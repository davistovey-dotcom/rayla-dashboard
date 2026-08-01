// Ask Rayla first-visit welcome message.
//
// Renders a short, grounded welcome the very first time a user opens Ask
// Rayla after completing onboarding. Every sentence references a field the
// user actually gave us — nothing is fabricated. Missing fields are silently
// omitted. If the profile has no useful signal at all, this returns null and
// the caller falls back to the default empty state.

// Static list of starter prompts shown below the welcome. These PREFILL the
// input rather than sending, so the user can review and edit before hitting
// send.
export const ASK_RAYLA_WELCOME_STARTERS = Object.freeze([
  "Review my portfolio",
  "Analyze a stock",
  "Help me think through a trade",
  "Explain something I don't understand",
  "Build my watchlist",
]);

// Normalize raw profile values into a canonical bucket. Returns null when
// the value isn't recognized — never guesses. Mirrors the existing
// `normalizeRisk` / `normalizeGoal` behavior in App.jsx so the phrasing
// here stays in sync with what onboarding actually persists.
function normalizeGoalBucket(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "wealth" || v === "growth") return "wealth";
  if (v === "income") return "income";
  if (
    v === "learning"
    || v === "learn the basics"
    || v === "improve execution"
    || v === "build investing confidence"
    || v === "analyze performance"
  ) return "learning";
  if (v === "alpha") return "alpha";
  return null;
}

function normalizeRiskBucket(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "low" || v === "tight") return "low";
  if (v === "medium" || v === "moderate") return "medium";
  if (v === "high" || v === "aggressive") return "high";
  return null;
}

function normalizeExperienceBucket(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "beginner" || v === "brand new") return "beginner";
  if (v === "intermediate" || v === "some experience") return "intermediate";
  if (v === "advanced" || v === "active trader") return "advanced";
  return null;
}

// Phrase fragments per field. Each is grammatical on its own AND composes
// cleanly when concatenated. Only inserted when the underlying field is
// known — no fabrication.
//
// Structure of the final sentence:
//   "From what you've shared, I understand you {predicate}."
// where {predicate} is one of the combinations below, chosen so the sentence
// reads naturally regardless of which fields are missing.

const GOAL_SUBJECT_PHRASES = Object.freeze({
  wealth: "'re a long-term investor focused on building wealth",
  income: "'re an income-focused investor",
  learning: "'re still learning how investing works",
  alpha: "'re aiming to outperform the broader market",
});

// Risk phrasing when a goal already carries the identity (adds ", with a … risk tolerance").
const RISK_APPEND_PHRASES = Object.freeze({
  low: "with a conservative risk tolerance",
  medium: "with a moderate risk tolerance",
  high: "with a higher risk tolerance",
});

// Risk phrasing when there is no goal (becomes the whole predicate).
const RISK_STANDALONE_PHRASES = Object.freeze({
  low: " take a conservative approach to risk",
  medium: " take a moderate approach to risk",
  high: " take a higher-risk approach to investing",
});

// Experience phrasing when it's the whole predicate (no goal, no risk).
const EXPERIENCE_STANDALONE_PHRASES = Object.freeze({
  beginner: " have limited investing experience so far",
  intermediate: " have some investing experience",
  advanced: " have substantial investing experience",
});

// Builds a welcome message from an onboarding coach profile. Returns null
// when there is nothing concrete to reference — the caller should show the
// default empty state in that case.
export function buildAskRaylaWelcome(profile) {
  if (!profile || typeof profile !== "object") return null;

  const goal = normalizeGoalBucket(profile.goal);
  const risk = normalizeRiskBucket(profile.risk ?? profile.riskComfort);
  const experience = normalizeExperienceBucket(profile.experience);

  let predicate = null;

  if (goal) {
    predicate = GOAL_SUBJECT_PHRASES[goal];
    if (risk) predicate += `, ${RISK_APPEND_PHRASES[risk]}`;
  } else if (risk) {
    predicate = RISK_STANDALONE_PHRASES[risk];
  } else if (experience) {
    predicate = EXPERIENCE_STANDALONE_PHRASES[experience];
  }

  if (!predicate) return null;

  const context = `From what you've shared, I understand you${predicate}.`;

  return {
    greeting: "Welcome to Ask Rayla.",
    context,
    promise: "I'll use that context whenever I help analyze investments, answer questions, or think through decisions with you.",
    future: "As we work together, I'll keep learning from your investing behavior — not just your questionnaire.",
  };
}
