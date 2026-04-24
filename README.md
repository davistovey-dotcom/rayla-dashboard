# Rayla Dashboard

Rayla is a React + Vite trading journal, simulation, coaching, and market-intel app backed by Supabase.

## Alpaca Paper Trading V1

This project now includes a first-pass Alpaca Paper Trading integration for stocks only.

Current scope:
- Connect an existing Alpaca Paper account with OAuth
- Store the returned Alpaca access token in Supabase
- Fetch Alpaca account summary
- Fetch Alpaca positions
- Submit one simple user-confirmed paper stock order
- Persist Rayla-placed and Alpaca-imported brokerage orders in a broker trade log

Out of scope in this version:
- Live trading
- Crypto orders
- Options
- Auto trading
- Broker account creation

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

`APP_BASE_URL` should point to the Rayla app itself, for example:

`http://localhost:5173`

or your deployed app URL.

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

### Follow-up TODOs before live trading

- Encrypt Alpaca access and refresh tokens at rest
- Add token refresh handling if Alpaca returns refresh tokens in your app setup
- Add disconnect/revoke flow
- Add stronger order validation and confirmation UX
- Add audit logging for brokerage actions
- Add symbol validation against supported US equities
- Add live-trading environment separation and approvals
- Add backend-side order preview / preflight checks
