// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  alpacaMarketDataRequest,
  getAlpacaMarketDataEnv,
  normalizeAlpacaBar,
  normalizeAlpacaSnapshot,
} from "../_shared/alpaca.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CRYPTO_BASES = new Set(["BTC","ETH","SOL","XRP","DOGE","BNB","ADA","AVAX","LINK","MATIC","DOT","UNI","ATOM","LTC","BCH","ALGO","NEAR","FTM","SAND","MANA","TRX","TRON"]);
const FALLBACK_CORS_JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };

function normalizeSymbolInput(item: any) {
  const symbol = String(item?.symbol || item || "").trim().toUpperCase();
  const type = String(item?.type || "").trim().toLowerCase();
  const assetType = type === "crypto" || CRYPTO_BASES.has(symbol) ? "crypto" : "stock";
  return { symbol, assetType };
}

function buildCryptoPair(symbol: string) {
  return `${symbol}/USD`;
}

function parseQuoteTimestamp(value: any) {
  if (!value) return null;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function isStaleCryptoQuote(quote: any) {
  const updatedAtMs = parseQuoteTimestamp(quote?.updatedAt);
  if (!updatedAtMs) return true;
  return Date.now() - updatedAtMs > 60_000;
}

function getChartConfig(range = "1D") {
  const now = new Date();
  const end = now.toISOString();

  if (range === "MAX") {
    return {
      stockTimeframe: "1Month",
      cryptoTimeframe: "1Month",
      start: new Date(now.getTime() - 20 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      end,
      limit: 240,
    };
  }

  if (range === "5Y") {
    return {
      stockTimeframe: "1Week",
      cryptoTimeframe: "1Week",
      start: new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      end,
      limit: 270,
    };
  }

  if (range === "1Y") {
    return {
      stockTimeframe: "1Day",
      cryptoTimeframe: "1Day",
      start: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      end,
      limit: 366,
    };
  }

  if (range === "1W") {
    return {
      stockTimeframe: "1Hour",
      cryptoTimeframe: "1Hour",
      start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      end,
      limit: 168,
    };
  }

  if (range === "1M") {
    return {
      stockTimeframe: "1Day",
      cryptoTimeframe: "1Day",
      start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end,
      limit: 60,
    };
  }

  if (range === "3M") {
    return {
      stockTimeframe: "1Day",
      cryptoTimeframe: "1Day",
      start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      end,
      limit: 90,
    };
  }

  return {
    stockTimeframe: "15Min",
    cryptoTimeframe: "15Min",
    start: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    end,
    limit: 96,
  };
}

async function fetchSnapshots(items: any[]) {
  const { stockFeed } = getAlpacaMarketDataEnv();
  const quotes: Record<string, { price: number; change: number; updatedAt?: string | null }> = {};
  const stockSymbols = items.filter((item) => item.assetType === "stock").map((item) => item.symbol);
  const cryptoSymbols = items.filter((item) => item.assetType === "crypto").map((item) => item.symbol);

  if (stockSymbols.length) {
    const data = await alpacaMarketDataRequest(`/v2/stocks/snapshots?symbols=${encodeURIComponent(stockSymbols.join(","))}&feed=${stockFeed}`);
    stockSymbols.forEach((symbol) => {
      const normalized = normalizeAlpacaSnapshot(symbol, data?.snapshots?.[symbol], "stock");
      if (normalized) {
        quotes[symbol] = {
          price: normalized.price,
          change: normalized.change,
          updatedAt: normalized.updatedAt || null,
        };
      }
    });
  }

  if (cryptoSymbols.length) {
    const cryptoPairs = cryptoSymbols.map(buildCryptoPair);
    const data = await alpacaMarketDataRequest(`/v1beta3/crypto/us/snapshots?symbols=${encodeURIComponent(cryptoPairs.join(","))}`);
    cryptoSymbols.forEach((symbol) => {
      const normalized = normalizeAlpacaSnapshot(symbol, data?.snapshots?.[buildCryptoPair(symbol)], "crypto");
      if (normalized) {
        quotes[symbol] = {
          price: normalized.price,
          change: normalized.change,
          updatedAt: normalized.updatedAt || null,
        };
      }
    });
  }

  return quotes;
}

async function fetchFallbackSnapshots(items: any[]) {
  const polygonKey = Deno.env.get("POLYGON_API_KEY");
  const finnhubKey = Deno.env.get("FINNHUB_API_KEY");
  const quotes: Record<string, { price: number; change: number; updatedAt?: string | null }> = {};
  const stockSymbols = items.filter((item) => item.assetType === "stock").map((item) => item.symbol);
  const cryptoSymbols = items.filter((item) => item.assetType === "crypto").map((item) => item.symbol);

  if (polygonKey && stockSymbols.length) {
    const tickerList = stockSymbols.join(",");
    const res = await fetch(`https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${encodeURIComponent(tickerList)}&apiKey=${polygonKey}`);
    if (res.ok) {
      const data = await res.json();
      for (const ticker of data?.tickers || []) {
        const symbol = String(ticker?.ticker || "").toUpperCase();
        const price = Number(ticker?.day?.c ?? ticker?.lastTrade?.p ?? ticker?.prevDay?.c ?? 0);
        const prevClose = Number(ticker?.prevDay?.c ?? 0);
        if (!symbol || !Number.isFinite(price) || price <= 0) continue;
        const change = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
        quotes[symbol] = {
          price,
          change: Number(change.toFixed(2)),
          updatedAt: ticker?.lastTrade?.t || ticker?.updated_utc || null,
        };
      }
    }
  }

  if (finnhubKey && cryptoSymbols.length) {
    for (const symbol of cryptoSymbols) {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=BINANCE:${encodeURIComponent(symbol)}USDT&token=${finnhubKey}`);
      if (!res.ok) continue;
      const data = await res.json();
      const price = Number(data?.c ?? 0);
      const prevClose = Number(data?.pc ?? 0);
      if (!Number.isFinite(price) || price <= 0) continue;
      const change = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
      quotes[symbol] = {
        price,
        change: Number(change.toFixed(2)),
        updatedAt: data?.t ? new Date(data.t * 1000).toISOString() : new Date().toISOString(),
      };
    }
  }

  return quotes;
}

async function fetchChart(symbol: string, assetType: string, range = "1D") {
  if (!symbol) return { symbol, range, bars: [] };

  const config = getChartConfig(range);
  const timeframe = assetType === "crypto" ? config.cryptoTimeframe : config.stockTimeframe;

  try {
    if (assetType === "crypto") {
      const pair = buildCryptoPair(symbol);
      const data = await alpacaMarketDataRequest(
        `/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(pair)}&timeframe=${encodeURIComponent(timeframe)}&start=${encodeURIComponent(config.start)}&end=${encodeURIComponent(config.end)}&limit=${config.limit}`
      );
      const rawBars = Array.isArray(data?.bars?.[pair]) ? data.bars[pair] : [];
      const bars = rawBars
        .map(normalizeAlpacaBar)
        .filter((bar: any) => Number.isFinite(bar.close) && bar.close > 0)
        .map(({ raw, ...bar }: any) => bar);

      if (!bars.length) {
        console.log("market-data fetchChart crypto returned no Alpaca bars", { symbol, pair, range, timeframe });
      }

      return { symbol, range, bars };
    }

    const { stockFeed } = getAlpacaMarketDataEnv();
    const data = await alpacaMarketDataRequest(
      `/v2/stocks/${encodeURIComponent(symbol)}/bars?timeframe=${encodeURIComponent(timeframe)}&start=${encodeURIComponent(config.start)}&end=${encodeURIComponent(config.end)}&limit=${config.limit}&feed=${encodeURIComponent(stockFeed)}`
    );
    const rawBars = Array.isArray(data?.bars) ? data.bars : [];
    const bars = rawBars
      .map(normalizeAlpacaBar)
      .filter((bar: any) => Number.isFinite(bar.close) && bar.close > 0)
      .map(({ raw, ...bar }: any) => bar);

    if (!bars.length) {
      console.log("market-data fetchChart stock returned no Alpaca bars", { symbol, range, timeframe, feed: stockFeed });
    }

    return { symbol, range, bars };
  } catch (error) {
    console.error("market-data fetchChart Alpaca bars failed", { symbol, assetType, range, error: error?.message || String(error) });
    return { symbol, range, bars: [] };
  }
}

async function fetchSymbolNews(symbol: string, assetType: string) {
  const finnhubKey = Deno.env.get("FINNHUB_API_KEY");
  const newsDataKey = Deno.env.get("NEWSDATA_API_KEY");

  if (finnhubKey && assetType !== "crypto") {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 3);
    const fromStr = from.toISOString().split("T")[0];
    const toStr = today.toISOString().split("T")[0];
    const res = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fromStr}&to=${toStr}&token=${finnhubKey}`);
    if (res.ok) {
      const data = await res.json();
      const articles = Array.isArray(data) ? data : [];
      const normalized = articles
        .filter((article: any) => article?.headline && article?.url)
        .slice(0, 3)
        .map((article: any) => ({
          id: article?.id || article?.url,
          headline: article?.headline || "",
          summary: article?.summary || "",
          url: article?.url || null,
          source: article?.source || "Finnhub",
          createdAt: article?.datetime ? new Date(article.datetime * 1000).toISOString() : null,
          symbols: [symbol],
        }));

      if (normalized.length) return normalized;
    }
  }

  if (newsDataKey) {
    const query = assetType === "crypto" ? `${symbol} crypto` : `${symbol} stock`;
    const res = await fetch(`https://newsdata.io/api/1/news?apikey=${newsDataKey}&q=${encodeURIComponent(query)}&language=en&size=3`);
    if (res.ok) {
      const data = await res.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      return results.slice(0, 3).map((article: any) => ({
        id: article?.article_id || article?.link,
        headline: article?.title || "",
        summary: article?.description || article?.content || "",
        url: article?.link || null,
        source: article?.source_id || "NewsData",
        createdAt: article?.pubDate || null,
        symbols: [symbol],
      }));
    }
  }

  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    const { symbols = [], chartSymbol, chartType, chartRange, newsSymbol, newsType } = await req.json();
    const normalizedItems = Array.isArray(symbols)
      ? symbols.map(normalizeSymbolInput).filter((item) => item.symbol)
      : [];

    let quotes: Record<string, { price: number; change: number }> = {};
    if (normalizedItems.length) {
      try {
        quotes = await fetchSnapshots(normalizedItems);
        const missingOrStaleItems = normalizedItems.filter((item) => (
          !quotes[item.symbol]
          || (item.assetType === "crypto" && isStaleCryptoQuote(quotes[item.symbol]))
        ));

        if (missingOrStaleItems.length) {
          const fallbackQuotes = await fetchFallbackSnapshots(
            missingOrStaleItems
          );
          if (Object.keys(fallbackQuotes).length) {
            quotes = { ...quotes, ...fallbackQuotes };
          }
        }
      } catch (error) {
        console.error("alpaca quotes failed, using fallback:", error);
        quotes = await fetchFallbackSnapshots(normalizedItems);
      }
    }

    let chart = null;
    if (chartSymbol) {
      const normalizedChartSymbol = String(chartSymbol).toUpperCase();
      const normalizedChartType = String(chartType || "").toLowerCase() === "crypto" ? "crypto" : (CRYPTO_BASES.has(normalizedChartSymbol) ? "crypto" : "stock");
      chart = await fetchChart(normalizedChartSymbol, normalizedChartType, chartRange || "1D");
    }

    let news = [];
    if (newsSymbol) {
      const normalizedNewsSymbol = String(newsSymbol).toUpperCase();
      const normalizedNewsType = String(newsType || "").toLowerCase() === "crypto" ? "crypto" : (CRYPTO_BASES.has(normalizedNewsSymbol) ? "crypto" : "stock");
      news = await fetchSymbolNews(normalizedNewsSymbol, normalizedNewsType);
    }

    return new Response(JSON.stringify({ ok: true, quotes, chart, news }), {
      headers: FALLBACK_CORS_JSON_HEADERS,
      status: 200,
    });
  } catch (err) {
    console.error("market-data error:", err);
    return new Response(JSON.stringify({ ok: false, error: err?.message || "Unknown error" }), {
      headers: FALLBACK_CORS_JSON_HEADERS,
      status: 500,
    });
  }
});
