create extension if not exists pgcrypto;

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'inactive',
  plan_key text not null default 'rayla_base',
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_subscriptions_user_key unique (user_id),
  constraint user_subscriptions_status_check check (
    status in (
      'inactive',
      'checkout_started',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'unpaid',
      'paused'
    )
  )
);

comment on table public.user_subscriptions is 'Server-synced Stripe subscription state for Rayla users. Stripe webhooks are the source of truth.';
comment on column public.user_subscriptions.status is 'Stripe subscription status, or checkout_started before Stripe confirms subscription state.';

drop trigger if exists set_user_subscriptions_updated_at on public.user_subscriptions;
create trigger set_user_subscriptions_updated_at
before update on public.user_subscriptions
for each row
execute procedure public.set_current_timestamp_updated_at();

create index if not exists user_subscriptions_stripe_customer_idx
on public.user_subscriptions (stripe_customer_id);

create index if not exists user_subscriptions_stripe_subscription_idx
on public.user_subscriptions (stripe_subscription_id);

alter table public.user_subscriptions enable row level security;

drop policy if exists "Users can read their own subscription" on public.user_subscriptions;
create policy "Users can read their own subscription"
on public.user_subscriptions
for select
using (auth.uid() = user_id);

