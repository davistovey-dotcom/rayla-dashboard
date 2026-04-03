# Rayla Dashboard

AI-powered trading analysis and coaching — React + Vite frontend backed by Supabase.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Supabase Edge Functions

Two edge functions live in `supabase/functions/`:

| Function | Trigger | Description |
|---|---|---|
| `daily-intel` | Supabase cron (daily) | Fetches top movers, scores via news rubric, upserts to `daily_intel_reports` |
| `ask-rayla` | HTTP POST `{ asset }` | On-demand stock/crypto scoring; returns verdict JSON |

### Required environment variables (set in Supabase Dashboard → Settings → Edge Functions)

| Variable | Used by | Description |
|---|---|---|
| `GNEWS_API_KEY` | both functions | [GNews](https://gnews.io) API key for fetching news articles |
| `SUPABASE_URL` | `daily-intel` | Auto-injected by Supabase runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | `daily-intel` | Auto-injected; needed to upsert `daily_intel_reports` |

### `daily_intel_reports` table schema (create once in Supabase SQL editor)

```sql
create table if not exists daily_intel_reports (
  id            bigint generated always as identity primary key,
  report_date   date not null unique,
  hottest_stocks   jsonb,
  coldest_stocks   jsonb,
  hottest_crypto   jsonb,
  coldest_crypto   jsonb,
  stock_candidates_count integer,
  crypto_candidates_count integer,
  generated_at  timestamptz,
  created_at    timestamptz default now()
);
```

### Deploy functions

```bash
supabase functions deploy daily-intel
supabase functions deploy ask-rayla
```

### Schedule `daily-intel` (Supabase cron via pg_cron)

```sql
select cron.schedule(
  'daily-intel-job',
  '0 14 * * 1-5',   -- weekdays at 14:00 UTC (≈ 9:00–10:00 AM ET, pre/early US market)
  $$
    select net.http_post(
      url := 'https://<project-ref>.supabase.co/functions/v1/daily-intel',
      headers := '{"Authorization":"Bearer <service-role-key>"}'::jsonb,
      body := '{}'::jsonb
    )
  $$
);
```

## ESLint

```bash
npm run lint
```

