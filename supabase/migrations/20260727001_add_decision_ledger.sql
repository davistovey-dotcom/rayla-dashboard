-- Decision Ledger — first vertical slice of Rayla's Investor Review.
-- Stores user-authored decision entries (plans, trades, reflections, rule checks).
-- Every field except id/user_id/created_at/entry_type/decision/metadata is nullable
-- so the user can capture what they know now and backfill outcome/lesson later.
-- No fabricated behavioral conclusions are ever written here — only user-supplied data.

create table if not exists public.decision_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  entry_type text not null,
  symbol text,
  decision text not null,
  reasoning text,
  confidence smallint,
  emotion text,
  rule_followed boolean,
  source text,
  outcome text,
  lesson text,
  metadata jsonb not null default '{}'::jsonb,
  constraint decision_ledger_entries_entry_type_check
    check (entry_type in ('plan', 'trade', 'reflection', 'rule_check', 'other')),
  constraint decision_ledger_entries_confidence_range
    check (confidence is null or (confidence between 1 and 10))
);

comment on table public.decision_ledger_entries is
  'User-authored decisions and reflections. Feeds Rayla''s Investor Review. Every row represents a fact the user recorded — Rayla never writes to this table on the user''s behalf.';
comment on column public.decision_ledger_entries.entry_type is
  'plan: pre-trade intent; trade: execution note; reflection: post-hoc thought; rule_check: was a personal rule followed; other.';
comment on column public.decision_ledger_entries.confidence is
  'User-reported confidence on a 1-10 scale. Optional.';
comment on column public.decision_ledger_entries.rule_followed is
  'Whether the user believes they followed their own trading rule for this decision. Optional.';
comment on column public.decision_ledger_entries.source is
  'Where the decision originated: manual, ask_rayla, journal, picks, etc. Optional free text.';
comment on column public.decision_ledger_entries.outcome is
  'User-recorded outcome (won, lost, closed early, still open). Backfilled later.';
comment on column public.decision_ledger_entries.lesson is
  'User-written takeaway. Backfilled later.';

create index if not exists decision_ledger_entries_user_created_idx
  on public.decision_ledger_entries (user_id, created_at desc);

create index if not exists decision_ledger_entries_user_symbol_idx
  on public.decision_ledger_entries (user_id, symbol)
  where symbol is not null;

create index if not exists decision_ledger_entries_user_type_created_idx
  on public.decision_ledger_entries (user_id, entry_type, created_at desc);

alter table public.decision_ledger_entries enable row level security;

drop policy if exists "Users can read their own decision ledger entries" on public.decision_ledger_entries;
create policy "Users can read their own decision ledger entries"
on public.decision_ledger_entries
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own decision ledger entries" on public.decision_ledger_entries;
create policy "Users can insert their own decision ledger entries"
on public.decision_ledger_entries
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own decision ledger entries" on public.decision_ledger_entries;
create policy "Users can update their own decision ledger entries"
on public.decision_ledger_entries
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own decision ledger entries" on public.decision_ledger_entries;
create policy "Users can delete their own decision ledger entries"
on public.decision_ledger_entries
for delete
using (auth.uid() = user_id);

do $$
begin
  alter publication supabase_realtime add table public.decision_ledger_entries;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
