# Rayla — Apple IAP Technical Design

**Status:** Planning  
**Scope:** Stripe (current) + Apple In-App Purchase (future)  
**Last updated:** 2026-06-15

---

## 1. Current Stripe Flow

### Signup → Paywall → Checkout

1. User creates account → email verified → session established in `App.jsx`
2. App fetches `user_subscriptions` row for the user from Supabase (`fetchBillingSubscription`, App.jsx ~15296)
3. `hasActiveRaylaSubscription(billingSubscription)` checks `status === "active"` or valid `"trialing"` — returns false for new users
4. `UnlockRaylaPage` is rendered (App.jsx ~21973)
5. User clicks "Start 14-day trial" → `handleStartStripeCheckout` calls edge function `stripe-create-checkout-session`
6. Edge function creates/retrieves Stripe customer, creates Stripe Checkout Session with 14-day trial, UPSERTs `user_subscriptions` row with `status = "checkout_started"`
7. Frontend redirects to Stripe-hosted checkout via `window.location.assign(data.url)`
8. User completes payment on Stripe → redirected back to `/?billing=checkout_success`

### Webhook sync (ongoing)

Stripe sends events to `stripe-webhook` edge function. The function verifies HMAC-SHA256 signature and calls `syncSubscriptionForUser()`, which UPSERTs `user_subscriptions` with:

| Stripe event | Resulting `status` |
|---|---|
| `checkout.session.completed` | trialing / active |
| `customer.subscription.created` | trialing / active |
| `customer.subscription.updated` | mirrors Stripe status |
| `customer.subscription.deleted` | canceled |
| `invoice.paid` | active |
| `invoice.payment_failed` | past\_due |

### Subscription management

- User opens portal → `handleOpenStripePortal` → `stripe-create-portal-session` edge function → redirect to Stripe billing portal
- Portal is only offered when `stripe_customer_id` is present on the subscription row
- Return URL: `/?billing=portal_return`

### Discount / founder codes

`redeem-discount-code` edge function accepts a code, validates it against `RAYLA_DISCOUNT_CODE` env var (default: `RAYLA-DISCOUNT-FREE`) and legacy codes, then UPSERTs `user_subscriptions` with `status = "active"`, `plan_key = "rayla_discount"`. No Stripe involvement.

### Access gate (App.jsx ~11916)

```js
function hasActiveRaylaSubscription(subscription) {
  const status = String(subscription?.status || "inactive").toLowerCase();
  if (status === "active") return true;
  if (status !== "trialing") return false;
  if (!subscription?.trial_ends_at) return true;
  return new Date(subscription.trial_ends_at).getTime() > Date.now();
}
```

This function reads only `status` and `trial_ends_at`. It has no concept of payment source. **It is already source-agnostic.**

---

## 2. Future Apple IAP Flow

### Overview

Apple In-App Purchase (StoreKit 2) requires that:
- The iOS app initiates and completes the purchase natively (not via a webview or external link)
- Verification happens server-side using signed JWS transactions from Apple
- Subscription lifecycle events (renewals, cancellations, billing failures) are delivered via Apple App Store Server Notifications V2
- Rayla's backend maps Apple subscription state into the existing `user_subscriptions` table

### Purchase flow (iOS)

1. User opens Rayla iOS app → same session flow → same paywall check
2. `UnlockRaylaPage` detects iOS native context (via `Capacitor.isNativePlatform()`) and renders an "Subscribe on App Store" button instead of the Stripe checkout button
3. Tapping the button calls the Capacitor IAP plugin (e.g., RevenueCat SDK or raw StoreKit 2), which presents the native App Store purchase sheet
4. On purchase completion, StoreKit 2 returns a signed JWS transaction
5. iOS app sends the JWS to a new Rayla edge function: `apple-iap-verify`
6. Edge function verifies the JWS with Apple's server API, extracts subscription data, UPSERTs `user_subscriptions` with `status = "active"`, `source = "apple"`, metadata with Apple-specific fields
7. Frontend polls or re-fetches `billingSubscription` → `hasActiveRaylaSubscription` returns true → user enters app

### Webhook/notification sync (ongoing)

Apple sends App Store Server Notifications V2 (JWS-signed) to a new Rayla edge function: `apple-iap-webhook`.

| Apple notification type | Resulting `status` |
|---|---|
| `SUBSCRIBED` / `DID_RENEW` | active |
| `DID_FAIL_TO_RENEW` | past\_due |
| `GRACE_PERIOD_EXPIRED` | canceled |
| `EXPIRED` | canceled |
| `REVOKE` | canceled |
| `REFUND` | canceled |

Apple's grace period behavior: when a renewal payment fails, Apple grants a grace period before canceling. During grace period, Rayla should continue granting access (`status` stays `active`). On `GRACE_PERIOD_EXPIRED`, set `status = "canceled"`.

### Subscription management

Apple IAP subscriptions are managed entirely through the App Store (Settings → Apple ID → Subscriptions). Rayla cannot cancel or modify them. On iOS, the "Manage billing" button should either be hidden or replaced with "Manage in App Store" (which deep-links to `itms-apps://apps.apple.com/account/subscriptions`).

---

## 3. Required Database Changes

### New column: `source`

```sql
ALTER TABLE user_subscriptions
  ADD COLUMN source text NOT NULL DEFAULT 'stripe'
  CHECK (source IN ('stripe', 'apple', 'discount'));
```

Existing Stripe rows get `source = 'stripe'` by default. The `redeem-discount-code` function needs one-line update to write `source = 'discount'`.

### New metadata fields (stored in existing `metadata jsonb` column)

Apple-specific fields written by `apple-iap-verify` and `apple-iap-webhook`:

| Field | Type | Description |
|---|---|---|
| `apple_original_transaction_id` | string | Stable identifier for the subscription across renewals |
| `apple_product_id` | string | App Store product ID (e.g., `com.rayla.app.monthly`) |
| `apple_expires_date_ms` | string | Expiry timestamp in milliseconds |
| `apple_environment` | string | `Sandbox` or `Production` |
| `last_apple_notification_type` | string | Most recent notification type from Apple |
| `last_apple_notification_at` | ISO string | Timestamp of last Apple notification |

Using `metadata` jsonb avoids new columns for Apple-specific fields and keeps the schema clean. The `apple_original_transaction_id` should be indexed if lookup by Apple transaction ID is needed (e.g., for webhook matching).

### No changes required to

- `status` CHECK constraint — existing values (`active`, `canceled`, `past_due`, `trialing`) cover all Apple states
- `plan_key` — Apple subscriptions use `"rayla_base"` same as Stripe
- `user_id` unique constraint — one row per user, regardless of source
- `hasActiveRaylaSubscription` — reads `status` only, already source-agnostic

---

## 4. Required Edge Functions

### `apple-iap-verify` (new)

**Trigger:** Called by iOS app after a successful StoreKit 2 purchase  
**Auth:** `verify_jwt = true` (user must be authenticated)  
**Input:** `{ signedTransaction: string }` — JWS transaction from StoreKit 2  

**Logic:**
1. Verify the JWS using Apple's `/inApps/v1/transactions/{transactionId}` endpoint with the shared secret or private key
2. Decode the payload to extract `originalTransactionId`, `productId`, `expiresDate`, `inAppOwnershipType`
3. Reject if `inAppOwnershipType === "FAMILY_SHARED"` if family sharing is not intended
4. UPSERT `user_subscriptions` with `status = "active"`, `source = "apple"`, metadata fields above
5. Return `{ ok: true, subscription: <row> }`

**Environment variables needed:**
- `APPLE_BUNDLE_ID` — e.g., `com.rayla.app`
- `APPLE_SHARED_SECRET` — for receipt validation (legacy) OR
- `APPLE_PRIVATE_KEY` / `APPLE_KEY_ID` / `APPLE_ISSUER_ID` — for App Store Connect API (StoreKit 2 server API)

### `apple-iap-webhook` (new)

**Trigger:** Apple App Store Server Notifications V2 POST  
**Auth:** `verify_jwt = false` (Apple calls this directly, not the user)  
**Input:** Raw JWS string from Apple  

**Logic:**
1. Decode and verify the outer JWS (signed by Apple's certificate chain)
2. Extract `notificationType`, `subtype`, `data.signedTransactionInfo`
3. Decode the inner JWS transaction to get `originalTransactionId`, `expiresDate`
4. Look up `user_subscriptions` row by `metadata->>'apple_original_transaction_id'`
5. Map notification type to `status` (see table in section 2)
6. UPDATE the row with new status and `last_apple_notification_type`
7. Return `200 OK` — Apple will retry on any non-2xx

**Failure handling:** Any verification failure should return `200` (to stop Apple retrying) and log the error internally. Apple retries on 4xx/5xx, so returning errors causes noise.

### Existing functions — no changes required

| Function | Reason unchanged |
|---|---|
| `stripe-webhook` | Stripe-only path, unaffected |
| `stripe-create-checkout-session` | Web-only, unaffected |
| `stripe-create-portal-session` | Stripe-only, unaffected |
| `redeem-discount-code` | Minor: add `source: "discount"` to upsert |

---

## 5. Required Frontend Changes

### Platform detection

Use `Capacitor.isNativePlatform()` (already a dependency via cap sync workflow). Returns `true` on iOS/Android native, `false` on web.

```js
import { Capacitor } from "@capacitor/core";
const isNative = Capacitor.isNativePlatform();
```

### `UnlockRaylaPage` — conditional payment path

Currently renders one Stripe-only path. Needs two branches:

**Web (`!isNative`):** Unchanged — Stripe checkout button, discount code form, manage billing.

**iOS native (`isNative`):**
- Hide Stripe checkout button (App Store rules prohibit linking to external payment for in-app digital goods)
- Hide discount code form (same rule — cannot offer cheaper price outside IAP)
- Show "Subscribe on App Store" button → triggers native IAP via Capacitor plugin
- Show "Manage in App Store" link → `itms-apps://apps.apple.com/account/subscriptions`

### IAP plugin

Use **RevenueCat** Capacitor SDK (`@revenuecat/purchases-capacitor`) or raw `@capacitor-community/in-app-purchases`. RevenueCat is recommended because it:
- Handles receipt validation server-side (reducing custom edge function complexity)
- Provides a webhook that can replace `apple-iap-webhook`
- Normalizes cross-platform IAP (future Android support)
- Has a Supabase integration example

If RevenueCat is used, `apple-iap-verify` and `apple-iap-webhook` may be replaced by RevenueCat webhooks → Supabase edge function that accepts RevenueCat's normalized payload.

### Billing management state

`handleOpenStripePortal` is already guarded by `stripe_customer_id` — Apple subscribers won't have one, so the portal button won't appear. No change needed to the guard logic.

Optionally: check `source === "apple"` to show "Manage in App Store" text in the account/settings area.

---

## 6. App Store Compliance Considerations

### IAP requirement for digital goods

Apple requires that all purchases of digital goods or services within an iOS app use In-App Purchase. External payment links (e.g., Stripe checkout) are prohibited for in-app digital goods in the iOS app. Web users are unaffected — the web app can continue using Stripe.

**Implication:** The Stripe checkout button must not appear in the native iOS app. The discount code form must also not appear (it grants access at a lower price than the App Store price, which violates guidelines).

### Pricing parity

The App Store price must not be higher than prices offered on other platforms. If Rayla charges $30/month on web, the iOS IAP price should match (or App Store pricing tiers may differ slightly due to Apple's fixed price tiers). Apple takes a 15–30% commission, so the economics change for IAP purchases.

### Free trial

Apple IAP supports introductory offers (free trials). A 14-day free trial can be configured as an introductory price in App Store Connect. This replaces the Stripe trial for iOS users. The `trial_ends_at` field in `user_subscriptions` should be populated from the Apple transaction's introductory period data.

### Restore purchases

Apple requires a "Restore Purchases" button in the IAP UI. Tapping it calls `Purchases.restorePurchases()` (RevenueCat) or StoreKit's `AppStore.sync()`, retrieves the user's existing subscription, and re-verifies with the backend. `apple-iap-verify` handles this identically to a new purchase.

### Sandbox testing

Apple provides a Sandbox environment for IAP testing. The `apple-iap-verify` edge function should check the `environment` field in the JWS payload and route verification to `https://api.storekit-sandbox.itunes.apple.com` for sandbox transactions. Sandbox subscriptions renew on an accelerated schedule (1 month = 5 minutes).

### Review guideline 3.1.1

Apple reviewers will create a test account and attempt to subscribe. The IAP sheet must appear correctly and the subscription must activate. If the app shows a Stripe payment path during review, it will be rejected.

---

## Implementation Sequence (when ready to build)

1. Database migration — add `source` column
2. App Store Connect — create IAP product, configure 14-day trial, set pricing
3. `apple-iap-verify` edge function + sandbox testing
4. iOS Capacitor plugin integration (RevenueCat or raw StoreKit 2)
5. `UnlockRaylaPage` platform split — web vs iOS UI
6. `apple-iap-webhook` edge function for lifecycle events
7. Update `redeem-discount-code` to write `source = "discount"`
8. TestFlight testing with sandbox IAP
9. Production App Store submission
