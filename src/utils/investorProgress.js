// Investor Progress — month-over-month behavior surface.
//
// This module is a THIN CONSUMER of the Adaptive Learning Profile. Any card
// whose meaning is behavioral (Discipline, Preparation, Reflection) reads
// its interpretation directly from profile.traits.* — value, trajectory,
// confidence, and distribution. No behavioral counting or window bucketing
// happens here; that logic lives in adaptiveLearningProfile.js and is the
// single source of truth.
//
// The Discipline card iterates warning-kind emotional patterns dynamically
// via getEmotionalPatternKeysByKind, so any new pattern added to the ALP
// automatically becomes a coaching signal here.
//
// Only STATE-metric cards (Diversification, Concentration) still walk
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

import { getEmotionalPatternKeysByKind } from "./adaptiveLearningProfile.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = 30 * DAY_MS;

// Human-friendly copy for known warning patterns. Any pattern the ALP knows
// about but that we haven't added copy for falls back to a generic template
// — the classification still flows through; the phrasing is just less polished.
const WARNING_TRAIT_IMPROVEMENT_COPY = {
  fear_of_missing_out: "You're becoming more patient. You've been chasing fewer moves recently. More of your decisions are happening because the opportunity fits instead of because the market moved first.",
  revenge_trading: "You've stopped chasing losses. The frustration that used to follow a bad trade isn't showing up in your entries as often.",
  analysis_paralysis: "You're spending less time weighing the same trade over and over. More of the plans you're logging are turning into actual trades.",
  fear_response: "Fewer of your recent decisions came from a place of worry. The tags that used to signal that mindset aren't showing up as often in your entries.",
  greed_driven: "You've been reaching for less than you used to. Fewer of your recent decisions are carrying the greed tag.",
  impulsive_action: "Fewer of your recent entries were snap decisions. The impulsive and reckless tags that used to appear more often are quieter now.",
  overconfidence: "Overconfident tags have been showing up less often in your recent decisions. The pattern that used to be there is quieter now.",
};

function improvementStatementForWarningKey(key) {
  if (WARNING_TRAIT_IMPROVEMENT_COPY[key]) return WARNING_TRAIT_IMPROVEMENT_COPY[key];
  const label = String(key || "").replace(/_/g, " ");
  return `You've been showing fewer ${label} signals lately. The pattern that used to be there is quieter than it was.`;
}

function positionMarketValue(position) {
  if (!position) return 0;
  return Math.abs(Number(position.marketValue ?? position.market_value ?? 0));
}

// For each 30-day window, return the most recent snapshot inside it (or null).
// Used ONLY by state-metric cards (Diversification, Concentration) — the
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
  const improvements = [];

  // Warning traits — iterate every warning pattern the ALP knows about.
  // Adding a new pattern in adaptiveLearningProfile.js automatically flows
  // through here without editing this file.
  for (const key of getEmotionalPatternKeysByKind("warning")) {
    const t = em[key];
    if (t?.trajectory === "improving") {
      improvements.push({
        statement: improvementStatementForWarningKey(key),
        confidence: Number(t.confidence) || 0,
      });
    }
  }

  // Strength / behavioral traits — kept explicit because their positive
  // statements are individually crafted and gated on a specific value.
  const strengths = [
    { key: "rule_following", positiveValue: "following", statement: "You've been following your rules more consistently. The moments that used to pull you away from your plan are showing up less often." },
    { key: "calm_decision_making", positiveValue: "present", statement: "You've been tagging more of your recent decisions as calm. That's a shift from what your entries used to look like." },
  ];
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
    statement: "Rayla starts reading discipline signals from her conversations with you around your trades. Give it a few of those.",
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
      // Distribution-present guard remains so this branch fires only when
      // there's real recent evidence to lean on; the copy itself never
      // references the exact share.
      return {
        type: "improvement",
        category: "Preparation",
        statement: "You're planning before acting more often. More of your recent trades had a plan behind them before execution.",
      };
    }
    return {
      type: "improvement",
      category: "Preparation",
      statement: "You're planning before acting more often. The plan is showing up before the trade now, not after.",
    };
  }
  return {
    type: "opportunity",
    category: "Preparation",
    statement: "This card starts showing your preparation habits once Rayla has a few of your trades to compare against.",
  };
}

// Reflection — reads profile.traits.reflection directly.
function cardReflection(profile) {
  const t = profile?.traits?.reflection;
  if (t?.trajectory === "improving") {
    return {
      type: "improvement",
      category: "Reflection",
      statement: "You've been going back to your decisions more often. More of them have a lesson or outcome on them than they used to.",
    };
  }
  return {
    type: "opportunity",
    category: "Reflection",
    statement: "When a trade closes, Rayla asks you what it taught you. This card starts filling in after a few of those conversations.",
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
        statement: `Your book grew from ${priorPositions.length} to ${currentPositions.length} positions over the last month. The weight of any single position on the total is smaller than it was.`,
      };
    }
  }
  return {
    type: "opportunity",
    category: "Diversification",
    statement: "As you add positions and build a broader book, you'll start to see the shape of that here.",
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
          category: "Concentration",
          statement: "Your largest holding takes up less of the book than it did a month ago. The rest of your positions are carrying more of the total than they were.",
        };
      }
    }
  }
  return {
    type: "opportunity",
    category: "Concentration",
    statement: "As your book spreads across more positions instead of sitting in one, you'll see that pattern reflected here.",
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
      emptyMessage: "You're just getting started. As you invest and Rayla learns from your trades, patterns start showing up in how you decide. This is where you'll see them.",
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
