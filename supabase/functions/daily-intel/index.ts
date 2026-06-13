// @ts-nocheck

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.56/deno-dom-wasm.ts";
import {
  alpacaMarketDataRequest,
  normalizeAlpacaSnapshot,
} from "../_shared/alpaca.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const RAYLA_GROQ_SYSTEM_PROMPT = `You are Rayla, a confident trading coach inside a simulation app.

Rules:
- Be concise and decisive
- No generic disclaimers
- Do NOT say "I can't give financial advice"
- Give 2–3 clear options
- Use bullet points
- Tie guidance to user behavior
- Speak like a coach, not a lawyer`;

type RawArticle = {
  title?: string;
  description?: string;
  content?: string;
  image?: string;
  image_url?: string;
  urlToImage?: string;
  url?: string;
  source?: { name?: string } | string;
  publishedAt?: string;
};

type NormalizedArticle = {
  title: string;
  description: string;
  image: string;
  url: string;
  source: { name: string };
  publishedAt: string;
};

type QuoteData = {
  symbol: string;
  name: string;
  dayChangePct: number | null;
  price: number | null;
};

type AssetResult = {
  symbol: string;
  name: string;
  score: number;
  change: string;
  summary: string;
  rawArticles: NormalizedArticle[];
  breakdown: Record<string, number>;
};

const WIKI_SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies";
const MAX_RAYLA_SYMBOLS = 24;
const MAX_EQUITY_SCAN_SYMBOLS = 72;
const MAX_STOCK_NEWS_ENRICHMENT = 36;

const DEFAULT_EQUITY_UNIVERSE = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", assetClass: "etf" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", assetClass: "etf" },
  { symbol: "DIA", name: "SPDR Dow Jones Industrial Average ETF", assetClass: "etf" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", assetClass: "etf" },
  { symbol: "SMH", name: "VanEck Semiconductor ETF", assetClass: "etf" },
  { symbol: "XLK", name: "Technology Select Sector SPDR Fund", assetClass: "etf" },
  { symbol: "XLF", name: "Financial Select Sector SPDR Fund", assetClass: "etf" },
  { symbol: "XLE", name: "Energy Select Sector SPDR Fund", assetClass: "etf" },
  { symbol: "ARKK", name: "ARK Innovation ETF", assetClass: "etf" },
  { symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF", assetClass: "etf" },
  { symbol: "GLD", name: "SPDR Gold Shares", assetClass: "etf" },
  { symbol: "SLV", name: "iShares Silver Trust", assetClass: "etf" },
  { symbol: "HYG", name: "iShares iBoxx High Yield Corporate Bond ETF", assetClass: "etf" },
  { symbol: "AAPL", name: "Apple Inc.", assetClass: "stock" },
  { symbol: "MSFT", name: "Microsoft Corporation", assetClass: "stock" },
  { symbol: "NVDA", name: "NVIDIA Corporation", assetClass: "stock" },
  { symbol: "AMZN", name: "Amazon.com, Inc.", assetClass: "stock" },
  { symbol: "GOOGL", name: "Alphabet Inc.", assetClass: "stock" },
  { symbol: "META", name: "Meta Platforms, Inc.", assetClass: "stock" },
  { symbol: "TSLA", name: "Tesla, Inc.", assetClass: "stock" },
  { symbol: "AMD", name: "Advanced Micro Devices, Inc.", assetClass: "stock" },
  { symbol: "AVGO", name: "Broadcom Inc.", assetClass: "stock" },
  { symbol: "NFLX", name: "Netflix, Inc.", assetClass: "stock" },
  { symbol: "PLTR", name: "Palantir Technologies Inc.", assetClass: "stock" },
  { symbol: "UBER", name: "Uber Technologies, Inc.", assetClass: "stock" },
  { symbol: "COIN", name: "Coinbase Global, Inc.", assetClass: "stock" },
  { symbol: "HOOD", name: "Robinhood Markets, Inc.", assetClass: "stock" },
  { symbol: "MU", name: "Micron Technology, Inc.", assetClass: "stock" },
  { symbol: "INTC", name: "Intel Corporation", assetClass: "stock" },
  { symbol: "CRM", name: "Salesforce, Inc.", assetClass: "stock" },
  { symbol: "ORCL", name: "Oracle Corporation", assetClass: "stock" },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", assetClass: "stock" },
  { symbol: "BAC", name: "Bank of America Corporation", assetClass: "stock" },
  { symbol: "WFC", name: "Wells Fargo & Company", assetClass: "stock" },
  { symbol: "GS", name: "The Goldman Sachs Group, Inc.", assetClass: "stock" },
  { symbol: "XOM", name: "Exxon Mobil Corporation", assetClass: "stock" },
  { symbol: "CVX", name: "Chevron Corporation", assetClass: "stock" },
  { symbol: "LLY", name: "Eli Lilly and Company", assetClass: "stock" },
  { symbol: "UNH", name: "UnitedHealth Group Incorporated", assetClass: "stock" },
  { symbol: "JNJ", name: "Johnson & Johnson", assetClass: "stock" },
  { symbol: "COST", name: "Costco Wholesale Corporation", assetClass: "stock" },
  { symbol: "WMT", name: "Walmart Inc.", assetClass: "stock" },
  { symbol: "NKE", name: "NIKE, Inc.", assetClass: "stock" },
  { symbol: "DIS", name: "The Walt Disney Company", assetClass: "stock" },
  { symbol: "MCD", name: "McDonald's Corporation", assetClass: "stock" },
  { symbol: "KO", name: "The Coca-Cola Company", assetClass: "stock" },
  { symbol: "PFE", name: "Pfizer Inc.", assetClass: "stock" },
  { symbol: "SHOP", name: "Shopify Inc.", assetClass: "stock" },
];

const CRYPTO_UNIVERSE = [
  { symbol: "BTC",  name: "Bitcoin",   query: "Bitcoin crypto" },
  { symbol: "ETH",  name: "Ethereum",  query: "Ethereum crypto" },
  { symbol: "SOL",  name: "Solana",    query: "Solana crypto" },
  { symbol: "XRP",  name: "XRP",       query: "XRP crypto" },
  { symbol: "DOGE", name: "Dogecoin",  query: "Dogecoin crypto" },
  { symbol: "BNB",  name: "BNB",       query: "BNB crypto" },
  { symbol: "ADA",  name: "Cardano",   query: "Cardano crypto" },
  { symbol: "AVAX", name: "Avalanche", query: "Avalanche crypto" },
  { symbol: "LINK", name: "Chainlink", query: "Chainlink crypto" },
  { symbol: "DOT",  name: "Polkadot",  query: "Polkadot crypto" },
];

const CRYPTO_SYMBOL_SET = new Set(CRYPTO_UNIVERSE.map((item) => item.symbol));

const NEWS_QUERY_MAP: Record<string, string[]> = {
  AMD: ['"Advanced Micro Devices" stock', "AMD stock", '"AMD earnings"'],
  CAT: ['"Caterpillar" stock', "CAT stock", '"Caterpillar earnings"'],
  AOS: ['"A. O. Smith" stock', '"AO Smith" stock', "AOS stock"],
  MMM: ['"3M" stock', '"3M company" stock', "MMM stock"],
  AES: ['"AES Corporation" stock', "AES stock"],
  AFL: ['"Aflac" stock', "AFL stock"],
  BTC: ["Bitcoin crypto", "Bitcoin news", "BTC crypto"],
  ETH: ["Ethereum crypto", "Ethereum news", "ETH crypto"],
  AVAX: ["Avalanche crypto", "AVAX crypto", "Avalanche news"],
};

const STOCK_KEYWORDS = {
  demand: {
    positive: [
      "demand", "strong demand", "higher demand", "bookings", "backlog", "orders",
      "sales growth", "traffic", "adoption", "expanding market", "share gains",
      "customer growth", "subscriber growth", "uptick", "rebound",
    ],
    negative: [
      "weak demand", "soft demand", "slowing demand", "declining sales", "traffic slowdown",
      "share loss", "cancellation", "slowdown", "contraction", "headwinds",
      "falling demand", "recession fears", "missed demand",
    ],
  },
  costMargin: {
    positive: [
      "margin expansion", "improved margin", "cost cuts", "lower costs", "efficiency",
      "productivity", "pricing power", "profitability improved", "operating leverage",
      "supply chain easing",
    ],
    negative: [
      "margin pressure", "higher costs", "input costs", "labor pressure", "supply chain issues",
      "tariffs", "cost inflation", "profit warning", "lower margins", "expense growth",
      "commodity prices rise",
    ],
  },
  guidance: {
    positive: [
      "raised guidance", "beat earnings", "beats earnings", "upward revision", "upgraded",
      "better outlook", "reiterated guidance", "above expectations", "strong forecast",
      "bullish outlook",
    ],
    negative: [
      "cut guidance", "missed earnings", "miss earnings", "downgraded", "lowered outlook",
      "below expectations", "weak forecast", "earnings warning", "trimmed target", "analyst cut",
    ],
  },
  narrative: {
    positive: [
      "bullish", "optimism", "positive catalyst", "momentum", "rally", "breakout",
      "confidence", "tailwind", "strong story", "winner", "leadership",
    ],
    negative: [
      "bearish", "selloff", "concern", "probe", "lawsuit", "risk", "uncertainty",
      "warning", "downdraft", "headwind", "controversy", "pressure",
    ],
  },
};

const CRYPTO_KEYWORDS = {
  liquidity: {
    positive: [
      "inflows", "etf inflows", "capital inflows", "institutional demand", "open interest rises",
      "liquidity improving", "accumulation", "funding stable", "more buyers",
    ],
    negative: [
      "outflows", "capital outflows", "liquidations", "liquidity drying up", "risk-off",
      "selling pressure", "deleveraging", "funding stress", "more sellers",
    ],
  },
  sentiment: {
    positive: [
      "bullish", "optimism", "adoption", "confidence", "surge", "rally",
      "interest rising", "positive sentiment", "buyers returning",
    ],
    negative: [
      "bearish", "fear", "panic", "selloff", "hack", "exploit", "lawsuit",
      "negative sentiment", "capitulation", "uncertainty",
    ],
  },
  catalyst: {
    positive: [
      "etf approval", "listing", "upgrade", "mainnet", "partnership", "integration",
      "regulatory clarity", "network upgrade", "adoption catalyst", "staking growth",
    ],
    negative: [
      "delisting", "lawsuit", "regulatory crackdown", "unlock", "token unlock",
      "exploit", "hack", "investigation", "sec action", "security issue",
    ],
  },
};

// ── Utilities ──────────────────────────────────────────────────────────────

function clampScore(value: number) {
  return value > 2 ? 2 : value < -2 ? -2 : value;
}

function formatPct(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function normalizeArticle(article: RawArticle): NormalizedArticle {
  return {
    title: article.title || "No title",
    description: article.description || article.content || "No summary available",
    image: article.image || article.image_url || article.urlToImage || "",
    url: article.url || "#",
    source:
      typeof article.source === "object"
        ? { name: article.source?.name || "Unknown source" }
        : { name: article.source || "Unknown source" },
    publishedAt: article.publishedAt || "",
  };
}

function scoreTextBucket(text: string, positive: string[], negative: string[]) {
  let score = 0;
  for (const word of positive) if (text.includes(word.toLowerCase())) score += 1;
  for (const word of negative) if (text.includes(word.toLowerCase())) score -= 1;
  return clampScore(score);
}

function buildTextFromArticles(articles: NormalizedArticle[]) {
  return articles.map((a) => `${a.title || ""} ${a.description || ""}`).join(" ").toLowerCase();
}

function buildStockSummary(name: string, breakdown: Record<string, number>, change: string) {
  const ordered = [
    ["Demand Impact", breakdown.demand],
    ["Cost / Margin Impact", breakdown.costMargin],
    ["Guidance / Earnings Impact", breakdown.guidance],
    ["Narrative / Sentiment Impact", breakdown.narrative],
    ["Price Confirmation", breakdown.priceConfirmation],
  ].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  const label =
    breakdown.total >= 4 ? "Hot"
    : breakdown.total >= 1 ? "Leaning Hot"
    : breakdown.total <= -4 ? "Cold"
    : breakdown.total <= -1 ? "Leaning Cold"
    : "Neutral";

  return `${label}. ${name} is at ${change}. Biggest drivers: ${ordered[0][0]} (${ordered[0][1] > 0 ? "positive" : ordered[0][1] < 0 ? "negative" : "neutral"}) and ${ordered[1][0]} (${ordered[1][1] > 0 ? "positive" : ordered[1][1] < 0 ? "negative" : "neutral"}).`;
}

function buildCryptoSummary(name: string, breakdown: Record<string, number>, change: string) {
  const ordered = [
    ["Liquidity Impact", breakdown.liquidity],
    ["Sentiment Impact", breakdown.sentiment],
    ["Momentum Impact", breakdown.momentum],
    ["Catalyst Impact", breakdown.catalyst],
    ["Relative Strength / Weakness", breakdown.relativeStrength],
  ].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  const label =
    breakdown.total >= 4 ? "Hot"
    : breakdown.total >= 1 ? "Leaning Hot"
    : breakdown.total <= -4 ? "Cold"
    : breakdown.total <= -1 ? "Leaning Cold"
    : "Neutral";

  return `${label}. ${name} is at ${change}. Biggest drivers: ${ordered[0][0]} (${ordered[0][1] > 0 ? "positive" : ordered[0][1] < 0 ? "negative" : "neutral"}) and ${ordered[1][0]} (${ordered[1][1] > 0 ? "positive" : ordered[1][1] < 0 ? "negative" : "neutral"}).`;
}

function dedupeBySymbol<T extends { symbol: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.symbol)) return false;
    seen.add(item.symbol);
    return true;
  });
}

function buildFallbackArticle(item: any, query: string): NormalizedArticle {
  return {
    title: `Search latest news for ${item.symbol}`,
    description: `No direct article was returned for ${item.name}, so this opens a live news search instead.`,
    image: "",
    url: `https://news.google.com/search?q=${encodeURIComponent(query)}`,
    source: { name: "Google News" },
    publishedAt: new Date().toISOString(),
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (true) {
      const current = index++;
      if (current >= items.length) break;
      results[current] = await mapper(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

// ── Data sources ───────────────────────────────────────────────────────────

// Finnhub quote → stock/ETF price + change%.
// Returns dp (day percent change) and c (current price) directly.
// Works at any time of day; already used in this function for news.
async function fetchStockQuotes(
  equities: { symbol: string; name: string; assetClass: string }[],
  finnhubKey: string
): Promise<QuoteData[]> {
  const results = await mapWithConcurrency(equities, 4, async (item) => {
    await new Promise((r) => setTimeout(r, 250));
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(item.symbol)}&token=${finnhubKey}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      const price = Number(data?.c);
      const prevClose = Number(data?.pc);
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(prevClose) || prevClose <= 0) return null;
      return {
        symbol: item.symbol,
        name: item.name,
        dayChangePct: Number(((price - prevClose) / prevClose * 100).toFixed(2)),
        price,
      };
    } catch (_err) {
      return null;
    }
  });
  return results.filter(Boolean) as QuoteData[];
}

// Alpaca crypto US snapshots → price + change%.
// Uses /v1beta3/crypto/us/snapshots (same endpoint as market-data function).
// normalizeAlpacaSnapshot computes change from prevDailyBar.c — no Polygon needed.
async function fetchCryptoQuotes(
  cryptos: typeof CRYPTO_UNIVERSE
): Promise<QuoteData[]> {
  const pairs = cryptos.map((c) => `${c.symbol}/USD`);
  try {
    const data = await alpacaMarketDataRequest(
      `/v1beta3/crypto/us/snapshots?symbols=${encodeURIComponent(pairs.join(","))}`
    );
    const quotes: QuoteData[] = [];
    for (const crypto of cryptos) {
      const norm = normalizeAlpacaSnapshot(
        crypto.symbol,
        data?.snapshots?.[`${crypto.symbol}/USD`],
        "crypto"
      );
      if (!norm) continue;
      quotes.push({
        symbol: crypto.symbol,
        name: crypto.name,
        dayChangePct: norm.change ?? null,
        price: norm.price ?? null,
      });
    }
    return quotes;
  } catch (err) {
    console.warn("[intel] crypto snapshot failed:", String(err));
    return [];
  }
}

// Finnhub company-news → NormalizedArticle[] with NewsData fallback.
async function fetchNewsWithFallbacks(
  symbol: string,
  name: string,
  type: "stock" | "crypto",
  finnhubKey: string
): Promise<NormalizedArticle[]> {
  // Finnhub company-news (stocks) or a generic search
  try {
    await new Promise((r) => setTimeout(r, 300));
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 3);
    const fromStr = from.toISOString().split("T")[0];
    const toStr = today.toISOString().split("T")[0];
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fromStr}&to=${toStr}&token=${finnhubKey}`
    );
    if (res.ok) {
      const data = await res.json();
      const articles = Array.isArray(data) ? data : [];
      const normalized = articles
        .filter((a: any) => a.headline && a.url)
        .slice(0, 1)
        .map((a: any) => ({
          title: a.headline || "No title",
          description: a.summary || "No summary available",
          image: a.image || "",
          url: a.url || "#",
          source: { name: a.source || "Finnhub" },
          publishedAt: a.datetime ? new Date(a.datetime * 1000).toISOString() : "",
        }));
      if (normalized.length > 0) return normalized;
    }
  } catch (_err) {
    // fall through to NewsData
  }

  // NewsData.io fallback
  try {
    const NEWSDATA_KEY = Deno.env.get("NEWSDATA_API_KEY");
    const query = type === "crypto" ? name : `${name} stock`;
    const res = await fetch(
      `https://newsdata.io/api/1/news?apikey=${NEWSDATA_KEY}&q=${encodeURIComponent(query)}&language=en&size=1`
    );
    if (res.ok) {
      const data = await res.json();
      const articles = data?.results || [];
      if (articles.length > 0) {
        const a = articles[0];
        return [{
          title: a.title || "No title",
          description: a.description || a.content || "No summary available",
          image: a.image_url || "",
          url: a.link || "#",
          source: { name: a.source_id || "NewsData" },
          publishedAt: a.pubDate || "",
        }];
      }
    }
  } catch (_err) {
    // fall through
  }

  return [];
}

// ── Scoring ────────────────────────────────────────────────────────────────

function scoreStockAsset(
  name: string,
  dayChangePct: number,
  articles: NormalizedArticle[]
): AssetResult {
  const text = buildTextFromArticles(articles);
  const demand = scoreTextBucket(text, STOCK_KEYWORDS.demand.positive, STOCK_KEYWORDS.demand.negative);
  const costMargin = scoreTextBucket(text, STOCK_KEYWORDS.costMargin.positive, STOCK_KEYWORDS.costMargin.negative);
  const guidance = scoreTextBucket(text, STOCK_KEYWORDS.guidance.positive, STOCK_KEYWORDS.guidance.negative);
  const narrative = scoreTextBucket(text, STOCK_KEYWORDS.narrative.positive, STOCK_KEYWORDS.narrative.negative);
  const priceConfirmation =
    dayChangePct >= 3 ? 2 : dayChangePct >= 0.75 ? 1 : dayChangePct <= -3 ? -2 : dayChangePct <= -0.75 ? -1 : 0;
  const total = demand + costMargin + guidance + narrative + priceConfirmation;
  const breakdown = { demand, costMargin, guidance, narrative, priceConfirmation, total };
  return {
    symbol: "",
    name,
    score: total,
    change: formatPct(dayChangePct),
    summary: buildStockSummary(name, breakdown, formatPct(dayChangePct)),
    rawArticles: articles.slice(0, 1),
    breakdown,
  };
}

function scoreCryptoAsset(
  name: string,
  dayChangePct: number,
  cryptoAvgChangePct: number,
  articles: NormalizedArticle[]
): AssetResult {
  const text = buildTextFromArticles(articles);
  const liquidity = scoreTextBucket(text, CRYPTO_KEYWORDS.liquidity.positive, CRYPTO_KEYWORDS.liquidity.negative);
  const sentiment = scoreTextBucket(text, CRYPTO_KEYWORDS.sentiment.positive, CRYPTO_KEYWORDS.sentiment.negative);
  const catalyst = scoreTextBucket(text, CRYPTO_KEYWORDS.catalyst.positive, CRYPTO_KEYWORDS.catalyst.negative);
  const momentum =
    dayChangePct >= 4 ? 2 : dayChangePct >= 1 ? 1 : dayChangePct <= -4 ? -2 : dayChangePct <= -1 ? -1 : 0;
  const delta = dayChangePct - cryptoAvgChangePct;
  const relativeStrength =
    delta >= 3 ? 2 : delta >= 1 ? 1 : delta <= -3 ? -2 : delta <= -1 ? -1 : 0;
  const total = liquidity + sentiment + momentum + catalyst + relativeStrength;
  const breakdown = { liquidity, sentiment, momentum, catalyst, relativeStrength, total };
  return {
    symbol: "",
    name,
    score: total,
    change: formatPct(dayChangePct),
    summary: buildCryptoSummary(name, breakdown, formatPct(dayChangePct)),
    rawArticles: articles.slice(0, 1),
    breakdown,
  };
}

// ── Support helpers ────────────────────────────────────────────────────────

async function fetchRecentRaylaSymbols(projectUrl: string, serviceKey: string) {
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };
  const [manualRes, brokerRes] = await Promise.all([
    fetch(`${projectUrl}/rest/v1/trades?select=asset,entry_time&order=entry_time.desc&limit=250`, { headers }),
    fetch(`${projectUrl}/rest/v1/broker_trade_logs?select=symbol,submitted_at&order=submitted_at.desc&limit=250`, { headers }),
  ]);
  const symbols = new Set<string>();
  if (manualRes.ok) {
    const trades = await manualRes.json();
    for (const row of Array.isArray(trades) ? trades : []) {
      const symbol = String(row?.asset || "").trim().toUpperCase();
      if (symbol) symbols.add(symbol);
      if (symbols.size >= MAX_RAYLA_SYMBOLS) break;
    }
  }
  if (brokerRes.ok && symbols.size < MAX_RAYLA_SYMBOLS) {
    const rows = await brokerRes.json();
    for (const row of Array.isArray(rows) ? rows : []) {
      const symbol = String(row?.symbol || "").trim().toUpperCase();
      if (symbol) symbols.add(symbol);
      if (symbols.size >= MAX_RAYLA_SYMBOLS) break;
    }
  }
  return [...symbols];
}

function buildIntelEquityUniverse(raylaSymbols: string[]) {
  const baseMap = new Map(DEFAULT_EQUITY_UNIVERSE.map((item) => [item.symbol, item]));
  const orderedSymbols = [
    ...raylaSymbols.filter((symbol) => {
      const base = symbol.replace(/\/USD$/i, "").replace(/USD$/i, "");
      return !CRYPTO_SYMBOL_SET.has(symbol) && !CRYPTO_SYMBOL_SET.has(base);
    }),
    ...DEFAULT_EQUITY_UNIVERSE.map((item) => item.symbol),
  ];
  const universe = [];
  const seen = new Set<string>();
  for (const symbol of orderedSymbols) {
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    universe.push(baseMap.get(symbol) || { symbol, name: symbol, assetClass: "stock" });
    if (universe.length >= MAX_EQUITY_SCAN_SYMBOLS) break;
  }
  return universe;
}

async function getLatestMarketIntel() {
  const PROJECT_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(
    `${PROJECT_URL}/rest/v1/daily_intel_reports?order=report_date.desc&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  if (!res.ok) return null;
  const [data] = await res.json();
  return data;
}

function findAssetInIntel(intel: any, symbol: string) {
  if (!intel) return null;
  const all = [
    ...(intel.stock_hot || []),
    ...(intel.stock_cold || []),
    intel.crypto_hot,
    intel.crypto_cold,
  ].filter(Boolean);
  return all.find((a) => (a.symbol || "").toUpperCase() === symbol.toUpperCase()) || null;
}

// ── Request handler ────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Ask Rayla POST path ────────────────────────────────────────────────
  if (req.method === "POST") {
    const { question, context } = await req.json();
    const q = (question || "").toLowerCase().trim();
    const GROQ_KEY = Deno.env.get("GROQ_API_KEY") || "";
    if (!GROQ_KEY) throw new Error("Missing GROQ_API_KEY");

    const classifyPrompt = `Classify this user request into exactly one category.

Categories:
- concept = general trading or finance explanation, definition, or how something works
- personal_coaching = advice based on the user's own trades, performance, risk, habits, or behavior
- market_asset = question about a specific stock, crypto, asset, or market outlook
- app_help = question about Rayla features, tabs, uploads, logging, dashboard, or app usage

Reply with only one word:
concept
personal_coaching
market_asset
app_help

User question: ${question}
`;

    const classifyRes = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: RAYLA_GROQ_SYSTEM_PROMPT },
          { role: "user", content: classifyPrompt },
        ],
        temperature: 0.7,
      }),
    });
    const classifyData = await classifyRes.json();
    if (!classifyRes.ok) {
      return new Response(
        JSON.stringify({ error: classifyData?.error?.message || "Classification failed." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const route = (classifyData?.choices?.[0]?.message?.content || "concept").trim().toLowerCase();

    if (route === "concept" || route === "personal_coaching") {
      const systemPrompt = `You are Rayla, a smart trading coach.
Sound human, natural, and direct.

User context:
${context ? JSON.stringify(context) : "No user data available"}

Adapt to user level:
- Beginner: use simple language and explain clearly.
- Intermediate: be practical and clear.
- Experienced: be sharper and more technical.

Rules:
- Answer the user's actual question.
- Use the provided context when helpful.
- Do not invent facts or stats.
- Do not ask follow-up questions.
- Keep it concise.
- Use plain everyday language.
- Avoid trading jargon and textbook wording.
- Prefer short, direct sentences.
- Keep the tone calm and confident.
- Do not use dramatic or fear-based language.
- When explaining a concept, explain it naturally like you're talking to a person.

Formatting rules (STRICT — must follow exactly):
- Do NOT use markdown symbols (#, ##, **, -, etc.)
- Do NOT use headings or titles
- Use plain text only
- Use bullet points with this symbol: •
- Separate sections with a blank line
- Keep everything clean and easy to read on mobile

Keep responses structured like this.`;

      const aiRes = await fetch(GROQ_CHAT_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: "system", content: RAYLA_GROQ_SYSTEM_PROMPT },
            { role: "user", content: systemPrompt },
            { role: "user", content: question },
          ],
          temperature: 0.7,
        }),
      });
      const aiData = await aiRes.json();
      if (!aiRes.ok) {
        return new Response(
          JSON.stringify({ error: aiData?.error?.message || "AI request failed." }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      let answer = aiData?.choices?.[0]?.message?.content || "No response.";
      answer = answer
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/^(\d+)\.\s+/gm, "• ")
        .replace(/^[-–—]\s+/gm, "• ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      return new Response(
        JSON.stringify({ answer }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // market_asset / app_help path
    const intel = await getLatestMarketIntel();
    const allAssets = [
      ...(intel?.stock_hot || []),
      ...(intel?.stock_cold || []),
      intel?.crypto_hot,
      intel?.crypto_cold,
    ].filter(Boolean);

    const ql = question.toLowerCase();
    const matchedAsset = allAssets.find(
      (a) => ql.includes(a.symbol.toLowerCase()) || ql.includes(a.name.toLowerCase())
    );

    let verdict = "Neutral";
    let signalContext = "";
    if (matchedAsset) {
      if (matchedAsset.score >= 4) verdict = "Hot";
      else if (matchedAsset.score >= 1) verdict = "Leaning Hot";
      else if (matchedAsset.score <= -4) verdict = "Cold";
      else if (matchedAsset.score <= -1) verdict = "Leaning Cold";
      signalContext = `The asset is ${matchedAsset.symbol} (${matchedAsset.name}). It is ${matchedAsset.change} today with a score of ${matchedAsset.score}. Top drivers: ${matchedAsset.summary}`;
    } else {
      const hotCount = (intel?.stock_hot || []).length;
      const coldCount = (intel?.stock_cold || []).length;
      const marketBias = hotCount >= coldCount ? "broadly positive" : "broadly negative";
      const tickerMatch = question.match(/\b[A-Z]{1,5}\b/) || question.toUpperCase().match(/\b[A-Z]{1,5}\b/);
      const ticker = tickerMatch ? tickerMatch[0] : "this asset";
      verdict = hotCount >= coldCount ? "Leaning Hot" : "Leaning Cold";
      signalContext = `The asset is ${ticker}. It is not in today's scored intel. The broader market today is ${marketBias}. Apply this context to ${ticker}.`;
    }

    const systemPrompt = `You are Rayla. The verdict is ${verdict}. Write exactly 2 punchy sentences explaining why. No hedging. No disclaimers. End with "${verdict}" on its own line.

Context: ${signalContext}`;

    const aiRes = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: RAYLA_GROQ_SYSTEM_PROMPT },
          { role: "user", content: systemPrompt },
          { role: "user", content: question },
        ],
        temperature: 0.7,
      }),
    });
    const aiData = await aiRes.json();
    if (!aiRes.ok) {
      return new Response(
        JSON.stringify({ error: aiData?.error?.message || "AI request failed." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    let answer = aiData?.choices?.[0]?.message?.content || "Signal unavailable.";
    answer = answer
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/^(\d+)\.\s+/gm, "• ")
      .replace(/^[-–—]\s+/gm, "• ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return new Response(
      JSON.stringify({ answer }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── GET: Daily Intel report generation ────────────────────────────────
  try {
    const PROJECT_URL = Deno.env.get("SUPABASE_URL");
    const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY") || "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!FINNHUB_API_KEY) throw new Error("Missing FINNHUB_API_KEY");
    if (!PROJECT_URL) throw new Error("Missing SUPABASE_URL");
    if (!SERVICE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

    // Return cached report if valid
    const today = new Date().toISOString().split("T")[0];
    const existingRes = await fetch(
      `${PROJECT_URL}/rest/v1/daily_intel_reports?report_date=eq.${today}`,
      { headers: { apikey: SERVICE_KEY } }
    );
    if (!existingRes.ok) throw new Error(`DB fetch failed: ${existingRes.status}`);
    const existing = await existingRes.json();
    if (existing.length > 0) {
      const cached = existing[0];
      const hasCryptoInStockBuckets =
        (cached.stock_hot || []).some((s: any) => CRYPTO_SYMBOL_SET.has(s.symbol)) ||
        (cached.stock_cold || []).some((s: any) => CRYPTO_SYMBOL_SET.has(s.symbol));
      const isValid =
        !hasCryptoInStockBuckets &&
        Array.isArray(cached.stock_hot) && cached.stock_hot.length >= 3 &&
        Array.isArray(cached.stock_cold) && cached.stock_cold.length >= 3 &&
        cached.crypto_hot?.symbol &&
        cached.crypto_hot?.change !== "N/A" &&
        cached.crypto_hot?.change !== "+0.00%" &&
        cached.stock_hot.some((s: any) => s.change !== "+0.00%" && s.score !== 0);
      if (isValid) {
        return new Response(JSON.stringify({
          ok: true,
          report_date: today,
          stockHot: cached.stock_hot,
          stockCold: cached.stock_cold,
          cryptoHot: cached.crypto_hot,
          cryptoCold: cached.crypto_cold,
          source: "cache",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      }
    }

    // Build equity universe (Rayla-used symbols first, then defaults)
    const raylaSymbols = await fetchRecentRaylaSymbols(PROJECT_URL, SERVICE_KEY);
    const equityUniverse = buildIntelEquityUniverse(raylaSymbols);

    // ── Stocks: Alpaca snapshots → change% (each batch isolated) ──────────
    let stockQuotes: QuoteData[] = [];
    try {
      stockQuotes = await fetchStockQuotes(equityUniverse, FINNHUB_API_KEY);
    } catch (err) {
      console.warn("[intel] fetchStockQuotes failed entirely:", String(err));
      // stockQuotes stays [] — crypto pipeline is unaffected
    }

    // ── Crypto: Alpaca /us/snapshots → price + change% ───────────────────
    let cryptoQuotes: QuoteData[] = [];
    try {
      cryptoQuotes = await fetchCryptoQuotes(CRYPTO_UNIVERSE);
    } catch (err) {
      console.warn("[intel] crypto quotes failed entirely:", String(err));
      // cryptoQuotes stays [] — stock pipeline is unaffected
    }

    // ── Score stocks ──────────────────────────────────────────────────────
    const stockCandidates = stockQuotes.length >= 10
      ? stockQuotes
      : equityUniverse.map((item) => ({ symbol: item.symbol, name: item.name, dayChangePct: 0, price: null }));

    const topCandidates = [...stockCandidates]
      .sort((a, b) => Math.abs(b.dayChangePct) - Math.abs(a.dayChangePct))
      .slice(0, MAX_STOCK_NEWS_ENRICHMENT);

    const scoredStocksRaw = await mapWithConcurrency(topCandidates, 6, async (candidate) => {
      const news = await fetchNewsWithFallbacks(candidate.symbol, candidate.name, "stock", FINNHUB_API_KEY);
      const articles = news.length > 0
        ? news.slice(0, 1)
        : [buildFallbackArticle(candidate, `${candidate.name} stock`)];
      const scored = scoreStockAsset(candidate.name, candidate.dayChangePct ?? 0, articles);
      return { ...scored, symbol: candidate.symbol, rawArticles: articles.slice(0, 1) };
    });

    const hasRealArticle = (item: any) => {
      const url = item?.rawArticles?.[0]?.url || "";
      return url && !String(url).startsWith("https://news.google.com/search?q=");
    };

    const stockHot = dedupeBySymbol(
      [...scoredStocksRaw].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const da = Math.abs(Number(a.dayChangePct ?? 0));
        const db = Math.abs(Number(b.dayChangePct ?? 0));
        if (db !== da) return db - da;
        return Number(hasRealArticle(b)) - Number(hasRealArticle(a));
      })
    ).filter((asset) => !CRYPTO_SYMBOL_SET.has(asset.symbol)).slice(0, 3);

    const stockCold = dedupeBySymbol(
      [...scoredStocksRaw].sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        const da = Math.abs(Number(a.dayChangePct ?? 0));
        const db = Math.abs(Number(b.dayChangePct ?? 0));
        if (db !== da) return db - da;
        return Number(hasRealArticle(b)) - Number(hasRealArticle(a));
      })
    ).filter((asset) => !CRYPTO_SYMBOL_SET.has(asset.symbol)).slice(0, 3);

    // ── Score crypto ──────────────────────────────────────────────────────
    const cryptoAvgChange = cryptoQuotes.length > 0
      ? cryptoQuotes.reduce((sum, q) => sum + (q.dayChangePct ?? 0), 0) / cryptoQuotes.length
      : 0;

    const scoredCryptoRaw = await mapWithConcurrency(CRYPTO_UNIVERSE, 6, async (coin) => {
      const foundQuote = cryptoQuotes.find((q) => q.symbol === coin.symbol);
      const dayChangePct = foundQuote?.dayChangePct ?? 0;
      const news = await fetchNewsWithFallbacks(coin.symbol, coin.name, "crypto", FINNHUB_API_KEY);
      const articles = news.length > 0
        ? news.slice(0, 1)
        : [buildFallbackArticle(coin, `${coin.name} crypto`)];
      const scored = scoreCryptoAsset(coin.name, dayChangePct, cryptoAvgChange, articles);
      return {
        ...scored,
        symbol: coin.symbol,
        rawArticles: articles.slice(0, 1),
        change: foundQuote?.dayChangePct !== null && foundQuote?.dayChangePct !== undefined
          ? scored.change
          : "N/A",
      };
    });

    const scoredCrypto = scoredCryptoRaw.sort((a, b) => b.score - a.score);
    const cryptoHot = scoredCrypto[0] || null;
    const cryptoCold =
      scoredCrypto.find((item) => item.symbol !== cryptoHot?.symbol && item.score < 0) ||
      scoredCrypto.find((item) => item.symbol !== cryptoHot?.symbol) ||
      null;

    // ── Write to DB ───────────────────────────────────────────────────────
    const payload = {
      report_date: today,
      stock_hot: stockHot,
      stock_cold: stockCold,
      crypto_hot: cryptoHot,
      crypto_cold: cryptoCold,
      created_at: new Date().toISOString(),
    };

    const dbRes = await fetch(
      `${PROJECT_URL}/rest/v1/daily_intel_reports?on_conflict=report_date`,
      {
        method: "POST",
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify([payload]),
      }
    );
    if (!dbRes.ok) {
      const errorText = await dbRes.text();
      throw new Error(`DB write failed: ${dbRes.status} ${errorText}`);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        report_date: today,
        stockHot,
        stockCold,
        cryptoHot,
        cryptoCold,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("[intel] daily-intel failed:", error instanceof Error ? error.message : String(error));
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
