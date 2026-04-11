// @ts-nocheck

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.56/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

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
  dayChangePct: number;
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

const CRYPTO_UNIVERSE = [
  { symbol: "BTC", name: "Bitcoin", yahoo: "BTC-USD", query: "Bitcoin crypto" },
  { symbol: "ETH", name: "Ethereum", yahoo: "ETH-USD", query: "Ethereum crypto" },
  { symbol: "SOL", name: "Solana", yahoo: "SOL-USD", query: "Solana crypto" },
  { symbol: "XRP", name: "XRP", yahoo: "XRP-USD", query: "XRP crypto" },
  { symbol: "DOGE", name: "Dogecoin", yahoo: "DOGE-USD", query: "Dogecoin crypto" },
  { symbol: "BNB", name: "BNB", yahoo: "BNB-USD", query: "BNB crypto" },
  { symbol: "ADA", name: "Cardano", yahoo: "ADA-USD", query: "Cardano crypto" },
  { symbol: "AVAX", name: "Avalanche", yahoo: "AVAX-USD", query: "Avalanche crypto" },
  { symbol: "LINK", name: "Chainlink", yahoo: "LINK-USD", query: "Chainlink crypto" },
  { symbol: "MATIC", name: "Polygon", yahoo: "MATIC-USD", query: "Polygon crypto" },
];

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
      "demand",
      "strong demand",
      "higher demand",
      "bookings",
      "backlog",
      "orders",
      "sales growth",
      "traffic",
      "adoption",
      "expanding market",
      "share gains",
      "customer growth",
      "subscriber growth",
      "uptick",
      "rebound",
    ],
    negative: [
      "weak demand",
      "soft demand",
      "slowing demand",
      "declining sales",
      "traffic slowdown",
      "share loss",
      "cancellation",
      "slowdown",
      "contraction",
      "headwinds",
      "falling demand",
      "recession fears",
      "missed demand",
    ],
  },
  costMargin: {
    positive: [
      "margin expansion",
      "improved margin",
      "cost cuts",
      "lower costs",
      "efficiency",
      "productivity",
      "pricing power",
      "profitability improved",
      "operating leverage",
      "supply chain easing",
    ],
    negative: [
      "margin pressure",
      "higher costs",
      "input costs",
      "labor pressure",
      "supply chain issues",
      "tariffs",
      "cost inflation",
      "profit warning",
      "lower margins",
      "expense growth",
      "commodity prices rise",
    ],
  },
  guidance: {
    positive: [
      "raised guidance",
      "beat earnings",
      "beats earnings",
      "upward revision",
      "upgraded",
      "better outlook",
      "reiterated guidance",
      "above expectations",
      "strong forecast",
      "bullish outlook",
    ],
    negative: [
      "cut guidance",
      "missed earnings",
      "miss earnings",
      "downgraded",
      "lowered outlook",
      "below expectations",
      "weak forecast",
      "earnings warning",
      "trimmed target",
      "analyst cut",
    ],
  },
  narrative: {
    positive: [
      "bullish",
      "optimism",
      "positive catalyst",
      "momentum",
      "rally",
      "breakout",
      "confidence",
      "tailwind",
      "strong story",
      "winner",
      "leadership",
    ],
    negative: [
      "bearish",
      "selloff",
      "concern",
      "probe",
      "lawsuit",
      "risk",
      "uncertainty",
      "warning",
      "downdraft",
      "headwind",
      "controversy",
      "pressure",
    ],
  },
};

const CRYPTO_KEYWORDS = {
  liquidity: {
    positive: [
      "inflows",
      "etf inflows",
      "capital inflows",
      "institutional demand",
      "open interest rises",
      "liquidity improving",
      "accumulation",
      "funding stable",
      "more buyers",
    ],
    negative: [
      "outflows",
      "capital outflows",
      "liquidations",
      "liquidity drying up",
      "risk-off",
      "selling pressure",
      "deleveraging",
      "funding stress",
      "more sellers",
    ],
  },
  sentiment: {
    positive: [
      "bullish",
      "optimism",
      "adoption",
      "confidence",
      "surge",
      "rally",
      "interest rising",
      "positive sentiment",
      "buyers returning",
    ],
    negative: [
      "bearish",
      "fear",
      "panic",
      "selloff",
      "hack",
      "exploit",
      "lawsuit",
      "negative sentiment",
      "capitulation",
      "uncertainty",
    ],
  },
  catalyst: {
    positive: [
      "etf approval",
      "listing",
      "upgrade",
      "mainnet",
      "partnership",
      "integration",
      "regulatory clarity",
      "network upgrade",
      "adoption catalyst",
      "staking growth",
    ],
    negative: [
      "delisting",
      "lawsuit",
      "regulatory crackdown",
      "unlock",
      "token unlock",
      "exploit",
      "hack",
      "investigation",
      "sec action",
      "security issue",
    ],
  },
};

function chunkArray<T>(arr: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function clampScore(value: number) {
  if (value > 2) return 2;
  if (value < -2) return -2;
  return value;
}

function formatPct(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
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

function sanitizeGNewsQuery(q: string): string {
  return q
    .replace(/&/g, "and")
    .replace(/[<>#%{}|^~[\]`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreTextBucket(text: string, positive: string[], negative: string[]) {
  let score = 0;

  for (const word of positive) {
    if (text.includes(word.toLowerCase())) score += 1;
  }

  for (const word of negative) {
    if (text.includes(word.toLowerCase())) score -= 1;
  }

  return clampScore(score);
}

function buildTextFromArticles(articles: NormalizedArticle[]) {
  return articles
    .map((a) => `${a.title || ""} ${a.description || ""}`)
    .join(" ")
    .toLowerCase();
}

function buildStockSummary(name: string, breakdown: Record<string, number>, change: string) {
  const ordered = [
    ["Demand Impact", breakdown.demand],
    ["Cost / Margin Impact", breakdown.costMargin],
    ["Guidance / Earnings Impact", breakdown.guidance],
    ["Narrative / Sentiment Impact", breakdown.narrative],
    ["Price Confirmation", breakdown.priceConfirmation],
  ].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  const strongest = ordered[0];
  const second = ordered[1];

  const label =
    breakdown.total >= 4
      ? "Hot"
      : breakdown.total >= 1
      ? "Leaning Hot"
      : breakdown.total <= -4
      ? "Cold"
      : breakdown.total <= -1
      ? "Leaning Cold"
      : "Neutral";

  return `${label}. ${name} is at ${change}. Biggest drivers: ${strongest[0]} (${strongest[1] > 0 ? "positive" : strongest[1] < 0 ? "negative" : "neutral"}) and ${second[0]} (${second[1] > 0 ? "positive" : second[1] < 0 ? "negative" : "neutral"}).`;
}

function buildCryptoSummary(name: string, breakdown: Record<string, number>, change: string) {
  const ordered = [
    ["Liquidity Impact", breakdown.liquidity],
    ["Sentiment Impact", breakdown.sentiment],
    ["Momentum Impact", breakdown.momentum],
    ["Catalyst Impact", breakdown.catalyst],
    ["Relative Strength / Weakness", breakdown.relativeStrength],
  ].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  const strongest = ordered[0];
  const second = ordered[1];

  const label =
    breakdown.total >= 4
      ? "Hot"
      : breakdown.total >= 1
      ? "Leaning Hot"
      : breakdown.total <= -4
      ? "Cold"
      : breakdown.total <= -1
      ? "Leaning Cold"
      : "Neutral";

  return `${label}. ${name} is at ${change}. Biggest drivers: ${strongest[0]} (${strongest[1] > 0 ? "positive" : strongest[1] < 0 ? "negative" : "neutral"}) and ${second[0]} (${second[1] > 0 ? "positive" : second[1] < 0 ? "negative" : "neutral"}).`;
}

async function fetchSp500Constituents() {
  const res = await fetch(WIKI_SP500_URL, {
    headers: { "User-Agent": "Rayla/1.0" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch S&P 500 page: ${res.status}`);
  }

  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  if (!doc) {
    throw new Error("Failed to parse S&P 500 page");
  }

  const table = doc.querySelector("table.wikitable");
  if (!table) {
    throw new Error("Could not find S&P 500 constituents table");
  }

  const rows = [...table.querySelectorAll("tbody tr")].slice(1);

  const constituents = rows
    .map((row) => {
      const cells = row.querySelectorAll("td");
      if (!cells || cells.length < 2) return null;

      const symbol = cells[0]?.textContent?.trim()?.replace(/\./g, "-");
      const name = cells[1]?.textContent?.trim();

      if (!symbol || !name) return null;

      return { symbol, name };
    })
    .filter(Boolean);

  if (constituents.length < 490) {
    throw new Error(`Constituent pull looks wrong: only got ${constituents.length}`);
  }

  return constituents;
}

async function fetchFinnhubQuotes(
  items: { symbol: string; name: string; yahoo?: string }[],
  type: "stock" | "crypto",
  finnhubKey: string
): Promise<QuoteData[]> {
  const results = await mapWithConcurrency(items, 3, async (item) => {
    const symbol = type === "crypto" ? `BINANCE:${item.symbol}USDT` : item.symbol;
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${finnhubKey}`;

    try {
      await new Promise(r => setTimeout(r, 250));
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`Finnhub quote failed ${res.status} for ${symbol}`);
        return null;
      }
      const data = await res.json();
      const price = data.c ?? null;
      const prevClose = data.pc ?? null;
      const dayChangePct = price && prevClose && prevClose !== 0
        ? ((price - prevClose) / prevClose) * 100
        : 0;

      return {
        symbol: item.symbol,
        name: item.name,
        dayChangePct,
        price,
      };
    } catch (err) {
      console.error(`Finnhub exception for ${symbol}:`, err);
      return null;
    }
  });

  return results.filter(Boolean) as QuoteData[];
}


async function fetchNewsWithFallbacks(
  symbol: string,
  name: string,
  type: "stock" | "crypto",
  apiKey: string,
  gnewsDebug: string[] = []
): Promise<NormalizedArticle[]> {
  try {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 3);
    const fromStr = from.toISOString().split("T")[0];
    const toStr = today.toISOString().split("T")[0];
    const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fromStr}&to=${toStr}&token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) { gnewsDebug?.push?.(`Finnhub news failed ${res.status} for ${symbol}`); return []; }
    const data = await res.json();
    const articles = Array.isArray(data) ? data : [];
    const normalized = articles.filter((a: any) => a.headline && a.url).slice(0, 1).map((a: any) => ({
      title: a.headline || "No title",
      description: a.summary || "No summary available",
      image: a.image || "",
      url: a.url || "#",
      source: { name: a.source || "Finnhub" },
      publishedAt: a.datetime ? new Date(a.datetime * 1000).toISOString() : "",
    }));
    gnewsDebug?.push?.(`Finnhub news for ${symbol}: ${normalized.length} articles`);
    return normalized;
  } catch (err) {
    gnewsDebug?.push?.(`exception for ${symbol}: ${String(err)}`);
    return [];
  }
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

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function scoreStockAsset(
  name: string,
  dayChangePct: number,
  articles: NormalizedArticle[]
): AssetResult {
  const text = buildTextFromArticles(articles);

  const demand = scoreTextBucket(
    text,
    STOCK_KEYWORDS.demand.positive,
    STOCK_KEYWORDS.demand.negative
  );

  const costMargin = scoreTextBucket(
    text,
    STOCK_KEYWORDS.costMargin.positive,
    STOCK_KEYWORDS.costMargin.negative
  );

  const guidance = scoreTextBucket(
    text,
    STOCK_KEYWORDS.guidance.positive,
    STOCK_KEYWORDS.guidance.negative
  );

  const narrative = scoreTextBucket(
    text,
    STOCK_KEYWORDS.narrative.positive,
    STOCK_KEYWORDS.narrative.negative
  );

  const priceConfirmation =
    dayChangePct >= 3 ? 2 : dayChangePct >= 0.75 ? 1 : dayChangePct <= -3 ? -2 : dayChangePct <= -0.75 ? -1 : 0;

  const total = demand + costMargin + guidance + narrative + priceConfirmation;

  const breakdown = {
    demand,
    costMargin,
    guidance,
    narrative,
    priceConfirmation,
    total,
  };

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
  relativeStrengthBase: number,
  articles: NormalizedArticle[]
): AssetResult {
  const text = buildTextFromArticles(articles);

  const liquidity = scoreTextBucket(
    text,
    CRYPTO_KEYWORDS.liquidity.positive,
    CRYPTO_KEYWORDS.liquidity.negative
  );

  const sentiment = scoreTextBucket(
    text,
    CRYPTO_KEYWORDS.sentiment.positive,
    CRYPTO_KEYWORDS.sentiment.negative
  );

  const catalyst = scoreTextBucket(
    text,
    CRYPTO_KEYWORDS.catalyst.positive,
    CRYPTO_KEYWORDS.catalyst.negative
  );

  const momentum =
    dayChangePct >= 4 ? 2 : dayChangePct >= 1 ? 1 : dayChangePct <= -4 ? -2 : dayChangePct <= -1 ? -1 : 0;

  const relativeDelta = dayChangePct - relativeStrengthBase;
  const relativeStrength =
    relativeDelta >= 3 ? 2 : relativeDelta >= 1 ? 1 : relativeDelta <= -3 ? -2 : relativeDelta <= -1 ? -1 : 0;

  const total = liquidity + sentiment + momentum + catalyst + relativeStrength;

  const breakdown = {
    liquidity,
    sentiment,
    momentum,
    catalyst,
    relativeStrength,
    total,
  };

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

function dedupeBySymbol<T extends { symbol: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.symbol)) return false;
    seen.add(item.symbol);
    return true;
  });
}

async function attachArticleToItem(
  item: any,
  type: "stock" | "crypto",
  apiKey: string
) {
  const gnewsDebug: string[] = [];
  const news = await fetchNewsWithFallbacks(
  item.symbol,
  item.name,
  type,
  apiKey,
  gnewsDebug
);

  if (news.length > 0) {
    return {
      ...item,
      rawArticles: news.slice(0, 1),
      
    };
  }

  const fallbackQuery =
    (NEWS_QUERY_MAP[item.symbol] && NEWS_QUERY_MAP[item.symbol][0]) ||
    (type === "crypto" ? `${item.name} crypto` : `${item.name} stock`);

  return {
    ...item,
    rawArticles: [buildFallbackArticle(item, fallbackQuery)],
  };
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

async function getLatestMarketIntel() {
  const PROJECT_URL = Deno.env.get("PROJECT_URL");
  const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY");

  const res = await fetch(
    `${PROJECT_URL}/rest/v1/daily_intel_reports?order=report_date.desc&limit=1`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    }
  );
  if (!res.ok) return null;
  const [data] = await res.json();
  return data;
}

function simpleRaylaOpinion(asset) {
  if (!asset || typeof asset !== "object") return { opinion: "unknown", reason: "No data found." };
  if (asset.score >= 2) return { opinion: "buy", reason: "Asset is rated hot based on recent news and sentiment." };
  if (asset.score >= 1) return { opinion: "consider buying", reason: "Asset is leaning hot/positive but not the top pick." };
  if (asset.score <= -2) return { opinion: "sell", reason: "Asset is rated cold due to negative news or momentum." };
  if (asset.score <= -1) return { opinion: "consider selling", reason: "Asset has negative sentiment/drivers." };
  return { opinion: "hold", reason: "Asset is neutral with no strong signals." };
}

function findAssetInIntel(intel, symbol) {
  if (!intel) return null;
  const allStocks = [...(intel.stock_hot || []), ...(intel.stock_cold || [])];
  const allCrypto = [intel.crypto_hot, intel.crypto_cold].filter(Boolean);
  return (
    allStocks.find(a => (a.symbol || "").toUpperCase() === symbol.toUpperCase()) ||
    allCrypto.find(a => (a.symbol || "").toUpperCase() === symbol.toUpperCase())
  );
}

serve(async (req) => {
  const gnewsDebug: string[] = [];
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }


   // Ask Rayla endpoint
  if (req.method === "POST") {
    const { question } = await req.json();

    const OPENAI_KEY = Deno.env.get("OPENAIKEY") || "";
    if (!OPENAI_KEY) throw new Error("Missing OPENAIKEY");

    const intel = await getLatestMarketIntel();

    const allAssets = [
      ...(intel?.stock_hot || []),
      ...(intel?.stock_cold || []),
      intel?.crypto_hot,
      intel?.crypto_cold,
    ].filter(Boolean);

    const ql = question.toLowerCase();
    const matchedAsset = allAssets.find(a =>
      ql.includes(a.symbol.toLowerCase()) ||
      ql.includes(a.name.toLowerCase())
    );

    // Compute verdict ourselves — never let the AI guess
    let verdict = "Neutral";
    let signalContext = "";

    if (matchedAsset) {
      if (matchedAsset.score >= 4) verdict = "Hot";
      else if (matchedAsset.score >= 1) verdict = "Leaning Hot";
      else if (matchedAsset.score <= -4) verdict = "Cold";
      else if (matchedAsset.score <= -1) verdict = "Leaning Cold";
      else verdict = "Neutral";

      signalContext = `The asset is ${matchedAsset.symbol} (${matchedAsset.name}). It is ${matchedAsset.change} today with a score of ${matchedAsset.score}. Top drivers: ${matchedAsset.summary}`;
    } else {
      // Derive market context from today's hot/cold stocks
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

   const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
    if (!ANTHROPIC_KEY) throw new Error("Missing ANTHROPIC_API_KEY");

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        system: systemPrompt,
        messages: [
          { role: "user", content: question },
        ],
      }),
    });

    const aiData = await aiRes.json();
    const answer = aiData?.content?.[0]?.text || "Signal unavailable.";

    return new Response(
      JSON.stringify({ answer }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }


  try {
    
    const PROJECT_URL = Deno.env.get("PROJECT_URL");
    const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY") || "";
    const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY");
    if (!FINNHUB_API_KEY) throw new Error("Missing FINNHUB_API_KEY");
    if (!PROJECT_URL) throw new Error("Missing PROJECT_URL");
    if (!SERVICE_KEY) throw new Error("Missing SERVICE_ROLE_KEY");

    // 5) Crypto quotes
    const cryptoQuotes = await fetchFinnhubQuotes(CRYPTO_UNIVERSE, "crypto", FINNHUB_API_KEY);
    const cryptoAvgChange =
      cryptoQuotes.length > 0
        ? cryptoQuotes.reduce((sum, item) => sum + item.dayChangePct, 0) / cryptoQuotes.length
        : 0;

    // 1. Return cached daily report if it exists in DB
    const today = new Date().toISOString().split("T")[0];
    const existingRes = await fetch(
      `${PROJECT_URL}/rest/v1/daily_intel_reports?report_date=eq.${today}`,
      {
        headers: {
          apikey: SERVICE_KEY,
        },
      }
    );
    if (!existingRes.ok) throw new Error(`Supabase fetch daily_intel_reports failed: ${existingRes.status}`);
    const existing = await existingRes.json();
    if (existing.length > 0) {
      console.log(`[intel] Returned cached daily intel for ${today}`);
      return new Response(JSON.stringify({
        ok: true,
        report_date: today,
        stockHot: existing[0].stock_hot,
        stockCold: existing[0].stock_cold,
        cryptoHot: existing[0].crypto_hot,
        cryptoCold: existing[0].crypto_cold,
        source: "cache"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    console.log(`[intel] No cached report for ${today}, computing fresh report.`);

      // 1) Load S&P 500 universe with REAL company names (prefer Wikipedia; fallback to local JSON)
      let sp500: { symbol: string; name: string }[] = [];
      try {
        sp500 = await fetchSp500Constituents();
      } catch (err) {
        console.error("fetchSp500Constituents failed; falling back to local sp500.json", err);

        const text = await Deno.readTextFile("../_shared/sp500.json");
        const json = JSON.parse(text);

        // Expect JSON to contain objects like: { symbol: "ABT", name: "Abbott Laboratories" }
        const list: any[] = Array.isArray(json?.constituents)
          ? json.constituents
          : Array.isArray(json?.sp500)
          ? json.sp500
          : Array.isArray(json?.items)
          ? json.items
          : Array.isArray(json)
          ? json
          : [];

        sp500 = list
          .map((x) => ({
            symbol: String(x?.symbol || "").trim().toUpperCase(),
            name: String(x?.name || "").trim(),
          }))
          .filter((x) => x.symbol && x.name);
      }

    const stockQuotes = await fetchFinnhubQuotes(sp500, "stock", FINNHUB_API_KEY);

    console.log(`S&P 500 constituents: ${sp500.length}`);
    console.log(`Finnhub quotes returned: ${stockQuotes.length}`);

    let stockCandidates: QuoteData[] = [];

    if (stockQuotes.length >= 10) {
      // Scan the full S&P 500, in the order returned by fetchFinnhubQuotes (no subset, no bias)
      stockCandidates = stockQuotes;
    } else {
      // fallback: scan the full S&P 500 with 0% change if quotes missing
      stockCandidates = sp500.map((item) => ({
        symbol: item.symbol,
        name: item.name,
        dayChangePct: 0,
        price: null,
      }));
    }

    console.log("[DEBUG] Number of S&P 500 stock candidates for scoring:", stockCandidates.length);
    console.log("[DEBUG] Example stock symbols scanned:", stockCandidates.slice(0, 10).map(x => x.symbol).join(", "), "...", stockCandidates.slice(-10).map(x => x.symbol).join(", "));
 

        // 4) Fetch news + score stock candidates (news BEFORE scoring)
        const topMovers = [...stockCandidates]
          .sort((a, b) => Math.abs(b.dayChangePct) - Math.abs(a.dayChangePct))
          .slice(0, 30);

        const scoredStocksRaw = await mapWithConcurrency(topMovers, 6, async (candidate) => {
          const news = await fetchNewsWithFallbacks(
            candidate.symbol,
            candidate.name,
            "stock",
            FINNHUB_API_KEY,
            []
          );

          const articles =
            news.length > 0
              ? news.slice(0, 1)
              : [buildFallbackArticle(candidate, `${candidate.name} stock`)];

          const scored = scoreStockAsset(candidate.name, candidate.dayChangePct, articles);

          return {
            ...scored,
            symbol: candidate.symbol,
            rawArticles: articles.slice(0, 1),
          };
        });

       const scoredStocks = scoredStocksRaw.sort((a, b) => b.score - a.score);

      // Select AFTER all candidates are scored (tie-break: abs(dayChangePct), then real-article vs fallback)
      const hasRealArticle = (item: any) => {
        const url = item?.rawArticles?.[0]?.url || "";
        return url && !String(url).startsWith("https://news.google.com/search?q=");
      };

      const stockHot = dedupeBySymbol(
        [...scoredStocks].sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;

          const aAbs = Math.abs(Number(a.dayChangePct ?? 0));
          const bAbs = Math.abs(Number(b.dayChangePct ?? 0));
          if (bAbs !== aAbs) return bAbs - aAbs;

          return Number(hasRealArticle(b)) - Number(hasRealArticle(a));
        })
      )
        .filter((item) => item.score >= 0)
        .slice(0, 3);

      const stockCold = dedupeBySymbol(
        [...scoredStocks].sort((a, b) => {
          if (a.score !== b.score) return a.score - b.score;

          const aAbs = Math.abs(Number(a.dayChangePct ?? 0));
          const bAbs = Math.abs(Number(b.dayChangePct ?? 0));
          if (bAbs !== aAbs) return bAbs - aAbs;

          return Number(hasRealArticle(b)) - Number(hasRealArticle(a));
        })
      )
        .filter((item) => item.score <= 0)
        .slice(0, 3);

      // 6) Crypto news + score (news BEFORE scoring)
const scoredCryptoRaw = await mapWithConcurrency(CRYPTO_UNIVERSE, 6, async (coin) => {
  const quote = cryptoQuotes.find((q) => q.symbol === coin.symbol) || {
    symbol: coin.symbol,
    name: coin.name,
    dayChangePct: 0,
    price: null,
  };

  const news = await fetchNewsWithFallbacks(coin.symbol, coin.name, "crypto", FINNHUB_API_KEY, []);

  const articles =
    news.length > 0
      ? news.slice(0, 1)
      : [buildFallbackArticle(coin, `${coin.name} crypto`)];

  const scored = scoreCryptoAsset(coin.name, quote.dayChangePct, cryptoAvgChange, articles);

  return {
    ...scored,
    symbol: coin.symbol,
    rawArticles: articles.slice(0, 1),
  };
});

const scoredCrypto = scoredCryptoRaw.sort((a, b) => b.score - a.score);
const cryptoHot = scoredCrypto[0] || null;
const cryptoCold = [...scoredCrypto].sort((a, b) => a.score - b.score).find((item) => item.symbol !== cryptoHot?.symbol && item.score < 0) || [...scoredCrypto].sort((a, b) => a.score - b.score).find((item) => item.symbol !== cryptoHot?.symbol) || null;

// Select AFTER all candidates are scored







console.log("[intel] Hot candidates selected:", stockHot.map(a => a.symbol));
console.log("[intel] Cold candidates selected:", stockCold.map(a => a.symbol));
console.log("[intel] Crypto hot:", cryptoHot?.symbol);
console.log("[intel] Crypto cold:", cryptoCold?.symbol);

    

    console.log("FINAL INTEL BEFORE SAVE:", JSON.stringify({
    stockHot,
    stockCold,
    cryptoHot,
    cryptoCold,
  }, null, 2));

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

    const dbJson = await dbRes.json();

        
    
// Ensure correct fields used throughout
const CRYPTO_SYMBOLS = new Set(CRYPTO_UNIVERSE.map(c => c.symbol));
const filteredStockHot = stockHot.filter(asset => !CRYPTO_SYMBOLS.has(asset.symbol));
const filteredStockCold = stockCold.filter(asset => !CRYPTO_SYMBOLS.has(asset.symbol));

// Pick just the top (first) and bottom (first) crypto
const filteredCrypto = scoredCrypto.filter(asset => CRYPTO_SYMBOLS.has(asset.symbol));
const cryptoHotFinal = filteredCrypto[0] || null;
const cryptoColdFinal = filteredCrypto.find(asset => asset.symbol !== cryptoHotFinal?.symbol && asset.score < 0) || filteredCrypto.find(asset => asset.symbol !== cryptoHotFinal?.symbol) || null;

        return new Response(
  JSON.stringify({
    ok: true,
    report_date: today,
    stockHot: filteredStockHot,
    stockCold: filteredStockCold,
    cryptoHot: cryptoHotFinal,
    cryptoCold: cryptoColdFinal,
    db: dbJson,
    gnewsDebug,
  }),
  {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
    status: 200,
  }
);

  } catch (error) {
    console.error("daily-intel failed:", error);

    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 500,
      }
    );
  }
});