// Rayla Daily — pure helpers.
//
// This module owns the client-side plumbing for the daily briefing:
//   - resolving the user's local calendar day
//   - assembling the raylaDailyContext payload for ask-rayla
//   - parsing the LLM's follow-up-prompt marker out of the streamed response
//
// No React, no supabase calls — just data shaping. The parent (App.jsx)
// owns state, fetches, and effects and calls these helpers as needed.

// ---------------------------------------------------------------------------
// Local calendar day
// ---------------------------------------------------------------------------

// Returns the user's LOCAL calendar day as YYYY-MM-DD. The Daily is scoped
// to the user's local timezone; server does no timezone math.
export function todayLocalYMD(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Portfolio delta
// ---------------------------------------------------------------------------

// Given the portfolioSnapshots array (each snapshot has { date, equity })
// plus the current equity, returns the delta since the most recent snapshot
// prior to today. Null when there is no prior snapshot to compare against
// (day-1 users). Used to fuel the "your portfolio increased X%" bullet.
export function computePortfolioDelta(portfolioSnapshots, currentEquity, todayYMD) {
  if (!Array.isArray(portfolioSnapshots) || portfolioSnapshots.length === 0) return null;
  if (!Number.isFinite(Number(currentEquity)) || Number(currentEquity) <= 0) return null;

  const prior = portfolioSnapshots
    .map((s) => ({ ...s, ymd: String(s?.date || s?.snapshot_date || "").slice(0, 10) }))
    .filter((s) => s.ymd && s.ymd < todayYMD && Number.isFinite(Number(s.equity)) && Number(s.equity) > 0)
    .sort((a, b) => b.ymd.localeCompare(a.ymd))[0];

  if (!prior) return null;

  const priorEquity = Number(prior.equity);
  const current = Number(currentEquity);
  const deltaAbs = current - priorEquity;
  const deltaPct = (deltaAbs / priorEquity) * 100;

  return {
    priorDate: prior.ymd,
    priorEquity,
    currentEquity: current,
    deltaAbs: Number(deltaAbs.toFixed(2)),
    deltaPct: Number(deltaPct.toFixed(2)),
  };
}

// ---------------------------------------------------------------------------
// Per-holding intraday movers
// ---------------------------------------------------------------------------

// Sorts brokerage positions by absolute intraday change and returns the top
// N. Used to surface "PLTR gained 27% since yesterday" style bullets. Only
// positions with a well-defined changeToday are included.
export function topIntradayMovers(brokerPositions, limit = 5) {
  if (!Array.isArray(brokerPositions)) return [];
  return brokerPositions
    .map((p) => ({
      symbol: String(p?.symbol || "").toUpperCase(),
      changeTodayPct: Number.isFinite(Number(p?.changeToday)) ? Number(p.changeToday) * 100 : null,
      intradayPl: Number.isFinite(Number(p?.unrealizedIntradayPl)) ? Number(p.unrealizedIntradayPl) : null,
      marketValue: Number.isFinite(Number(p?.marketValue)) ? Number(p.marketValue) : null,
      currentPrice: Number.isFinite(Number(p?.currentPrice)) ? Number(p.currentPrice) : null,
    }))
    .filter((row) => row.symbol && Number.isFinite(row.changeTodayPct))
    .sort((a, b) => Math.abs(b.changeTodayPct) - Math.abs(a.changeTodayPct))
    .slice(0, limit)
    .map((row) => ({
      ...row,
      changeTodayPct: Number(row.changeTodayPct.toFixed(2)),
      intradayPl: row.intradayPl != null ? Number(row.intradayPl.toFixed(2)) : null,
    }));
}

// ---------------------------------------------------------------------------
// Full context assembly
// ---------------------------------------------------------------------------

// Assembles the raylaDailyContext object that ask-rayla consumes. All fields
// are optional — the LLM prompt handles missing pieces via graceful
// omission (see raylaDailyGuidance in the edge function).
export function buildRaylaDailyContext({
  todayYMD,
  firstName = null,
  hasBrokerage = false,
  portfolioDelta = null,          // from computePortfolioDelta
  topMovers = [],                  // from topIntradayMovers
  investorScoreCurrent = null,     // number 0-100 or null
  investorScoreYesterday = null,   // number 0-100 or null
  investorScoreEvidence = null,    // { ledgerCount, primaryDriver } or null
  adaptiveProfileSummary = null,   // compact summary of ALP; null when thin
  raylaPicksToday = null,          // compact intel picks context or null
  marketIsOpen = null,             // bool or null
}) {
  const scoreDelta = Number.isFinite(Number(investorScoreCurrent)) && Number.isFinite(Number(investorScoreYesterday))
    ? Math.round(Number(investorScoreCurrent) - Number(investorScoreYesterday))
    : null;

  return {
    intent: "rayla_daily",
    todayYMD,
    firstName: firstName ? String(firstName).trim().slice(0, 40) : null,
    hasBrokerage: Boolean(hasBrokerage),
    marketIsOpen,
    portfolio: portfolioDelta
      ? {
          priorDate: portfolioDelta.priorDate,
          priorEquity: portfolioDelta.priorEquity,
          currentEquity: portfolioDelta.currentEquity,
          deltaAbs: portfolioDelta.deltaAbs,
          deltaPct: portfolioDelta.deltaPct,
        }
      : null,
    topMovers: Array.isArray(topMovers) ? topMovers : [],
    investorScore: Number.isFinite(Number(investorScoreCurrent))
      ? {
          current: Math.round(Number(investorScoreCurrent)),
          yesterday: Number.isFinite(Number(investorScoreYesterday)) ? Math.round(Number(investorScoreYesterday)) : null,
          delta: scoreDelta,
          evidenceLedgerCount: Number(investorScoreEvidence?.ledgerCount) || 0,
          primaryDriver: investorScoreEvidence?.primaryDriver || null,
        }
      : null,
    adaptiveProfileSummary: adaptiveProfileSummary || null,
    raylaPicksToday: raylaPicksToday || null,
  };
}

// ---------------------------------------------------------------------------
// Follow-up prompt marker parsing
// ---------------------------------------------------------------------------
//
// The Daily response ends with a strict marker the LLM is instructed to
// emit exactly:
//
//     FOLLOWUP_PROMPTS:
//     - <chip 1>
//     - <chip 2>
//     - <chip 3>
//
// We strip everything from the marker onward when displaying the message,
// and parse the bulleted lines below into a JS array. Chips are capped at
// 3 and each is trimmed / length-clamped.

const FOLLOWUP_MARKER_RE = /\n\s*FOLLOWUP_PROMPTS\s*:\s*/i;

// Returns the message content with the FOLLOWUP_PROMPTS block removed.
// Safe to call on partial streaming text; the block is only removed once
// the marker has been emitted.
export function stripFollowupMarker(text) {
  if (!text) return "";
  const match = text.match(FOLLOWUP_MARKER_RE);
  if (!match) return text;
  return text.slice(0, match.index).trimEnd();
}

// Parses up to 3 follow-up chips out of the message. Returns [] when the
// marker is absent or the block is malformed.
export function extractFollowupPrompts(text) {
  if (!text) return [];
  const match = text.match(FOLLOWUP_MARKER_RE);
  if (!match) return [];
  const tail = text.slice(match.index + match[0].length);
  return tail
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-") || line.startsWith("•") || line.startsWith("*"))
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((chip) => chip.length > 120 ? `${chip.slice(0, 117)}…` : chip);
}
