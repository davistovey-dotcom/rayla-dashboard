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

const CONVERSATION_SELECT = "id, title, created_at, updated_at";
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
