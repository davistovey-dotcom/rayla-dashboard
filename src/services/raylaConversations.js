// Ask Rayla conversation persistence — pure I/O.
//
// This module owns every database and localStorage operation for Rayla chat
// history. It is deliberately React-free: functions take a Supabase client
// and the user id as arguments, and either return raw data or throw. The
// caller (App.jsx) wraps these in useCallback / useState / useEffect and
// decides how to handle failures at the UI layer.
//
// The database is the durable source of truth. localStorage is used only for
// tiny recovery hints — which conversation was last open and any unsent draft
// text — so that a page reload can reopen the same thread and restore
// in-progress typing without needing a network round-trip first.

// ---------------------------------------------------------------------------
// localStorage
// ---------------------------------------------------------------------------

export const LOCAL_KEYS = Object.freeze({
  draft: (userId) => `rayla_ask_draft_${userId}`,
  currentConversation: (userId) => `rayla_ask_current_conversation_${userId}`,
});

export function persistLocal(key, value) {
  if (!key) return;
  try {
    if (value == null || value === "") localStorage.removeItem(key);
    else localStorage.setItem(key, String(value));
  } catch {
    /* private mode / storage full — non-fatal */
  }
}

export function readLocal(key) {
  if (!key) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Title generation
// ---------------------------------------------------------------------------

// Short, safe title derived from a user's first message. Truncates long
// messages so the sidebar row stays a single line. Never fabricates content —
// only reformats what the user actually typed.
export function conversationTitleFromMessage(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "New conversation";
  const oneLine = trimmed.replace(/\s+/g, " ");
  return oneLine.length > 60 ? `${oneLine.slice(0, 57).trimEnd()}…` : oneLine;
}

// ---------------------------------------------------------------------------
// Database operations
// ---------------------------------------------------------------------------
//
// All operations scope by user_id defensively even though RLS on the two
// tables already enforces per-user isolation. Both belt and suspenders.

const CONVERSATION_SELECT = "id, title, created_at, updated_at, kind, generated_for, daily_message_id";
const MESSAGE_SELECT = "id, role, content, created_at";

export async function fetchConversations(supabase, userId, { limit = 50 } = {}) {
  const { data, error } = await supabase
    .from("rayla_conversations")
    .select(CONVERSATION_SELECT)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// Returns messages in the shape the Ask Rayla UI expects
// ({ id, role, content, loading }). Chronological order, oldest first.
export async function loadConversationMessages(supabase, userId, conversationId) {
  const { data, error } = await supabase
    .from("rayla_messages")
    .select(MESSAGE_SELECT)
    .eq("user_id", userId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    loading: false,
  }));
}

export async function createConversation(supabase, userId, title) {
  const { data, error } = await supabase
    .from("rayla_conversations")
    .insert({ user_id: userId, title: title || "" })
    .select(CONVERSATION_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteConversation(supabase, userId, conversationId) {
  const { error } = await supabase
    .from("rayla_conversations")
    .delete()
    .eq("user_id", userId)
    .eq("id", conversationId);
  if (error) throw error;
  return true;
}

export async function persistMessage(supabase, { userId, conversationId, role, content }) {
  const { data, error } = await supabase
    .from("rayla_messages")
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      role,
      content: String(content ?? ""),
    })
    .select("id, created_at")
    .single();
  if (error) throw error;
  return data;
}

// Bumps updated_at so the conversation moves to the top of "most recent
// first" lists. Fire-and-forget from the caller's perspective; failures are
// non-fatal because the row is unchanged.
export async function touchConversation(supabase, userId, conversationId) {
  const { error } = await supabase
    .from("rayla_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", conversationId);
  if (error) throw error;
  return true;
}

// ---------------------------------------------------------------------------
// Rayla Daily — tagged-conversation helpers
// ---------------------------------------------------------------------------
//
// Rayla Daily lives inside rayla_conversations, discriminated by
// kind = 'rayla_daily' and scoped to a user-local calendar day via
// generated_for. daily_message_id points at the first assistant message
// (the briefing itself) so Refresh can replace it without touching any
// follow-up messages the user has added.

// Returns today's Daily conversation row, or null when the user hasn't
// generated one for this date yet.
export async function findRaylaDaily(supabase, userId, dateStr) {
  const { data, error } = await supabase
    .from("rayla_conversations")
    .select(CONVERSATION_SELECT)
    .eq("user_id", userId)
    .eq("kind", "rayla_daily")
    .eq("generated_for", dateStr)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

// Creates a new Daily conversation row. The partial unique index on
// (user_id, generated_for) WHERE kind = 'rayla_daily' guarantees at most
// one Daily per user per day; a concurrent duplicate insert surfaces as a
// unique-violation error that the caller can handle by calling findRaylaDaily.
export async function createRaylaDailyConversation(supabase, userId, dateStr, title) {
  const { data, error } = await supabase
    .from("rayla_conversations")
    .insert({
      user_id: userId,
      title: title || `Rayla Daily · ${dateStr}`,
      kind: "rayla_daily",
      generated_for: dateStr,
    })
    .select(CONVERSATION_SELECT)
    .single();
  if (error) throw error;
  return data;
}

// Called after the initial Daily message is persisted. Wires the message id
// onto the conversation row so future refreshes know which message to
// replace.
export async function attachDailyMessageId(supabase, userId, conversationId, messageId) {
  const { error } = await supabase
    .from("rayla_conversations")
    .update({ daily_message_id: messageId })
    .eq("user_id", userId)
    .eq("id", conversationId);
  if (error) throw error;
  return true;
}

// Behavior Capture — inserts a decision_ledger_entries row from a parsed
// LEDGER_ENTRY marker. Called silently after the capture-conversation
// stream completes. The row carries metadata tagging its capture source
// so InvestorReviewTab can render a "Rayla" vs "Manual" badge and future
// analytics can filter.
//
//   rowData     the parsed marker payload (entry_type, symbol, reasoning,
//               lesson, emotion, outcome, rule_followed, confidence)
//   triggerContext  e.g. "trade_close" — stored in metadata for audit
//   positionRef optional { positionId, closedAt } — stored in metadata to
//               tie the entry back to the specific closed position
export async function writeLedgerEntry(supabase, userId, rowData, { triggerContext = null, positionRef = null } = {}) {
  if (!userId || !rowData || !rowData.entry_type) return null;
  const insertRow = {
    user_id: userId,
    entry_type: rowData.entry_type,
    symbol: rowData.symbol || null,
    decision: rowData.decision || null,
    reasoning: rowData.reasoning || null,
    confidence: Number.isFinite(Number(rowData.confidence)) ? Number(rowData.confidence) : null,
    emotion: rowData.emotion || null,
    rule_followed: typeof rowData.rule_followed === "boolean" ? rowData.rule_followed : null,
    outcome: rowData.outcome || null,
    lesson: rowData.lesson || null,
    source: triggerContext ? `behavior_capture:${triggerContext}` : "behavior_capture",
    metadata: {
      captured_via: "behavior_capture",
      trigger_context: triggerContext || null,
      ...(positionRef ? { position_id: positionRef.positionId || null, closed_at: positionRef.closedAt || null } : {}),
    },
  };
  const { data, error } = await supabase
    .from("decision_ledger_entries")
    .insert(insertRow)
    .select("id, created_at")
    .single();
  if (error) throw error;
  return data;
}

// In-place message content replacement — used only by Refresh Daily.
// Follow-up messages (message_ids other than daily_message_id) are never
// touched by this path.
export async function updateMessageContent(supabase, userId, messageId, content) {
  const { error } = await supabase
    .from("rayla_messages")
    .update({ content: String(content ?? "") })
    .eq("user_id", userId)
    .eq("id", messageId);
  if (error) throw error;
  return true;
}
