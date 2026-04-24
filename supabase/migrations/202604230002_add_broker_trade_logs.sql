create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.broker_trade_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  broker_provider text not null,
  broker_order_id text not null,
  symbol text not null,
  side text not null,
  qty numeric not null,
  order_type text not null,
  limit_price numeric,
  time_in_force text,
  status text not null,
  source text not null check (source in ('rayla', 'alpaca_import')),
  submitted_at timestamptz,
  filled_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_trade_logs_user_provider_order_key unique (user_id, broker_provider, broker_order_id)
);

comment on table public.broker_trade_logs is 'Persisted brokerage order/trade activity synced into Rayla.';

alter table public.broker_trade_logs enable row level security;

drop trigger if exists set_broker_trade_logs_updated_at on public.broker_trade_logs;
create trigger set_broker_trade_logs_updated_at
before update on public.broker_trade_logs
for each row
execute procedure public.set_current_timestamp_updated_at();

drop policy if exists "Users can read their own broker trade logs" on public.broker_trade_logs;
create policy "Users can read their own broker trade logs"
on public.broker_trade_logs
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own broker trade logs" on public.broker_trade_logs;
create policy "Users can insert their own broker trade logs"
on public.broker_trade_logs
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own broker trade logs" on public.broker_trade_logs;
create policy "Users can update their own broker trade logs"
on public.broker_trade_logs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own broker trade logs" on public.broker_trade_logs;
create policy "Users can delete their own broker trade logs"
on public.broker_trade_logs
for delete
using (auth.uid() = user_id);
