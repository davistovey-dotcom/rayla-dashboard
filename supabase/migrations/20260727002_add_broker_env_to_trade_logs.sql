-- Add explicit brokerage environment (paper vs live) to broker_trade_logs.
-- Historically, rows were env-blind: reads mixed paper and live activity, and
-- there was no defensible way to attribute the "Picks sharpen as you trade"
-- counter or trade history to the currently selected account.
--
-- Backfill policy: NULL means unknown. We do NOT infer env from row content
-- (Alpaca order JSON does not include env; only the API host does). Historical
-- rows stay NULL and are excluded from env-specific queries until they are
-- re-upserted on the next sync — that natural backfill lets rows heal safely
-- without us guessing.

alter table public.broker_trade_logs
  add column if not exists broker_environment text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'broker_trade_logs_broker_environment_check'
      and conrelid = 'public.broker_trade_logs'::regclass
  ) then
    alter table public.broker_trade_logs
      add constraint broker_trade_logs_broker_environment_check
      check (broker_environment is null or broker_environment in ('paper', 'live'));
  end if;
end $$;

comment on column public.broker_trade_logs.broker_environment is
  'Alpaca account environment for this order: paper or live. NULL means unknown (historical row from before env tracking); such rows are excluded from environment-specific reads.';

create index if not exists broker_trade_logs_user_env_submitted_idx
  on public.broker_trade_logs (user_id, broker_environment, submitted_at desc)
  where broker_environment is not null;
