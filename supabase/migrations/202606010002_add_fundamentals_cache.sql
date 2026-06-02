create table if not exists fundamentals_cache (
  symbol text primary key,
  data jsonb not null default '{}',
  fetched_at timestamptz not null default now()
);

alter table fundamentals_cache enable row level security;
-- No public policies — only service role (edge function) can read/write
