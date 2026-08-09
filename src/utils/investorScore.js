// Investor Score — MVP scoring utility.
//
// Answers "how well is this user investing?" — a measure of BEHAVIOR, not
// portfolio performance. A user can lose money and still improve their score;
// a user can make money while their score declines. Every category returns a
// 0-100 score OR the sentinel "Building" when the user has not yet generated
// enough recorded evidence for that category to be judged.
//
// ARCHITECTURE
// ------------
// This module is a THIN CONSUMER of the Adaptive Learning Profile. Any score
// whose meaning is behavioral (Discipline, Preparation, Reflection) reads
// counts directly from `profile.traits.*.evidence`. Emotion-tag classification
// is NOT duplicated here — it lives in the Adaptive Learning Profile's
// EMOTION_TAG_MAP and flows through automatically. No behavioral counting or
// window bucketing over raw ledger rows happens here.
//
// The set of "warning" emotional patterns is looked up dynamically from the
// ALP via getEmotionalPatternKeysByKind("warning"), so new patterns added to
// the ALP flow into Discipline without any change here.
//
// Only STATE-metric scores (Risk Management, Diversification) still read raw
// positions, because the Adaptive Learning Profile stores riskComfort as a
// categorical value with neutral polarity — that is a different granularity
// than "top holding is 42% of the book across 6 positions."
//
// Every explanation references an actual recorded count. No inferred data.

import { getEmotionalPatternKeysByKind } from "./adaptiveLearningProfile.js";

export const STATUS_BUILDING = "Building";

const STATUS_THRESHOLDS = [
  { min: 81, label: "Excellent" },
  { min: 61, label: "Strong" },
  { min: 41, label: "Improving" },
  { min: 0, label: "Developing" },
];

const SCORE_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

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

function positionMarketValue(position) {
  if (!position) return 0;
  return Math.abs(Number(position.marketValue ?? position.market_value ?? 0));
}

// ---------------------------------------------------------------------------
// Adaptive Learning Profile evidence readers
// ---------------------------------------------------------------------------
// The ALP already applies emotion-tag classification, plan/trade correlation,
// and reflection-source tagging. These helpers read the classified evidence
// filtered to the same 30-day window the score reports.

function countRecentEvidenceWithValue(trait, value, { nowMs = Date.now(), windowDays = SCORE_WINDOW_DAYS } = {}) {
  if (!trait || !Array.isArray(trait.evidence)) return 0;
  const cutoff = nowMs - windowDays * DAY_MS;
  let count = 0;
  for (const ev of trait.evidence) {
    if (ev.value !== value) continue;
    const t = Date.parse(ev.observed_at);
    if (Number.isFinite(t) && t >= cutoff) count += 1;
  }
  return count;
}

function countRecentEvidenceBySource(trait, source, { nowMs = Date.now(), windowDays = SCORE_WINDOW_DAYS } = {}) {
  if (!trait || !Array.isArray(trait.evidence)) return 0;
  const cutoff = nowMs - windowDays * DAY_MS;
  let count = 0;
  for (const ev of trait.evidence) {
    if (ev.source !== source) continue;
    const t = Date.parse(ev.observed_at);
    if (Number.isFinite(t) && t >= cutoff) count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Discipline
// ---------------------------------------------------------------------------
// Start at 100; subtract for recorded rule breaks and self-tagged negative
// emotions. Reads directly from the Adaptive Learning Profile's warning
// traits and rule_following trait — no local emotion classifier. The set of
// tags treated as "negative" is owned by the ALP (EMOTION_TAG_MAP).
export function scoreDiscipline(profile) {
  const em = profile?.traits?.emotionalPatterns;
  if (!em) {
    return {
      score: null,
      status: STATUS_BUILDING,
      reason: "This score fills in as Rayla and you talk through your trades.",
    };
  }

  // Warning-trait evidence in the last 30d = "negative emotion tag" count.
  // We iterate over every warning-kind emotional pattern the ALP knows about
  // (fear_of_missing_out, revenge_trading, fear_response, greed_driven,
  // impulsive_action, analysis_paralysis, overconfidence, ...) and count
  // observations whose source is a self-tag. Derived signals like
  // analysis_paralysis (source: ledger.plans_vs_trades) are naturally
  // excluded by the source filter — this score has always been about tags.
  const warningKeys = getEmotionalPatternKeysByKind("warning");
  const negativeEmotionCount = warningKeys.reduce(
    (sum, key) => sum + countRecentEvidenceBySource(em[key], "ledger.emotion_tag"),
    0,
  );

  const brokenCount = countRecentEvidenceWithValue(em.rule_following, "not_following");
  const followedCount = countRecentEvidenceWithValue(em.rule_following, "following");

  // Any recorded emotion tag (positive or negative) OR any rule check makes
  // this a scored category. Calm signals count as evidence the user is
  // engaging with the tag surface even when they don't move the score down.
  const totalRuleChecks = brokenCount + followedCount;
  const totalEmotionEvidence = negativeEmotionCount
    + countRecentEvidenceBySource(em.calm_decision_making, "ledger.emotion_tag");

  if (totalRuleChecks === 0 && totalEmotionEvidence === 0) {
    return {
      score: null,
      status: STATUS_BUILDING,
      reason: "This score fills in as Rayla and you talk through your trades.",
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
// Risk Management  (state metric — NOT in the profile)
// ---------------------------------------------------------------------------
// Uses one signal Rayla actually records reliably: portfolio concentration —
// what share of the book sits in the single largest holding. Per-trade stop
// prices are not stored, so no stop-discipline signal is emitted (we do not
// invent a proxy such as R-multiple thresholds).
//
// This score is intentionally NOT read from profile.traits.riskComfort:
// the ALP stores riskComfort as a categorical value (concentrated / balanced
// / diversified) with neutral polarity. That is coarser than the numeric
// concentration percentage this score needs, and the profile has no ordering
// over the categories.
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
// Diversification  (state metric — NOT in the profile)
// ---------------------------------------------------------------------------
// Breadth (count of open positions) with a concentration penalty on the top
// holding. Does NOT judge whether the holdings are "good" — only whether the
// book is spread across enough distinct positions.
//
// Not read from profile.traits.riskComfort for the same reason as Risk
// Management: the profile records categorical position mix, not the numeric
// count-based breadth formula this score uses.
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
// Measures the behavior of planning BEFORE trading. Reads directly from
// profile.traits.preparation.evidence, which the ALP populates with one
// observation per manual trade in the last 180 days — value "prepared" when
// a plan entry precedes the trade within 72h, "unprepared" otherwise.
//
// Building if fewer than 3 trade observations exist in the last 30 days.
export function scorePreparation(profile) {
  const p = profile?.traits?.preparation;
  if (!p) {
    return {
      score: null,
      status: STATUS_BUILDING,
      reason: `Log at least 3 trades in the last ${SCORE_WINDOW_DAYS} days to unlock this score.`,
    };
  }

  const preparedCount = countRecentEvidenceWithValue(p, "prepared");
  const unpreparedCount = countRecentEvidenceWithValue(p, "unprepared");
  const totalTrades = preparedCount + unpreparedCount;

  if (totalTrades < 3) {
    return {
      score: null,
      status: STATUS_BUILDING,
      reason: `Log at least 3 trades in the last ${SCORE_WINDOW_DAYS} days to unlock this score.`,
    };
  }

  const score = clamp(Math.round((preparedCount / totalTrades) * 100), 0, 100);
  const reason = `${preparedCount} of ${totalTrades} trade${totalTrades === 1 ? "" : "s"} in the last ${SCORE_WINDOW_DAYS} days had a plan logged within 72 hours before entry.`;
  return { score, status: statusForScore(score), reason };
}

// ---------------------------------------------------------------------------
// Reflection
// ---------------------------------------------------------------------------
// Rewards learning artifacts recorded in the ledger. Reads directly from
// profile.traits.reflection.evidence, split by source so the weighting per
// artifact type is preserved:
//   - ledger.reflection_entry  (reflection-type ledger entry)  × 12
//   - ledger.lesson_recorded   (entry with a lesson field)     × 12
//   - ledger.outcome_tracked   (entry with an outcome field)   × 8
export function scoreReflection(profile) {
  const t = profile?.traits?.reflection;
  if (!t) {
    return {
      score: null,
      status: STATUS_BUILDING,
      reason: "Rayla asks what each trade taught you when it closes. Once a few of those are in, this score starts moving.",
    };
  }

  const reflectionCount = countRecentEvidenceBySource(t, "ledger.reflection_entry");
  const lessonCount = countRecentEvidenceBySource(t, "ledger.lesson_recorded");
  const outcomeCount = countRecentEvidenceBySource(t, "ledger.outcome_tracked");

  if (reflectionCount === 0 && lessonCount === 0 && outcomeCount === 0) {
    return {
      score: null,
      status: STATUS_BUILDING,
      reason: "Rayla asks what each trade taught you when it closes. Once a few of those are in, this score starts moving.",
    };
  }

  const score = clamp(
    Math.round(reflectionCount * 12 + lessonCount * 12 + outcomeCount * 8),
    0,
    100,
  );
  const parts = [];
  if (reflectionCount > 0) parts.push(`${reflectionCount} reflection entr${reflectionCount === 1 ? "y" : "ies"}`);
  if (lessonCount > 0) parts.push(`${lessonCount} lesson${lessonCount === 1 ? "" : "s"} recorded`);
  if (outcomeCount > 0) parts.push(`${outcomeCount} outcome${outcomeCount === 1 ? "" : "s"} tracked`);
  const reason = `${parts.join(", ")} in the last ${SCORE_WINDOW_DAYS} days.`;
  return { score, status: statusForScore(score), reason };
}

// ---------------------------------------------------------------------------
// Overall
// ---------------------------------------------------------------------------
// `profile` is an Adaptive Learning Profile (see adaptiveLearningProfile.js).
// `positions` is passed separately because the state-metric scores need raw
// position arrays at a finer granularity than the profile stores.
export function computeInvestorScore({ profile = null, positions = [] } = {}) {
  const categories = {
    discipline: scoreDiscipline(profile),
    riskManagement: scoreRiskManagement({ positions }),
    diversification: scoreDiversification(positions),
    preparation: scorePreparation(profile),
    reflection: scoreReflection(profile),
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
