# CLAUDE.md — Rayla Dashboard

## Project

React 18 + Vite SPA backed by Supabase edge functions. Alpaca OAuth for live/paper trading. One main file: `src/App.jsx` (~26 000 lines). Edge functions under `supabase/functions/` (Deno/TypeScript). Shared Alpaca helpers at `supabase/functions/_shared/alpaca.ts`.

- **Supabase project ref:** `uoxzzhtnzmsolvcykynu`
- **Local dev:** `http://10.0.0.197:5002`
- **Edge functions:** `supabase functions serve` (local) or deployed via Supabase CLI

## Workflow Rules

1. **Diagnostic first.** Read the real code at the referenced lines before editing. Never guess class names, function names, or CSS selectors — grep for them.
2. **Never commit until the user confirms by screenshot.** Always say "Do NOT commit — I verify by screenshot" unless the user explicitly says "commit this."
3. **Report before editing.** Show the current value (line number + snippet) before making a change. For UI fixes, confirm which component/class actually controls the element.
4. **Change only what's asked.** No cleanup, no refactoring, no extra comments unless explicitly requested.
5. **Files staged / files not staged** audit required before every commit. Never sweep unrelated working-tree changes into a task commit.
6. **iOS sync / native build:** Skip by default. Only run `npx cap sync` or open Xcode when native testing is explicitly requested.

## Communication

- Responses 4–7 sentences max.
- Act as the engineer — decide, don't ask things already answered in the prompt.
- No summary paragraph appended after completing a task.

## Architecture Notes

### State / localStorage
- **Coach profile:** `localStorage` key `rayla_coach_profile_v1`, loaded/saved via `loadCoachProfile()` / `saveCoachProfile()` (App.jsx ~line 646). Capital Guide and all consumers read from this.
- **Scanner results:** `localStorage` key via `loadScannerResults` / `saveScannerResults` (App.jsx ~line 122).

### Key data flows
- **Portfolio chart:** `buildPortfolioChartFromSnapshots()` — `view="portfolio"` uses `snapshot.equity`; `view="holdings"` sums investment-classified positions; `view="active"` sums day/swing positions.
- **Signal scanner:** `resolveScanner()` in `market-data/index.ts` (~line 59) — portfolio + picks symbols only, 70-day daily bars, computes EMA50/ROC20/RS/trend (5-state: Bullish/Rising/Neutral/Declining/Bearish).
- **Capital Guide:** `buildCapitalGuideResponse()` (App.jsx ~line 17356) — pure allocation math, reads coach profile, no signal logic.
- **Ask Rayla:** `ask-rayla` edge function, OpenRouter → Claude primary, Groq fallback.

### Dead code — do not wire without explicit instruction
- **Personal Picks tab** (`"picks"`) — tab exists but is unreachable; no nav item points to it.

### Edge functions (all)
`alpaca-account`, `alpaca-account-contributions`, `alpaca-assets`, `alpaca-connect-callback`, `alpaca-connect-start`, `alpaca-orders`, `alpaca-place-order`, `alpaca-portfolio-history`, `alpaca-positions`, `ask-rayla`, `daily-intel`, `delete-account`, `market-data`, `parse-screenshot`, `redeem-discount-code`, `redeem-founder-code`, `stripe-create-checkout-session`, `stripe-create-portal-session`, `stripe-webhook`
