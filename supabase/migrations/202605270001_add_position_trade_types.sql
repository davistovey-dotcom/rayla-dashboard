alter table public.trades
add column if not exists trade_type text not null default 'day_trade';

alter table public.broker_trade_logs
add column if not exists trade_type text not null default 'day_trade';

update public.trades
set trade_type = 'investment'
where trade_type = 'crypto_hold';

update public.broker_trade_logs
set trade_type = 'investment'
where trade_type = 'crypto_hold';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trades_trade_type_check'
      and conrelid = 'public.trades'::regclass
  ) then
    alter table public.trades
    add constraint trades_trade_type_check
    check (trade_type in ('day_trade', 'swing_trade', 'investment'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'broker_trade_logs_trade_type_check'
      and conrelid = 'public.broker_trade_logs'::regclass
  ) then
    alter table public.broker_trade_logs
    add constraint broker_trade_logs_trade_type_check
    check (trade_type in ('day_trade', 'swing_trade', 'investment'));
  end if;
end $$;

create table if not exists public.position_trade_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  broker_provider text not null default 'alpaca',
  symbol text not null,
  trade_type text not null default 'day_trade',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint position_trade_types_trade_type_check
    check (trade_type in ('day_trade', 'swing_trade', 'investment')),
  constraint position_trade_types_user_provider_symbol_key unique (user_id, broker_provider, symbol)
);

update public.position_trade_types
set trade_type = 'investment'
where trade_type = 'crypto_hold';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'position_trade_types_trade_type_check'
      and conrelid = 'public.position_trade_types'::regclass
  ) then
    alter table public.position_trade_types
    add constraint position_trade_types_trade_type_check
    check (trade_type in ('day_trade', 'swing_trade', 'investment'));
  end if;
end $$;

comment on table public.position_trade_types is 'Rayla source of truth for user-selected trade classification on open broker positions.';

drop trigger if exists set_position_trade_types_updated_at on public.position_trade_types;
create trigger set_position_trade_types_updated_at
before update on public.position_trade_types
for each row
execute procedure public.set_current_timestamp_updated_at();

alter table public.position_trade_types enable row level security;

drop policy if exists "Users can read their own position trade types" on public.position_trade_types;
create policy "Users can read their own position trade types"
on public.position_trade_types
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own position trade types" on public.position_trade_types;
create policy "Users can insert their own position trade types"
on public.position_trade_types
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own position trade types" on public.position_trade_types;
create policy "Users can update their own position trade types"
on public.position_trade_types
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own position trade types" on public.position_trade_types;
create policy "Users can delete their own position trade types"
on public.position_trade_types
for delete
using (auth.uid() = user_id);

do $$
begin
  alter publication supabase_realtime add table public.position_trade_types;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
