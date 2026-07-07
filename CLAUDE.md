# CLAUDE.md — Rayla Dashboard

## Project

React 19 + Vite 7 SPA backed by Supabase edge functions. Alpaca OAuth for live and paper trading. One main file: `src/App.jsx` (~30 000 lines). Edge functions under `supabase/functions/` (Deno/TypeScript). Shared Alpaca helpers at `supabase/functions/_shared/alpaca.ts`. Charts use `lightweight-charts` v5.

- **Supabase project ref:** `uoxzzhtnzmsolvcykynu`
- **Production URL:** `https://raylainc.live`
- **Local dev:** `npm run dev` — Vite auto-picks a port in the 5000–5005 range
- **Edge functions:** `supabase functions serve` (local) or deployed via Supabase CLI

## Workflow Rules

1. **Diagnostic first.** Read the real code before editing. Never guess class names, function names, or CSS selectors — grep for them. Do not rely on line numbers documented here; the file grows and they drift.
2. **Never commit until the user confirms by screenshot.** Always say "Do NOT commit — I verify by screenshot" unless the user explicitly says "commit this."
3. **Report before editing.** Show the current value (line number + snippet at the moment you read it) before making a change. For UI fixes, confirm which component/class actually controls the element.
4. **Change only what's asked.** No cleanup, no refactoring, no extra comments unless explicitly requested.
5. **Files staged / files not staged** audit required before every commit. Never sweep unrelated working-tree changes into a task commit.
6. **iOS sync / native build:** Skip by default. Only run `npx cap sync` or open Xcode when native testing is explicitly requested.

## Communication

- Responses 4–7 sentences max.
- Act as the engineer — decide, don't ask things already answered in the prompt.
- No summary paragraph appended after completing a task.

## Architecture Notes

### State / localStorage
- **Coach profile:** `localStorage` key `rayla_coach_profile_v1`, loaded/saved via `loadCoachProfile()` / `saveCoachProfile()` (App.jsx). Capital Guide and all consumers read from this.
- **Scanner results:** `localStorage` key via `loadScannerResults` / `saveScannerResults` (App.jsx).

### Key data flows
- **Portfolio chart:** `buildPortfolioChartFromSnapshots()` — `view="portfolio"` uses `snapshot.equity`; `view="holdings"` sums investment-classified positions; `view="active"` sums day/swing positions.
- **1D Portfolio chart:** fetched from `alpaca-portfolio-history` edge function with `period=1D`, `timeframe=1Min`, `intraday_reporting=continuous`, and an explicit `start` anchored to the most recent past 20:00 America/New_York (Alpaca web dashboard behavior). Client overlays a live-equity terminal point from `alpacaAccount.equity` between refetches.
- **Signal scanner:** `resolveScanner()` in `market-data/index.ts` — portfolio + picks symbols only, 70-day daily bars, computes EMA50/ROC20/RS/trend (5-state: Bullish/Rising/Neutral/Declining/Bearish).
- **Capital Guide:** `buildCapitalGuideResponse()` (App.jsx) — pure allocation math, reads coach profile, no signal logic.
- **Ask Rayla:** `ask-rayla` edge function, OpenRouter → Claude primary, Groq fallback. Requires an authenticated Supabase user JWT (verified via `verify_jwt = true` + in-function `/auth/v1/user` check).
- **Supabase client:** `src/supabase.js` uses `processLock` from `@supabase/supabase-js` to serialize concurrent auth token access and avoid Web Locks `AbortError` under effect fan-out.

### Live features (all reachable in production)
- **Personal Picks** — reachable via Intel → "Rayla's Picks" sub-tab. Not dead code; do not delete `src/components/PersonalPicksTab.jsx`.
- **Live Trades** — full Alpaca live-order flow via `alpaca-place-order` (also supports paper).
- **Stripe subscription + billing gate** — checkout via `stripe-create-checkout-session`, portal via `stripe-create-portal-session`, webhook at `stripe-webhook`.
- **Apple IAP** (iOS in-app subscription) — verify/restore/notifications via `apple-verify-purchase`, `apple-restore-purchase`, `apple-app-store-notifications`. Design at `docs/apple-iap-design.md`.

### Edge functions (all 23)
`alpaca-account`, `alpaca-account-contributions`, `alpaca-assets`, `alpaca-connect-callback`, `alpaca-connect-start`, `alpaca-orders`, `alpaca-place-order`, `alpaca-portfolio-history`, `alpaca-positions`, `apple-app-store-notifications`, `apple-restore-purchase`, `apple-verify-purchase`, `ask-rayla`, `check-email-confirmed`, `daily-intel`, `delete-account`, `market-data`, `parse-screenshot`, `redeem-discount-code`, `redeem-founder-code`, `stripe-create-checkout-session`, `stripe-create-portal-session`, `stripe-webhook`
