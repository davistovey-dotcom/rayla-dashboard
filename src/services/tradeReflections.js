// Trade Reflection Engine (Phase 2.1) — service layer.
//
// This module owns:
//   - deriving a stable trade_id from a closed brokerage position so the
//     UNIQUE constraint on the table prevents duplicate insertion if the
//     client's close-watcher re-fires
//   - picking a coaching question template based on the trade's outcome
//   - CRUD helpers for the trade_reflections table
//
// It is pure I/O — no React, no state. The parent (App.jsx) wires close
// detection to createPendingReflection, and wires overlay-open + first-
// user-reply to fetchOldestPending / saveReflectionResponse.
//
// Future systems (Investor Score, Investor Progress, ALP, Weekly Review,
// Rayla Daily, Ask Rayla coaching) can consume completed reflections by
// reading trade_reflections directly; the row shape is stable and the
// behavior_tags / metadata JSONB columns give them room to extend without
// a schema change.

const REFLECTION_SELECT = "id, user_id, trade_id, reflection_question, user_response, reflection_type, behavior_tags, metadata, created_at, answered_at";

// ---------------------------------------------------------------------------
// Trade id derivation
// ---------------------------------------------------------------------------
//
// Alpaca does not give us a stable "trade id" for the lifecycle of a
// position (open → close). Instead we synthesize one from fields that are
// stable at close time. The format keeps the id short, human-inspectable
// in the audit log, and cryptographically unimportant — the UNIQUE
// constraint just needs strict string equality across re-detections.
//
//   '{broker_env}:{SYMBOL}:{entry.4f}:{close_ymd}'
//
// Collision analysis: two different position lifecycles collide only if
// the user re-opens the same symbol at the same avg_entry_price on the
// same local calendar day and also closes on the same day. Vanishingly
// rare; the safe failure mode is that the second reflection is skipped
// (rather than being an incorrect record of a different trade).
export function deriveTradeId({ brokerEnv, symbol, avgEntryPrice, closedAt }) {
  const env = String(brokerEnv || "live").trim().toLowerCase();
  const sym = String(symbol || "").trim().toUpperCase();
  if (!sym) return null;
  const entry = Number.isFinite(Number(avgEntryPrice)) && Number(avgEntryPrice) > 0
    ? Number(avgEntryPrice).toFixed(4)
    : "0.0000";
  const closeDate = String(closedAt || new Date().toISOString()).slice(0, 10);
  return `${env}:${sym}:${entry}:${closeDate}`;
}

// ---------------------------------------------------------------------------
// Coaching question templates
// ---------------------------------------------------------------------------
//
// Exactly ONE question is asked per reflection. The template pool is
// small and deterministic — pick by outcome bucket (win / loss / flat).
// Each includes the symbol and outcome inline so the user knows what
// trade they're reflecting on without extra UI.

export function buildReflectionQuestion(item) {
  const symbol = String(item?.symbol || "").toUpperCase() || "That trade";
  const plPct = Number(item?.plPct);
  const plAbs = Number(item?.pl);
  const hasPct = Number.isFinite(plPct);
  const hasAbs = Number.isFinite(plAbs);

  // Format the outcome fragment inline in the question.
  let outcome = "";
  if (hasPct) {
    const sign = plPct >= 0 ? "+" : "";
    const plStr = hasAbs ? ` (${plAbs >= 0 ? "+" : ""}$${Math.abs(plAbs).toFixed(2)})` : "";
    outcome = ` at ${sign}${plPct.toFixed(2)}%${plStr}`;
  }

  // Bucket by outcome magnitude. A ~0.5% threshold separates a
  // meaningful move from a near-flat exit so the question tone fits.
  if (hasPct && plPct >= 0.5) {
    return `${symbol} just closed${outcome}. What made this one work?`;
  }
  if (hasPct && plPct <= -0.5) {
    return `${symbol} just closed${outcome}. What would you do differently?`;
  }
  return `${symbol} just closed${outcome}. Was that the right exit?`;
}

// ---------------------------------------------------------------------------
// Metadata builder
// ---------------------------------------------------------------------------
//
// Snapshot the outcome data on the row at creation time. Downstream
// consumers (Decision Log display, future scoring) shouldn't need to
// re-query Alpaca to know what the trade did.

export function buildReflectionMetadata(item, { brokerEnv = "live" } = {}) {
  const out = {
    broker_environment: brokerEnv,
    symbol: item?.symbol || null,
    side: item?.side || null,
    qty: Number.isFinite(Number(item?.qty)) ? Number(item.qty) : null,
    entry_price: Number.isFinite(Number(item?.entryPrice)) ? Number(item.entryPrice) : null,
    exit_price: Number.isFinite(Number(item?.exitPrice)) ? Number(item.exitPrice) : null,
    pl: Number.isFinite(Number(item?.pl)) ? Number(item.pl) : null,
    pl_pct: Number.isFinite(Number(item?.plPct)) ? Number(item.plPct) : null,
    closed_at: item?.closedAt || new Date().toISOString(),
  };
  return out;
}

// ---------------------------------------------------------------------------
// DB operations
// ---------------------------------------------------------------------------

// Creates one pending reflection row for a closed trade. Idempotent via
// the (user_id, trade_id, reflection_type) UNIQUE constraint: if a row
// for this exact trade already exists we swallow the 23505 (unique
// violation) and return null. Any other error propagates.
export async function createPendingReflection(supabase, userId, closedTradeItem, { brokerEnv = "live" } = {}) {
  if (!userId || !closedTradeItem) return null;
  const tradeId = deriveTradeId({
    brokerEnv,
    symbol: closedTradeItem.symbol,
    avgEntryPrice: closedTradeItem.entryPrice,
    closedAt: closedTradeItem.closedAt,
  });
  if (!tradeId) return null;

  const insertRow = {
    user_id: userId,
    trade_id: tradeId,
    reflection_type: "trade_close",
    reflection_question: buildReflectionQuestion(closedTradeItem),
    behavior_tags: [],
    metadata: buildReflectionMetadata(closedTradeItem, { brokerEnv }),
  };

  const { data, error } = await supabase
    .from("trade_reflections")
    .insert(insertRow)
    .select(REFLECTION_SELECT)
    .single();

  if (error) {
    // Postgres unique_violation — the reflection already exists. This is
    // the expected outcome on a re-detected close; not an error.
    if (String(error?.code || "").trim() === "23505") return null;
    throw error;
  }
  return data;
}

// Returns the oldest pending (answered_at IS NULL) reflection for the
// user, or null if none exist. Used on Ask Rayla overlay open to decide
// whether to surface a reflection conversation.
export async function fetchOldestPending(supabase, userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("trade_reflections")
    .select(REFLECTION_SELECT)
    .eq("user_id", userId)
    .is("answered_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

// Saves the user's first-reply text as the reflection response and stamps
// answered_at. Trims whitespace but does not otherwise filter — a garbage
// answer is still the user's answer.
export async function saveReflectionResponse(supabase, userId, reflectionId, responseText) {
  if (!userId || !reflectionId) return false;
  const trimmed = String(responseText ?? "").trim();
  const { error } = await supabase
    .from("trade_reflections")
    .update({
      user_response: trimmed || null,
      answered_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", reflectionId)
    .is("answered_at", null); // only update if still pending — no accidental overwrites
  if (error) throw error;
  return true;
}

// Closes the loop between trade_reflections and decision_ledger_entries.
// Without this the Investor Score's Reflection metric never moves when a
// user answers a trade reflection, because scoreReflection reads only
// ledger-source observations (ledger.reflection_entry / lesson_recorded /
// outcome_tracked) that deriveProfileFromData emits from ledger rows.
//
// Called from App.jsx right after saveReflectionResponse succeeds. The
// user's reply becomes `lesson`. The trade's P/L direction becomes
// `outcome`. Both fields are exactly what the ALP looks for.
//
// Idempotent: metadata.reflection_id is the dedup key. Re-running for the
// same reflection is a no-op that returns the existing row.
export async function convertReflectionToLedgerEntry(supabase, userId, reflectionId, userResponse, { reflectionRow = null } = {}) {
  if (!userId || !reflectionId) return null;
  const trimmed = String(userResponse ?? "").trim();
  if (!trimmed) return null; // no substantive answer → no ledger entry

  // Dedup — bail out early if we've already written a ledger entry for
  // this reflection. Survives client retries and future pipeline re-runs.
  try {
    const { data: existing } = await supabase
      .from("decision_ledger_entries")
      .select("id")
      .eq("user_id", userId)
      .eq("source", "trade_reflection")
      .eq("metadata->>reflection_id", reflectionId)
      .maybeSingle();
    if (existing) return existing;
  } catch (dedupErr) {
    console.warn("[trade-reflection] ledger dedup check failed", dedupErr);
    // fall through — insert path below will still attempt the write
  }

  // Load reflection metadata if the caller didn't hand it in.
  let reflection = reflectionRow;
  if (!reflection) {
    const { data, error } = await supabase
      .from("trade_reflections")
      .select("id, trade_id, reflection_question, reflection_type, metadata")
      .eq("user_id", userId)
      .eq("id", reflectionId)
      .maybeSingle();
    if (error || !data) return null;
    reflection = data;
  }

  const meta = reflection?.metadata || {};
  const symbol = meta.symbol ? String(meta.symbol).toUpperCase() : null;
  const plPct = Number(meta.pl_pct);
  const plAbs = Number(meta.pl);
  // Bucket by the same 0.5% threshold buildReflectionQuestion uses so the
  // outcome label matches the tone of the coaching question.
  let outcomeDirection = null;
  if (Number.isFinite(plPct)) {
    if (plPct >= 0.5) outcomeDirection = "win";
    else if (plPct <= -0.5) outcomeDirection = "loss";
    else outcomeDirection = "flat";
  }
  const outcomeLabel = outcomeDirection
    ? (Number.isFinite(plPct)
        ? `${outcomeDirection} (${plPct >= 0 ? "+" : ""}${plPct.toFixed(2)}%)`
        : outcomeDirection)
    : null;

  const insertRow = {
    user_id: userId,
    entry_type: "reflection",
    symbol,
    decision: reflection?.reflection_question || `Reflection on ${symbol || "trade close"}`,
    lesson: trimmed,
    outcome: outcomeLabel,
    source: "trade_reflection",
    metadata: {
      reflection_id: reflection.id,
      trade_id: reflection.trade_id || null,
      reflection_type: reflection.reflection_type || null,
      captured_via: "trade_reflection",
      pl_pct: Number.isFinite(plPct) ? plPct : null,
      pl: Number.isFinite(plAbs) ? plAbs : null,
    },
  };

  const { data: created, error: insertErr } = await supabase
    .from("decision_ledger_entries")
    .insert(insertRow)
    .select("id")
    .single();

  if (insertErr) {
    console.error("[trade-reflection] ledger insert failed", insertErr);
    return null;
  }
  return created;
}

// Fetches recent completed (answered) reflections for the Decision Log
// audit trail. Newest first. Caller decides limit.
export async function fetchCompletedReflections(supabase, userId, { limit = 30 } = {}) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("trade_reflections")
    .select(REFLECTION_SELECT)
    .eq("user_id", userId)
    .not("answered_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// Optional cleanup path — mostly used by admin/debug flows. Not called
// during normal user activity in Phase 2.1.
export async function deleteReflection(supabase, userId, reflectionId) {
  if (!userId || !reflectionId) return false;
  const { error } = await supabase
    .from("trade_reflections")
    .delete()
    .eq("user_id", userId)
    .eq("id", reflectionId);
  if (error) throw error;
  return true;
}
