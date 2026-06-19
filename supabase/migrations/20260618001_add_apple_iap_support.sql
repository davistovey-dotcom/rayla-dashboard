-- Phase 1: Add billing_provider and Apple IAP columns to user_subscriptions.
-- Existing Stripe subscribers are backfilled to billing_provider = 'stripe'.
-- No Apple logic is active yet — columns are additive only.

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS billing_provider                text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS apple_original_transaction_id   text,
  ADD COLUMN IF NOT EXISTS apple_product_id                text,
  ADD COLUMN IF NOT EXISTS apple_bundle_id                 text;

-- Valid providers only
ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_billing_provider_check
  CHECK (billing_provider IN ('stripe', 'apple'));

-- Partial unique index: apple_original_transaction_id must be unique when set.
-- NULL values are not constrained — all current Stripe rows remain NULL without issue.
CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_apple_txn_unique_idx
  ON public.user_subscriptions (apple_original_transaction_id)
  WHERE apple_original_transaction_id IS NOT NULL;

-- Provider lookup index
CREATE INDEX IF NOT EXISTS user_subscriptions_billing_provider_idx
  ON public.user_subscriptions (billing_provider);

-- Backfill: column DEFAULT handles rows added after migration;
-- explicit UPDATE ensures any rows created before migration have the correct value.
UPDATE public.user_subscriptions
  SET billing_provider = 'stripe'
  WHERE billing_provider IS NULL OR billing_provider != 'apple';

-- Column comments
COMMENT ON COLUMN public.user_subscriptions.billing_provider IS 'Payment provider: stripe or apple. Determines which platform manages subscription lifecycle.';
COMMENT ON COLUMN public.user_subscriptions.apple_original_transaction_id IS 'Apple StoreKit 2 originalTransactionId. Stable identifier for an Apple subscription across renewals.';
COMMENT ON COLUMN public.user_subscriptions.apple_product_id IS 'Apple App Store product ID (e.g. com.rayla.app.monthly).';
COMMENT ON COLUMN public.user_subscriptions.apple_bundle_id IS 'Apple app bundle ID used to scope and validate App Store receipts.';
