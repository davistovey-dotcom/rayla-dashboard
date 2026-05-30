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
const DEBUG_CHARTS = Deno.env.get("DEBUG_CHARTS") === "true";

function logChartDebug(label: string, payload: Record<string, unknown>) {
  if (!DEBUG_CHARTS) return;
  console.log(label, payload);
}

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

function getChartConfig(range = "1D", assetType = "stock") {
  const now = new Date();
  const end = now.toISOString();
  if (range === "MAX") return { stockTimeframe: "1Month", cryptoTimeframe: "1Month", start: "2000-01-01T00:00:00.000Z", end, limit: 10000 };
  if (range === "5Y") return { stockTimeframe: "1Week", cryptoTimeframe: "1Week", start: new Date(now.getTime() - 5*365*24*60*60*1000).toISOString(), end, limit: 10000 };
  if (range === "1Y") return { stockTimeframe: "1Day", cryptoTimeframe: "1Day", start: new Date(now.getTime() - 365*24*60*60*1000).toISOString(), end, limit: 10000 };
  if (range === "3M") return { stockTimeframe: "1Day", cryptoTimeframe: "1Day", start: new Date(now.getTime() - 90*24*60*60*1000).toISOString(), end, limit: 10000 };
  if (range === "1M") return { stockTimeframe: "1Day", cryptoTimeframe: "1Day", start: new Date(now.getTime() - 30*24*60*60*1000).toISOString(), end, limit: 500 };
  if (range === "1W") return { stockTimeframe: "1Hour", cryptoTimeframe: "1Hour", start: new Date(now.getTime() - 7*24*60*60*1000).toISOString(), end, limit: 500 };
  return { stockTimeframe: "15Min", cryptoTimeframe: "15Min", start: new Date(now.getTime() - 24*60*60*1000).toISOString(), end, limit: 500 };
}

async function fetchCryptoChangeFromBars(symbol: string, knownPrice: number | null): Promise<{ price: number; change: number; source: string } | null> {
  try {
    const pair = buildCryptoPair(symbol);
    const data = await alpacaMarketDataRequest(
      `/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(pair)}&timeframe=1Day&limit=2&sort=asc`
    );
    const bars: any[] = data?.bars?.[pair] || [];
    if (bars.length >= 2) {
      const prevClose = Number(bars[bars.length - 2]?.c ?? 0);
      const latestClose = Number(bars[bars.length - 1]?.c ?? 0);
      const price = knownPrice && knownPrice > 0 ? knownPrice : latestClose;
      if (price > 0 && prevClose > 0) {
        const change = ((price - prevClose) / prevClose) * 100;
        console.log(`[market-data] bars-fallback ${symbol}: price=${price} prevClose=${prevClose} change=${change.toFixed(2)} bars=${bars.length}`);
        return { price, change: Number(change.toFixed(2)), source: "alpaca-bars" };
      }
      console.log(`[market-data] bars-fallback ${symbol}: insufficient data prevClose=${prevClose} latestClose=${latestClose}`);
    } else {
      console.log(`[market-data] bars-fallback ${symbol}: only ${bars.length} bar(s) returned`);
    }
  } catch (e) {
    console.error(`[market-data] bars-fallback failed for ${symbol}:`, e);
  }
  return null;
}

async function fetchCryptoChangeFromFinnhub(symbol: string, knownPrice: number | null): Promise<{ price: number; change: number; source: string } | null> {
  const finnhubKey = Deno.env.get("FINNHUB_API_KEY");
  if (!finnhubKey) return null;
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=BINANCE:${symbol}USDT&token=${finnhubKey}`);
    if (!res.ok) {
      console.log(`[market-data] finnhub-fallback ${symbol}: HTTP ${res.status}`);
      return null;
    }
    const fData = await res.json();
    const price = knownPrice && knownPrice > 0 ? knownPrice : Number(fData?.c ?? 0);
    const prevClose = Number(fData?.pc ?? 0);
    console.log(`[market-data] finnhub-fallback ${symbol}: c=${fData?.c} pc=${fData?.pc} price=${price} prevClose=${prevClose}`);
    if (price > 0 && prevClose > 0) {
      const change = ((price - prevClose) / prevClose) * 100;
      return { price, change: Number(change.toFixed(2)), source: "finnhub" };
    }
  } catch (e) {
    console.error(`[market-data] finnhub-fallback failed for ${symbol}:`, e);
  }
  return null;
}

async function fetchSnapshots(items: any[]) {
  const { stockFeed } = getAlpacaMarketDataEnv();
  const quotes: Record<string, any> = {};
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
          bid: normalized.bid ?? null,
          ask: normalized.ask ?? null,
          lastTradePrice: normalized.lastTradePrice ?? normalized.price,
        };
      }
    });
  }

  if (cryptoSymbols.length) {
    // Step 1: Alpaca snapshot
    const cryptoPairs = cryptoSymbols.map(buildCryptoPair);
    const data = await alpacaMarketDataRequest(`/v1beta3/crypto/us/snapshots?symbols=${encodeURIComponent(cryptoPairs.join(","))}`);
    cryptoSymbols.forEach((symbol) => {
      const normalized = normalizeAlpacaSnapshot(symbol, data?.snapshots?.[buildCryptoPair(symbol)], "crypto");
      console.log(`[market-data] crypto snapshot ${symbol}: price=${normalized?.price} change=${normalized?.change}`);
      if (normalized) {
        quotes[symbol] = {
          price: normalized.price,
          change: normalized.change,
          updatedAt: normalized.updatedAt || null,
          bid: normalized.bid ?? null,
          ask: normalized.ask ?? null,
          lastTradePrice: normalized.lastTradePrice ?? normalized.price,
        };
      }
    });

    // Steps 2 & 3: fallback chain for any crypto symbol still missing a valid change
    const needsFallback = cryptoSymbols.filter((sym) => quotes[sym]?.change == null);
    if (needsFallback.length) {
      console.log(`[market-data] crypto change missing for: ${needsFallback.join(", ")} — trying bars fallback`);

      // Step 2: Alpaca daily bars (batch)
      const stillNeedsFallback: string[] = [];
      const fallbackPairs = needsFallback.map(buildCryptoPair);
      try {
        const barsData = await alpacaMarketDataRequest(
          `/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(fallbackPairs.join(","))}&timeframe=1Day&limit=2&sort=asc`
        );
        for (const symbol of needsFallback) {
          const bars: any[] = barsData?.bars?.[buildCryptoPair(symbol)] || [];
          if (bars.length >= 2) {
            const prevClose = Number(bars[bars.length - 2]?.c ?? 0);
            const latestClose = Number(bars[bars.length - 1]?.c ?? 0);
            const knownPrice = quotes[symbol]?.price;
            const price = knownPrice && knownPrice > 0 ? knownPrice : latestClose;
            if (price > 0 && prevClose > 0) {
              const change = ((price - prevClose) / prevClose) * 100;
              console.log(`[market-data] bars-fallback OK ${symbol}: price=${price} prevClose=${prevClose} change=${change.toFixed(2)}`);
              quotes[symbol] = { ...(quotes[symbol] || {}), price, change: Number(change.toFixed(2)) };
              continue;
            }
          }
          console.log(`[market-data] bars-fallback insufficient for ${symbol}, bars=${bars.length}`);
          stillNeedsFallback.push(symbol);
        }
      } catch (e) {
        console.error("[market-data] Alpaca bars batch fallback failed:", e);
        stillNeedsFallback.push(...needsFallback);
      }

      // Step 3: Finnhub per-symbol
      if (stillNeedsFallback.length) {
        console.log(`[market-data] trying finnhub fallback for: ${stillNeedsFallback.join(", ")}`);
        for (const symbol of stillNeedsFallback) {
          const result = await fetchCryptoChangeFromFinnhub(symbol, quotes[symbol]?.price ?? null);
          if (result) {
            quotes[symbol] = { ...(quotes[symbol] || {}), price: result.price, change: result.change };
            console.log(`[market-data] finnhub-fallback OK ${symbol}: change=${result.change}`);
          } else {
            console.error(`[market-data] all fallbacks exhausted for ${symbol} — change will be null`);
          }
        }
      }
    }
  }

  return quotes;
}

async function fetchFallbackSnapshots(items: any[]) {
  const polygonKey = Deno.env.get("POLYGON_API_KEY");
  const finnhubKey = Deno.env.get("FINNHUB_API_KEY");
  const quotes: Record<string, { price: number; change: number; updatedAt?: string | null; bid?: number | null; ask?: number | null; lastTradePrice?: number | null }> = {};
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
          bid: Number.isFinite(Number(ticker?.lastQuote?.p ?? ticker?.lastQuote?.bp)) ? Number(ticker?.lastQuote?.p ?? ticker?.lastQuote?.bp) : null,
          ask: Number.isFinite(Number(ticker?.lastQuote?.P ?? ticker?.lastQuote?.ap)) ? Number(ticker?.lastQuote?.P ?? ticker?.lastQuote?.ap) : null,
          lastTradePrice: Number.isFinite(Number(ticker?.lastTrade?.p)) ? Number(ticker?.lastTrade?.p) : price,
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
      if (prevClose <= 0) continue;
      const change = ((price - prevClose) / prevClose) * 100;
      quotes[symbol] = {
        price,
        change: Number(change.toFixed(2)),
        updatedAt: data?.t ? new Date(data.t * 1000).toISOString() : new Date().toISOString(),
        bid: null,
        ask: null,
        lastTradePrice: price,
      };
    }
  }

  return quotes;
}

async function fetchChart(symbol: string, assetType: string, range = "1D", timeframeOverride: string | null = null) {
  if (!symbol) return { symbol, range, bars: [] };

  const config = getChartConfig(range, assetType);
  const timeframe = timeframeOverride || (assetType === "crypto" ? config.cryptoTimeframe : config.stockTimeframe);
  const requestedSpanMs = new Date(config.end).getTime() - new Date(config.start).getTime();
  logChartDebug("market-data fetchChart request", {
    symbol,
    assetType,
    range,
    timeframe,
    start: config.start,
    end: config.end,
    limit: config.limit,
  });

  try {
    if (assetType === "crypto") {
      const pair = buildCryptoPair(symbol);
      const provider = "alpaca-crypto-bars";
      const requestPath = `/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(pair)}&timeframe=${encodeURIComponent(timeframe)}&start=${encodeURIComponent(config.start)}&end=${encodeURIComponent(config.end)}&limit=${config.limit}`;
      logChartDebug("market-data fetchChart provider request", {
        provider,
        symbol,
        assetType,
        range,
        requestPath,
        requestParams: {
          symbols: pair,
          timeframe,
          start: config.start,
          end: config.end,
          limit: config.limit,
        },
      });
      const data = await alpacaMarketDataRequest(requestPath);
      const rawBars = Array.isArray(data?.bars?.[pair]) ? data.bars[pair] : [];
      const bars = rawBars
        .map(normalizeAlpacaBar)
        .filter((bar: any) => Number.isFinite(bar.close) && bar.close > 0)
        .map(({ raw, ...bar }: any) => bar);
      const returnedSpanMs = bars.length >= 2
        ? new Date(bars[bars.length - 1].time).getTime() - new Date(bars[0].time).getTime()
        : 0;
      const coverage = {
        provider,
        requestPath,
        requestedStart: config.start,
        requestedEnd: config.end,
        firstBarTime: bars[0]?.time || null,
        lastBarTime: bars[bars.length - 1]?.time || null,
        rawFirstBarTime: rawBars[0]?.t || null,
        rawLastBarTime: rawBars[rawBars.length - 1]?.t || null,
        requestedSpanHours: Number((requestedSpanMs / (1000 * 60 * 60)).toFixed(2)),
        returnedSpanHours: Number((returnedSpanMs / (1000 * 60 * 60)).toFixed(2)),
        limited: returnedSpanMs < requestedSpanMs * 0.85,
        reason: returnedSpanMs < requestedSpanMs * 0.85
          ? "Provider returned less than the requested trailing window."
          : null,
      };

      if (!bars.length) {
        logChartDebug("market-data fetchChart crypto returned no Alpaca bars", { symbol, pair, range, timeframe });
      }

      logChartDebug("market-data fetchChart response", {
        symbol,
        assetType,
        range,
        start: config.start,
        end: config.end,
        provider,
        requestPath,
        firstBarTime: bars[0]?.time || null,
        lastBarTime: bars[bars.length - 1]?.time || null,
        rawFirstBarTime: rawBars[0]?.t || null,
        rawLastBarTime: rawBars[rawBars.length - 1]?.t || null,
        barCount: bars.length,
        diffHours: bars.length >= 2
          ? Number((((new Date(bars[bars.length - 1].time).getTime()) - (new Date(bars[0].time).getTime())) / (1000 * 60 * 60)).toFixed(2))
          : 0,
        diffDays: bars.length >= 2
          ? Number((((new Date(bars[bars.length - 1].time).getTime()) - (new Date(bars[0].time).getTime())) / (1000 * 60 * 60 * 24)).toFixed(2))
          : 0,
        coverageReason: coverage.reason,
      });

      logChartDebug("CHART DATA VERIFY", {
        symbol,
        range,
        assetType,
        requestedStart: config.start,
        requestedEnd: config.end,
        timeframe: assetType === "crypto" ? config.cryptoTimeframe : config.stockTimeframe,
        limit: config.limit,
        actualFirstBar: bars[0]?.time || null,
        actualLastBar: bars[bars.length - 1]?.time || null,
        rawFirstBar: rawBars[0]?.t || null,
        rawLastBar: rawBars[rawBars.length - 1]?.t || null,
        totalBarsReturned: bars.length,
      });
      return { symbol, range, bars, coverage, rangeMode: config.label || null };
    }

    const { stockFeed } = getAlpacaMarketDataEnv();
    const provider = "alpaca-stock-bars";
    const feedParam = range === "1D" ? `&feed=${encodeURIComponent(stockFeed)}` : "";
    const requestPath = `/v2/stocks/${encodeURIComponent(symbol)}/bars?timeframe=${encodeURIComponent(timeframe)}&start=${encodeURIComponent(config.start)}&end=${encodeURIComponent(config.end)}&limit=${config.limit}${feedParam}`;
    logChartDebug("market-data fetchChart provider request", {
      provider,
      symbol,
      assetType,
      range,
      requestPath,
      requestParams: {
        symbol,
        timeframe,
        start: config.start,
        end: config.end,
        limit: config.limit,
        feed: range === "1D" ? stockFeed : "(default)",
      },
    });
    const data = await alpacaMarketDataRequest(requestPath);
    const rawBars = Array.isArray(data?.bars) ? data.bars : [];
    const bars = rawBars
      .map(normalizeAlpacaBar)
      .filter((bar: any) => Number.isFinite(bar.close) && bar.close > 0)
      .map(({ raw, ...bar }: any) => bar);
    const returnedSpanMs = bars.length >= 2
      ? new Date(bars[bars.length - 1].time).getTime() - new Date(bars[0].time).getTime()
      : 0;
    const limitedCoverage = returnedSpanMs < requestedSpanMs * 0.85;
    const likelyMarketHoursOnly = range === "1D" && timeframe === "15Min" && limitedCoverage;
    const coverage = {
      provider,
      requestPath,
      requestedStart: config.start,
      requestedEnd: config.end,
      firstBarTime: bars[0]?.time || null,
      lastBarTime: bars[bars.length - 1]?.time || null,
      rawFirstBarTime: rawBars[0]?.t || null,
      rawLastBarTime: rawBars[rawBars.length - 1]?.t || null,
      requestedSpanHours: Number((requestedSpanMs / (1000 * 60 * 60)).toFixed(2)),
      returnedSpanHours: Number((returnedSpanMs / (1000 * 60 * 60)).toFixed(2)),
      limited: limitedCoverage,
      reason: likelyMarketHoursOnly
        ? "Alpaca stock intraday bars appear limited to market-session coverage for this request/feed, so the returned 1D span is shorter than the requested trailing 24 hours."
        : limitedCoverage
          ? "Provider returned less than the requested trailing window."
          : null,
    };

    if (!bars.length) {
      logChartDebug("market-data fetchChart stock returned no Alpaca bars", { symbol, range, timeframe, feed: stockFeed });
    }

    logChartDebug("market-data fetchChart response", {
      symbol,
      assetType,
      range,
      start: config.start,
      end: config.end,
      provider,
      requestPath,
      firstBarTime: bars[0]?.time || null,
      lastBarTime: bars[bars.length - 1]?.time || null,
      rawFirstBarTime: rawBars[0]?.t || null,
      rawLastBarTime: rawBars[rawBars.length - 1]?.t || null,
      barCount: bars.length,
      diffHours: bars.length >= 2
        ? Number((((new Date(bars[bars.length - 1].time).getTime()) - (new Date(bars[0].time).getTime())) / (1000 * 60 * 60)).toFixed(2))
        : 0,
      diffDays: bars.length >= 2
        ? Number((((new Date(bars[bars.length - 1].time).getTime()) - (new Date(bars[0].time).getTime())) / (1000 * 60 * 60 * 24)).toFixed(2))
        : 0,
      coverageReason: coverage.reason,
    });

    logChartDebug("CHART DATA VERIFY", {
      symbol,
      range,
      assetType,
      requestedStart: config.start,
      requestedEnd: config.end,
      timeframe: assetType === "crypto" ? config.cryptoTimeframe : config.stockTimeframe,
      limit: config.limit,
      actualFirstBar: bars[0]?.time || null,
      actualLastBar: bars[bars.length - 1]?.time || null,
      rawFirstBar: rawBars[0]?.t || null,
      rawLastBar: rawBars[rawBars.length - 1]?.t || null,
      totalBarsReturned: bars.length,
    });
    return { symbol, range, bars, coverage, rangeMode: config.label || null };
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
  console.error("ALPACA ENV CHECK", {
    hasKeyId: !!Deno.env.get("ALPACA_MARKET_DATA_KEY_ID"),
    hasSecretKey: !!Deno.env.get("ALPACA_MARKET_DATA_SECRET_KEY"),
    stockFeed: Deno.env.get("ALPACA_MARKET_DATA_STOCK_FEED"),
  });

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
    const { symbols = [], chartSymbol, chartType, chartRange, chartTimeframe, newsSymbol, newsType } = await req.json();
    const normalizedItems = Array.isArray(symbols)
      ? symbols.map(normalizeSymbolInput).filter((item) => item.symbol)
      : [];

    let quotes: Record<string, { price: number; change: number; updatedAt?: string | null; bid?: number | null; ask?: number | null; lastTradePrice?: number | null }> = {};
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
      chart = await fetchChart(normalizedChartSymbol, normalizedChartType, chartRange || "1D", chartTimeframe || null);
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
