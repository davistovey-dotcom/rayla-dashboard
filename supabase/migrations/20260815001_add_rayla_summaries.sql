-- Rayla's Summary — historical paragraphs + evidence snapshots.
--
-- Persists every LLM-generated Rayla's Summary paragraph so future
-- generations can compare the investor's current state to who they were
-- before, quote the trend correctly ("third week in a row"), avoid
-- repeating prior phrasing, and honestly say "nothing significant has
-- changed" when that is true.
--
-- Written to only by the rayla-summary edge function on real
-- regeneration. Client-side signature-cache hits do NOT write rows —
-- history should reflect meaningfully different reads, not every page
-- load.

create table if not exists public.rayla_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  signature text not null,
  summary text not null,
  evidence jsonb not null,
  model text
);

comment on table public.rayla_summaries is
  'Historical Rayla''s Summary paragraphs. Enables continuity: each generation compares the investor now vs the investor at prior generations. Written by the rayla-summary edge function only when a real (non-cached) generation happens.';

create index if not exists rayla_summaries_user_created_idx
  on public.rayla_summaries (user_id, created_at desc);

alter table public.rayla_summaries enable row level security;

drop policy if exists "Users can read their own rayla summaries" on public.rayla_summaries;
create policy "Users can read their own rayla summaries"
on public.rayla_summaries
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own rayla summaries" on public.rayla_summaries;
create policy "Users can insert their own rayla summaries"
on public.rayla_summaries
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own rayla summaries" on public.rayla_summaries;
create policy "Users can delete their own rayla summaries"
on public.rayla_summaries
for delete
using (auth.uid() = user_id);
