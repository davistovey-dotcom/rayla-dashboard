-- Trade Reflection Engine (Phase 2.1) — long-term behavioral memory.
--
-- When a live brokerage position fully closes, the client detects the close
-- and inserts ONE pending row here. On the user's next Ask Rayla overlay
-- open (post-Rayla-Daily), the overlay spawns a new conversation seeded
-- with the row's `reflection_question`. The user's first reply becomes
-- `user_response` + populates `answered_at`; the conversation then
-- continues normally.
--
-- Columns
--   id                    row id
--   user_id               owner
--   trade_id              stable synthetic id for the specific closed
--                         trade: '{broker_env}:{SYMBOL}:{entry.4f}:{close_ymd}'.
--                         Reproducible across re-detections so the UNIQUE
--                         constraint below prevents duplicate insertion if
--                         the client watcher fires twice for the same
--                         close event.
--   reflection_question   the coaching question shown to the user (client
--                         picks from a small template pool based on outcome)
--   user_response         NULL until answered; the user's first reply in
--                         the reflection conversation. Free text.
--   reflection_type       currently only 'trade_close'; future types are
--                         allowed by the CHECK below without a migration.
--   behavior_tags         reserved for future tagging (Investor Score,
--                         ALP, Weekly Review can populate later). '[]' now.
--   metadata              arbitrary extension bag. The client stores the
--                         symbol, P/L snapshot, side, and broker
--                         environment here at creation time so downstream
--                         consumers don't need to re-derive.
--   created_at            insertion time
--   answered_at           set when the user submits their first reply
--
-- Uniqueness
--   UNIQUE (user_id, trade_id, reflection_type) — the primary defence
--   against duplicates from client re-detection. Multiple reflection_type
--   values per trade are permitted in the future (e.g. 'entry_reflection'
--   alongside 'trade_close') without violating the constraint.

create table if not exists public.trade_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_id text not null,
  reflection_question text not null,
  user_response text,
  reflection_type text not null default 'trade_close'
    check (reflection_type in ('trade_close', 'entry_reflection', 'portfolio_review', 'other')),
  behavior_tags jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  constraint trade_reflections_unique_per_trade_type
    unique (user_id, trade_id, reflection_type)
);

comment on table public.trade_reflections is
  'Coaching-style reflections tied to a specific closed brokerage trade. One pending row is created per closed trade; the user answers on their next Ask Rayla overlay open.';
comment on column public.trade_reflections.trade_id is
  'Stable synthetic id ''{broker_env}:{SYMBOL}:{entry_price.4f}:{close_ymd}''. Reproducible so re-detection is idempotent via the UNIQUE constraint.';
comment on column public.trade_reflections.answered_at is
  'NULL = pending (client will surface on next overlay open); non-NULL = the row is a completed reflection consumable by future scoring systems.';

-- Fast pending lookup — the client fetches oldest unanswered on every
-- overlay open. Partial index keeps the scan cheap even as answered rows
-- accumulate.
create index if not exists trade_reflections_user_pending_idx
  on public.trade_reflections (user_id, created_at asc)
  where answered_at is null;

-- Chronological feed — the Decision Log renders answered reflections
-- interleaved with decision_ledger_entries, both sorted newest-first.
create index if not exists trade_reflections_user_created_idx
  on public.trade_reflections (user_id, created_at desc);

-- --------------------------------------------------------------------------
-- Row-Level Security — strict per-user isolation
-- --------------------------------------------------------------------------

alter table public.trade_reflections enable row level security;

drop policy if exists "Users can read their own trade reflections" on public.trade_reflections;
create policy "Users can read their own trade reflections"
on public.trade_reflections
for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their own trade reflections" on public.trade_reflections;
create policy "Users can create their own trade reflections"
on public.trade_reflections
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own trade reflections" on public.trade_reflections;
create policy "Users can update their own trade reflections"
on public.trade_reflections
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own trade reflections" on public.trade_reflections;
create policy "Users can delete their own trade reflections"
on public.trade_reflections
for delete
using (auth.uid() = user_id);
