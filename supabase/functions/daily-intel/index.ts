// supabase/functions/daily-intel/index.ts
// Scheduled edge function — runs via Supabase cron.
// KEY FIX: articles are fetched for ALL candidates BEFORE selection so that
// news/rubric text influences which assets are chosen as hottest/coldest.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const GNEWS_TIMEOUT_MS = 2500;
const QUOTE_TIMEOUT_MS = 4000;
const YAHOO_BATCH_SIZE = 20;

// ── Types ────────────────────────────────────────────────────────────────────

interface Article {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
}

interface AssetResult {
  symbol: string;
  dayChangePct: number;
  priceScore: number;
  newsScore: number;
  totalScore: number;
  verdict: "Hot" | "Neutral" | "Cold";
  article: Article | null;
}

// ── Scoring Rubric ───────────────────────────────────────────────────────────

const BULLISH_TERMS = [
  "surge", "rally", "beat", "strong", "upgrade", "growth", "rise", "gain",
  "bull", "buy", "outperform", "record", "breakout", "momentum", "soar",
  "jump", "profit", "positive", "bullish", "boost", "upside",
];

const BEARISH_TERMS = [
  "plunge", "crash", "miss", "weak", "downgrade", "decline", "fall", "drop",
  "bear", "sell", "underperform", "warning", "risk", "concern", "loss",
  "slump", "tumble", "fear", "bearish", "cut", "downside",
];

function sentimentScore(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const t of BULLISH_TERMS) if (lower.includes(t)) score++;
  for (const t of BEARISH_TERMS) if (lower.includes(t)) score--;
  return Math.max(-3, Math.min(3, score));
}

function calcPriceScore(pct: number): number {
  if (pct >= 4) return 4;
  if (pct >= 2) return 3;
  if (pct >= 0.5) return 2;
  if (pct >= -0.5) return 0;
  if (pct >= -2) return -2;
  if (pct >= -4) return -3;
  return -4;
}

function toVerdict(score: number): "Hot" | "Neutral" | "Cold" {
  if (score >= 3) return "Hot";
  if (score <= -3) return "Cold";
  return "Neutral";
}

// ── Concurrency limiter ──────────────────────────────────────────────────────

function pLimit(concurrency: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  function next() {
    while (running < concurrency && queue.length > 0) {
      running++;
      const fn = queue.shift()!;
      fn();
    }
  }

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            running--;
            next();
          });
      });
      next();
    });
  };
}

// ── GNews fetch ──────────────────────────────────────────────────────────────

async function fetchArticle(query: string, apiKey: string): Promise<Article | null> {
  if (!apiKey) return null;
  try {
    const url =
      `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=1&apikey=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(GNEWS_TIMEOUT_MS) });
    if (!res.ok) return null;
    const json = await res.json();
    const a = json.articles?.[0];
    if (!a) return null;
    return {
      title: a.title ?? "",
      description: a.description ?? "",
      url: a.url ?? "",
      source: a.source?.name ?? "",
      publishedAt: a.publishedAt ?? "",
    };
  } catch {
    return null;
  }
}

// ── Stock universe (top liquid S&P 500 names) ────────────────────────────────

const STOCK_UNIVERSE = [
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "JPM", "V", "MA",
  "UNH", "WMT", "LLY", "JNJ", "XOM", "PG", "AVGO", "HD", "COST", "MRK",
  "CVX", "KO", "PEP", "ABBV", "AMD", "ADBE", "CRM", "TXN", "NFLX", "ORCL",
  "MS", "GS", "BAC", "WFC", "BX", "SPGI", "SCHW", "AMGN", "GILD", "REGN",
  "ISRG", "MDT", "SYK", "ABT", "BSX", "NEE", "DUK", "PLD", "AMT", "EQIX",
];

async function fetchYahooQuotes(symbols: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  for (let i = 0; i < symbols.length; i += YAHOO_BATCH_SIZE) {
    const batch = symbols.slice(i, i + YAHOO_BATCH_SIZE);
    try {
      const url =
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${batch.join(",")}&fields=symbol,regularMarketChangePercent`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(QUOTE_TIMEOUT_MS),
      const json = await res.json();
      for (const q of json.quoteResponse?.result ?? []) {
        if (q.symbol && q.regularMarketChangePercent != null) {
          result.set(q.symbol, q.regularMarketChangePercent as number);
        }
      }
    } catch {
      // skip failed batch — degrade gracefully
    }
  }
  return result;
}

interface CryptoCandidate {
  symbol: string;
  name: string;
  pct: number;
}

async function fetchCryptoTop30(): Promise<CryptoCandidate[]> {
  try {
    const url =
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=30&page=1&price_change_percentage=24h`;
    const res = await fetch(url, { signal: AbortSignal.timeout(QUOTE_TIMEOUT_MS) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(
      (c: { symbol: string; name: string; price_change_percentage_24h: number }) => ({
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        pct: c.price_change_percentage_24h ?? 0,
      }),
    );
  } catch {
    return [];
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const runDate = new Date().toISOString().split("T")[0];
  console.log(`[daily-intel] run_date=${runDate}`);

  const GNEWS_KEY = Deno.env.get("GNEWS_API_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

  const limit = pLimit(5);

  // ── Stocks ──────────────────────────────────────────────────────────────

  console.log(`[daily-intel] Fetching quotes for ${STOCK_UNIVERSE.length} stocks`);
  const quoteMap = await fetchYahooQuotes(STOCK_UNIVERSE);

  const ranked = Array.from(quoteMap.entries())
    .map(([symbol, pct]) => ({ symbol, pct }))
    .sort((a, b) => b.pct - a.pct);

  // Narrow to top 10 + bottom 10 before fetching news
  const seen = new Set<string>();
  const stockCandidates: { symbol: string; pct: number }[] = [];
  for (const c of [...ranked.slice(0, 10), ...ranked.slice(-10)]) {
    if (!seen.has(c.symbol)) {
      seen.add(c.symbol);
      stockCandidates.push(c);
    }
  }

  console.log(
    `[daily-intel] Stock candidates (${stockCandidates.length}): ${stockCandidates.map((c) => c.symbol).join(", ")}`,
  );

  // Fetch 1 article per candidate BEFORE scoring — articles influence selection
  const stockScored: AssetResult[] = await Promise.all(
    stockCandidates.map(({ symbol, pct }) =>
      limit(async () => {
        const article = await fetchArticle(symbol, GNEWS_KEY);
        const ps = calcPriceScore(pct);
        const ns = article
          ? sentimentScore(`${article.title} ${article.description}`)
          : 0;
        const total = ps + ns;
        return {
          symbol,
          dayChangePct: pct,
          priceScore: ps,
          newsScore: ns,
          totalScore: total,
          verdict: toVerdict(total),
          article,
        };
      })
    ),
  );

  // Select top 3 hottest and coldest AFTER combined score is computed
  const sortedStocks = [...stockScored].sort((a, b) => b.totalScore - a.totalScore);
  const hottestStocks = sortedStocks.slice(0, 3);
  const coldestStocks = [...sortedStocks].reverse().slice(0, 3);

  console.log(
    `[daily-intel] Hottest stocks: ${hottestStocks.map((s) => `${s.symbol}(${s.totalScore})`).join(", ")}`,
  );
  console.log(
    `[daily-intel] Coldest stocks: ${coldestStocks.map((s) => `${s.symbol}(${s.totalScore})`).join(", ")}`,
  );

  // ── Crypto ──────────────────────────────────────────────────────────────

  const cryptoRaw = await fetchCryptoTop30();
  console.log(`[daily-intel] Crypto candidates: ${cryptoRaw.length}`);

  const cryptoScored: AssetResult[] = await Promise.all(
    cryptoRaw.map(({ symbol, pct }) =>
      limit(async () => {
        const article = await fetchArticle(`${symbol} crypto`, GNEWS_KEY);
        const ps = calcPriceScore(pct);
        const ns = article
          ? sentimentScore(`${article.title} ${article.description}`)
          : 0;
        const total = ps + ns;
        return {
          symbol,
          dayChangePct: pct,
          priceScore: ps,
          newsScore: ns,
          totalScore: total,
          verdict: toVerdict(total),
          article,
        };
      })
    ),
  );

  const sortedCrypto = [...cryptoScored].sort((a, b) => b.totalScore - a.totalScore);
  const hottestCrypto = sortedCrypto.slice(0, 3);

  // Ensure coldest picks are distinct from hottest
  const coldestCrypto: AssetResult[] = [];
  for (const c of [...sortedCrypto].reverse()) {
    if (!hottestCrypto.find((h) => h.symbol === c.symbol)) {
      coldestCrypto.push(c);
      if (coldestCrypto.length === 3) break;
    }
  }

  console.log(
    `[daily-intel] Hottest crypto: ${hottestCrypto.map((s) => `${s.symbol}(${s.totalScore})`).join(", ")}`,
  );
  console.log(
    `[daily-intel] Coldest crypto: ${coldestCrypto.map((s) => `${s.symbol}(${s.totalScore})`).join(", ")}`,
  );

  // ── Upsert ───────────────────────────────────────────────────────────────

  const toRow = (r: AssetResult) => ({
    symbol: r.symbol,
    dayChangePct: r.dayChangePct,
    priceScore: r.priceScore,
    newsScore: r.newsScore,
    totalScore: r.totalScore,
    verdict: r.verdict,
    article: r.article,
  });

  const report = {
    report_date: runDate,
    hottest_stocks: hottestStocks.map(toRow),
    coldest_stocks: coldestStocks.map(toRow),
    hottest_crypto: hottestCrypto.map(toRow),
    coldest_crypto: coldestCrypto.map(toRow),
    stock_candidates_count: stockCandidates.length,
    crypto_candidates_count: cryptoRaw.length,
    generated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await db
    .from("daily_intel_reports")
    .upsert(report, { onConflict: "report_date" });

  if (upsertError) {
    console.error("[daily-intel] Upsert error:", upsertError.message);
    return new Response(JSON.stringify({ error: upsertError.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  console.log(
    `[daily-intel] Done. report_date=${runDate}, stocks=${stockCandidates.length}, crypto=${cryptoRaw.length}`,
  );

  return new Response(
    JSON.stringify({
      ok: true,
      report_date: runDate,
      hottest_stocks: hottestStocks.map((s) => s.symbol),
      coldest_stocks: coldestStocks.map((s) => s.symbol),
      hottest_crypto: hottestCrypto.map((s) => s.symbol),
      coldest_crypto: coldestCrypto.map((s) => s.symbol),
    }),
    { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
