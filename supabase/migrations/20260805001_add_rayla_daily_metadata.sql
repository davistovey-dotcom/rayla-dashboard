-- Rayla Daily — metadata columns on rayla_conversations.
--
-- Rayla Daily is a proactive briefing that renders inside the existing Ask
-- Rayla overlay on the user's first open each local calendar day. Rather
-- than introduce a parallel briefs table, we tag the Daily as a normal
-- conversation with three extra columns and a partial unique index. This
-- keeps sidebar history, streaming, follow-ups, and RLS working unchanged.
--
--   kind                 discriminator; NULL for regular chats,
--                        'rayla_daily' for a Daily briefing
--   generated_for        the user's LOCAL YYYY-MM-DD the Daily covers
--                        (client passes; server does no timezone math)
--   daily_message_id     pointer to the first assistant message in this
--                        conversation — the ONLY row Refresh Daily updates.
--                        Follow-ups always live at other message ids and
--                        are never touched by refresh.
--
-- Follow-up chip suggestions are NOT persisted — they are UI hints derived
-- fresh from the Daily message text on every render (via a trailing
-- FOLLOWUP_PROMPTS marker the LLM emits inside the message content).
--
-- The partial unique index enforces "one Daily per user per local day".
-- Regular conversations (kind IS NULL) are unconstrained.

alter table public.rayla_conversations
  add column if not exists kind text,
  add column if not exists generated_for date,
  add column if not exists daily_message_id uuid;

create unique index if not exists rayla_conversations_daily_unique
  on public.rayla_conversations (user_id, generated_for)
  where kind = 'rayla_daily';

comment on column public.rayla_conversations.kind is
  'Conversation discriminator. NULL = regular chat, ''rayla_daily'' = daily briefing.';
comment on column public.rayla_conversations.generated_for is
  'User-local YYYY-MM-DD the Daily covers. NULL for non-Daily conversations.';
comment on column public.rayla_conversations.daily_message_id is
  'The rayla_messages.id of the Daily briefing message. Refresh Daily replaces this message in place; follow-ups are preserved.';
