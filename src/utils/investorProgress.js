// Investor Progress — month-over-month behavior surface.
//
// This module is a THIN CONSUMER of the Adaptive Learning Profile. Any card
// whose meaning is behavioral (Discipline, Preparation, Reflection) reads
// its interpretation directly from profile.traits.* — value, trajectory,
// confidence, and distribution. No behavioral counting or window bucketing
// happens here; that logic lives in adaptiveLearningProfile.js and is the
// single source of truth.
//
// Only STATE-metric cards (Diversification, Risk Management) still walk
// portfolio_snapshots here, because the Adaptive Learning Profile intentionally
// does not track position-count deltas or top-holding percentage deltas —
// riskComfort is stored as a categorical value with neutral polarity, which
// is a different level of granularity than "top holding was 80% → 40%".
//
// Every card is either:
//   (a) an "improvement" statement backed by a real signal from the profile
//       or a real snapshot delta, or
//   (b) an "opportunity" statement inviting the user to start a habit that
//       will unlock this card once the data exists.
//
// Never invents progress. Never criticizes. Never compares returns or account
// value — only investing behaviors and portfolio state.

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = 30 * DAY_MS;

function positionMarketValue(position) {
  if (!position) return 0;
  return Math.abs(Number(position.marketValue ?? position.market_value ?? 0));
}

// For each 30-day window, return the most recent snapshot inside it (or null).
// Used ONLY by state-metric cards (Diversification, Risk Management) — the
// profile handles all behavioral windowing internally.
function bucketSnapshots(snapshots, now) {
  const currentStart = now - WINDOW_MS;
  const priorStart = currentStart - WINDOW_MS;
  let latestCurrent = null;
  let latestPrior = null;
  for (const snap of snapshots || []) {
    const ts = Number(snap?.timestampMs);
    if (!Number.isFinite(ts)) continue;
    if (ts >= currentStart && ts < now) {
      if (!latestCurrent || ts > latestCurrent.timestampMs) latestCurrent = snap;
    } else if (ts >= priorStart && ts < currentStart) {
      if (!latestPrior || ts > latestPrior.timestampMs) latestPrior = snap;
    }
  }
  return { current: latestCurrent, prior: latestPrior };
}

// Any trait leaf with recorded evidence anywhere in the profile tells us the
// user is not a blank slate.
function hasAnyProfileEvidence(profile) {
  if (!profile?.traits) return false;
  for (const node of Object.values(profile.traits)) {
    if (Array.isArray(node?.evidence) && node.evidence.length > 0) return true;
    if (node && typeof node === "object") {
      for (const sub of Object.values(node)) {
        if (Array.isArray(sub?.evidence) && sub.evidence.length > 0) return true;
      }
    }
  }
  return false;
}

// ---- Behavioral cards (read profile directly) ------------------------------

// Discipline — surface the most confident improving warning trait, or an
// improving rule_following / calm_decision_making signal. All interpretation
// comes from the profile; no counting or window logic runs here.
function cardDiscipline(profile) {
  const em = profile?.traits?.emotionalPatterns || {};

  const warnings = [
    { key: "fear_of_missing_out", statement: "Fewer FOMO signals recorded than before." },
    { key: "revenge_trading", statement: "Fewer revenge-trading signals recorded than before." },
    { key: "analysis_paralysis", statement: "Less over-planning noise recently — clearer decisions coming through." },
  ];
  const strengths = [
    { key: "rule_following", positiveValue: "following", statement: "Rule adherence has been trending up recently." },
    { key: "calm_decision_making", positiveValue: "present", statement: "More calm decision-making recorded than before." },
  ];

  const improvements = [];
  for (const w of warnings) {
    const t = em[w.key];
    if (t?.trajectory === "improving") {
      improvements.push({ statement: w.statement, confidence: Number(t.confidence) || 0 });
    }
  }
  for (const s of strengths) {
    const t = em[s.key];
    if (t?.trajectory === "improving" && t.value === s.positiveValue) {
      improvements.push({ statement: s.statement, confidence: Number(t.confidence) || 0 });
    }
  }

  if (improvements.length > 0) {
    improvements.sort((a, b) => b.confidence - a.confidence);
    return { type: "improvement", category: "Discipline", statement: improvements[0].statement };
  }
  return {
    type: "opportunity",
    category: "Discipline",
    statement: "Tag emotions on your next trade to notice patterns in your entries.",
  };
}

// Preparation — reads profile.traits.preparation directly. Trajectory decides
// whether it's an improvement; distribution provides the specific share to
// mention. Falls back to opportunity when the profile lacks a clear signal.
function cardPreparation(profile) {
  const t = profile?.traits?.preparation;
  if (t?.trajectory === "improving") {
    const preparedShare = Number(t.distribution?.prepared);
    if (Number.isFinite(preparedShare) && preparedShare > 0) {
      const pct = Math.round(preparedShare * 100);
      return {
        type: "improvement",
        category: "Preparation",
        statement: `You planned ${pct}% of your recent trades — trending up.`,
      };
    }
    return {
      type: "improvement",
      category: "Preparation",
      statement: "You've been planning more trades ahead than before.",
    };
  }
  return {
    type: "opportunity",
    category: "Preparation",
    statement: "Log a plan before your next trade to build the habit.",
  };
}

// Reflection — reads profile.traits.reflection directly.
function cardReflection(profile) {
  const t = profile?.traits?.reflection;
  if (t?.trajectory === "improving") {
    return {
      type: "improvement",
      category: "Reflection",
      statement: "You've reflected on more decisions this month than before.",
    };
  }
  return {
    type: "opportunity",
    category: "Reflection",
    statement: "Add a lesson or outcome to a past decision to unlock personalized coaching.",
  };
}

// ---- State cards (snapshot-based; not in the profile) ----------------------

function cardDiversification(currentSnap, priorSnap) {
  const validArray = (snap) => (snap && Array.isArray(snap.positions) ? snap.positions : null);
  const currentPositions = validArray(currentSnap);
  const priorPositions = validArray(priorSnap);
  // Only fire improvement when we can confirm a real book at both endpoints.
  // A corrupted or missing prior positions field must never be interpreted as
  // "you had 0 positions" — that would fabricate a 0→N expansion story.
  if (currentPositions && priorPositions && priorPositions.length >= 1) {
    if (currentPositions.length > priorPositions.length) {
      return {
        type: "improvement",
        category: "Diversification",
        statement: `You expanded your book from ${priorPositions.length} to ${currentPositions.length} positions.`,
      };
    }
  }
  return {
    type: "opportunity",
    category: "Diversification",
    statement: "As you spread across more positions, this card will track your growth.",
  };
}

function cardRiskManagement(currentSnap, priorSnap) {
  if (currentSnap && priorSnap) {
    const cPositions = Array.isArray(currentSnap.positions) ? currentSnap.positions : [];
    const pPositions = Array.isArray(priorSnap.positions) ? priorSnap.positions : [];
    const cTotal = cPositions.reduce((s, p) => s + positionMarketValue(p), 0);
    const pTotal = pPositions.reduce((s, p) => s + positionMarketValue(p), 0);
    if (cTotal > 0 && pTotal > 0 && cPositions.length > 0 && pPositions.length > 0) {
      const cTop = cPositions.reduce((max, p) => (positionMarketValue(p) > positionMarketValue(max) ? p : max), cPositions[0]);
      const pTop = pPositions.reduce((max, p) => (positionMarketValue(p) > positionMarketValue(max) ? p : max), pPositions[0]);
      const cPct = (positionMarketValue(cTop) / cTotal) * 100;
      const pPct = (positionMarketValue(pTop) / pTotal) * 100;
      // Improvement when top concentration meaningfully decreased.
      if (cPct + 1 < pPct) {
        return {
          type: "improvement",
          category: "Risk Management",
          statement: `Your top position eased from ${pPct.toFixed(0)}% to ${cPct.toFixed(0)}% of the book — more balanced sizing.`,
        };
      }
    }
  }
  return {
    type: "opportunity",
    category: "Risk Management",
    statement: "As your position sizing evens out, this card will track your progress.",
  };
}

// ---- Public API ------------------------------------------------------------

// `profile` is an Adaptive Learning Profile derived from the user's ledger,
// trades, and portfolio snapshots. `portfolioSnapshots` is passed separately
// because the state-metric cards need raw snapshot arrays (position counts,
// concentration percentages) at a finer granularity than the profile stores.
export function computeInvestorProgress(
  { profile = null, portfolioSnapshots = [] } = {},
  { now = Date.now() } = {},
) {
  const hasProfileEvidence = hasAnyProfileEvidence(profile);
  const hasSnapshots = Array.isArray(portfolioSnapshots) && portfolioSnapshots.length > 0;

  if (!hasProfileEvidence && !hasSnapshots) {
    return {
      empty: true,
      emptyMessage: "You're just getting started. As you invest and journal, Rayla will begin tracking your growth as an investor.",
      cards: [],
    };
  }

  const bucketedSnapshots = bucketSnapshots(portfolioSnapshots, now);

  const cards = [
    cardDiscipline(profile),
    cardPreparation(profile),
    cardReflection(profile),
    cardDiversification(bucketedSnapshots.current, bucketedSnapshots.prior),
    cardRiskManagement(bucketedSnapshots.current, bucketedSnapshots.prior),
  ];

  return { empty: false, emptyMessage: "", cards };
}
