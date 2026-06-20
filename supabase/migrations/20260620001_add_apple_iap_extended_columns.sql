-- Apple IAP phase 2: promote frequently-queried Apple fields out of the
-- metadata JSONB into typed columns so they can be indexed and read without
-- JSON parsing. All columns are nullable — Stripe rows stay untouched.

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS apple_transaction_id text,
  ADD COLUMN IF NOT EXISTS apple_environment    text,
  ADD COLUMN IF NOT EXISTS apple_expires_at     timestamptz,
  ADD COLUMN IF NOT EXISTS apple_status         text;

CREATE INDEX IF NOT EXISTS user_subscriptions_apple_environment_idx
  ON public.user_subscriptions (apple_environment)
  WHERE apple_environment IS NOT NULL;

COMMENT ON COLUMN public.user_subscriptions.apple_transaction_id
  IS 'Apple StoreKit 2 transactionId for the most recent transaction (renewal). Changes on each renewal; pair with apple_original_transaction_id which stays stable.';
COMMENT ON COLUMN public.user_subscriptions.apple_environment
  IS 'Apple environment for the most recent transaction: Production or Sandbox.';
COMMENT ON COLUMN public.user_subscriptions.apple_expires_at
  IS 'Apple subscription expiration timestamp. Mirrors current_period_end for Apple-billed rows; kept separately so Apple-specific queries do not need a billing_provider filter.';
COMMENT ON COLUMN public.user_subscriptions.apple_status
  IS 'Raw Apple subscription state: ACTIVE/EXPIRED from transaction info, or the notification type (DID_RENEW, REVOKE, etc.) that last touched the row. The generic status column remains the source of truth for access gating.';
