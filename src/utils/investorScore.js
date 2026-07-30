// Investor Score — MVP scoring utility.
//
// Answers "how well is this user investing?" — a measure of BEHAVIOR, not
// portfolio performance. A user can lose money and still improve their score;
// a user can make money while their score declines. Every category returns a
// 0-100 score OR the sentinel "Building" when the user has not yet generated
// enough recorded evidence for that category to be judged.
//
// No inferred data, no invented behaviors. Every explanation references a
// count that exists in the source data.

export const STATUS_BUILDING = "Building";

// Negative emotion tags the user typed themselves on decision_ledger_entries.
// We only look at values the user actually wrote — no inference.
export const NEGATIVE_EMOTION_TAGS = new Set([
  "fomo",
  "chase",
  "chasing",
  "panic",
  "revenge",
  "anger",
  "greed",
  "fear",
  "anxious",
  "anxiety",
  "impulsive",
  "reckless",
]);

const STATUS_THRESHOLDS = [
  { min: 81, label: "Excellent" },
  { min: 61, label: "Strong" },
  { min: 41, label: "Improving" },
  { min: 0, label: "Developing" },
];

const SCORE_WINDOW_DAYS = 30;

export function statusForScore(score) {
  if (typeof score !== "number" || Number.isNaN(score)) return STATUS_BUILDING;
  for (const t of STATUS_THRESHOLDS) {
    if (score >= t.min) return t.label;
  }
  return "Developing";
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function positionMarketValue(position) {
  if (!position) return 0;
  return Math.abs(Number(position.marketValue ?? position.market_value ?? 0));
}

export function filterLedgerToWindow(ledger, days = SCORE_WINDOW_DAYS) {
  if (!Array.isArray(ledger)) return [];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return ledger.filter((entry) => {
    const t = entry?.created_at ? Date.parse(entry.created_at) : NaN;
    return Number.isFinite(t) && t >= cutoff;
  });
}

// ---------------------------------------------------------------------------
// Discipline
// ---------------------------------------------------------------------------
// Start at 100; subtract for recorded rule breaks and self-tagged negative
// emotions. We never infer either signal — they must come from a real ledger
// row the user wrote.
export function scoreDiscipline(ledger) {
  const scoped = filterLedgerToWindow(ledger);
  const ruleChecks = scoped.filter((e) => e?.entry_type === "rule_check");
  const brokenCount = ruleChecks.filter((e) => e.rule_followed === false).length;
  const followedCount = ruleChecks.filter((e) => e.rule_followed === true).length;
  const emotionEntries = scoped.filter((e) => isNonEmptyString(e?.emotion));
  const negativeEmotionCount = emotionEntries.filter((e) =>
    NEGATIVE_EMOTION_TAGS.has(e.emotion.trim().toLowerCase()),
  ).length;

  if (ruleChecks.length === 0 && emotionEntries.length === 0) {
    return {
      score: null,
      status: STATUS_BUILDING,
      reason: "Log a rule check or tag an emotion on a decision to unlock this score.",
    };
  }

  const score = clamp(100 - brokenCount * 8 - negativeEmotionCount * 6, 0, 100);
  const parts = [];
  if (brokenCount > 0) parts.push(`${brokenCount} recorded rule break${brokenCount === 1 ? "" : "s"}`);
  if (negativeEmotionCount > 0) {
    parts.push(`${negativeEmotionCount} emotional trade tag${negativeEmotionCount === 1 ? "" : "s"}`);
  }
  const reason = parts.length === 0
    ? `${followedCount} rule check${followedCount === 1 ? "" : "s"} passed; no rule breaks or emotional tags in the last ${SCORE_WINDOW_DAYS} days.`
    : `Reduced by ${parts.join(" and ")}.`;
  return { score, status: statusForScore(score), reason };
}

// ---------------------------------------------------------------------------
// Risk Management
// ---------------------------------------------------------------------------
// Uses one signal Rayla actually records reliably: portfolio concentration —
// what share of the book sits in the single largest holding. Per-trade stop
// prices are not stored, so no stop-discipline signal is emitted (we do not
// invent a proxy such as R-multiple thresholds).
export function scoreRiskManagement({ positions = [] } = {}) {
  const openPositions = (Array.isArray(positions) ? positions : []).filter(
    (p) => positionMarketValue(p) > 0,
  );
  if (openPositions.length === 0) {
    return {
      score: null,
      status: STATUS_BUILDING,
      reason: "Add an open position to unlock this score.",
    };
  }

  const total = openPositions.reduce((s, p) => s + positionMarketValue(p), 0);
  if (total <= 0) {
    return {
      score: null,
      status: STATUS_BUILDING,
      reason: "Add an open position to unlock this score.",
    };
  }
  const sorted = [...openPositions].sort(
    (a, b) => positionMarketValue(b) - positionMarketValue(a),
  );
  const topPct = (positionMarketValue(sorted[0]) / total) * 100;

  let score = 100;
  if (topPct > 50) score -= 40;
  else if (topPct > 35) score -= 25;
  else if (topPct > 25) score -= 15;
  else if (topPct > 15) score -= 5;
  score = clamp(score, 0, 100);

  const reason = `Top holding is ${topPct.toFixed(0)}% of the book across ${openPositions.length} position${openPositions.length === 1 ? "" : "s"}.`;
  return { score, status: statusForScore(score), reason };
}

// ---------------------------------------------------------------------------
// Diversification
// ---------------------------------------------------------------------------
// Breadth (count of open positions) with a concentration penalty on the top
// holding. Does NOT judge whether the holdings are "good" — only whether the
// book is spread across enough distinct positions.
export function scoreDiversification(positions = []) {
  const list = (Array.isArray(positions) ? positions : []).filter(
    (p) => positionMarketValue(p) > 0,
  );
  if (list.length === 0) {
    return {
      score: null,
      status: STATUS_BUILDING,
      reason: "Diversification will unlock once you have open positions.",
    };
  }
  const total = list.reduce((s, p) => s + positionMarketValue(p), 0);
  const sorted = [...list].sort((a, b) => positionMarketValue(b) - positionMarketValue(a));
  const topPct = total > 0 ? (positionMarketValue(sorted[0]) / total) * 100 : 0;
  const count = list.length;

  const breadthScore = Math.min(100, count * 12.5);
  let concentrationAdjust = 0;
  if (topPct > 40) concentrationAdjust = -25;
  else if (topPct > 25) concentrationAdjust = -10;

  const score = clamp(Math.round(breadthScore + concentrationAdjust), 0, 100);
  const reason = `You hold ${count} position${count === 1 ? "" : "s"}; top position is ${topPct.toFixed(0)}% of the book.`;
  return { score, status: statusForScore(score), reason };
}

// ---------------------------------------------------------------------------
// Preparation
// ---------------------------------------------------------------------------
// Measures the behavior of planning BEFORE trading — the fraction of manual
// trades in the window that were preceded by a `plan` ledger entry with the
// same symbol within 72h. Plan entries are used only as a linkage signal,
// never rewarded standalone. Field length is not scored anywhere.
// Building if fewer than 3 manual trades exist in the window (we do not
// invent a preparation signal from unrelated activity).
export function scorePreparation({ ledger = [], trades = [] } = {}) {
  const scopedLedger = filterLedgerToWindow(ledger);
  const plans = scopedLedger.filter((e) => e?.entry_type === "plan");
  const cutoffMs = Date.now() - SCORE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const scopedTrades = (Array.isArray(trades) ? trades : []).filter((t) => {
    const ts = t?.entry_time ? Date.parse(t.entry_time) : NaN;
    return Number.isFinite(ts) && ts >= cutoffMs;
  });

  if (scopedTrades.length < 3) {
    return {
      score: null,
      status: STATUS_BUILDING,
      reason: `Log at least 3 trades in the last ${SCORE_WINDOW_DAYS} days to unlock this score.`,
    };
  }

  let plannedCount = 0;
  for (const trade of scopedTrades) {
    const asset = String(trade.asset || "").trim().toUpperCase();
    const tradeMs = Date.parse(trade.entry_time);
    if (!asset || !Number.isFinite(tradeMs)) continue;
    const matched = plans.some((plan) => {
      const planSymbol = String(plan.symbol || "").trim().toUpperCase();
      if (planSymbol !== asset) return false;
      const planMs = plan.created_at ? Date.parse(plan.created_at) : NaN;
      if (!Number.isFinite(planMs)) return false;
      const dt = tradeMs - planMs;
      return dt >= 0 && dt <= 72 * 60 * 60 * 1000;
    });
    if (matched) plannedCount += 1;
  }

  const score = clamp(Math.round((plannedCount / scopedTrades.length) * 100), 0, 100);
  const reason = `${plannedCount} of ${scopedTrades.length} trade${scopedTrades.length === 1 ? "" : "s"} in the last ${SCORE_WINDOW_DAYS} days had a plan logged within 72 hours before entry.`;
  return { score, status: statusForScore(score), reason };
}

// ---------------------------------------------------------------------------
// Reflection
// ---------------------------------------------------------------------------
// Rewards learning artifacts: reflection entries, recorded lessons, and
// tracked outcomes. Measures whether the user is closing the loop on past
// decisions, not whether those decisions were profitable.
export function scoreReflection(ledger) {
  const scoped = filterLedgerToWindow(ledger);
  const reflectionEntries = scoped.filter((e) => e?.entry_type === "reflection").length;
  const withLesson = scoped.filter((e) => isNonEmptyString(e?.lesson)).length;
  const withOutcome = scoped.filter((e) => isNonEmptyString(e?.outcome)).length;

  if (reflectionEntries === 0 && withLesson === 0 && withOutcome === 0) {
    return {
      score: null,
      status: STATUS_BUILDING,
      reason: "Write a reflection entry or add a lesson to a decision to unlock this score.",
    };
  }

  const score = clamp(
    Math.round(reflectionEntries * 12 + withLesson * 12 + withOutcome * 8),
    0,
    100,
  );
  const parts = [];
  if (reflectionEntries > 0) parts.push(`${reflectionEntries} reflection entr${reflectionEntries === 1 ? "y" : "ies"}`);
  if (withLesson > 0) parts.push(`${withLesson} lesson${withLesson === 1 ? "" : "s"} recorded`);
  if (withOutcome > 0) parts.push(`${withOutcome} outcome${withOutcome === 1 ? "" : "s"} tracked`);
  const reason = `${parts.join(", ")} in the last ${SCORE_WINDOW_DAYS} days.`;
  return { score, status: statusForScore(score), reason };
}

// ---------------------------------------------------------------------------
// Overall
// ---------------------------------------------------------------------------
export function computeInvestorScore({ ledger = [], trades = [], positions = [] } = {}) {
  const categories = {
    discipline: scoreDiscipline(ledger),
    riskManagement: scoreRiskManagement({ positions }),
    diversification: scoreDiversification(positions),
    preparation: scorePreparation({ ledger, trades }),
    reflection: scoreReflection(ledger),
  };
  const scored = Object.values(categories).filter((c) => typeof c.score === "number");
  if (scored.length === 0) {
    return {
      overall: null,
      status: STATUS_BUILDING,
      categories,
      completedCount: 0,
    };
  }
  const overall = Math.round(scored.reduce((s, c) => s + c.score, 0) / scored.length);
  return {
    overall,
    status: statusForScore(overall),
    categories,
    completedCount: scored.length,
  };
}

export const CATEGORY_ORDER = [
  { key: "discipline", label: "Discipline" },
  { key: "riskManagement", label: "Risk Management" },
  { key: "diversification", label: "Diversification" },
  { key: "preparation", label: "Preparation" },
  { key: "reflection", label: "Reflection" },
];
