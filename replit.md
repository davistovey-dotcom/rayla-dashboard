# Rayla Dashboard

## Project Overview
Rayla is a React + Vite trading journal, simulation, coaching, and market intelligence web app backed by Supabase.

## Tech Stack
- **Frontend**: React 19 + Vite 7
- **Styling**: Plain CSS
- **Backend/BaaS**: Supabase (PostgreSQL + Edge Functions + Auth)
- **Mobile**: Ionic Capacitor (iOS wrapper)
- **External APIs**: Alpaca (paper trading & market data), Finnhub

## Architecture
- `src/` — React source code (components, routing, Supabase client)
- `supabase/` — Edge functions (Deno/TypeScript) and SQL migrations
- `ios/` — Capacitor iOS native project
- `public/` — Static assets

## Key Features
- Alpaca Paper Trading integration via OAuth
- Live market data (stocks + crypto) via Alpaca
- Trade journal and brokerage trade log synced to Supabase
- AI coaching via `ask-rayla` edge function
- Daily market intel via `daily-intel` edge function
- **Live Market chart** in Trade tab powered by `lightweight-charts` v5 (Line + Candlestick modes, price scale, time scale, crosshair, dashed live-price line, 10s auto-refresh); Portfolio view uses a custom SVG multi-line normalized % chart

## Chart Architecture (Trade Tab)
- `src/TradeChart.jsx` — standalone component wrapping `lightweight-charts` v5. Accepts `bars` (OHLC array), `mode` ("line"|"candlestick"), `latestPrice`. Handles ResizeObserver, series lifecycle, and a dashed price line at the latest quote.
- Portfolio view (multi-asset normalized % change) remains as a custom SVG in `App.jsx`.

## Running Locally
```bash
npm install
npm run dev
```
App runs on port 5000.

## Environment Variables
Set in Supabase Edge Functions secrets:
- `ALPACA_CLIENT_ID`
- `ALPACA_CLIENT_SECRET`
- `ALPACA_REDIRECT_URI`
- `APP_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALPACA_MARKET_DATA_KEY_ID`
- `ALPACA_MARKET_DATA_SECRET_KEY`
- `ALPACA_MARKET_DATA_STOCK_FEED` (optional, defaults to `iex`)

Frontend env:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_FINNHUB_KEY`

## Database Migrations
Apply in order:
- `supabase/migrations/202604230001_add_alpaca_broker_connect.sql`
- `supabase/migrations/202604230002_add_broker_trade_logs.sql`

## Deployment
Static site deployment — builds with `npm run build`, serves from `dist/`.
