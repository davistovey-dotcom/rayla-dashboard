// Rayla's Summary — service layer.
//
// Owns the client-side evidence assembly, change detection, and fetch
// against the rayla-summary edge function. The evidence packet is the
// ONLY thing the LLM sees — anything not in the packet cannot appear in
// the summary. That is how we hold the "never hallucinate" line.
//
// Change detection is a stable signature over meaningful state fields
// (position count, top-holding bucket, P/L bucket, score integers,
// ledger/reflection counts, improving-trajectory keys). Time is NOT in
// the signature — a stale hour does not trigger regeneration; a real
// state change does.

function positionMarketValue(position) {
  if (!position) return 0;
  return Math.abs(Number(position.marketValue ?? position.market_value ?? 0));
}

function positionUnrealizedPl(position) {
  if (!position) return 0;
  const value = position.unrealizedPl ?? position.unrealized_pl;
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

// ---------------------------------------------------------------------------
// Evidence builder
// ---------------------------------------------------------------------------
//
// Pulls together everything Rayla knows about the investor as a flat,
// serializable object. Every field is a real number, string, or count —
// no free-form text, no LLM output, no unreviewed data. Fields the LLM
// prompt does not use are still safe to include; the prompt lists what
// to emphasize.
//
// Callers should pass whatever they actually have — missing fields are
// simply omitted from the packet so the summary omits those topics
// instead of inventing commentary.

export function buildRaylaSummaryEvidence({
  positions = [],
  alpacaAccount = null,
  portfolioSnapshots = [],
  ledger = [],
  reflections = [],
  investorScore = null, // { overall, categories: { discipline: {score,status}, ... } }
  investorProgress = null, // { cards: [{ type, category, statement }, ...] }
  brokerTradeLog = [],
  now = Date.now(),
} = {}) {
  const positionList = (Array.isArray(positions) ? positions : []).filter(
    (p) => positionMarketValue(p) > 0,
  );
  const totalMarketValue = positionList.reduce((s, p) => s + positionMarketValue(p), 0);
  const totalUnrealizedPl = positionList.reduce((s, p) => s + positionUnrealizedPl(p), 0);
  const winning = positionList.filter((p) => positionUnrealizedPl(p) > 0);
  const losing = positionList.filter((p) => positionUnrealizedPl(p) < 0);

  const sortedByValue = [...positionList].sort(
    (a, b) => positionMarketValue(b) - positionMarketValue(a),
  );
  const topPosition = sortedByValue[0] || null;
  const topAllocationPct = topPosition && totalMarketValue > 0
    ? (positionMarketValue(topPosition) / totalMarketValue) * 100
    : null;

  // Asset class + intent mix — counts only, no free-text symbols.
  const assetClassMix = {};
  const intentMix = {};
  for (const p of positionList) {
    const cls = String(p.assetClass || p.asset_class || "equity").toLowerCase();
    assetClassMix[cls] = (assetClassMix[cls] || 0) + 1;
    const intent = String(p.positionType || "unclassified").toLowerCase();
    intentMix[intent] = (intentMix[intent] || 0) + 1;
  }

  // Ledger evidence — 30-day totals split by entry_type.
  const cutoff30 = now - 30 * 24 * 60 * 60 * 1000;
  const ledgerRecent = (Array.isArray(ledger) ? ledger : []).filter((row) => {
    const t = Date.parse(row?.created_at);
    return Number.isFinite(t) && t >= cutoff30;
  });
  const ledgerByType = {};
  for (const row of ledgerRecent) {
    const type = row?.entry_type || "other";
    ledgerByType[type] = (ledgerByType[type] || 0) + 1;
  }
  const ledgerRuleFollowedCount = ledgerRecent.filter((r) => r?.rule_followed === true).length;
  const ledgerRuleBrokenCount = ledgerRecent.filter((r) => r?.rule_followed === false).length;

  // Reflections — separate pending and completed counts. Uses answered_at
  // as the completion signal, not user_response, so a row with an empty
  // answer that has been stamped is still "completed."
  const reflectionsList = Array.isArray(reflections) ? reflections : [];
  const completedReflections = reflectionsList.filter((r) => r?.answered_at);
  const pendingReflections = reflectionsList.filter((r) => !r?.answered_at);

  // Trade activity — 30-day count from broker_trade_logs if provided.
  const brokerLogList = Array.isArray(brokerTradeLog) ? brokerTradeLog : [];
  const tradesRecent = brokerLogList.filter((t) => {
    const ts = Date.parse(t?.submitted_at || t?.filled_at || t?.created_at);
    return Number.isFinite(ts) && ts >= cutoff30;
  }).length;

  // Portfolio-value trajectory — most recent two snapshots for a delta
  // hint if we have both. Not currency values (avoids inviting P/L
  // commentary); just a direction.
  const snapshotList = Array.isArray(portfolioSnapshots) ? portfolioSnapshots : [];
  const snapshotsChron = [...snapshotList].sort(
    (a, b) => Number(a?.timestampMs || 0) - Number(b?.timestampMs || 0),
  );
  const latestSnap = snapshotsChron[snapshotsChron.length - 1] || null;
  const monthAgoCutoff = now - 30 * 24 * 60 * 60 * 1000;
  const earlierSnap = snapshotsChron.find((s) => Number(s?.timestampMs || 0) >= monthAgoCutoff - 7 * 24 * 60 * 60 * 1000) || null;
  const positionCountDelta = latestSnap && earlierSnap && Array.isArray(latestSnap.positions) && Array.isArray(earlierSnap.positions)
    ? latestSnap.positions.length - earlierSnap.positions.length
    : null;

  // Investor Score — pass through the whole shape but stripped of any
  // objects the prompt does not need.
  const scoreCategories = investorScore?.categories || null;
  const categorySummaries = scoreCategories
    ? Object.entries(scoreCategories).map(([key, cat]) => ({
        key,
        score: typeof cat?.score === "number" ? cat.score : null,
        status: cat?.status || null,
      }))
    : [];

  // Investor Progress — only "improvement" cards feed the "what's
  // improving" angle; opportunities feed the "what deserves attention"
  // angle. We forward category+statement pairs; the LLM chooses which
  // to weave in.
  const progressCards = Array.isArray(investorProgress?.cards)
    ? investorProgress.cards
        .filter((c) => c && (c.type === "improvement" || c.type === "opportunity"))
        .map((c) => ({ type: c.type, category: c.category, statement: c.statement }))
    : [];

  // Account facts — cash and buying power are intentionally omitted
  // (per the ask-rayla policy of never proactively weighing cash).
  const account = alpacaAccount
    ? {
        broker_environment: alpacaAccount?.paper === true || alpacaAccount?.status === "PAPER_ACCOUNT" ? "paper" : "live",
        equity: Number.isFinite(Number(alpacaAccount?.equity)) ? Number(alpacaAccount.equity) : null,
      }
    : null;

  return {
    generated_at: new Date(now).toISOString(),
    account,
    portfolio: {
      position_count: positionList.length,
      total_market_value: Number.isFinite(totalMarketValue) ? Number(totalMarketValue.toFixed(2)) : null,
      total_unrealized_pl: Number.isFinite(totalUnrealizedPl) ? Number(totalUnrealizedPl.toFixed(2)) : null,
      unrealized_pct: totalMarketValue > 0
        ? Number(((totalUnrealizedPl / (totalMarketValue - totalUnrealizedPl || totalMarketValue)) * 100).toFixed(2))
        : null,
      winners: winning.length,
      losers: losing.length,
      top_symbol: topPosition?.symbol || null,
      top_allocation_pct: Number.isFinite(topAllocationPct) ? Number(topAllocationPct.toFixed(1)) : null,
      asset_class_mix: assetClassMix,
      intent_mix: intentMix,
      position_count_delta_month: positionCountDelta,
    },
    trade_activity_30d: tradesRecent,
    ledger_30d: {
      total: ledgerRecent.length,
      by_type: ledgerByType,
      rule_followed_count: ledgerRuleFollowedCount,
      rule_broken_count: ledgerRuleBrokenCount,
    },
    reflections: {
      completed: completedReflections.length,
      pending: pendingReflections.length,
    },
    investor_score: {
      overall: typeof investorScore?.overall === "number" ? investorScore.overall : null,
      status: investorScore?.status || null,
      categories: categorySummaries,
    },
    investor_progress: progressCards,
  };
}

// ---------------------------------------------------------------------------
// Stable signature
// ---------------------------------------------------------------------------
//
// Buckets floating values so tiny quote ticks don't retrigger regeneration.
// The rules mirror what a coach would actually consider a "meaningful"
// change — a $50 P/L drift is noise; a jump from $200 to $2,000 is not.
// Any field genuinely worth reflecting on flips its bucket when it moves.
//
// Time is NOT in this signature. That is deliberate: staleness alone must
// not trigger regeneration.

function bucketDollar(value, bucketSize = 100) {
  if (!Number.isFinite(Number(value))) return "-";
  return String(Math.round(Number(value) / bucketSize) * bucketSize);
}

function bucketPercent(value, bucketSize = 2) {
  if (!Number.isFinite(Number(value))) return "-";
  return String(Math.round(Number(value) / bucketSize) * bucketSize);
}

export function evidenceSignature(evidence) {
  if (!evidence) return "empty";
  const parts = [
    `pc:${evidence.portfolio?.position_count ?? 0}`,
    `w:${evidence.portfolio?.winners ?? 0}`,
    `l:${evidence.portfolio?.losers ?? 0}`,
    `top:${evidence.portfolio?.top_symbol || "-"}`,
    `topPct:${bucketPercent(evidence.portfolio?.top_allocation_pct, 5)}`,
    `plB:${bucketDollar(evidence.portfolio?.total_unrealized_pl, 100)}`,
    `mvB:${bucketDollar(evidence.portfolio?.total_market_value, 500)}`,
    `iso:${evidence.investor_score?.overall ?? "-"}`,
    `cats:${(evidence.investor_score?.categories || []).map((c) => `${c.key}=${c.score ?? "-"}`).join(",")}`,
    `led:${evidence.ledger_30d?.total ?? 0}`,
    `ledR:${evidence.ledger_30d?.rule_followed_count ?? 0}-${evidence.ledger_30d?.rule_broken_count ?? 0}`,
    `ref:${evidence.reflections?.completed ?? 0}p${evidence.reflections?.pending ?? 0}`,
    `prog:${(evidence.investor_progress || [])
      .map((c) => `${c.type[0]}:${c.category}`)
      .sort()
      .join(",")}`,
    `td:${evidence.trade_activity_30d ?? 0}`,
    `pcd:${evidence.portfolio?.position_count_delta_month ?? "-"}`,
  ];
  return parts.join("|");
}

// ---------------------------------------------------------------------------
// Edge-function call
// ---------------------------------------------------------------------------
//
// Sends the evidence packet to rayla-summary and returns the summary
// text. Throws on any failure so the caller can surface a soft error
// state without displaying a hallucinated placeholder.

export async function fetchRaylaSummary(supabase, evidence, signature = null) {
  const { data, error } = await supabase.functions.invoke("rayla-summary", {
    body: { evidence, signature: signature || null },
  });
  if (error) throw error;
  if (!data?.ok || typeof data.summary !== "string" || !data.summary.trim()) {
    throw new Error(data?.error || "Rayla summary unavailable.");
  }
  return {
    summary: data.summary.trim(),
    generatedAt: data.generatedAt || new Date().toISOString(),
    model: data.model || null,
    priorSummaryCount: typeof data.priorSummaryCount === "number" ? data.priorSummaryCount : null,
    significance: data.significance || null,
  };
}

// ---------------------------------------------------------------------------
// localStorage cache
// ---------------------------------------------------------------------------
//
// The cache key is per user; the value is { signature, summary, generatedAt }.
// Only used to skip a regeneration when the signature has not changed
// between page loads. A signature mismatch always regenerates.

const CACHE_PREFIX = "rayla_summary_v1:";

export function readSummaryCache(userId) {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.summary !== "string" || typeof parsed.signature !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSummaryCache(userId, { signature, summary, generatedAt }) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${CACHE_PREFIX}${userId}`,
      JSON.stringify({ signature, summary, generatedAt: generatedAt || new Date().toISOString() }),
    );
  } catch {
    // Storage unavailable — cache is best-effort.
  }
}

export function clearSummaryCache(userId) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`${CACHE_PREFIX}${userId}`);
  } catch {
    // best-effort
  }
}
