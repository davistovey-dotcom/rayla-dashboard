# Rayla Dashboard

Rayla is a React + Vite trading journal, simulation, coaching, and market-intel app backed by Supabase.

## Automated Regression QA

Rayla has a lightweight Playwright regression suite for launch-critical client flows.

Run it with:

```bash
npm run test:regression
```

The suite starts the Vite dev server, uses mocked Supabase auth/REST responses for fake QA users, and does not require real user credentials, broker credentials, or real broker orders.

Current coverage:
- auth shell boot and app-level error boundary fallback
- scoped Live Simulation history rendering in Performance
- same-user vs different-user simulation localStorage isolation
- sign-out cleanup for transient simulation/debug state
- Picks eligibility for directional finite-R manual and simulation history
- broker/null-R exclusion from strategy-only analytics, coaching, and Home edge aggregation
- same-timestamp equity chart normalization
- manual trade validation for direction, numeric fields, `+1.5R`, `0R`, and duplicate blocking
- screenshot partial-prefill state reset so stale manual fields do not carry over
- `parse-screenshot` no-auth and invalid-token 401 security boundary

Intentionally not covered yet:
- real Supabase sign-up/sign-in email verification
- real broker refresh/order submission
- real screenshot OCR success with a brokerage image

Those require external accounts, credentials, or image fixtures and should be handled in a separate controlled QA pass.

## Alpaca Trading Integration

Rayla connects to Alpaca via OAuth for both live and paper trading.

Current scope:
- Connect an Alpaca live or paper account with OAuth
- Store the returned Alpaca access token in Supabase (`user_broker_connections`)
- Fetch Alpaca account summary and positions
- Submit user-confirmed live or paper stock and crypto orders through the Live Trades tab
- Persist Rayla-placed and Alpaca-imported brokerage orders in a broker trade log
- Sync intraday and historical portfolio equity from Alpaca's portfolio history endpoint (1D chart mirrors Alpaca web dashboard's 20:00 ET session-close anchor)

Not supported:
- Options
- Auto trading
- Broker account creation (users bring their own Alpaca account)

### Required environment variables

Set these in Supabase Edge Functions:
- `ALPACA_CLIENT_ID`
- `ALPACA_CLIENT_SECRET`
- `ALPACA_REDIRECT_URI`
- `APP_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Existing app env still used elsewhere:
- `VITE_FINNHUB_KEY`

Additional Alpaca market-data env for live market surfaces:
- `ALPACA_MARKET_DATA_KEY_ID`
- `ALPACA_MARKET_DATA_SECRET_KEY`
- `ALPACA_MARKET_DATA_STOCK_FEED` optional, defaults to `iex`

### Alpaca redirect URI setup

Register the exact callback function URL in Alpaca:

`https://<your-supabase-project-ref>.functions.supabase.co/alpaca-connect-callback`

That same value should be stored in:
- `ALPACA_REDIRECT_URI`

`APP_BASE_URL` should point to the Rayla app itself. For example:
- Production: `https://raylainc.live`
- Local: the port `npm run dev` reports (Vite auto-picks in the 5000–5005 range)

### Database setup

Apply the new migration:

- `supabase/migrations/202604230001_add_alpaca_broker_connect.sql`
- `supabase/migrations/202604230002_add_broker_trade_logs.sql`

It creates:
- `user_broker_connections`
- `broker_oauth_states`
- `broker_trade_logs`

Notes:
- RLS is enabled
- users can only access their own rows
- token fields are stored as plain text for now
- TODO: replace token storage with encryption-at-rest before live trading

### Local testing flow

1. Start the app:

```bash
npm install
npm run dev
```

2. Serve Supabase functions locally or deploy them to your Supabase project.

3. Make sure the new functions are available:
- `alpaca-connect-start`
- `alpaca-connect-callback`
- `alpaca-account`
- `alpaca-positions`
- `alpaca-orders`
- `alpaca-place-order`

4. Log in to Rayla.

5. Open the Trade tab and find the `Alpaca Paper Trading` section.

6. Click `Connect Alpaca`.

7. Complete Alpaca OAuth against your Paper account.

8. After redirect back to Rayla, confirm:
- status shows `Connected to Alpaca Paper`
- account summary loads
- positions load

9. Submit a paper stock order with:
- symbol
- side
- qty
- market or limit

10. Refresh account/positions and confirm the order reached Alpaca Paper.

### Brokerage trade log sync

Rayla now keeps a Supabase-backed brokerage trade log in `broker_trade_logs`.

How sync works:
- orders placed from Rayla through `alpaca-place-order` are immediately upserted with `source='rayla'`
- `alpaca-orders` fetches recent Alpaca orders and upserts them with `source='alpaca_import'`
- if an order already exists from Rayla, the sync preserves the `rayla` source instead of overwriting it
- the Trade tab reads from the persisted broker trade log, so brokerage orders are still visible after reloads

## Alpaca Market Data

Rayla now uses Alpaca as the primary source for the live market experience:
- watchlist stock quotes
- watchlist crypto quotes
- live market chart bars/candles
- stock symbol news in the Market tab

Current details:
- the `market-data` edge function now serves Alpaca-backed snapshots, bars, and stock news
- stock market data defaults to the Alpaca `iex` feed for safety and broader availability
- crypto watchlist quotes and bars use Alpaca crypto market data
- the Market tab chart is now rendered from Alpaca bars instead of a TradingView iframe

Current limitations:
- the broader `Intel` workflow still uses the existing hybrid news/intel sources in this pass
- crypto symbol news in the Market tab is still limited; Rayla keeps the UI stable and shows an honest fallback message instead of fabricating coverage
- symbol search still uses the current search flow and was not rewritten in this pass

### Local market-data testing

1. Set the Alpaca market-data function secrets:

```bash
supabase secrets set \
  ALPACA_MARKET_DATA_KEY_ID=... \
  ALPACA_MARKET_DATA_SECRET_KEY=... \
  ALPACA_MARKET_DATA_STOCK_FEED=iex
```

2. Deploy or serve the updated `market-data` function.

3. Start the app:

```bash
npm run dev
```

4. Open the `Market` tab and confirm:
- watchlist prices populate
- selecting a stock loads an Alpaca chart and stock news
- selecting a crypto symbol loads an Alpaca chart and a graceful news fallback message if no symbol news is available

## Subscriptions & Billing

Rayla supports two billing paths depending on how the user subscribed:

- **Web (Stripe):** checkout via `stripe-create-checkout-session` edge function, billing management via `stripe-create-portal-session`, webhook events at `stripe-webhook`. Users cancel through their account or the Stripe customer portal.
- **iOS App Store (Apple In-App Purchase):** verify via `apple-verify-purchase`, restore via `apple-restore-purchase`, App Store server notifications at `apple-app-store-notifications`. Users cancel through their Apple ID subscription settings. Design notes at `docs/apple-iap-design.md`.

Terms of Service (`public/terms.html`) sections 7.3, 7.4, and 11.1 cover the billing-provider-neutral language required by Apple App Review.

## Deliverability

Transactional email (signup verification, password reset) is sent through Brevo. `raylainc.live` DNS must be configured with:

- SPF including `spf.brevo.com` alongside any existing includes
- Two Brevo DKIM CNAMEs (`brevo1._domainkey`, `brevo2._domainkey`) resolving to 2048-bit RSA keys
- DMARC at `_dmarc.raylainc.live` (minimum `v=DMARC1; p=none; rua=...`)

Verify with `dig TXT raylainc.live`, `dig TXT _dmarc.raylainc.live`, and `dig TXT brevo1._domainkey.raylainc.live`.
