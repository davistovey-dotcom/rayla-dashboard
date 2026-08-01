// Adaptive Learning Profile — Rayla's long-term memory of WHO the investor
// is becoming.
//
// PHILOSOPHY
// ----------
// Every interaction should help Rayla understand the investor better AND help
// the investor become a better investor. This module stores that
// understanding as a set of probabilistic behavioral traits. Nothing is
// permanent, nothing is invented; every stored belief traces back to a real,
// timestamped user behavior recorded in the app.
//
// TRAITS
// ------
// Each trait has:
//   value:              a categorical label (e.g. "prepared") or null when unknown
//   confidence:         probability in [0,1] — how much evidence supports the label
//   stability:          recency-weighted fraction of evidence agreeing with `value`
//   trajectory:         "improving" | "stable" | "declining" | "new" | null
//                       null when the trait has neutral polarity (no better direction)
//   distribution:       object mapping every observed value to its recency-weighted share
//   previousValue:      the trait's value BEFORE the most recent transition (or null)
//   previousConfidence: the trait's confidence at that same prior moment
//   firstObserved:      ISO timestamp of the earliest evidence in the trait
//   lastUpdated:        ISO timestamp of the last change
//   evidence:           an ordered list of recent observations (capped)
//
// Traits automatically STRENGTHEN with fresh matching evidence, WEAKEN as
// evidence ages (30-day half-life), and DISAPPEAR (value → null) when
// confidence falls below CONFIDENCE_MIN_STRENGTH. If behavior changes, the
// dominant weighted value changes with it — the profile is never a permanent
// label.
//
// TRAIT METADATA
// --------------
// TRAIT_METADATA describes each trait's `kind`, its known `labels`, and the
// polarity of each label. Consumers should read polarity from metadata rather
// than hardcoding interpretation. Traits with `polarity: "neutral"` do NOT
// emit a trajectory — because "concentrated" is not universally better or
// worse than "diversified"; it depends on the investor's own intent.
//
// USES
// ----
// This module is designed to be consumed by every AI feature in Rayla
// (Investor Score, Progress, Monthly Reviews, Ask Rayla, coaching,
// notifications, adaptive onboarding). It is NOT integrated into the UI in
// this pass — the intelligence layer stands alone.
//
// NON-GOALS
// ---------
// - Does not judge whether investment choices are "good."
// - Does not invent behaviors. If evidence is absent, the trait stays null.
// - Does not produce natural-language summaries; consumers do that.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// v2 added stability, trajectory, distribution, previousValue,
// previousConfidence, firstObserved, and TRAIT_METADATA.
// v3 expanded EMOTION_TAG_MAP to include panic, fear, anxious, anxiety,
// greed, impulsive, reckless — routed to three new emotional patterns
// (fear_response, greed_driven, impulsive_action). Older profiles are not
// upgraded in place — deserializeProfile returns null for older versions,
// forcing a rebuild via deriveProfileFromData.
export const PROFILE_SCHEMA_VERSION = 3;

// Evidence loses ~50% of its weight every 30 days. Older observations still
// contribute, but new behavior dominates. This is the mechanism by which
// traits WEAKEN naturally.
export const EVIDENCE_HALF_LIFE_DAYS = 30;

// Per-trait cap on stored observations. Keeps profile bounded regardless of
// how much a user journals. Oldest evicted first when the cap is exceeded.
export const EVIDENCE_CAP_PER_TRAIT = 24;

// Confidence below this makes a trait DISAPPEAR — value is nulled out. Guards
// against thin/stale evidence producing a false-strong label.
export const CONFIDENCE_MIN_STRENGTH = 0.15;

// Number of recent full-weight observations needed to reach confidence 1.0.
// Lower calibration → higher confidence per observation.
export const CONFIDENCE_CALIBRATION = 5;

// Trait registry — top-level trait keys.
export const TRAIT_KEYS = Object.freeze({
  CURIOSITY: "curiosity",
  PREPARATION: "preparation",
  REFLECTION: "reflection",
  PATIENCE: "patience",
  RISK_COMFORT: "riskComfort",
  DECISION_STYLE: "decisionStyle",
  LEARNING_STYLE: "learningStyle",
  CONFIDENCE_TREND: "confidenceTrend",
});

// Emotional pattern registry — sub-traits under traits.emotionalPatterns.
export const EMOTIONAL_PATTERN_KEYS = Object.freeze({
  FEAR_OF_MISSING_OUT: "fear_of_missing_out",
  REVENGE_TRADING: "revenge_trading",
  FEAR_RESPONSE: "fear_response",
  GREED_DRIVEN: "greed_driven",
  IMPULSIVE_ACTION: "impulsive_action",
  OVERCONFIDENCE: "overconfidence",
  ANALYSIS_PARALYSIS: "analysis_paralysis",
  CALM_DECISION_MAKING: "calm_decision_making",
  RULE_FOLLOWING: "rule_following",
});

export const RISK_COMFORT_LEVELS = Object.freeze({
  CONCENTRATED: "concentrated",
  BALANCED: "balanced",
  DIVERSIFIED: "diversified",
});

export const DECISION_STYLES = Object.freeze({
  RESEARCH_DRIVEN: "research-driven",
  THEME_DRIVEN: "theme-driven",
  MOMENTUM_DRIVEN: "momentum-driven",
  INCOME_FOCUSED: "income-focused",
  LONG_TERM: "long-term",
  SHORT_TERM: "short-term",
});

export const CONFIDENCE_TRENDS = Object.freeze({
  INCREASING: "increasing",
  STABLE: "stable",
  DECREASING: "decreasing",
});

// Polarity vocabulary. Only traits with polarity="directional" emit a
// non-null trajectory. Neutral and descriptive traits leave trajectory null
// so consumers cannot accidentally treat them as evaluative.
export const TRAIT_POLARITIES = Object.freeze({
  DIRECTIONAL: "directional", // labels carry meaningful +/− weight
  NEUTRAL: "neutral",         // labels have no universal ordering
  DESCRIPTIVE: "descriptive", // labels describe movement, not quality
});

// Trait taxonomy. Consumers should read polarity and labels from here
// rather than hardcoding interpretation. Keys use dotted paths matching
// getTraitByPath (e.g. "emotionalPatterns.fear_of_missing_out").
export const TRAIT_METADATA = Object.freeze({
  curiosity: {
    kind: "behavioral",
    labels: { inquisitive: +1 },
    polarity: TRAIT_POLARITIES.DIRECTIONAL,
  },
  preparation: {
    kind: "behavioral",
    labels: { prepared: +1, unprepared: -1 },
    polarity: TRAIT_POLARITIES.DIRECTIONAL,
  },
  reflection: {
    kind: "behavioral",
    labels: { reflective: +1 },
    polarity: TRAIT_POLARITIES.DIRECTIONAL,
  },
  patience: {
    kind: "behavioral",
    labels: { patient: +1, impulsive: -1 },
    polarity: TRAIT_POLARITIES.DIRECTIONAL,
  },
  riskComfort: {
    kind: "state",
    labels: { concentrated: 0, balanced: 0, diversified: 0 },
    polarity: TRAIT_POLARITIES.NEUTRAL,
  },
  decisionStyle: {
    kind: "state",
    labels: {
      "long-term": 0,
      "short-term": 0,
      "research-driven": 0,
      "theme-driven": 0,
      "momentum-driven": 0,
      "income-focused": 0,
    },
    polarity: TRAIT_POLARITIES.NEUTRAL,
  },
  learningStyle: {
    kind: "state",
    labels: {},
    polarity: TRAIT_POLARITIES.NEUTRAL,
  },
  confidenceTrend: {
    kind: "meta",
    labels: { increasing: 0, stable: 0, decreasing: 0 },
    polarity: TRAIT_POLARITIES.DESCRIPTIVE,
  },
  "emotionalPatterns.fear_of_missing_out": {
    kind: "warning",
    labels: { present: -1 },
    polarity: TRAIT_POLARITIES.DIRECTIONAL,
  },
  "emotionalPatterns.revenge_trading": {
    kind: "warning",
    labels: { present: -1 },
    polarity: TRAIT_POLARITIES.DIRECTIONAL,
  },
  "emotionalPatterns.fear_response": {
    kind: "warning",
    labels: { present: -1 },
    polarity: TRAIT_POLARITIES.DIRECTIONAL,
  },
  "emotionalPatterns.greed_driven": {
    kind: "warning",
    labels: { present: -1 },
    polarity: TRAIT_POLARITIES.DIRECTIONAL,
  },
  "emotionalPatterns.impulsive_action": {
    kind: "warning",
    labels: { present: -1 },
    polarity: TRAIT_POLARITIES.DIRECTIONAL,
  },
  "emotionalPatterns.overconfidence": {
    kind: "warning",
    labels: { present: -1 },
    polarity: TRAIT_POLARITIES.DIRECTIONAL,
  },
  "emotionalPatterns.analysis_paralysis": {
    kind: "warning",
    labels: { present: -1 },
    polarity: TRAIT_POLARITIES.DIRECTIONAL,
  },
  "emotionalPatterns.calm_decision_making": {
    kind: "strength",
    labels: { present: +1 },
    polarity: TRAIT_POLARITIES.DIRECTIONAL,
  },
  "emotionalPatterns.rule_following": {
    kind: "behavioral",
    labels: { following: +1, not_following: -1 },
    polarity: TRAIT_POLARITIES.DIRECTIONAL,
  },
});

export function getTraitMetadata(path) {
  return TRAIT_METADATA[path] || null;
}

// Returns the RELATIVE emotional-pattern keys (e.g. "fear_of_missing_out")
// whose metadata.kind matches the given kind. Consumers use this so they
// automatically pick up new emotional patterns without hardcoding a list.
// Example: getEmotionalPatternKeysByKind("warning") returns every negative
// emotion trait so consumers can iterate warning traits generically.
export function getEmotionalPatternKeysByKind(kind) {
  const prefix = "emotionalPatterns.";
  const out = [];
  for (const [path, meta] of Object.entries(TRAIT_METADATA)) {
    if (!path.startsWith(prefix)) continue;
    if (meta?.kind !== kind) continue;
    out.push(path.slice(prefix.length));
  }
  return out;
}

// Emotion tag → pattern mapping. Only tags the user actually typed on a
// decision ledger entry drive these. No inference, no free-text parsing.
// Each tag is routed to exactly one pattern; a tag string must be listed
// under a single key to avoid overlapping classifications.
const EMOTION_TAG_MAP = Object.freeze({
  fear_of_missing_out: new Set(["fomo", "chase", "chasing"]),
  revenge_trading: new Set(["revenge", "anger"]),
  // Fear/flight cluster — sudden or persistent worry driving the decision.
  fear_response: new Set(["panic", "fear", "anxious", "anxiety"]),
  // Desire for excess gain, distinct from FOMO's "missing out" framing.
  greed_driven: new Set(["greed"]),
  // Acting without deliberation or disregarding risk, broader than FOMO.
  impulsive_action: new Set(["impulsive", "reckless"]),
  calm_decision_making: new Set(["calm", "patient", "disciplined", "focused", "steady"]),
});

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const PLAN_TRADE_LOOKBACK_MS = 72 * HOUR_MS;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function isNonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function positionMarketValue(p) {
  if (!p) return 0;
  return Math.abs(Number(p.marketValue ?? p.market_value ?? 0));
}

function recencyFactor(observedAtMs, nowMs) {
  if (!Number.isFinite(observedAtMs)) return 0;
  const ageMs = Math.max(0, nowMs - observedAtMs);
  const halfLifeMs = EVIDENCE_HALF_LIFE_DAYS * DAY_MS;
  return Math.pow(0.5, ageMs / halfLifeMs);
}

function computeConfidence(evidence, nowMs) {
  if (!Array.isArray(evidence) || evidence.length === 0) return 0;
  let weighted = 0;
  for (const ev of evidence) {
    const t = Date.parse(ev.observed_at);
    if (!Number.isFinite(t)) continue;
    const w = Number(ev.weight);
    if (!Number.isFinite(w)) continue;
    weighted += w * recencyFactor(t, nowMs);
  }
  return clamp(weighted / CONFIDENCE_CALIBRATION, 0, 1);
}

function dominantValue(evidence, nowMs) {
  if (!Array.isArray(evidence) || evidence.length === 0) return null;
  const scores = new Map();
  for (const ev of evidence) {
    if (ev.value == null) continue;
    const t = Date.parse(ev.observed_at);
    if (!Number.isFinite(t)) continue;
    const w = (Number(ev.weight) || 0) * recencyFactor(t, nowMs);
    if (w <= 0) continue;
    const val = String(ev.value);
    scores.set(val, (scores.get(val) || 0) + w);
  }
  if (scores.size === 0) return null;
  let bestValue = null;
  let bestScore = -Infinity;
  for (const [key, score] of scores) {
    if (score > bestScore) {
      bestValue = key;
      bestScore = score;
    }
  }
  return bestValue;
}

function emptyTrait() {
  return {
    value: null,
    confidence: 0,
    stability: 0,
    trajectory: null,
    distribution: {},
    previousValue: null,
    previousConfidence: 0,
    firstObserved: null,
    lastUpdated: null,
    evidence: [],
  };
}

// Recency-weighted fraction of evidence that agrees with `dominant`. Range
// [0, 1]. 1.0 means every recent observation shares the current label; 0.5
// means the trait is split evenly; near 0 means the current label barely
// wins. Distinct from confidence, which measures MAGNITUDE of evidence.
function computeStability(evidence, dominant, nowMs) {
  if (!Array.isArray(evidence) || evidence.length === 0 || dominant == null) return 0;
  let matchWeight = 0;
  let totalWeight = 0;
  for (const ev of evidence) {
    if (ev.value == null) continue;
    const t = Date.parse(ev.observed_at);
    if (!Number.isFinite(t)) continue;
    const w = (Number(ev.weight) || 0) * recencyFactor(t, nowMs);
    if (w <= 0) continue;
    totalWeight += w;
    if (String(ev.value) === String(dominant)) matchWeight += w;
  }
  return totalWeight > 0 ? clamp(matchWeight / totalWeight, 0, 1) : 0;
}

// Recency-weighted share for every value that ever appeared in the evidence.
// Consumers can decide whether to threshold, sort, or ignore rare values.
// Returns an empty object when there is no valid evidence.
function computeDistribution(evidence, nowMs) {
  if (!Array.isArray(evidence) || evidence.length === 0) return {};
  const scores = new Map();
  let totalWeight = 0;
  for (const ev of evidence) {
    if (ev.value == null) continue;
    const t = Date.parse(ev.observed_at);
    if (!Number.isFinite(t)) continue;
    const w = (Number(ev.weight) || 0) * recencyFactor(t, nowMs);
    if (w <= 0) continue;
    totalWeight += w;
    const val = String(ev.value);
    scores.set(val, (scores.get(val) || 0) + w);
  }
  if (totalWeight <= 0) return {};
  const dist = {};
  for (const [val, w] of scores) {
    dist[val] = w / totalWeight;
  }
  return dist;
}

// Trajectory: direction of movement in the polarity-weighted score.
//
//   - Returns null for traits without directional polarity (state,
//     descriptive) — there is no universally "better" direction to move.
//   - Returns "new" when there are fewer than 3 polarity-labeled
//     observations, or when nothing predates the last 30 days (no prior
//     baseline exists yet to compare against).
//   - Splits observations by TIME at the 30-day boundary (newer half =
//     last 30 days, older half = anything older) and compares the
//     polarity SUM of each half. |delta| >= 1 → improving/declining;
//     smaller → stable.
//
// The 30-day fixed-window split (rather than a median-index split) means:
//   - A pattern that stopped correctly reads as improving/declining based
//     on whether it was a warning or a strength.
//   - Clusters of similarly-aged observations don't get artificially
//     bisected into "old" and "new" halves that both sit in the past.
//
// Using the sum (not the average) means both value shifts and frequency
// shifts move the trajectory — a user who becomes MORE frequently prepared,
// or who logs FEWER warning tags, both register as improving.
const TRAJECTORY_WINDOW_DAYS = 30;

function computeTrajectory(evidence, metadata, nowMs) {
  if (!metadata || metadata.polarity !== TRAIT_POLARITIES.DIRECTIONAL) return null;
  const labels = metadata.labels || {};
  const valid = [];
  for (const ev of evidence || []) {
    if (ev.value == null) continue;
    if (!(String(ev.value) in labels)) continue;
    const t = Date.parse(ev.observed_at);
    if (!Number.isFinite(t)) continue;
    valid.push({ ms: t, polarity: labels[String(ev.value)] || 0 });
  }
  if (valid.length < 3) return "new";
  const cutoff = nowMs - TRAJECTORY_WINDOW_DAYS * DAY_MS;
  const older = valid.filter((v) => v.ms < cutoff);
  const newer = valid.filter((v) => v.ms >= cutoff);
  // No prior baseline → "new". A pattern that only exists in the last
  // 30 days doesn't have an older comparison point.
  if (older.length === 0) return "new";
  const sumPolarity = (arr) => arr.reduce((s, e) => s + e.polarity, 0);
  const olderSum = sumPolarity(older);
  const newerSum = sumPolarity(newer);
  const delta = newerSum - olderSum;
  if (Math.abs(delta) < 1) return "stable";
  return delta > 0 ? "improving" : "declining";
}

function earliestObservationIso(evidence) {
  let min = Infinity;
  for (const ev of evidence || []) {
    const t = Date.parse(ev.observed_at);
    if (Number.isFinite(t) && t < min) min = t;
  }
  return Number.isFinite(min) ? new Date(min).toISOString() : null;
}

function normalizeObservation(observation, nowMs) {
  const observedAt = isNonEmpty(observation?.observed_at)
    ? observation.observed_at
    : new Date(nowMs).toISOString();
  return {
    observed_at: observedAt,
    source: isNonEmpty(observation?.source) ? observation.source : "unknown",
    value: observation?.value ?? null,
    note: isNonEmpty(observation?.note) ? observation.note : null,
    weight: clamp(Number(observation?.weight ?? 1), 0.05, 1),
  };
}

// Push a single observation into a trait's evidence, evict old, recompute
// every derived field, and record the prior value/confidence on a transition.
// `metadata` is optional: pass the trait's TRAIT_METADATA entry so trajectory
// can be computed. Without metadata, trajectory stays null.
function pushObservation(trait, observation, nowMs, metadata = null) {
  if (!trait || !Array.isArray(trait.evidence)) return;

  const priorValue = trait.value;
  const priorConfidence = trait.confidence;

  const ev = normalizeObservation(observation, nowMs);
  trait.evidence.push(ev);
  if (trait.evidence.length > EVIDENCE_CAP_PER_TRAIT) {
    // Evict oldest first, keep newest EVIDENCE_CAP_PER_TRAIT.
    trait.evidence = trait.evidence.slice(-EVIDENCE_CAP_PER_TRAIT);
  }

  trait.confidence = computeConfidence(trait.evidence, nowMs);
  trait.value = trait.confidence >= CONFIDENCE_MIN_STRENGTH
    ? dominantValue(trait.evidence, nowMs)
    : null;
  trait.stability = computeStability(trait.evidence, trait.value, nowMs);
  trait.distribution = computeDistribution(trait.evidence, nowMs);
  trait.trajectory = computeTrajectory(trait.evidence, metadata, nowMs);
  trait.firstObserved = earliestObservationIso(trait.evidence);

  // previousValue/previousConfidence capture the LAST state before a real
  // value transition. Consumers detect transitions by comparing value vs
  // previousValue. When the value is unchanged, previous state is preserved.
  if (priorValue !== trait.value) {
    trait.previousValue = priorValue;
    trait.previousConfidence = priorConfidence;
  }

  trait.lastUpdated = new Date(nowMs).toISOString();
}

// Internal: push an observation targeted by dotted path, looking up
// metadata from the registry so trajectory is populated correctly.
function observeAtPath(profile, path, observation, nowMs) {
  const trait = getTraitByPath(profile, path);
  if (!trait) return;
  pushObservation(trait, observation, nowMs, TRAIT_METADATA[path] || null);
}

// ---------------------------------------------------------------------------
// Public API — profile lifecycle
// ---------------------------------------------------------------------------

export function createEmptyProfile({ userId = null, now = Date.now() } = {}) {
  const traits = {};
  for (const key of Object.values(TRAIT_KEYS)) {
    traits[key] = emptyTrait();
  }
  traits.emotionalPatterns = {};
  for (const key of Object.values(EMOTIONAL_PATTERN_KEYS)) {
    traits.emotionalPatterns[key] = emptyTrait();
  }
  const iso = new Date(now).toISOString();
  return {
    version: PROFILE_SCHEMA_VERSION,
    userId,
    generatedAt: iso,
    lastUpdated: iso,
    traits,
  };
}

// Resolve a trait by dotted path: "preparation" or
// "emotionalPatterns.fear_of_missing_out". Returns the trait leaf object or
// null. Rejects paths that resolve to container objects (no evidence array).
export function getTraitByPath(profile, path) {
  if (!profile?.traits || !isNonEmpty(path)) return null;
  const parts = path.split(".");
  let node = profile.traits;
  for (const part of parts) {
    if (!node || typeof node !== "object") return null;
    node = node[part];
  }
  return node && Array.isArray(node.evidence) ? node : null;
}

// Append a single observation to a trait. For streaming/real-time updates
// where you already have a normalized signal; batch derivation should use
// deriveProfileFromData instead.
export function observeTrait(profile, path, observation, { now = Date.now() } = {}) {
  const trait = getTraitByPath(profile, path);
  if (!trait) return profile;
  pushObservation(trait, observation, now, TRAIT_METADATA[path] || null);
  profile.lastUpdated = new Date(now).toISOString();
  return profile;
}

// Prune evidence older than maxAgeDays (default 180) and recompute each
// trait's derived fields. Traits whose confidence falls below
// CONFIDENCE_MIN_STRENGTH lose their value (become null). This is the
// explicit "trait disappears" mechanism. previousValue / previousConfidence
// are transition markers and are NOT recomputed here.
export function decayProfile(profile, { now = Date.now(), maxAgeDays = 180 } = {}) {
  if (!profile) return profile;
  const cutoff = now - maxAgeDays * DAY_MS;
  walkTraitsWithPath(profile.traits, (path, trait) => {
    trait.evidence = (trait.evidence || []).filter((ev) => {
      const t = Date.parse(ev.observed_at);
      return Number.isFinite(t) && t >= cutoff;
    });
    const metadata = TRAIT_METADATA[path] || null;
    trait.confidence = computeConfidence(trait.evidence, now);
    trait.value = trait.confidence >= CONFIDENCE_MIN_STRENGTH
      ? dominantValue(trait.evidence, now)
      : null;
    trait.stability = computeStability(trait.evidence, trait.value, now);
    trait.distribution = computeDistribution(trait.evidence, now);
    trait.trajectory = computeTrajectory(trait.evidence, metadata, now);
    trait.firstObserved = earliestObservationIso(trait.evidence);
  });
  profile.lastUpdated = new Date(now).toISOString();
  return profile;
}

// Return the traits with confidence at or above threshold, sorted descending.
// Useful for AI consumers wanting a short "who is this investor" summary
// without doing their own walking.
export function getStrongestTraits(profile, { minConfidence = CONFIDENCE_MIN_STRENGTH } = {}) {
  const out = [];
  walkTraitsWithPath(profile?.traits, (path, trait) => {
    if (trait.value != null && trait.confidence >= minConfidence) {
      out.push({
        path,
        value: trait.value,
        confidence: trait.confidence,
        stability: trait.stability,
        trajectory: trait.trajectory,
        lastUpdated: trait.lastUpdated,
      });
    }
  });
  return out.sort((a, b) => b.confidence - a.confidence);
}

function walkTraitsWithPath(node, fn, prefix = "") {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node.evidence)) {
    fn(prefix, node);
    return;
  }
  for (const [key, child] of Object.entries(node)) {
    const nextPath = prefix ? `${prefix}.${key}` : key;
    walkTraitsWithPath(child, fn, nextPath);
  }
}

// ---------------------------------------------------------------------------
// Public API — serialization
// ---------------------------------------------------------------------------

export function serializeProfile(profile) {
  return JSON.stringify(profile);
}

// Returns null for anything unparseable, missing, or from an incompatible
// schema version. Callers must handle null (typically by rebuilding via
// deriveProfileFromData).
export function deserializeProfile(json) {
  try {
    const parsed = typeof json === "string" ? JSON.parse(json) : json;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.version !== PROFILE_SCHEMA_VERSION) return null;
    if (!parsed.traits || typeof parsed.traits !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API — batch derivation from raw user data
// ---------------------------------------------------------------------------

// Idempotent: fully rebuilds a profile from the current data snapshot. Every
// observation is anchored to a real ledger row, trade, or snapshot. No
// signal is fabricated when the data doesn't support it.
export function deriveProfileFromData(
  { ledger = [], trades = [], portfolioSnapshots = [] } = {},
  { userId = null, now = Date.now() } = {},
) {
  const profile = createEmptyProfile({ userId, now });
  const nowIso = new Date(now).toISOString();
  const cutoff30Ms = now - 30 * DAY_MS;
  const cutoff60Ms = now - 60 * DAY_MS;
  const cutoff180Ms = now - 180 * DAY_MS;

  const safeLedger = Array.isArray(ledger) ? ledger : [];
  const safeTrades = Array.isArray(trades) ? trades : [];
  const safeSnapshots = Array.isArray(portfolioSnapshots) ? portfolioSnapshots : [];

  const plans = safeLedger.filter((e) => e?.entry_type === "plan");

  // --- Preparation + Patience (plan → trade linkage) --------------------
  for (const trade of safeTrades) {
    const asset = String(trade?.asset || "").trim().toUpperCase();
    const tradeMs = trade?.entry_time ? Date.parse(trade.entry_time) : NaN;
    if (!asset || !Number.isFinite(tradeMs)) continue;
    if (tradeMs < cutoff180Ms) continue;

    const match = plans.find((p) => {
      const ps = String(p.symbol || "").trim().toUpperCase();
      if (ps !== asset) return false;
      const pt = p.created_at ? Date.parse(p.created_at) : NaN;
      if (!Number.isFinite(pt)) return false;
      const dt = tradeMs - pt;
      return dt >= 0 && dt <= PLAN_TRADE_LOOKBACK_MS;
    });

    observeAtPath(profile, "preparation", {
      observed_at: new Date(tradeMs).toISOString(),
      source: "trades.entry_vs_plan",
      value: match ? "prepared" : "unprepared",
      note: match
        ? `Planned ${asset} before entering.`
        : `Entered ${asset} without a logged plan.`,
      weight: 1,
    }, now);

    if (match) {
      const planMs = Date.parse(match.created_at);
      const deltaHrs = (tradeMs - planMs) / HOUR_MS;
      if (deltaHrs >= 24) {
        observeAtPath(profile, "patience", {
          observed_at: new Date(tradeMs).toISOString(),
          source: "trades.plan_to_entry_delta",
          value: "patient",
          note: `Waited ${Math.round(deltaHrs)}h from plan to entry on ${asset}.`,
          weight: 0.7,
        }, now);
      } else if (deltaHrs < 1) {
        observeAtPath(profile, "patience", {
          observed_at: new Date(tradeMs).toISOString(),
          source: "trades.plan_to_entry_delta",
          value: "impulsive",
          note: `Entered ${asset} within an hour of planning.`,
          weight: 0.6,
        }, now);
      }
    }
  }

  // --- Patience (holding time on closed trades) -------------------------
  for (const trade of safeTrades) {
    const entryMs = trade?.entry_time ? Date.parse(trade.entry_time) : NaN;
    const exitMs = trade?.exit_time ? Date.parse(trade.exit_time) : NaN;
    if (!Number.isFinite(entryMs) || !Number.isFinite(exitMs)) continue;
    if (exitMs < cutoff180Ms) continue;
    const holdHrs = (exitMs - entryMs) / HOUR_MS;
    if (holdHrs >= 24) {
      observeAtPath(profile, "patience", {
        observed_at: new Date(exitMs).toISOString(),
        source: "trades.hold_time",
        value: "patient",
        note: `Held ${trade?.asset || "position"} for ${Math.round(holdHrs)}h.`,
        weight: 0.4,
      }, now);
    }
  }

  // --- Reflection --------------------------------------------------------
  for (const entry of safeLedger) {
    const t = entry?.created_at ? Date.parse(entry.created_at) : NaN;
    if (!Number.isFinite(t) || t < cutoff180Ms) continue;
    if (entry.entry_type === "reflection") {
      observeAtPath(profile, "reflection", {
        observed_at: entry.created_at,
        source: "ledger.reflection_entry",
        value: "reflective",
        note: `Logged a reflection entry${entry.symbol ? ` on ${entry.symbol}` : ""}.`,
        weight: 1,
      }, now);
    }
    if (isNonEmpty(entry.lesson)) {
      observeAtPath(profile, "reflection", {
        observed_at: entry.created_at,
        source: "ledger.lesson_recorded",
        value: "reflective",
        note: `Recorded a lesson${entry.symbol ? ` on ${entry.symbol}` : ""}.`,
        weight: 0.9,
      }, now);
    }
    if (isNonEmpty(entry.outcome)) {
      observeAtPath(profile, "reflection", {
        observed_at: entry.created_at,
        source: "ledger.outcome_tracked",
        value: "reflective",
        note: `Tracked an outcome${entry.symbol ? ` on ${entry.symbol}` : ""}.`,
        weight: 0.7,
      }, now);
    }
  }

  // --- Curiosity (reasoning fill-in as an inquisitive proxy) ------------
  // Presence of reasoning text on a decision is evidence the user paused to
  // frame a "why" — the core curiosity behavior. Length is not scored;
  // only presence.
  for (const entry of safeLedger) {
    const t = entry?.created_at ? Date.parse(entry.created_at) : NaN;
    if (!Number.isFinite(t) || t < cutoff180Ms) continue;
    if (isNonEmpty(entry.reasoning)) {
      observeAtPath(profile, "curiosity", {
        observed_at: entry.created_at,
        source: "ledger.reasoning_present",
        value: "inquisitive",
        note: `Wrote reasoning on a ${entry.entry_type || "decision"} entry.`,
        weight: 0.5,
      }, now);
    }
  }

  // --- Risk Comfort (from portfolio snapshots) --------------------------
  for (const snap of safeSnapshots) {
    const t = Number(snap?.timestampMs);
    if (!Number.isFinite(t) || t < cutoff30Ms) continue;
    const list = Array.isArray(snap.positions) ? snap.positions : null;
    if (!list || list.length === 0) continue;
    const total = list.reduce((s, p) => s + positionMarketValue(p), 0);
    if (total <= 0) continue;
    const top = list.reduce(
      (max, p) => (positionMarketValue(p) > positionMarketValue(max) ? p : max),
      list[0],
    );
    const topPct = (positionMarketValue(top) / total) * 100;
    let value;
    if (topPct > 40) value = RISK_COMFORT_LEVELS.CONCENTRATED;
    else if (topPct >= 20) value = RISK_COMFORT_LEVELS.BALANCED;
    else value = RISK_COMFORT_LEVELS.DIVERSIFIED;
    observeAtPath(profile, "riskComfort", {
      observed_at: new Date(t).toISOString(),
      source: "portfolio.top_concentration",
      value,
      note: `Top holding was ${Math.round(topPct)}% of the book.`,
      weight: 0.4,
    }, now);
  }

  // --- Decision Style (from manual trade_type distribution) -------------
  for (const trade of safeTrades) {
    const tt = String(trade?.trade_type || trade?.tradeType || "").trim().toLowerCase();
    const t = trade?.entry_time ? Date.parse(trade.entry_time) : NaN;
    if (!Number.isFinite(t) || t < cutoff180Ms) continue;
    let value = null;
    if (tt === "day_trade" || tt === "swing_trade") value = DECISION_STYLES.SHORT_TERM;
    else if (tt === "investment") value = DECISION_STYLES.LONG_TERM;
    if (!value) continue;
    observeAtPath(profile, "decisionStyle", {
      observed_at: new Date(t).toISOString(),
      source: "trades.trade_type",
      value,
      note: `Logged as ${tt.replace(/_/g, " ")}.`,
      weight: 0.5,
    }, now);
  }

  // --- Confidence Trend (30d vs prior 30d avg recorded confidence) ------
  const confidenceCurrent = [];
  const confidencePrior = [];
  for (const entry of safeLedger) {
    const c = Number(entry?.confidence);
    if (!Number.isFinite(c) || c < 1 || c > 10) continue;
    const t = entry?.created_at ? Date.parse(entry.created_at) : NaN;
    if (!Number.isFinite(t)) continue;
    if (t >= cutoff30Ms && t <= now) confidenceCurrent.push(c);
    else if (t >= cutoff60Ms && t < cutoff30Ms) confidencePrior.push(c);
  }
  if (confidenceCurrent.length >= 3 && confidencePrior.length >= 3) {
    const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const cur = avg(confidenceCurrent);
    const pri = avg(confidencePrior);
    const delta = cur - pri;
    let value;
    if (delta > 0.5) value = CONFIDENCE_TRENDS.INCREASING;
    else if (delta < -0.5) value = CONFIDENCE_TRENDS.DECREASING;
    else value = CONFIDENCE_TRENDS.STABLE;
    observeAtPath(profile, "confidenceTrend", {
      observed_at: nowIso,
      source: "ledger.confidence_ma_30d",
      value,
      note: `Average recorded confidence ${pri.toFixed(1)} → ${cur.toFixed(1)} across ${confidencePrior.length + confidenceCurrent.length} entries.`,
      weight: 1,
    }, now);
  }

  // --- Emotional patterns from emotion tags -----------------------------
  for (const entry of safeLedger) {
    const t = entry?.created_at ? Date.parse(entry.created_at) : NaN;
    if (!Number.isFinite(t) || t < cutoff180Ms) continue;
    const tag = String(entry?.emotion || "").trim().toLowerCase();
    if (!tag) continue;
    for (const [patternKey, tagSet] of Object.entries(EMOTION_TAG_MAP)) {
      if (tagSet.has(tag)) {
        observeAtPath(profile, `emotionalPatterns.${patternKey}`, {
          observed_at: entry.created_at,
          source: "ledger.emotion_tag",
          value: "present",
          note: `Tagged "${tag}"${entry.symbol ? ` on ${entry.symbol}` : ""}.`,
          weight: 1,
        }, now);
      }
    }
  }

  // --- Rule following ---------------------------------------------------
  for (const entry of safeLedger) {
    if (entry?.entry_type !== "rule_check") continue;
    const t = entry?.created_at ? Date.parse(entry.created_at) : NaN;
    if (!Number.isFinite(t) || t < cutoff180Ms) continue;
    if (entry.rule_followed === true) {
      observeAtPath(profile, "emotionalPatterns.rule_following", {
        observed_at: entry.created_at,
        source: "ledger.rule_check",
        value: "following",
        note: "Recorded that a rule was followed.",
        weight: 1,
      }, now);
    } else if (entry.rule_followed === false) {
      observeAtPath(profile, "emotionalPatterns.rule_following", {
        observed_at: entry.created_at,
        source: "ledger.rule_check",
        value: "not_following",
        note: "Recorded that a rule was broken.",
        weight: 1,
      }, now);
    }
  }

  // --- Analysis paralysis ----------------------------------------------
  // Present when planning volume dwarfs execution in the last 30 days —
  // suggests the user is stuck at "should I?" without committing.
  const plansIn30d = safeLedger.filter(
    (e) => e?.entry_type === "plan" && Number.isFinite(Date.parse(e.created_at)) && Date.parse(e.created_at) >= cutoff30Ms,
  );
  const tradesIn30d = safeTrades.filter(
    (t) => Number.isFinite(Date.parse(t?.entry_time)) && Date.parse(t.entry_time) >= cutoff30Ms,
  );
  if (plansIn30d.length >= 6 && plansIn30d.length >= tradesIn30d.length * 3) {
    observeAtPath(profile, "emotionalPatterns.analysis_paralysis", {
      observed_at: nowIso,
      source: "ledger.plans_vs_trades",
      value: "present",
      note: `${plansIn30d.length} plans logged vs ${tradesIn30d.length} trade${tradesIn30d.length === 1 ? "" : "s"} in the last 30 days.`,
      weight: 0.6,
    }, now);
  }

  return profile;
}
