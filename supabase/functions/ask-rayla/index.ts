// supabase/functions/ask-rayla/index.ts
// POST { asset: string } — resolves stock or crypto, fetches quote + news,
// scores using the same rubric as daily-intel, returns structured verdict JSON.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const GNEWS_TIMEOUT_MS = 2500;
const QUOTE_TIMEOUT_MS = 4000;
const DEFAULT_MAX_ARTICLES = 3;

// ── Types ────────────────────────────────────────────────────────────────────

interface Article {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
}

interface AskResult {
  asset: string;
  assetType: "stock" | "crypto";
  verdict: "Hot" | "Neutral" | "Cold";
  action: "Buy" | "Hold" | "Sell";
  dayChangePct: number;
  breakdown: {
    priceChange: string;
    priceSignal: "Bullish" | "Bearish" | "Neutral";
    newsSignal: "Bullish" | "Bearish" | "Neutral";
    priceScore: number;
    newsScore: number;
    totalScore: number;
  };
  summary: string;
  citations: { title: string; url: string; source: string; publishedAt: string }[];
}

// ── Scoring Rubric (mirrors daily-intel) ────────────────────────────────────

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

function toAction(score: number): "Buy" | "Hold" | "Sell" {
  if (score >= 3) return "Buy";
  if (score <= -3) return "Sell";
  return "Hold";
}

// ── Asset resolution ─────────────────────────────────────────────────────────

const CRYPTO_MAP: Record<string, string> = {
  "BTC": "bitcoin",        "BITCOIN": "bitcoin",
  "ETH": "ethereum",       "ETHEREUM": "ethereum",
  "SOL": "solana",         "SOLANA": "solana",
  "BNB": "binancecoin",    "BINANCE COIN": "binancecoin",
  "ADA": "cardano",        "CARDANO": "cardano",
  "DOGE": "dogecoin",      "DOGECOIN": "dogecoin",
  "XRP": "ripple",         "RIPPLE": "ripple",
  "DOT": "polkadot",       "POLKADOT": "polkadot",
  "AVAX": "avalanche-2",   "AVALANCHE": "avalanche-2",
  "MATIC": "matic-network","POLYGON": "matic-network",
  "LINK": "chainlink",     "CHAINLINK": "chainlink",
  "LTC": "litecoin",       "LITECOIN": "litecoin",
  "UNI": "uniswap",        "UNISWAP": "uniswap",
  "ATOM": "cosmos",        "COSMOS": "cosmos",
  "SHIB": "shiba-inu",     "SHIBA INU": "shiba-inu",
  "TON": "the-open-network","TONCOIN": "the-open-network",
  "SUI": "sui",
  "APT": "aptos",          "APTOS": "aptos",
  "ARB": "arbitrum",       "ARBITRUM": "arbitrum",
  "OP": "optimism",        "OPTIMISM": "optimism",
  "NEAR": "near",          "NEAR PROTOCOL": "near",
};

const STOCK_NAME_MAP: Record<string, string> = {
  "TESLA": "TSLA",            "APPLE": "AAPL",
  "MICROSOFT": "MSFT",        "GOOGLE": "GOOGL",
  "ALPHABET": "GOOGL",        "AMAZON": "AMZN",
  "META": "META",             "FACEBOOK": "META",
  "NVIDIA": "NVDA",           "NETFLIX": "NFLX",
  "INTEL": "INTC",            "WALMART": "WMT",
  "JPMORGAN": "JPM",          "JP MORGAN": "JPM",
  "VISA": "V",                "MASTERCARD": "MA",
  "UNITEDHEALTH": "UNH",      "EXXON": "XOM",
  "CHEVRON": "CVX",           "BANK OF AMERICA": "BAC",
  "WELLS FARGO": "WFC",       "COINBASE": "COIN",
  "PALANTIR": "PLTR",         "UBER": "UBER",
  "DISNEY": "DIS",            "AIRBNB": "ABNB",
  "SPOTIFY": "SPOT",          "PAYPAL": "PYPL",
  "SHOPIFY": "SHOP",          "SALESFORCE": "CRM",
  "ORACLE": "ORCL",           "QUALCOMM": "QCOM",
  "BROADCOM": "AVGO",         "AMD": "AMD",
};

function resolveAsset(
  raw: string,
): { ticker: string; assetType: "stock" | "crypto"; coinId: string | null } {
  const upper = raw.toUpperCase().trim();
  if (CRYPTO_MAP[upper]) {
    return { ticker: upper, assetType: "crypto", coinId: CRYPTO_MAP[upper] };
  }
  if (STOCK_NAME_MAP[upper]) {
    return { ticker: STOCK_NAME_MAP[upper], assetType: "stock", coinId: null };
  }
  return { ticker: upper, assetType: "stock", coinId: null };
}

// ── Quote fetchers ───────────────────────────────────────────────────────────

async function fetchStockPct(ticker: string): Promise<number | null> {
  try {
    const url =
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}&fields=regularMarketChangePercent`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(QUOTE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.quoteResponse?.result?.[0]?.regularMarketChangePercent ?? null;
  } catch {
    return null;
  }
}

async function fetchCryptoPct(coinId: string): Promise<number | null> {
  try {
    const url =
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(QUOTE_TIMEOUT_MS) });
    if (!res.ok) return null;
    const json = await res.json();
    return json[coinId]?.usd_24h_change ?? null;
  } catch {
    return null;
  }
}

async function fetchGNewsArticles(
  query: string,
  apiKey: string,
  max = DEFAULT_MAX_ARTICLES,
): Promise<Article[]> {
  if (!apiKey) return [];
  try {
    const url =
      `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=${max}&apikey=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(GNEWS_TIMEOUT_MS) });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.articles ?? []).map(
      (a: {
        title: string;
        description?: string;
        url: string;
        source?: { name?: string };
        publishedAt: string;
      }) => ({
        title: a.title ?? "",
        description: a.description ?? "",
        url: a.url ?? "",
        source: a.source?.name ?? "",
        publishedAt: a.publishedAt ?? "",
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

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let body: { asset?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const rawAsset = (body.asset ?? "").trim();
  if (!rawAsset) {
    return new Response(JSON.stringify({ error: "asset is required" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const GNEWS_KEY = Deno.env.get("GNEWS_API_KEY") ?? "";
  const { ticker, assetType, coinId } = resolveAsset(rawAsset);

  console.log(`[ask-rayla] asset=${rawAsset} -> ticker=${ticker} type=${assetType}`);

  // Fetch quote and news in parallel
  const newsQuery = assetType === "crypto" ? `${ticker} crypto` : ticker;
  const [dayChangePct, articles] = await Promise.all([
    assetType === "crypto" && coinId ? fetchCryptoPct(coinId) : fetchStockPct(ticker),
    fetchGNewsArticles(newsQuery, GNEWS_KEY, 3),
  ]);

  const pct = dayChangePct ?? 0;
  const ps = calcPriceScore(pct);
  const allText = articles.map((a) => `${a.title} ${a.description}`).join(" ");
  const ns = articles.length > 0 ? sentimentScore(allText) : 0;
  const totalScore = ps + ns;
  const verdict = toVerdict(totalScore);
  const action = toAction(totalScore);

  const priceChangeStr = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
  const priceDir = pct >= 2
    ? "strongly higher"
    : pct >= 0.5
    ? "higher"
    : pct <= -2
    ? "strongly lower"
    : pct <= -0.5
    ? "lower"
    : "roughly flat";
  const newsDesc = ns >= 2
    ? "highly positive"
    : ns >= 1
    ? "positive"
    : ns <= -2
    ? "highly negative"
    : ns <= -1
    ? "negative"
    : "neutral";

  const summary = dayChangePct == null
    ? `${ticker} quote unavailable. News sentiment is ${newsDesc}. Rayla rates it ${verdict}.`
    : `${ticker} is trading ${priceDir} today (${priceChangeStr}) with ${newsDesc} news sentiment. Rayla rates it ${verdict}.`;

  const result: AskResult = {
    asset: ticker,
    assetType,
    verdict,
    action,
    dayChangePct: pct,
    breakdown: {
      priceChange: priceChangeStr,
      priceSignal: ps > 0 ? "Bullish" : ps < 0 ? "Bearish" : "Neutral",
      newsSignal: ns > 0 ? "Bullish" : ns < 0 ? "Bearish" : "Neutral",
      priceScore: ps,
      newsScore: ns,
      totalScore,
    },
    summary,
    citations: articles.map((a) => ({
      title: a.title,
      url: a.url,
      source: a.source,
      publishedAt: a.publishedAt,
    })),
  };

  return new Response(JSON.stringify(result), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
