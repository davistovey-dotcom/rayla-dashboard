create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  broker_provider text not null default 'alpaca',
  timestamp timestamptz not null default now(),
  source text not null default 'broker_refresh',
  timeframe text not null default 'snapshot',
  total_market_value numeric not null default 0,
  cash numeric not null default 0,
  equity numeric not null default 0,
  day_pl numeric not null default 0,
  positions_count integer not null default 0,
  positions_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.portfolio_snapshots is 'Historical broker portfolio snapshots used for Rayla portfolio performance charts.';

create index if not exists portfolio_snapshots_user_timestamp_idx
on public.portfolio_snapshots (user_id, timestamp desc);

create index if not exists portfolio_snapshots_user_provider_timestamp_idx
on public.portfolio_snapshots (user_id, broker_provider, timestamp desc);

alter table public.portfolio_snapshots enable row level security;

drop policy if exists "Users can read their own portfolio snapshots" on public.portfolio_snapshots;
create policy "Users can read their own portfolio snapshots"
on public.portfolio_snapshots
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own portfolio snapshots" on public.portfolio_snapshots;
create policy "Users can insert their own portfolio snapshots"
on public.portfolio_snapshots
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own portfolio snapshots" on public.portfolio_snapshots;
create policy "Users can delete their own portfolio snapshots"
on public.portfolio_snapshots
for delete
using (auth.uid() = user_id);

do $$
begin
  alter publication supabase_realtime add table public.portfolio_snapshots;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
