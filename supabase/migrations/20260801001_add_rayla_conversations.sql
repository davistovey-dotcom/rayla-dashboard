-- Ask Rayla persistent conversation history.
--
-- Before this migration Ask Rayla stored messages only in React useState. Any
-- unmount (session token refresh triggering a render-gate, HMR, WebView
-- reload) dropped the entire conversation. These tables make the database the
-- durable source of truth.
--
-- RLS: strict per-user isolation on both tables. auth.uid() must match
-- user_id for every read/insert/update/delete. rayla_messages carries a
-- denormalized user_id so the same policy shape works on both tables and
-- policy checks stay O(1) without a join.

create table if not exists public.rayla_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.rayla_conversations is
  'Ask Rayla conversation threads. One row per distinct chat a user has started.';

create index if not exists rayla_conversations_user_updated_idx
  on public.rayla_conversations (user_id, updated_at desc);

create table if not exists public.rayla_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.rayla_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  constraint rayla_messages_role_check check (role in ('user', 'assistant', 'system'))
);

comment on table public.rayla_messages is
  'Ordered messages within a rayla_conversations thread. user_id is denormalized so RLS does not require a join.';

create index if not exists rayla_messages_conversation_created_idx
  on public.rayla_messages (conversation_id, created_at asc);

create index if not exists rayla_messages_user_conversation_idx
  on public.rayla_messages (user_id, conversation_id);

-- --------------------------------------------------------------------------
-- Row-Level Security
-- --------------------------------------------------------------------------

alter table public.rayla_conversations enable row level security;
alter table public.rayla_messages enable row level security;

drop policy if exists "Users can read their own rayla conversations" on public.rayla_conversations;
create policy "Users can read their own rayla conversations"
on public.rayla_conversations
for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their own rayla conversations" on public.rayla_conversations;
create policy "Users can create their own rayla conversations"
on public.rayla_conversations
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own rayla conversations" on public.rayla_conversations;
create policy "Users can update their own rayla conversations"
on public.rayla_conversations
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own rayla conversations" on public.rayla_conversations;
create policy "Users can delete their own rayla conversations"
on public.rayla_conversations
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read their own rayla messages" on public.rayla_messages;
create policy "Users can read their own rayla messages"
on public.rayla_messages
for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their own rayla messages" on public.rayla_messages;
create policy "Users can create their own rayla messages"
on public.rayla_messages
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own rayla messages" on public.rayla_messages;
create policy "Users can update their own rayla messages"
on public.rayla_messages
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own rayla messages" on public.rayla_messages;
create policy "Users can delete their own rayla messages"
on public.rayla_messages
for delete
using (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- Auto-bump updated_at on conversation touches so "most-recent first" sort works.
-- --------------------------------------------------------------------------

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_rayla_conversations_updated_at on public.rayla_conversations;
create trigger set_rayla_conversations_updated_at
before update on public.rayla_conversations
for each row
execute procedure public.set_current_timestamp_updated_at();
