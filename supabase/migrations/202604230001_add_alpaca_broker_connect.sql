create extension if not exists pgcrypto;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_broker_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  broker_user_id text,
  access_token text not null,
  refresh_token text,
  scope text,
  is_paper boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_broker_connections_user_provider_env_key unique (user_id, provider, is_paper)
);

comment on table public.user_broker_connections is 'OAuth-backed broker connections for authenticated Rayla users.';
comment on column public.user_broker_connections.access_token is 'TODO: replace with encrypted-at-rest storage before enabling live trading.';
comment on column public.user_broker_connections.refresh_token is 'TODO: replace with encrypted-at-rest storage before enabling live trading.';

create table if not exists public.broker_oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  state_token text not null unique,
  is_paper boolean not null default true,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.broker_oauth_states is 'Short-lived OAuth state records used during broker connect flows.';

drop trigger if exists set_user_broker_connections_updated_at on public.user_broker_connections;
create trigger set_user_broker_connections_updated_at
before update on public.user_broker_connections
for each row
execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists set_broker_oauth_states_updated_at on public.broker_oauth_states;
create trigger set_broker_oauth_states_updated_at
before update on public.broker_oauth_states
for each row
execute procedure public.set_current_timestamp_updated_at();

alter table public.user_broker_connections enable row level security;
alter table public.broker_oauth_states enable row level security;

drop policy if exists "Users can read their own broker connections" on public.user_broker_connections;
create policy "Users can read their own broker connections"
on public.user_broker_connections
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own broker connections" on public.user_broker_connections;
create policy "Users can insert their own broker connections"
on public.user_broker_connections
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own broker connections" on public.user_broker_connections;
create policy "Users can update their own broker connections"
on public.user_broker_connections
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own broker connections" on public.user_broker_connections;
create policy "Users can delete their own broker connections"
on public.user_broker_connections
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read their own broker oauth states" on public.broker_oauth_states;
create policy "Users can read their own broker oauth states"
on public.broker_oauth_states
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own broker oauth states" on public.broker_oauth_states;
create policy "Users can insert their own broker oauth states"
on public.broker_oauth_states
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own broker oauth states" on public.broker_oauth_states;
create policy "Users can update their own broker oauth states"
on public.broker_oauth_states
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own broker oauth states" on public.broker_oauth_states;
create policy "Users can delete their own broker oauth states"
on public.broker_oauth_states
for delete
using (auth.uid() = user_id);
