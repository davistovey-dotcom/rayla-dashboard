-- Backfill broker_environment for historical broker_trade_logs rows.
--
-- Migration 20260727002 added the broker_environment column with NULL for
-- pre-existing rows and the client query in fetchBrokerTradeLog filters with
-- strict equality (broker_environment = activeEnv). Because NULL never equals
-- anything, historical rows disappeared from BOTH paper and live views. The
-- comment on 20260727002 claimed the next sync would heal these rows via
-- upsert, but alpaca-orders only pulls the 50 most recent orders plus open
-- orders — older filled/canceled rows never re-upsert, so they stay NULL
-- forever.
--
-- This migration backfills deterministically at deploy time so live and paper
-- history remain visible without reintroducing env mixing. Each tier assigns
-- rows only when the env can be proven; rows the tiers cannot prove stay NULL
-- and remain hidden — env isolation is preserved.
--
-- Attribution tiers (highest confidence first):
--
--   1. raw_payload.account_id matches user_broker_connections.broker_user_id
--      Alpaca's /v2/orders responses include the account_id UUID of the
--      account that placed the order. alpaca-connect-callback stores that
--      same UUID as broker_user_id (functions/alpaca-connect-callback:70).
--      Per-row, per-account: authoritative.
--
--   2. Single-env-user rule. The (user_id, provider, is_paper) unique
--      constraint guarantees a user has at most one connection per env. If a
--      user has exactly one connection row, every historical trade must be
--      that env — no other env has ever existed for them.
--
--   3. Time-window inference for users with both env connections. If a row's
--      submitted_at predates one env's connection (created_at) but not the
--      other, it can only have originated from the env that already existed.
--      Re-connects preserve created_at (upsert onConflict updates rows in
--      place; created_at default only fires on insert), so this remains
--      accurate across token refreshes.

update public.broker_trade_logs t
set broker_environment = case when c.is_paper then 'paper' else 'live' end
from public.user_broker_connections c
where t.broker_environment is null
  and t.broker_provider = 'alpaca'
  and t.user_id = c.user_id
  and c.provider = 'alpaca'
  and c.broker_user_id is not null
  and t.raw_payload->>'account_id' = c.broker_user_id;

with single_env_users as (
  select
    user_id,
    bool_and(is_paper) as all_paper
  from public.user_broker_connections
  where provider = 'alpaca'
  group by user_id
  having count(distinct is_paper) = 1
)
update public.broker_trade_logs t
set broker_environment = case when s.all_paper then 'paper' else 'live' end
from single_env_users s
where t.broker_environment is null
  and t.broker_provider = 'alpaca'
  and t.user_id = s.user_id;

with both_env_users as (
  select
    user_id,
    max(created_at) filter (where is_paper) as paper_created_at,
    max(created_at) filter (where not is_paper) as live_created_at
  from public.user_broker_connections
  where provider = 'alpaca'
  group by user_id
  having count(distinct is_paper) = 2
)
update public.broker_trade_logs t
set broker_environment = case
    when coalesce(t.submitted_at, t.created_at) < b.live_created_at
         and coalesce(t.submitted_at, t.created_at) >= b.paper_created_at
      then 'paper'
    when coalesce(t.submitted_at, t.created_at) < b.paper_created_at
         and coalesce(t.submitted_at, t.created_at) >= b.live_created_at
      then 'live'
  end
from both_env_users b
where t.broker_environment is null
  and t.broker_provider = 'alpaca'
  and t.user_id = b.user_id
  and (
    (coalesce(t.submitted_at, t.created_at) < b.live_created_at
     and coalesce(t.submitted_at, t.created_at) >= b.paper_created_at)
    or
    (coalesce(t.submitted_at, t.created_at) < b.paper_created_at
     and coalesce(t.submitted_at, t.created_at) >= b.live_created_at)
  );

do $$
declare
  null_count integer;
  paper_count integer;
  live_count integer;
begin
  select count(*) into null_count from public.broker_trade_logs where broker_environment is null;
  select count(*) into paper_count from public.broker_trade_logs where broker_environment = 'paper';
  select count(*) into live_count from public.broker_trade_logs where broker_environment = 'live';
  raise notice 'broker_trade_logs env backfill: paper=%, live=%, still_null=%', paper_count, live_count, null_count;
end $$;

comment on column public.broker_trade_logs.broker_environment is
  'Alpaca account environment for this order: paper or live. Backfilled by migration 20260727003 using (1) raw_payload.account_id matched to user_broker_connections.broker_user_id, (2) single-env-user rule, (3) time-window inference from connection.created_at. NULL only for rows genuinely unattributable (raw_payload lacks account_id AND user has both envs connected AND submission postdates both connections).';
