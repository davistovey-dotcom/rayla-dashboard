import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import Login from "./Login";
import { supabase } from "./supabase";
import TradeChart from "./TradeChart";
import { LayoutDashboard, PlusSquare, Brain, User, ClipboardList, Target, Gamepad2 } from "lucide-react";
import { Tutorial } from "./Login";

const CRYPTO_SYMBOL_SET = new Set(["BTC","ETH","SOL","XRP","DOGE","BNB","ADA","AVAX","LINK","MATIC","DOT","UNI","ATOM","LTC","BCH","ALGO","NEAR","FTM","SAND","MANA","TRX","TRON"]);
const SUPPORTED_CRYPTO_SEARCH_ASSETS = [
  { symbol: "BTC", description: "Bitcoin", exchange: "CRYPTO", type: "crypto" },
  { symbol: "ETH", description: "Ethereum", exchange: "CRYPTO", type: "crypto" },
  { symbol: "SOL", description: "Solana", exchange: "CRYPTO", type: "crypto" },
  { symbol: "XRP", description: "XRP", exchange: "CRYPTO", type: "crypto" },
  { symbol: "DOGE", description: "Dogecoin", exchange: "CRYPTO", type: "crypto" },
  { symbol: "BNB", description: "BNB", exchange: "CRYPTO", type: "crypto" },
  { symbol: "ADA", description: "Cardano", exchange: "CRYPTO", type: "crypto" },
  { symbol: "AVAX", description: "Avalanche", exchange: "CRYPTO", type: "crypto" },
  { symbol: "LINK", description: "Chainlink", exchange: "CRYPTO", type: "crypto" },
  { symbol: "MATIC", description: "Polygon", exchange: "CRYPTO", type: "crypto" },
  { symbol: "DOT", description: "Polkadot", exchange: "CRYPTO", type: "crypto" },
  { symbol: "UNI", description: "Uniswap", exchange: "CRYPTO", type: "crypto" },
  { symbol: "ATOM", description: "Cosmos", exchange: "CRYPTO", type: "crypto" },
  { symbol: "LTC", description: "Litecoin", exchange: "CRYPTO", type: "crypto" },
  { symbol: "BCH", description: "Bitcoin Cash", exchange: "CRYPTO", type: "crypto" },
  { symbol: "ALGO", description: "Algorand", exchange: "CRYPTO", type: "crypto" },
  { symbol: "NEAR", description: "NEAR Protocol", exchange: "CRYPTO", type: "crypto" },
  { symbol: "FTM", description: "Fantom", exchange: "CRYPTO", type: "crypto" },
  { symbol: "SAND", description: "The Sandbox", exchange: "CRYPTO", type: "crypto" },
  { symbol: "MANA", description: "Decentraland", exchange: "CRYPTO", type: "crypto" },
  { symbol: "TRX", description: "TRON", exchange: "CRYPTO", type: "crypto" },
];

function normalizeCryptoAssetId(rawSymbol) {
  const raw = String(rawSymbol || "").trim().toUpperCase();
  if (!raw) return "";

  let normalized = raw.includes(":") ? raw.split(":").pop() : raw;
  normalized = normalized.replace(/[\/-]/g, "");

  if (normalized.endsWith("USDT")) normalized = normalized.slice(0, -4);
  else if (normalized.endsWith("USD")) normalized = normalized.slice(0, -3);

  if (normalized === "TRON") return "TRX";
  return normalized;
}

function normalizeAssetId(rawSymbol, type = "", tvSymbol = "") {
  const raw = String(rawSymbol || "").trim().toUpperCase();
  if (!raw) return "";

  const normalizedType = String(type || "").trim().toUpperCase();
  const upperTvSymbol = String(tvSymbol || "").trim().toUpperCase();
  const cryptoCandidate = normalizeCryptoAssetId(raw);
  const isCrypto = normalizedType === "CRYPTO"
    || upperTvSymbol.includes("BINANCE")
    || upperTvSymbol.includes("USDT")
    || raw.includes("USDT")
    || raw.includes("USD")
    || CRYPTO_SYMBOL_SET.has(raw)
    || CRYPTO_SYMBOL_SET.has(cryptoCandidate);

  if (isCrypto) return cryptoCandidate;
  if (raw === "TRON") return "TRX";
  return raw.includes(":") ? raw.split(":").pop() : raw;
}

function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeout));
}

function getTvSymbol(asset) {
  if (asset?.tvSymbol) return asset.tvSymbol;
  if (asset?.type === "crypto") return `BINANCE:${asset.id}USDT`;
  return asset?.id || "";
}

function getEquityTvSymbol(symbol, exchange = "", assetType = "") {
  const normalizedExchange = String(exchange || "").trim().toUpperCase();
  const normalizedType = String(assetType || "").trim().toUpperCase();
  if (normalizedExchange.includes("NYSE")) return `NYSE:${symbol}`;
  if (normalizedExchange.includes("NASDAQ")) return `NASDAQ:${symbol}`;
  if (
    normalizedExchange.includes("AMEX")
    || normalizedExchange.includes("ARCA")
    || normalizedExchange.includes("BATS")
    || normalizedExchange.includes("CBOE")
  ) {
    return `AMEX:${symbol}`;
  }
  if (normalizedType === "ETP" && !String(symbol).includes(".")) {
    return `AMEX:${symbol}`;
  }

  return symbol;
}

function normalizeSearchResult(result) {
  const symbol = normalizeAssetId(result?.symbol, result?.type, result?.tvSymbol);
  const description = String(result?.description || symbol).trim();
  const exchange = String(result?.exchange || result?.mic || "").trim().toUpperCase();
  const assetType = String(result?.type || "").trim().toUpperCase();
  const explicitOverrides = {
    SPY: "AMEX:SPY",
    QQQ: "NASDAQ:QQQ",
    DIA: "AMEX:DIA",
    IWM: "AMEX:IWM",
    BTC: "BINANCE:BTCUSDT",
    ETH: "BINANCE:ETHUSDT",
    SOL: "BINANCE:SOLUSDT",
    XRP: "BINANCE:XRPUSDT",
    DOGE: "BINANCE:DOGEUSDT",
    ADA: "BINANCE:ADAUSDT",
    AVAX: "BINANCE:AVAXUSDT",
    LINK: "BINANCE:LINKUSDT",
    NRG: "NYSE:NRG",
    KO: "NYSE:KO",
    DIS: "NYSE:DIS",
    BA: "NYSE:BA",
    JPM: "NYSE:JPM",
    XOM: "NYSE:XOM",
    WMT: "NYSE:WMT",
    NKE: "NYSE:NKE",
    MCD: "NYSE:MCD",
    GS: "NYSE:GS",
  };

  let tvSymbol = explicitOverrides[symbol];
  if (!tvSymbol) {
    const isCrypto = CRYPTO_SYMBOL_SET.has(symbol) || exchange.includes("CRYPTO");
    if (isCrypto) tvSymbol = `BINANCE:${symbol}USDT`;
    else tvSymbol = getEquityTvSymbol(symbol, exchange, assetType);
  }

  return {
    ...result,
    symbol,
    description,
    exchange,
    tvSymbol,
  };
}

function rankSupportedSearchResult(result, query) {
  const normalizedQuery = String(query || "").trim().toUpperCase();
  const symbol = String(result?.symbol || "").trim().toUpperCase();
  const description = String(result?.description || "").trim().toUpperCase();
  if (symbol === normalizedQuery) return 0;
  if (description === normalizedQuery) return 1;
  if (symbol.startsWith(normalizedQuery)) return 2;
  if (description.startsWith(normalizedQuery)) return 3;
  if (symbol.includes(normalizedQuery)) return 4;
  if (description.includes(normalizedQuery)) return 5;
  return 6;
}

const supportedSearchCache = new Map();

async function searchRaylaSupportedAssets(query, alpacaConnected) {
  const normalizedQuery = String(query || "").trim().toUpperCase();
  if (!normalizedQuery) return [];

  const cacheKey = `${alpacaConnected ? "alpaca" : "local"}:${normalizedQuery}`;
  if (supportedSearchCache.has(cacheKey)) {
    return supportedSearchCache.get(cacheKey);
  }

  const cryptoResults = SUPPORTED_CRYPTO_SEARCH_ASSETS
    .filter((asset) => (
      asset.symbol.includes(normalizedQuery)
      || asset.description.toUpperCase().includes(normalizedQuery)
    ))
    .map(normalizeSearchResult);

  let stockResults = [];
  if (alpacaConnected) {
    try {
      const { data, error } = await supabase.functions.invoke("alpaca-assets", {
        body: { query: normalizedQuery },
      });

      if (!error && data?.ok && Array.isArray(data.assets)) {
        stockResults = data.assets.map((asset) => normalizeSearchResult({
          symbol: asset.symbol,
          description: asset.name,
          exchange: asset.exchange,
          type: "stock",
        }));
      }
    } catch {
      stockResults = [];
    }
  }

  const merged = [...stockResults, ...cryptoResults];
  const seen = new Set();
  const results = merged
    .filter((result) => {
      const key = `${result.symbol}:${result.type || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const rankDelta = rankSupportedSearchResult(a, normalizedQuery) - rankSupportedSearchResult(b, normalizedQuery);
      if (rankDelta !== 0) return rankDelta;
      const symbolLengthDelta = Math.abs(String(a.symbol || "").length - normalizedQuery.length) - Math.abs(String(b.symbol || "").length - normalizedQuery.length);
      if (symbolLengthDelta !== 0) return symbolLengthDelta;
      return String(a.symbol || "").localeCompare(String(b.symbol || ""));
    })
    .slice(0, 6);

  supportedSearchCache.set(cacheKey, results);
  return results;
}

const SUPABASE_FUNCTIONS_BASE_URL = "https://uoxzzhtnzmsolvcykynu.functions.supabase.co";
const DAILY_INTEL_URL = `${SUPABASE_FUNCTIONS_BASE_URL}/daily-intel`;
const ASK_RAYLA_URL = `${SUPABASE_FUNCTIONS_BASE_URL}/ask-rayla`;
const SIMULATION_STARTING_BALANCE = 10000;
const SIMULATION_STORAGE_KEYS = {
  tradeHistory: "rayla_sim_trade_history",
  closedTrade: "rayla_sim_closed_trade",
  openPosition: "rayla_sim_open_position",
  balance: "rayla_sim_balance",
  guidedDraft: "rayla_sim_guided_draft",
};
const FIRST_TRADE_ONBOARDING_STORAGE_KEYS = {
  completed: "rayla_first_trade_onboarding_completed",
  autoStarted: "rayla_first_trade_onboarding_autostarted",
};

const marketSeeds = [
  { id: "BTC", type: "crypto", label: "Bitcoin", tvSymbol: "BINANCE:BTCUSDT", fallbackPrice: "64,210", fallbackChange: "+1.2%" },
  { id: "ETH", type: "crypto", label: "Ethereum", tvSymbol: "BINANCE:ETHUSDT", fallbackPrice: "3,120", fallbackChange: "+0.9%" },
  { id: "SPY", type: "stock", label: "SPDR S&P 500 ETF", tvSymbol: "AMEX:SPY", fallbackPrice: "521.14", fallbackChange: "-0.4%" },
  { id: "NVDA", type: "stock", label: "NVIDIA", tvSymbol: "NASDAQ:NVDA", fallbackPrice: "908.55", fallbackChange: "+3.2%" },
  { id: "AAPL", type: "stock", label: "Apple", tvSymbol: "NASDAQ:AAPL", fallbackPrice: "212.44", fallbackChange: "-0.4%" },
];

const SETUP_OPTIONS = ["rejection","breakout","pullback","reversal","range"];
const SESSION_OPTIONS = ["Asia","London","New York","After Hours"];
const SIMULATION_TUTORIAL_SECTIONS = [
  {
    key: "controls",
    title: "Trade Controls",
    description: "Search an asset, choose direction, set amount mode and size, then build your stop and target plan before starting the rep.",
  },
  {
    key: "risk",
    title: "Risk Inputs",
    description: "Stop loss or max loss protects the downside. Take profit or profit target defines where you want the simulator to pay you.",
  },
  {
    key: "account",
    title: "Simulator Stats",
    description: "This area shows mode-specific P/L and coaching stats. Live uses live-simulator trades, while Scenario stats focus on Realistic-mode scenario trades.",
  },
  {
    key: "chart",
    title: "Chart View",
    description: "The chart shows the active market or scenario path. In Scenario mode, the line projects forward from the fixed Now anchor as the rep unfolds.",
  },
  {
    key: "open-position",
    title: "Open Position Panel",
    description: "This panel tracks the live or scenario rep with current price, unrealized P/L, R multiple, and the risk plan you entered before opening.",
  },
  {
    key: "summary",
    title: "Trade Summary",
    description: "After a trade closes, Rayla summarizes the outcome, grade, coaching takeaway, and the next thing to focus on in your simulator practice.",
  },
  {
    key: "history",
    title: "Trade History",
    description: "Your recent simulator trades stay here so you can review execution, compare environments, and see how your decisions are evolving over time.",
  },
];
const NAV_TABS = [
  { id: "home", icon: <LayoutDashboard size={18} />, label: "Home" },
  { id: "trades", icon: <PlusSquare size={18} />, label: "My Trades" },
  { id: "simulation", icon: <Gamepad2 size={18} />, label: "Simulation" },
  { id: "ask", icon: <Brain size={18} />, label: "Ask Rayla" },
  { id: "ai", icon: <Target size={18} />, label: "Analysis" },
  { id: "intel", icon: <ClipboardList size={18} />, label: "Intel" },
];

function parseTradeResult(value) {
  const parsed = Number.parseFloat(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseBrokerFillPrice(trade) {
  const rawPayload = trade?.raw_payload || {};
  const candidates = [
    rawPayload?.filled_avg_price,
    rawPayload?.avg_fill_price,
    rawPayload?.filledAvgPrice,
  ];
  const parsed = Number.parseFloat(candidates.find((value) => value != null) ?? NaN);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getBrokerOrderStatusPresentation(rawStatus) {
  const status = String(rawStatus || "").trim().toLowerCase();

  if (status === "filled") {
    return { label: "Order filled", color: "#4ade80", background: "rgba(74,222,128,0.12)", border: "rgba(74,222,128,0.24)" };
  }
  if (status === "partially_filled") {
    return { label: "Partially filled", color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.24)" };
  }
  if (status === "accepted" || status === "new" || status === "pending_new") {
    return { label: "Order accepted — may fill when market opens", color: "#fb923c", background: "rgba(251,146,60,0.12)", border: "rgba(251,146,60,0.24)" };
  }
  if (status === "canceled") {
    return { label: "Order canceled", color: "#f87171", background: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.24)" };
  }
  if (status === "rejected") {
    return { label: "Order rejected", color: "#f87171", background: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.24)" };
  }
  if (status === "expired") {
    return { label: "Order expired", color: "#94a3b8", background: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.24)" };
  }

  return { label: rawStatus || "Status unavailable", color: "#cbd5e1", background: "rgba(203,213,225,0.08)", border: "rgba(203,213,225,0.16)" };
}

function buildOrderRealityCheck({ symbol, side, qty, estimatedValue, buyingPower, position }) {
  const insights = [];
  const currentQty = Math.abs(Number(position?.qty ?? 0));

  if (!position || currentQty <= 0) {
    if (side === "buy") {
      insights.push(`This is your first position in ${symbol}.`);
    }
  } else if (side === "buy") {
    insights.push(`You are adding to your ${symbol} position.`);
  } else if (qty >= currentQty) {
    insights.push(`This will close your ${symbol} position.`);
  } else {
    insights.push(`This reduces your ${symbol} exposure.`);
  }

  if (Number.isFinite(estimatedValue) && Number.isFinite(buyingPower) && buyingPower > 0) {
    const buyingPowerUsage = estimatedValue / buyingPower;
    if (buyingPowerUsage >= 0.3) {
      insights.push(`This trade uses ~${Math.round(buyingPowerUsage * 100)}% of your available buying power.`);
    }
  }

  return insights.slice(0, 2);
}

function getSimulationCoachMessage(position, currentPrice, metrics) {
  if (!position) return "Waiting for your next setup.";
  if (!Number.isFinite(currentPrice)) return "You are currently in a trade. Stay disciplined.";

  if (position.exitMode === "pnl") {
    if (position.stopLoss != null && Number.isFinite(metrics?.profitLoss) && metrics.profitLoss < 0) {
      const stopProgress = Math.abs(metrics.profitLoss) / Math.max(position.stopLoss, 0.0001);
      if (stopProgress >= 0.85) {
        return "Price is approaching your stop. Stay disciplined.";
      }
    }
    if (position.takeProfit != null && Number.isFinite(metrics?.profitLoss) && metrics.profitLoss > 0) {
      const targetProgress = metrics.profitLoss / Math.max(position.takeProfit, 0.0001);
      if (targetProgress >= 0.85) {
        return "Price is approaching your target.";
      }
    }
  } else {
    if (position.stopLoss != null) {
      const stopDistance = Math.abs(position.entryPrice - position.stopLoss);
      const remainingToStop = Math.abs(currentPrice - position.stopLoss);
      if (stopDistance > 0 && remainingToStop / stopDistance <= 0.15) {
        return "Price is approaching your stop. Stay disciplined.";
      }
    }
    if (position.takeProfit != null) {
      const targetDistance = Math.abs(position.takeProfit - position.entryPrice);
      const remainingToTarget = Math.abs(position.takeProfit - currentPrice);
      if (targetDistance > 0 && remainingToTarget / targetDistance <= 0.15) {
        return "Price is approaching your target.";
      }
    }
  }

  if (Number.isFinite(metrics?.profitLoss) && metrics.profitLoss > 0) {
    return "You are in profit. Let your plan play out.";
  }

  return "You are currently in a trade. Stay disciplined.";
}

function getLiveQuoteByAssetId(quotes, assetId, type = "", tvSymbol = "") {
  const normalizedId = normalizeAssetId(assetId, type, tvSymbol);
  return quotes[assetId] || quotes[normalizedId] || null;
}

function formatQuoteUpdatedAt(updatedAt) {
  if (!updatedAt) return "--";
  const timestamp = Date.parse(String(updatedAt));
  if (!Number.isFinite(timestamp)) return "--";
  return new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function getKnownStockQuotePrice(symbol, quotes, watchlistItems, cachedQuotes) {
  const upperSymbol = String(symbol || "").trim().toUpperCase();
  if (!upperSymbol) return null;

  const liveQuotePrice = quotes[upperSymbol]?.price;
  if (Number.isFinite(liveQuotePrice)) return liveQuotePrice;

  const cachedPrice = cachedQuotes[upperSymbol]?.price;
  if (Number.isFinite(cachedPrice)) return cachedPrice;

  const watchlistPrice = watchlistItems.find((item) => item.id === upperSymbol)?.priceValue;
  return Number.isFinite(watchlistPrice) ? watchlistPrice : null;
}

function getKnownStockQuoteData(symbol, quotes, watchlistItems, cachedQuotes) {
  const upperSymbol = String(symbol || "").trim().toUpperCase();
  if (!upperSymbol) return null;

  if (quotes[upperSymbol]?.price != null) return quotes[upperSymbol];
  if (cachedQuotes[upperSymbol]?.price != null) return cachedQuotes[upperSymbol];

  const watchlistItem = watchlistItems.find((item) => item.id === upperSymbol);
  if (watchlistItem && (Number.isFinite(watchlistItem.priceValue) || Number.isFinite(watchlistItem.changeValue))) {
    return {
      price: Number.isFinite(watchlistItem.priceValue) ? watchlistItem.priceValue : null,
      change: Number.isFinite(watchlistItem.changeValue) ? watchlistItem.changeValue : null,
    };
  }

  return null;
}

function extractChartCloseSeries(chart) {
  const barCandidates = Array.isArray(chart?.bars)
    ? chart.bars
    : Array.isArray(chart?.candles)
      ? chart.candles
      : Array.isArray(chart)
        ? chart
        : [];

  return barCandidates
    .map((bar) => Number(bar?.close ?? bar?.c ?? bar))
    .filter((value) => Number.isFinite(value) && value > 0)
    .slice(-48);
}

function extractChartBars(chart) {
  const barCandidates = Array.isArray(chart?.bars)
    ? chart.bars
    : Array.isArray(chart?.candles)
      ? chart.candles
      : [];
  return barCandidates
    .filter((bar) => bar && Number.isFinite(Number(bar.close)) && Number(bar.close) > 0)
    .slice(-48);
}

function buildFallbackMiniChartSeries(quote, position) {
  const currentPrice = Number(quote?.price ?? position?.currentPrice ?? 0);
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return Array.from({ length: 24 }, () => 1);
  }

  const changePct = Number(quote?.change);
  if (!Number.isFinite(changePct)) {
    return Array.from({ length: 24 }, () => currentPrice);
  }

  const baselinePrice = currentPrice / (1 + (changePct / 100));
  if (!Number.isFinite(baselinePrice) || baselinePrice <= 0) {
    return Array.from({ length: 24 }, () => currentPrice);
  }

  return Array.from({ length: 36 }, (_, index) => {
    const ratio = index / 35;
    const drift = baselinePrice + ((currentPrice - baselinePrice) * ratio);
    const wiggle = Math.sin(ratio * Math.PI * 2.5) * currentPrice * 0.0012 * (1 - (ratio * 0.35));
    return Math.max(0.0001, drift + wiggle);
  });
}

function roundMetric(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function readSimulationStorage(key, fallback, validate) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return validate && !validate(parsed) ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function writeSimulationStorage(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage write failures so simulation never crashes.
  }
}

function averageNumber(values) {
  const safeValues = values.filter((value) => Number.isFinite(value));
  if (!safeValues.length) return 0;
  return safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length;
}

function buildTradeStats(trades) {
  const safeTrades = Array.isArray(trades) ? trades : [];
  const results = safeTrades.map((trade) => ({
    ...trade,
    resultValue: parseTradeResult(trade?.result_r),
    assetName: String(trade?.asset || "Unknown").toUpperCase(),
    setupName: String(trade?.setup || "").trim(),
  }));

  const wins = results.filter((trade) => trade.resultValue > 0);
  const losses = results.filter((trade) => trade.resultValue < 0);
  const totalTrades = results.length;
  const totalR = results.reduce((sum, trade) => sum + trade.resultValue, 0);
  const winRate = totalTrades ? (wins.length / totalTrades) * 100 : 0;
  const avgR = totalTrades ? totalR / totalTrades : 0;
  const averageWin = wins.length
    ? wins.reduce((sum, trade) => sum + trade.resultValue, 0) / wins.length
    : 0;
  const averageLoss = losses.length
    ? losses.reduce((sum, trade) => sum + trade.resultValue, 0) / losses.length
    : 0;
  const maxLoss = losses.length
    ? Math.min(...losses.map((trade) => trade.resultValue))
    : 0;
  const largestWin = wins.length
    ? Math.max(...wins.map((trade) => trade.resultValue))
    : 0;

  const summarizeGroup = (key) => {
    const groups = {};

    results.forEach((trade) => {
      const rawName = key === "setupName" ? trade.setupName : trade.assetName;
      if (!rawName) return;
      if (!groups[rawName]) {
        groups[rawName] = { name: rawName, trades: 0, wins: 0, totalR: 0 };
      }
      groups[rawName].trades += 1;
      groups[rawName].totalR += trade.resultValue;
      if (trade.resultValue > 0) groups[rawName].wins += 1;
    });

    return Object.values(groups)
      .map((group) => ({
        name: group.name,
        trades: group.trades,
        winRate: group.trades ? roundMetric((group.wins / group.trades) * 100, 1) : 0,
        avgR: group.trades ? roundMetric(group.totalR / group.trades) : 0,
        totalR: roundMetric(group.totalR),
      }))
      .sort((a, b) => {
        if (b.avgR !== a.avgR) return b.avgR - a.avgR;
        if (b.totalR !== a.totalR) return b.totalR - a.totalR;
        return b.trades - a.trades;
      });
  };

  const setupStats = summarizeGroup("setupName");
  const assetStats = summarizeGroup("assetName");

  let recentLossStreak = 0;
  for (const trade of results) {
    if (trade.resultValue < 0) recentLossStreak += 1;
    else break;
  }

  return {
    totalTrades,
    winRate: roundMetric(winRate, 1),
    avgR: roundMetric(avgR),
    totalR: roundMetric(totalR),
    averageWin: roundMetric(averageWin),
    averageLoss: roundMetric(averageLoss),
    maxLoss: roundMetric(maxLoss),
    largestWin: roundMetric(largestWin),
    bestSetup: setupStats[0] || null,
    worstSetup: setupStats[setupStats.length - 1] || null,
    bestAsset: assetStats[0] || null,
    worstAsset: assetStats[assetStats.length - 1] || null,
    recentLossStreak,
  };
}

function buildAskRaylaContext({ trades, userLevel, selectedMarketId }) {
  return {
    userLevel,
    selectedMarketId,
    stats: buildTradeStats(trades),
    recentTrades: (Array.isArray(trades) ? trades : []).slice(0, 10).map((trade) => ({
      asset: trade?.asset || "",
      setup: trade?.setup || "",
      session: trade?.session || "",
      resultR: roundMetric(parseTradeResult(trade?.result_r)),
      direction: trade?.direction || "",
      createdAt: trade?.created_at || trade?.entry_time || null,
    })),
  };
}

function buildCoachReport(trades) {
  if (!trades || trades.length === 0) return null;

  const wins = trades.filter(t => parseFloat(t.result_r) > 0);
  const losses = trades.filter(t => parseFloat(t.result_r) < 0);
  const winRate = trades.length ? (wins.length / trades.length) * 100 : 0;
  const avgR = trades.length ? trades.reduce((s, t) => s + parseFloat(t.result_r || 0), 0) / trades.length : 0;
  const avgWin = wins.length ? wins.reduce((s, t) => s + parseFloat(t.result_r || 0), 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + parseFloat(t.result_r || 0), 0) / losses.length) : 0;
  const totalR = trades.reduce((s, t) => s + parseFloat(t.result_r || 0), 0);
  const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : null;

  const setupMap = {};
  trades.forEach(t => {
    if (!t.setup) return;
    if (!setupMap[t.setup]) setupMap[t.setup] = { trades: 0, wins: 0, totalR: 0 };
    setupMap[t.setup].trades++;
    setupMap[t.setup].totalR += parseFloat(t.result_r || 0);
    if (parseFloat(t.result_r) > 0) setupMap[t.setup].wins++;
  });
  const setupStats = Object.entries(setupMap)
    .map(([setup, s]) => ({ setup, trades: s.trades, winRate: (s.wins / s.trades) * 100, avgR: s.totalR / s.trades, totalR: s.totalR }))
    .sort((a, b) => b.avgR - a.avgR);

  const assetMap = {};
  trades.forEach(t => {
    const asset = (t.asset || "Unknown").toUpperCase();
    if (!assetMap[asset]) assetMap[asset] = { trades: 0, wins: 0, totalR: 0 };
    assetMap[asset].trades++;
    assetMap[asset].totalR += parseFloat(t.result_r || 0);
    if (parseFloat(t.result_r) > 0) assetMap[asset].wins++;
  });
  const assetStats = Object.entries(assetMap)
    .map(([asset, s]) => ({ asset, trades: s.trades, winRate: (s.wins / s.trades) * 100, avgR: s.totalR / s.trades, totalR: s.totalR }))
    .sort((a, b) => b.avgR - a.avgR);

  const comboMap = {};
  trades.forEach(t => {
    if (!t.setup?.trim()) return;
    const key = `${(t.asset||"").toUpperCase()}_${t.setup.trim()}`;
    if (!comboMap[key]) comboMap[key] = { asset: (t.asset||"").toUpperCase(), setup: t.setup.trim(), trades: 0, wins: 0, totalR: 0 };
    comboMap[key].trades++;
    comboMap[key].totalR += parseFloat(t.result_r || 0);
    if (parseFloat(t.result_r) > 0) comboMap[key].wins++;
  });
  const comboStats = Object.values(comboMap)
    .map(c => ({ ...c, winRate: (c.wins / c.trades) * 100, avgR: c.totalR / c.trades }))
    .filter(c => c.trades >= 2)
    .sort((a, b) => b.avgR - a.avgR);

  const warnings = [];
  if (winRate < 40) warnings.push("Win rate is below 40% — entries need refinement.");
  if (avgLoss > avgWin && wins.length > 0 && losses.length > 0) warnings.push("Avg loss is larger than avg win — cutting winners too early or letting losers run.");
  if (profitFactor !== null && profitFactor < 1) warnings.push("Profit factor is below 1.0 — system is net negative. Review setups immediately.");
  if (trades.length >= 5 && winRate < 50) warnings.push("Win rate under 50% with 5+ trades — possible overtrading or setup quality issues.");
  if (assetStats.length > 4) warnings.push(`You are trading ${assetStats.length} different assets. Consider narrowing focus.`);
  const recentLosses = trades.slice(0, 4).filter(t => parseFloat(t.result_r) < 0).length;
  if (recentLosses >= 3) warnings.push("3 or more losses in your last 4 trades — consider taking a break.");

  const actions = [];
  const bestCombo = comboStats[0];
  const worstSetup = setupStats[setupStats.length - 1];
  if (bestCombo) actions.push(`Focus on ${bestCombo.setup} setups on ${bestCombo.asset} — your strongest edge (${bestCombo.avgR.toFixed(2)}R avg).`);
  if (worstSetup && setupStats.length > 1 && worstSetup.avgR < 0) actions.push(`Reduce or stop trading ${worstSetup.setup} setups — negative avg R (${worstSetup.avgR.toFixed(2)}R).`);
  if (avgLoss > avgWin) actions.push("Define your stop before entry on every trade and respect it without exception.");
  if (winRate < 50) actions.push("Be more selective — only take your clearest A+ setups.");
  if (actions.length === 0) actions.push("Keep executing consistently. Log every trade and review weekly.");

  return { winRate, avgR, avgWin, avgLoss, totalR, profitFactor, trades: trades.length, wins: wins.length, losses: losses.length, setupStats, assetStats, comboStats, warnings, actions, bestCombo, worstCombo: comboStats[comboStats.length - 1] };
}

function CoachSection({ label, children, accent }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        {accent && <div style={{ width: 8, height: 8, borderRadius: "50%", background: accent }} />}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7f8ea3" }}>{label}</div>
      </div>
      {children}
    </div>
  );
}

function CoachRow({ left, right, sub, tone }) {
  const color = tone === "positive" ? "#4ade80" : tone === "negative" ? "#f87171" : "#e2e8f0";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{left}</div>
        {sub && <div style={{ fontSize: 12, color: "#7f8ea3", marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color, textAlign: "right" }}>{right}</div>
    </div>
  );
}

function AICoachTab({ trades, onRunAnalysis, showNoNewTrades, coachSummary }) {
  const report = useMemo(() => buildCoachReport(trades), [trades]);

  if (!report) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 16, color: "#7f8ea3", marginBottom: 8 }}>No trades yet</div>
        <div style={{ fontSize: 13, color: "#7f8ea3" }}>Log your first trade to unlock AI Coach insights.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ borderColor: "rgba(124,196,255,0.2)" }}>
        <div className="cardHeader"><h2>Coach Insights</h2></div>
        <div className="cardBody">
          <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
            {`Win Rate: ${report.winRate.toFixed(1)}% · Avg R: ${report.avgR >= 0 ? "+" : ""}${report.avgR.toFixed(2)}R · Trades: ${report.trades}`}
          </div>
          {report.bestCombo && (
            <div style={{ marginTop: 10, fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
              {`Your strongest edge is ${report.bestCombo.setup} on ${report.bestCombo.asset} — ${report.bestCombo.avgR.toFixed(2)}R avg · ${report.bestCombo.winRate.toFixed(0)}% win rate across ${report.bestCombo.trades} trades.${report.bestCombo.trades < 3 ? " (early edge forming — low sample size)" : ""}`}
            </div>
          )}
          {report.warnings.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 14, color: "#fbbf24", lineHeight: 1.7 }}>{report.warnings[0]}</div>
          )}
          {report.actions.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 14, color: "#7CC4FF", lineHeight: 1.7 }}>{`Next step: ${report.actions[0]}`}</div>
          )}
          <button className="ghostButton" type="button" onClick={onRunAnalysis} style={{ marginTop: 12 }}>
            Refresh Analysis
          </button>
          {showNoNewTrades && (
            <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 13, color: "#7f8ea3" }}>
              No new trades since last analysis
            </div>
          )}
          {coachSummary && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 10, color: "#7f8ea3", letterSpacing: "1px", textTransform: "uppercase" }}>Last run · {coachSummary.generatedAt}</div>
              {coachSummary.strongestEdge && (
                <div style={{ background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#4ade80" }}>
                  <strong>Strongest Edge:</strong> {coachSummary.strongestEdge}
                </div>
              )}
              {coachSummary.weakestPattern && (
                <div style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#f87171" }}>
                  <strong>Weakest Pattern:</strong> {coachSummary.weakestPattern}
                </div>
              )}
              {coachSummary.warning && (
                <div style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#fbbf24" }}>
                  ⚠ {coachSummary.warning}
                </div>
              )}
              {coachSummary.nextAction && (
                <div style={{ background: "rgba(124,196,255,0.07)", border: "1px solid rgba(124,196,255,0.15)", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#7CC4FF" }}>
                  <strong>Next:</strong> {coachSummary.nextAction}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="cardHeader"><h2>Overall Performance</h2></div>
        <div className="cardBody">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 12 }}>
            {[
              { label: "Trades", value: report.trades },
              { label: "Win Rate", value: `${report.winRate.toFixed(1)}%`, tone: report.winRate >= 50 ? "positive" : "negative" },
              { label: "Avg R", value: `${report.avgR >= 0 ? "+" : ""}${report.avgR.toFixed(2)}R`, tone: report.avgR >= 0 ? "positive" : "negative" },
              { label: "Total R", value: `${report.totalR >= 0 ? "+" : ""}${report.totalR.toFixed(2)}R`, tone: report.totalR >= 0 ? "positive" : "negative" },
              { label: "Avg Win", value: `+${report.avgWin.toFixed(2)}R`, tone: "positive" },
              { label: "Avg Loss", value: `-${report.avgLoss.toFixed(2)}R`, tone: "negative" },
              ...(report.profitFactor !== null ? [{ label: "Profit Factor", value: report.profitFactor.toFixed(2), tone: report.profitFactor >= 1 ? "positive" : "negative" }] : []),
            ].map(item => (
              <div key={item.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: "#7f8ea3", marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: item.tone === "positive" ? "#4ade80" : item.tone === "negative" ? "#f87171" : "#e2e8f0" }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardHeader"><h2>Edge Analysis</h2></div>
        <div className="cardBody">
          {report.comboStats.length === 0 ? (
            <div style={{ fontSize: 13, color: "#7f8ea3" }}>Need at least 2 trades in the same setup to identify an edge.</div>
          ) : (
            <>
              <CoachSection label="Strongest Edge" accent="#4ade80">
                {report.comboStats.slice(0, 3).map((c, i) => (
                  <CoachRow key={i} left={`${c.asset} · ${c.setup}`} sub={`${c.trades} trades · ${c.winRate.toFixed(0)}% win rate`} right={`${c.avgR >= 0 ? "+" : ""}${c.avgR.toFixed(2)}R avg`} tone="positive" />
                ))}
              </CoachSection>
              {report.comboStats.length > 1 && (
                <CoachSection label="Weakest Edge" accent="#f87171">
                  {report.comboStats.slice(-Math.min(2, report.comboStats.length)).reverse().map((c, i) => (
                    <CoachRow key={i} left={`${c.asset} · ${c.setup}`} sub={`${c.trades} trades · ${c.winRate.toFixed(0)}% win rate`} right={`${c.avgR >= 0 ? "+" : ""}${c.avgR.toFixed(2)}R avg`} tone={c.avgR < 0 ? "negative" : "neutral"} />
                  ))}
                </CoachSection>
              )}
            </>
          )}
        </div>
      </div>

      {report.setupStats.length > 0 && (
        <div className="card">
          <div className="cardHeader"><h2>Setup Insights</h2></div>
          <div className="cardBody">
            {report.setupStats.map((s, i) => (
              <CoachRow key={i} left={s.setup} sub={`${s.trades} trades · ${s.winRate.toFixed(0)}% win rate`} right={`${s.avgR >= 0 ? "+" : ""}${s.avgR.toFixed(2)}R avg`} tone={s.avgR > 0 ? "positive" : s.avgR < 0 ? "negative" : "neutral"} />
            ))}
          </div>
        </div>
      )}

      {report.assetStats.length > 0 && (
        <div className="card">
          <div className="cardHeader"><h2>Asset Insights</h2></div>
          <div className="cardBody">
            {report.assetStats.map((a, i) => (
              <CoachRow key={i} left={a.asset} sub={`${a.trades} trades · ${a.winRate.toFixed(0)}% win rate`} right={`${a.avgR >= 0 ? "+" : ""}${a.avgR.toFixed(2)}R avg`} tone={a.avgR > 0 ? "positive" : a.avgR < 0 ? "negative" : "neutral"} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, children, className = "" }) {
  return (
    <section className={`card ${className}`}>
      <div className="cardHeader"><h2>{title}</h2></div>
      <div className="cardBody">{children}</div>
    </section>
  );
}

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function formatCompactPrice(value) {
  if (value == null || Number.isNaN(value)) return "--";
  return formatNumber(value, 2);
}

function formatCurrency(value) {
  if (!Number.isFinite(Number(value))) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatPctChange(value) {
  if (value == null || Number.isNaN(value)) return "--";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function getSvgZoomFactor(data, zoomLevel = "normal") {
  const baseFactor =
    data.length <= 30 ? 0.22 :
    data.length <= 60 ? 0.28 :
    data.length <= 120 ? 0.36 :
    0.44;

  if (zoomLevel === "wide") return baseFactor * 1.45;
  if (zoomLevel === "close") return baseFactor * 0.75;
  return baseFactor;
}

function buildSvgLinePoints(
  data,
  zoomLevel = "normal",
  slotCount = data.length,
  xStart = 14,
  xEnd = 100,
  xRatios = null
) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const zoomFactor = getSvgZoomFactor(data, zoomLevel);

  const paddedMax = max + range * zoomFactor;
  const paddedMin = min - range * zoomFactor;
  const xDivisor = Math.max(1, (slotCount || data.length) - 1);
  const xSpan = xEnd - xStart;

  return data.map((value, index) => {
    const xRatio = Array.isArray(xRatios) && xRatios[index] != null
      ? xRatios[index]
      : index / xDivisor;
    const x = xStart + xRatio * xSpan;
    const y = 88 - ((value - paddedMin) / (paddedMax - paddedMin || 1)) * 68;
    return `${x},${y}`;
  }).join(" ");
}

function buildSvgPointCoords(
  data,
  index,
  zoomLevel = "normal",
  slotCount = data.length,
  xStart = 14,
  xEnd = 100,
  xRatios = null
) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const zoomFactor = getSvgZoomFactor(data, zoomLevel);
  const paddedMax = max + range * zoomFactor;
  const paddedMin = min - range * zoomFactor;
  const safeIndex = Math.max(0, Math.min(index, data.length - 1));
  const value = data[safeIndex];
  const xDivisor = Math.max(1, (slotCount || data.length) - 1);
  const xSpan = xEnd - xStart;
  const xRatio = Array.isArray(xRatios) && xRatios[safeIndex] != null
    ? xRatios[safeIndex]
    : safeIndex / xDivisor;

  return {
    x: xStart + xRatio * xSpan,
    y: 88 - ((value - paddedMin) / (paddedMax - paddedMin || 1)) * 68,
  };
}

function getScenarioAnchorY(scenarioType) {
  if (scenarioType === "uptrend") return 74;
  if (scenarioType === "downtrend") return 26;
  return 50;
}

function clampScenarioChartY(value) {
  return Math.max(10, Math.min(90, value));
}

function buildSvgValueY(data, value, zoomLevel = "normal") {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const zoomFactor = getSvgZoomFactor(data, zoomLevel);
  const paddedMax = max + range * zoomFactor;
  const paddedMin = min - range * zoomFactor;
  return 88 - ((value - paddedMin) / (paddedMax - paddedMin || 1)) * 68;
}

function buildSvgPriceScale(data, steps = 6, zoomLevel = "normal") {
  if (!Array.isArray(data) || data.length < 2) return [];
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const zoomFactor = getSvgZoomFactor(data, zoomLevel);
  const paddedMax = max + range * zoomFactor;
  const paddedMin = min - range * zoomFactor;

  return Array.from({ length: steps }, (_, index) => {
    const ratio = index / (steps - 1 || 1);
    const y = 14 + (72 * ratio);
    const value = paddedMax - ((paddedMax - paddedMin) * ratio);
    return { y, label: formatCompactPrice(value) };
  });
}

function hashScenarioSeed(symbol) {
  return String(symbol || "").split("").reduce((total, char) => total + char.charCodeAt(0), 0);
}

function buildNextScenarioPrice({ assetId, currentPrice, anchorPrice, tick, scenarioType }) {
  const seed = hashScenarioSeed(assetId);
  const safeAnchor = Number.isFinite(anchorPrice) && anchorPrice > 0 ? anchorPrice : currentPrice;
  const safePrice = Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : safeAnchor;
  const phaseLength = 7 + (seed % 5);
  const phaseIndex = Math.floor((tick + seed) / phaseLength) % 3;
  const phaseStep = (tick + seed) % phaseLength;
  const phaseProgress = phaseStep / (phaseLength - 1 || 1);
  const microWave = Math.sin((tick + seed) / 3.2) * 0.00045;
  const secondaryWave = Math.cos((tick + seed * 1.7) / 5.4) * 0.0003;
  const directionalNudge = (phaseProgress - 0.5) * 0.0009;
  const phaseName = phaseIndex === 0 ? "impulse" : phaseIndex === 1 ? "pullback" : "consolidation";

  let movePct = microWave + secondaryWave;

  if (scenarioType === "uptrend") {
    if (phaseName === "impulse") movePct += 0.0034 + directionalNudge;
    else if (phaseName === "pullback") movePct += -0.0015 + (directionalNudge * 0.45);
    else movePct += 0.00035 + (directionalNudge * 0.2);
  } else if (scenarioType === "downtrend") {
    if (phaseName === "impulse") movePct += -0.0034 - directionalNudge;
    else if (phaseName === "pullback") movePct += 0.0015 - (directionalNudge * 0.45);
    else movePct += -0.00035 - (directionalNudge * 0.2);
  } else if (scenarioType === "realistic") {
    const regimeLength = 11 + ((seed + Math.floor(tick / phaseLength)) % 9);
    const regimeIndex = Math.floor((tick + seed * 3) / regimeLength) % 5;
    const regimeStep = (tick + seed * 3) % regimeLength;
    const regimeProgress = regimeStep / (regimeLength - 1 || 1);
    const distanceFromAnchor = (safeAnchor - safePrice) / safeAnchor;
    const recoveryBias = distanceFromAnchor * 0.1;

    if (regimeIndex === 0) {
      movePct += 0.0024 + (directionalNudge * 0.6) + (regimeProgress * 0.0007);
    } else if (regimeIndex === 1) {
      movePct += -0.0014 - (regimeProgress * 0.0005) + (recoveryBias * 0.18);
    } else if (regimeIndex === 2) {
      movePct += (distanceFromAnchor * 0.26) + (directionalNudge * 0.18);
    } else if (regimeIndex === 3) {
      movePct += -0.002 + ((0.5 - Math.abs(regimeProgress - 0.5)) * 0.0012) - (recoveryBias * 0.08);
    } else {
      movePct += 0.0031 + (regimeProgress * 0.0009) - (distanceFromAnchor * 0.05);
    }
  } else {
    const distanceFromAnchor = (safeAnchor - safePrice) / safeAnchor;
    if (phaseName === "impulse") movePct += (distanceFromAnchor * 0.16) + (directionalNudge * 0.35);
    else if (phaseName === "pullback") movePct += (distanceFromAnchor * 0.24) - (directionalNudge * 0.25);
    else movePct += distanceFromAnchor * 0.28;
  }

  return Math.max(0.01, safePrice * (1 + movePct));
}

function buildScenarioPlaybackBridge({ assetId, currentPrice, anchorPrice, fromTick, toTick, scenarioType }) {
  if (toTick <= fromTick) return { nextPrice: currentPrice, points: [] };

  const totalTicks = toTick - fromTick;
  const sampleCount = Math.max(1, Math.min(24, totalTicks));
  let price = currentPrice;
  const points = [];

  for (let index = 1; index <= sampleCount; index += 1) {
    const sampleTick = fromTick + Math.round((totalTicks * index) / sampleCount);
    price = buildNextScenarioPrice({
      assetId,
      currentPrice: price,
      anchorPrice,
      tick: sampleTick,
      scenarioType,
    });
    points.push(price);
  }

  return { nextPrice: price, points };
}

function getScenarioSpeedInterval(speed) {
  if (speed === "10000x") return 10;
  if (speed === "1000x") return 16;
  if (speed === "500x") return 24;
  if (speed === "100x") return 70;
  if (speed === "50x") return 120;
  if (speed === "10x") return 300;
  return 1000;
}

function getScenarioSpeedMultiplier(speed) {
  if (speed === "10000x") return 10000;
  if (speed === "1000x") return 1000;
  if (speed === "500x") return 500;
  if (speed === "100x") return 100;
  if (speed === "50x") return 50;
  if (speed === "10x") return 10;
  return 1;
}

function getScenarioPlaybackDurationMs(duration) {
  if (duration === "1m") return 60000;
  if (duration === "30s") return 30000;
  if (duration === "10s") return 10000;
  return 5000;
}

function parseScenarioDurationValue(value) {
  const parsed = Number.parseFloat(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatScenarioDurationSummary(totalMs) {
  if (!Number.isFinite(totalMs) || totalMs <= 0) return "0s";

  const units = [
    { label: "y", ms: 365 * 24 * 60 * 60 * 1000 },
    { label: "mo", ms: 30 * 24 * 60 * 60 * 1000 },
    { label: "w", ms: 7 * 24 * 60 * 60 * 1000 },
    { label: "d", ms: 24 * 60 * 60 * 1000 },
    { label: "h", ms: 60 * 60 * 1000 },
    { label: "m", ms: 60 * 1000 },
    { label: "s", ms: 1000 },
  ];

  const parts = [];
  let remaining = totalMs;

  units.forEach((unit) => {
    if (parts.length >= 2) return;
    const amount = Math.floor(remaining / unit.ms);
    if (amount > 0) {
      parts.push(`${amount}${unit.label}`);
      remaining -= amount * unit.ms;
    }
  });

  return parts.length ? parts.join(" ") : "0s";
}

function formatScenarioAxisLabel(ms, totalMs) {
  if (!Number.isFinite(ms) || ms <= 0) {
    if (totalMs >= 365 * 24 * 60 * 60 * 1000) return "0mo";
    if (totalMs >= 30 * 24 * 60 * 60 * 1000) return "0w";
    if (totalMs >= 24 * 60 * 60 * 1000) return "0h";
    if (totalMs >= 60 * 60 * 1000) return "0m";
    return "0:00";
  }

  const totalSeconds = Math.floor(ms / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);
  const totalWeeks = ms / (7 * 24 * 60 * 60 * 1000);
  const totalMonths = ms / (30 * 24 * 60 * 60 * 1000);
  const totalYears = ms / (365 * 24 * 60 * 60 * 1000);

  if (totalMs >= 365 * 24 * 60 * 60 * 1000) {
    if (ms < 365 * 24 * 60 * 60 * 1000) return `${Math.round(totalMonths)}mo`;
    return `${Math.round(totalYears)}y`;
  }

  if (totalMs >= 30 * 24 * 60 * 60 * 1000) {
    if (ms < 30 * 24 * 60 * 60 * 1000) return `${Math.round(totalWeeks)}w`;
    return `${Math.round(totalMonths)}mo`;
  }

  if (totalMs >= 7 * 24 * 60 * 60 * 1000) {
    return `${Math.round(totalDays)}d`;
  }

  if (totalMs >= 24 * 60 * 60 * 1000) {
    if (ms < 24 * 60 * 60 * 1000) return `${Math.round(totalHours)}h`;
    return `${Math.round(totalDays)}d`;
  }

  if (totalMs >= 60 * 60 * 1000) {
    if (ms < 60 * 60 * 1000) return `${Math.round(totalMinutes)}m`;
    return `${Math.round(totalHours)}h`;
  }

  if (totalMs >= 60 * 1000) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  return `${totalSeconds}s`;
}

function isCapitalGuideIntent(question) {
  const normalized = String(question || "").trim().toLowerCase();
  if (!normalized) return false;

  const directPhrases = [
    "invest",
    "i want to invest",
    "where should i put money",
    "where should i put my money",
    "where should i put it",
    "extra money",
    "extra cash",
    "extra funds",
    "what should i do with money",
    "what should i do with my money",
    "what should i do with extra cash",
    "where should i invest",
    "where do i put extra cash",
    "where do i put this money",
    "where should i put this money",
  ];

  const hasMoneyReference =
    /\$\s?\d+/i.test(question)
    || /\b\d+(k|m)\b/i.test(normalized)
    || ["money", "cash", "funds", "savings", "capital"].some((term) => normalized.includes(term));
  const hasPlacementLanguage =
    ["invest", "put it", "put this", "put my", "do with", "where should", "where do i put"].some((term) => normalized.includes(term));
  const hasExtraCashPattern = normalized.includes("extra") && (hasMoneyReference || /\b\d+(k|m)\b/i.test(normalized));

  return directPhrases.some((phrase) => normalized.includes(phrase))
    || (hasMoneyReference && hasPlacementLanguage)
    || hasExtraCashPattern;
}

function normalizeCapitalGuideAnswer(questionKey, value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s/+.-]/g, " ")
    .replace(/\s+/g, " ");

  const matchesAny = (patterns) => patterns.some((pattern) => normalized.includes(pattern));

  if (questionKey === "timeHorizon") {
    if (matchesAny(["short", "near term", "weeks", "months", "month or two"])) return "short";
    if (matchesAny(["medium", "mid term", "months to years", "few years", "year or two"])) return "medium";
    if (matchesAny(["long", "long term", "years", "retirement", "decade"])) return "long";
  }

  if (questionKey === "riskTolerance") {
    if (matchesAny(["low", "conservative", "careful", "safe"])) return "low";
    if (matchesAny(["medium", "moderate", "balanced"])) return "medium";
    if (matchesAny(["high", "aggressive", "high risk", "riskier"])) return "high";
  }

  if (questionKey === "goal") {
    if (matchesAny(["growth", "grow", "compound", "upside"])) return "growth";
    if (matchesAny(["income", "cash flow", "yield"])) return "income";
    if (matchesAny(["learning", "learn", "practice", "education"])) return "learning";
  }

  if (questionKey === "experience") {
    if (matchesAny(["beginner", "new", "starting out", "no experience"])) return "beginner";
    if (matchesAny(["some experience", "intermediate", "a bit of experience", "somewhat experienced"])) return "some experience";
    if (matchesAny(["active trader", "active", "experienced trader", "i trade actively"])) return "active trader";
  }

  if (questionKey === "drawdownTolerance") {
    if (matchesAny(["sell quickly", "sell", "cut it", "get out fast"])) return "sell quickly";
    if (matchesAny(["buy more", "add", "average down", "add more"])) return "buy more";
    if (matchesAny(["hold", "wait", "ride it out", "stay in"])) return "hold";
  }

  if (questionKey === "managementStyle") {
    if (matchesAny(["mostly passive", "passive", "hands off", "set and forget"])) return "mostly passive";
    if (matchesAny(["active / hands-on", "active", "hands on", "manage it"])) return "active / hands-on";
  }

  if (questionKey === "moneyImportance") {
    if (matchesAny(["important / cannot lose much", "important", "cannot lose much", "cant lose much", "very important", "need to protect it"])) {
      return "important / cannot lose much";
    }
    if (matchesAny(["somewhat flexible", "flexible", "kind of flexible", "moderately flexible"])) return "somewhat flexible";
    if (matchesAny(["high-risk / learning capital", "high risk", "high-risk", "learning capital", "risk capital"])) {
      return "high-risk / learning capital";
    }
  }

  return null;
}

function getCapitalGuideQuestions() {
  return [
    {
      key: "timeHorizon",
      label: "Time horizon",
      options: ["short", "medium", "long"],
      prompt: "Capital Guide — first, what is your time horizon? Choose short (weeks/months), medium (months/years), or long (years+).",
      parse(value) {
        return normalizeCapitalGuideAnswer("timeHorizon", value);
      },
    },
    {
      key: "riskTolerance",
      label: "Risk tolerance",
      options: ["low", "medium", "high"],
      prompt: "What is your risk tolerance? Choose low, medium, or high.",
      parse(value) {
        return normalizeCapitalGuideAnswer("riskTolerance", value);
      },
    },
    {
      key: "goal",
      label: "Goal",
      options: ["growth", "income", "learning"],
      prompt: "What is the main goal for this money? Choose growth, income, or learning.",
      parse(value) {
        return normalizeCapitalGuideAnswer("goal", value);
      },
    },
    {
      key: "experience",
      label: "Experience",
      options: ["beginner", "some experience", "active trader"],
      prompt: "What best matches your experience level? Choose beginner, some experience, or active trader.",
      parse(value) {
        return normalizeCapitalGuideAnswer("experience", value);
      },
    },
    {
      key: "drawdownTolerance",
      label: "Drawdown tolerance",
      options: ["sell quickly", "hold", "buy more"],
      prompt: "If this dropped meaningfully after you invested, what would you most likely do? Choose sell quickly, hold, or buy more.",
      parse(value) {
        return normalizeCapitalGuideAnswer("drawdownTolerance", value);
      },
    },
    {
      key: "managementStyle",
      label: "Management style",
      options: ["active / hands-on", "mostly passive"],
      prompt: "How do you want to manage this money? Choose active / hands-on or mostly passive.",
      parse(value) {
        return normalizeCapitalGuideAnswer("managementStyle", value);
      },
    },
    {
      key: "moneyImportance",
      label: "Importance of the money",
      options: ["important / cannot lose much", "somewhat flexible", "high-risk / learning capital"],
      prompt: "How important is this money to you right now? Choose important / cannot lose much, somewhat flexible, or high-risk / learning capital.",
      parse(value) {
        return normalizeCapitalGuideAnswer("moneyImportance", value);
      },
    },
  ];
}

function EquityCurveCard({ equitySeries, sourceLabel, chartRange, setChartRange }) {
  const points = useMemo(() => buildSvgLinePoints(equitySeries), [equitySeries]);
  const areaPoints = `0,100 ${points} 100,100`;
  const startValue = equitySeries[0];
  const currentValue = equitySeries[equitySeries.length - 1];
  const netValue = currentValue - startValue;
  const netText = `${netValue >= 0 ? "+" : ""}${netValue.toFixed(2)}R`;

  return (
    <Card title="Equity Curve" className="equityCard">
      <div className="chartTabs">
        {["1D","1W","1M","3M","ALL"].map((range) => (
          <button key={range} className={`chartTab ${chartRange === range ? "active" : ""}`} onClick={() => setChartRange(range)} type="button">{range}</button>
        ))}
      </div>
      <div className="equityMeta">
        <div><span>Start</span><strong>{startValue.toFixed(1)}</strong></div>
        <div><span>Current</span><strong>{currentValue.toFixed(1)}</strong></div>
        <div><span>Net</span><strong>{netText}</strong></div>
      </div>
      <div className="equityChart">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points={areaPoints} className="equityArea" />
          <polyline points={points} />
        </svg>
      </div>
      <div className="equityFooter"><div className="equityFooterLabel">{sourceLabel}</div></div>
    </Card>
  );
}

function RecentTradesCard({ recentTrades, onDeleteTrade }) {
  return (
    <Card title="Recent Trades">
      <div className="listSubtext" style={{ marginBottom: "8px" }}>{recentTrades.length} trades logged</div>
      <div className="list">
        {recentTrades.length === 0 ? (
          <div className="listSubtext">No trades yet — log your first trade to start tracking.</div>
        ) : (
          recentTrades.map((trade) => (
            <div className="listRow" key={trade.id}>
              <div>
                <div className="listTitle">
                  <span className="assetText">{trade.asset}</span> {trade.setup ? `· ${trade.setup}` : ""}
                </div>
                <div className="listSubtext">
                  Entry: ${trade.entry_price ? Number(trade.entry_price).toFixed(2) : "-"} ·
                  Size: ${trade.entry_size ? Number(trade.entry_size).toFixed(0) : "-"} ·
                  {trade.entry_time ? (() => {
                    const [date, time] = trade.entry_time.split("T");
                    const [year, month, day] = date.split("-");
                    let [hour, minute] = time.split(":");
                    const ampm = hour >= 12 ? "PM" : "AM";
                    hour = hour % 12 || 12;
                    return `${month}/${day}/${year}, ${hour}:${minute} ${ampm}`;
                  })() : "-"}
                </div>
              </div>
              <div className={`tradeResult ${trade.result_r < 0 ? "negative" : trade.result_r > 0 ? "positive" : "neutral"}`}>
                {trade.result_r !== null && trade.result_r !== undefined ? `${trade.result_r > 0 ? "+" : ""}${Number(trade.result_r).toFixed(1)}R` : "-"}
              </div>
              <div className="listSubtext">{trade.coachTag || "Disciplined"}</div>
              <button type="button" className="deleteTradeButton" onClick={() => onDeleteTrade(trade.id)}>Delete</button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function BrokerTradeLogCard({ trades, isLoading, onRefresh }) {
  return (
    <Card title="Broker Trade Log">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <div className="listSubtext">{trades.length} broker trade{trades.length === 1 ? "" : "s"} synced</div>
        <button type="button" className="ghostButton" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh Alpaca Orders"}
        </button>
      </div>
      <div className="list">
        {!trades.length ? (
          <div className="listSubtext">No broker trades synced yet. Place a Rayla paper order or refresh Alpaca orders.</div>
        ) : (
          trades.map((trade) => {
            const statusPresentation = getBrokerOrderStatusPresentation(trade.status);
            return (
              <div className="listRow" key={trade.id}>
                <div>
                  <div className="listTitle">
                    <span className="assetText">{trade.symbol}</span> · {trade.side} · {Number(trade.qty || 0)} share(s)
                  </div>
                  <div className="listSubtext">
                    {trade.order_type} {trade.limit_price ? `· Limit ${formatCurrency(trade.limit_price)}` : ""} · {trade.source === "rayla" ? "Placed in Rayla" : "Imported from Alpaca"}
                  </div>
                </div>
                <div
                  className="pill"
                  style={{
                    color: statusPresentation.color,
                    background: statusPresentation.background,
                    border: `1px solid ${statusPresentation.border}`,
                  }}
                >
                  {statusPresentation.label}
                </div>
                <div className="listSubtext">
                  {trade.submitted_at
                    ? new Date(trade.submitted_at).toLocaleString()
                    : "--"}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function MarketCard({ items, selectedId, onSelect, onRemove, newSymbol, setNewSymbol, onAddSymbol, fullPage = false, alpacaConnected = false }) {
  const [quotes, setQuotes] = useState(() => {
  try {
    return JSON.parse(sessionStorage.getItem("rayla-market-quotes") || "{}");
  } catch {
    return {};
  }
});
  const [searchResults, setSearchResults] = useState([]);
  const [marketChart, setMarketChart] = useState(null);
  const [marketChartLoading, setMarketChartLoading] = useState(false);
  const [marketChartMode, setMarketChartMode] = useState("candlestick");
  const [marketChartRange, setMarketChartRange] = useState("1D");
  const [marketChartLastUpdated, setMarketChartLastUpdated] = useState(null);
  const marketSearchTimeoutRef = useRef(null);
  const homeMarketCarouselRef = useRef(null);
  const homeMarketCarouselDirectionRef = useRef(1);
  const [homeMarketCarouselPaused, setHomeMarketCarouselPaused] = useState(false);
  const [homeMarketCarouselCardWidth, setHomeMarketCarouselCardWidth] = useState(null);
  const [homeMarketCarouselCanScroll, setHomeMarketCarouselCanScroll] = useState(false);
  const [homeMarketCarouselSpeed, setHomeMarketCarouselSpeed] = useState(0.02);
  const symbolsKey = items.map((item) => item.id).sort().join("|");
  const selectedItem = items.find((item) => item.id === selectedId) || items[0];

  function getBestSearchMatch(query) {
    const normalizedQuery = String(query || "").trim().toUpperCase();
    if (!normalizedQuery) return null;

    return searchResults.find((result) => result.symbol === normalizedQuery)
      || searchResults.find((result) => String(result.description || "").trim().toUpperCase() === normalizedQuery)
      || searchResults.find((result) => result.symbol.startsWith(normalizedQuery))
      || searchResults.find((result) => String(result.description || "").trim().toUpperCase().startsWith(normalizedQuery))
      || (searchResults.length === 1 ? searchResults[0] : null);
  }


useEffect(() => {
  if (!items.length) return;


  async function fetchQuotes() {
    try {
      const symbols = items.map(item => ({
        symbol: item.id,
        type: item.type || "stock",
      }));
      const { data, error } = await supabase.functions.invoke("market-data", {
        body: { symbols },
      });

        if (error || !data?.ok) {
          console.error("market-data bad response:", error || data);
          return;
        }

        if (data.ok) {

        setQuotes((prev) => {
          const next = { ...prev };
          Object.entries(data.quotes || {}).forEach(([symbol, q]) => {
            if (q?.price != null) next[symbol] = q;
          });
          sessionStorage.setItem("rayla-market-quotes", JSON.stringify(next));
          return next;
        });
      }
    } catch (err) {
      console.error("fetchQuotes failed:", err);
    }
  }

  fetchQuotes();
  const interval = setInterval(fetchQuotes, 30000);
  return () => clearInterval(interval);
}, [symbolsKey]);

useEffect(() => {
  if (!selectedItem) {
    setMarketChart(null);
    setMarketChartLoading(false);
    return;
  }

  let isCancelled = false;
  setMarketChart((prev) => (prev?.symbol === selectedItem.id ? prev : null));
  setMarketChartLoading(true);

  async function fetchMarketChart() {
    try {
      const { data, error } = await supabase.functions.invoke("market-data", {
        body: {
          chartSymbol: selectedItem.id,
          chartType: selectedItem.type || "stock",
          chartRange: marketChartRange,
        },
      });

      if (isCancelled || error || !data?.ok) return;

      const nextChart = data.chart || null;
      const nextBars = extractChartBars(nextChart);
      if (nextChart && nextBars.length >= 2) {
        setMarketChart({
          ...nextChart,
          symbol: nextChart.symbol || selectedItem.id,
        });
        setMarketChartLastUpdated(new Date());
        return;
      }

      setMarketChart({
        symbol: selectedItem.id,
        range: marketChartRange,
        bars: [],
      });
    } catch {
      // Keep the current market view stable if chart fetch fails.
    } finally {
      if (!isCancelled) setMarketChartLoading(false);
    }
  }

  fetchMarketChart();
  const interval = marketChartRange === "1D"
    ? setInterval(fetchMarketChart, 10000)
    : null;

  return () => {
    isCancelled = true;
    if (interval) clearInterval(interval);
  };
}, [selectedItem?.id, selectedItem?.type, marketChartRange]);

useEffect(() => {
  if (fullPage) return undefined;

  function handlePointerDown(event) {
    if (homeMarketCarouselRef.current?.contains(event.target)) return;
    setHomeMarketCarouselPaused(false);
  }

  document.addEventListener("pointerdown", handlePointerDown);
  return () => document.removeEventListener("pointerdown", handlePointerDown);
}, [fullPage]);

  const sortedItems = [...items].sort((a, b) => a.id.localeCompare(b.id));

useEffect(() => {
  if (fullPage || !homeMarketCarouselRef.current) return undefined;

  const gap = 8;
  const minCardWidth = 154;

  function syncHomeCarouselLayout() {
    const containerWidth = homeMarketCarouselRef.current?.clientWidth || 0;
    if (!containerWidth || !sortedItems.length) {
      setHomeMarketCarouselCardWidth(null);
      setHomeMarketCarouselCanScroll(false);
      setHomeMarketCarouselSpeed(0.02);
      return;
    }

    const visibleSlots = Math.max(1, Math.floor((containerWidth + gap) / (minCardWidth + gap)));
    const overflowsVisibleWidth = sortedItems.length > visibleSlots;
    const wantsAutoScroll = sortedItems.length >= 8
      ? true
      : sortedItems.length >= 6
        ? overflowsVisibleWidth
        : false;
    const shouldScroll = wantsAutoScroll && overflowsVisibleWidth;
    setHomeMarketCarouselCanScroll(shouldScroll);
    setHomeMarketCarouselSpeed(sortedItems.length >= 8 ? 0.02 : 0.01);

    if (shouldScroll) {
      setHomeMarketCarouselCardWidth(minCardWidth);
      return;
    }

    const expandedWidth = Math.max(
      minCardWidth,
      Math.floor((containerWidth - gap * Math.max(sortedItems.length - 1, 0)) / sortedItems.length)
    );
    setHomeMarketCarouselCardWidth(expandedWidth);
  }

  syncHomeCarouselLayout();
  const observer = new ResizeObserver(syncHomeCarouselLayout);
  observer.observe(homeMarketCarouselRef.current);
  return () => observer.disconnect();
}, [fullPage, sortedItems.length]);

useEffect(() => {
  if (fullPage || homeMarketCarouselPaused || !homeMarketCarouselCanScroll || !homeMarketCarouselRef.current) {
    return undefined;
  }

  const wrapper = homeMarketCarouselRef.current;
  let frameId = null;
  let lastTime = performance.now();
  homeMarketCarouselDirectionRef.current = 1;

  const tick = (now) => {
    const maxScroll = Math.max(0, wrapper.scrollWidth - wrapper.clientWidth);
    if (maxScroll <= 0) return;

    const elapsed = now - lastTime;
    lastTime = now;
    const nextScrollLeft = wrapper.scrollLeft + (elapsed * homeMarketCarouselSpeed * homeMarketCarouselDirectionRef.current);

    if (nextScrollLeft >= maxScroll) {
      wrapper.scrollLeft = maxScroll;
      homeMarketCarouselDirectionRef.current = -1;
    } else if (nextScrollLeft <= 0) {
      wrapper.scrollLeft = 0;
      homeMarketCarouselDirectionRef.current = 1;
    } else {
      wrapper.scrollLeft = nextScrollLeft;
    }

    frameId = window.requestAnimationFrame(tick);
  };

  frameId = window.requestAnimationFrame(tick);
  return () => {
    if (frameId) window.cancelAnimationFrame(frameId);
  };
}, [fullPage, homeMarketCarouselPaused, homeMarketCarouselCanScroll, homeMarketCarouselSpeed, sortedItems.length]);

  const WatchlistItems = () => (
    !fullPage ? (
      <div
        className={`marketWatchlistCarouselWrap ${homeMarketCarouselPaused ? "paused" : ""}`}
        ref={homeMarketCarouselRef}
      >
        <div
          className={`marketWatchlist marketWatchlistCarousel ${homeMarketCarouselPaused ? "paused" : ""} ${homeMarketCarouselCanScroll ? "scrolling" : "filled"}`}
        >
          {sortedItems.map((item, index) => (
            <button
              type="button"
              key={`${item.id}-${index}`}
              className={`marketWatchRow ${item.id === selectedId ? "active" : ""}`}
              style={homeMarketCarouselCardWidth ? { width: homeMarketCarouselCardWidth, minWidth: homeMarketCarouselCardWidth } : undefined}
              onClick={() => {
                setHomeMarketCarouselPaused(true);
                onSelect(item.id);
              }}
            >
              <div className="marketWatchLeft">
                <div className="marketWatchLabel">
                  {quotes[item.id]?.price != null
                    ? quotes[item.id].price.toFixed(2)
                    : "..."}
                </div>
                <div className="marketWatchSymbol">{item.id}</div>
              </div>
              <div className="marketWatchRight">
                <div
                  className={`marketWatchChange ${
                    (quotes[item.id]?.change ?? item.changeValue) < 0 ? "negative" : "positive"
                  }`}
                >
                  {quotes[item.id]?.change != null
                    ? `${quotes[item.id].change >= 0 ? "+" : ""}${quotes[item.id].change.toFixed(2)}%`
                    : "..."}
                </div>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.id);
                  }}
                  style={{ marginLeft: "8px", cursor: "pointer", fontWeight: "700", fontSize: "16px" }}
                >
                  ×
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    ) : (
      <div className="marketWatchlist">
        {sortedItems.map((item, index) => (
          <button
            type="button"
            key={`${item.id}-${index}`}
            className={`marketWatchRow ${item.id === selectedId ? "active" : ""}`}
            onClick={() => {
              setHomeMarketCarouselPaused(true);
              onSelect(item.id);
            }}
          >
            <div className="marketWatchLeft">
              <div className="marketWatchLabel">
                {quotes[item.id]?.price != null
                  ? quotes[item.id].price.toFixed(2)
                  : "..."}
              </div>
              <div className="marketWatchSymbol">{item.id}</div>
            </div>
            <div className="marketWatchRight">
              <div
                className={`marketWatchChange ${
                  (quotes[item.id]?.change ?? item.changeValue) < 0 ? "negative" : "positive"
                }`}
              >
                {quotes[item.id]?.change != null
                  ? `${quotes[item.id].change >= 0 ? "+" : ""}${quotes[item.id].change.toFixed(2)}%`
                  : "..."}
              </div>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.id);
                }}
                style={{ marginLeft: "8px", cursor: "pointer", fontWeight: "700", fontSize: "16px" }}
              >
                ×
              </span>
            </div>
          </button>
        ))}
      </div>
    )
  );



  return (
    <Card title="Live Market" className="marketCard">
      <div style={{ position: "relative", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "10px" }}>
        <input
          type="text"
          value={newSymbol}
          onChange={async (e) => {
            const val = e.target.value;
            setNewSymbol(val);
            if (marketSearchTimeoutRef.current) clearTimeout(marketSearchTimeoutRef.current);
            if (val.length < 1) { setSearchResults([]); return; }
            marketSearchTimeoutRef.current = setTimeout(async () => {
              try {
                const results = await searchRaylaSupportedAssets(val, alpacaConnected);
                setSearchResults(results);
              } catch {
                setSearchResults([]);
              }
            }, 120);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
            }
          }}
          placeholder="Search symbol (AAPL, BTC, NRG)"
          className="authInput"
        />
        <button
          type="button"
          onClick={() => {
            const bestMatch = getBestSearchMatch(newSymbol);
            onAddSymbol(bestMatch || newSymbol);
            setSearchResults([]);
          }}
          className="ghostButton"
        >
          Add
        </button>
        </div>
        {searchResults.length > 0 && (
          <div style={{ position: "absolute", zIndex: 999, background: "#111827", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, width: "100%", maxHeight: 220, overflowY: "auto", marginTop: 4 }}>
            {searchResults.map((r) => (
              <div key={r.symbol} onClick={() => { onAddSymbol(r); setSearchResults([]); setNewSymbol(""); }} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: "#fff", fontSize: 13 }}>{r.symbol}</span>
                <span style={{ color: "#7f8ea3", fontSize: 12, marginLeft: 8 }}>{r.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`marketLayout ${fullPage ? "marketLayoutFull" : "marketLayoutDash"}`}>
        {!fullPage && <WatchlistItems />}

        {!fullPage && (
          <div className="tradingviewFrameWrap">
            <div style={{ width: "100%", height: "100%", minHeight: 320, background: "#0d1117", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px 0 12px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {["1D", "1W", "1M", "3M", "1Y", "5Y", "MAX"].map((range) => (
                      <button
                        key={range}
                        type="button"
                        onClick={() => setMarketChartRange(range)}
                        style={{
                          padding: "3px 9px",
                          borderRadius: 6,
                          border: "1px solid",
                          borderColor: marketChartRange === range ? "rgba(124,196,255,0.5)" : "rgba(255,255,255,0.1)",
                          background: marketChartRange === range ? "rgba(124,196,255,0.13)" : "transparent",
                          color: marketChartRange === range ? "#d7efff" : "#7f8ea3",
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: "pointer",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {[["line", "Line"], ["candlestick", "Candles"]].map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setMarketChartMode(mode)}
                        style={{
                          padding: "3px 9px",
                          borderRadius: 6,
                          border: "1px solid",
                          borderColor: marketChartMode === mode ? "rgba(124,196,255,0.5)" : "rgba(255,255,255,0.1)",
                          background: marketChartMode === mode ? "rgba(124,196,255,0.13)" : "transparent",
                          color: marketChartMode === mode ? "#d7efff" : "#7f8ea3",
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: "pointer",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {marketChartLastUpdated && (
                  <div style={{ fontSize: 10, color: "#7f8ea3" }}>
                    Updated {marketChartLastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </div>
            <div style={{ width: "100%", height: "100%", minHeight: 320, background: "#0d1117", paddingTop: 10 }}>
              {selectedItem && (marketChartLoading && extractChartBars(marketChart).length < 2) ? (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8" }}>
                  Loading chart...
                </div>
              ) : selectedItem && extractChartBars(marketChart).length < 2 ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 6, alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "0 24px" }}>
                  <div>Chart unavailable</div>
                  <div>Alpaca does not provide chart bars for this asset yet, but live quote data is still available and was added to your watchlist.</div>
                </div>
              ) : selectedItem ? (
                <TradeChart
                  bars={extractChartBars(marketChart)}
                  mode={marketChartMode}
                  latestPrice={quotes[selectedItem.id]?.price}
                  assetSymbol={selectedItem.id}
                  assetName={selectedItem.description || selectedItem.name || selectedItem.id}
                />
              ) : null}
            </div>
            </div>
          </div>
        )}

        {fullPage && (
          <div className="tradingviewFrameWrapFull">
            <div style={{ width: "100%", height: "100%", minHeight: 420, background: "#0d1117", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px 0 12px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {["1D", "1W", "1M", "3M", "1Y", "5Y", "MAX"].map((range) => (
                      <button
                        key={range}
                        type="button"
                        onClick={() => setMarketChartRange(range)}
                        style={{
                          padding: "3px 9px",
                          borderRadius: 6,
                          border: "1px solid",
                          borderColor: marketChartRange === range ? "rgba(124,196,255,0.5)" : "rgba(255,255,255,0.1)",
                          background: marketChartRange === range ? "rgba(124,196,255,0.13)" : "transparent",
                          color: marketChartRange === range ? "#d7efff" : "#7f8ea3",
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: "pointer",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {[["line", "Line"], ["candlestick", "Candles"]].map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setMarketChartMode(mode)}
                        style={{
                          padding: "3px 9px",
                          borderRadius: 6,
                          border: "1px solid",
                          borderColor: marketChartMode === mode ? "rgba(124,196,255,0.5)" : "rgba(255,255,255,0.1)",
                          background: marketChartMode === mode ? "rgba(124,196,255,0.13)" : "transparent",
                          color: marketChartMode === mode ? "#d7efff" : "#7f8ea3",
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: "pointer",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {marketChartLastUpdated && (
                  <div style={{ fontSize: 10, color: "#7f8ea3" }}>
                    Updated {marketChartLastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </div>
            <div style={{ width: "100%", height: "100%", minHeight: 420, background: "#0d1117", paddingTop: 10 }}>
              {selectedItem && (marketChartLoading && extractChartBars(marketChart).length < 2) ? (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8" }}>
                  Loading chart...
                </div>
              ) : selectedItem && extractChartBars(marketChart).length < 2 ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 6, alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "0 24px" }}>
                  <div>Chart unavailable</div>
                  <div>Alpaca does not provide chart bars for this asset yet, but live quote data is still available and was added to your watchlist.</div>
                </div>
              ) : selectedItem ? (
                <TradeChart
                  bars={extractChartBars(marketChart)}
                  mode={marketChartMode}
                  latestPrice={quotes[selectedItem.id]?.price}
                  assetSymbol={selectedItem.id}
                  assetName={selectedItem.description || selectedItem.name || selectedItem.id}
                />
              ) : null}
            </div>
            </div>
          </div>
        )}

        {fullPage && <WatchlistItems />}
      </div>
    </Card>
  );
}

function normalizeIntelArticles(items = []) {
  return (items || []).map((article) => ({
    title: article.title || "No title",
    description: article.description || article.content || "No summary available",
    image: article.image || article.image_url || article.urlToImage || "",
    url: article.url || "#",
    source: typeof article.source === "object" ? article.source : { name: article.source || "Unknown source" },
    publishedAt: article.publishedAt || "",
  }));
}

function getScoreLabel(score) {
  if (score >= 4) return { label: "Hot", cls: "hot" };
  if (score >= 1) return { label: "Leaning Hot", cls: "leaning-hot" };
  if (score <= -4) return { label: "Cold", cls: "cold" };
  if (score <= -1) return { label: "Leaning Cold", cls: "leaning-cold" };
  return { label: "Neutral", cls: "neutral" };
}

function IntelAssetCard({ item, onTrySimulation = null }) {
  if (!item) return null;
  const { label, cls } = getScoreLabel(item.score);
  const changePos = !item.change?.startsWith("-");
  const article = (item.rawArticles || [])[0];
  const drivers = item.breakdown
    ? Object.entries(item.breakdown).filter(([k]) => k !== "total").sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 2)
    : [];
  const pillColors = {
    "hot": { bg: "rgba(239,68,68,0.15)", color: "#f87171" },
    "leaning-hot": { bg: "rgba(239,68,68,0.08)", color: "#fca5a5" },
    "cold": { bg: "rgba(124,196,255,0.15)", color: "#7CC4FF" },
    "leaning-cold": { bg: "rgba(124,196,255,0.08)", color: "#93c5fd" },
    "neutral": { bg: "rgba(255,255,255,0.08)", color: "#7f8ea3" },
  };
  const pill = pillColors[cls];
  const driverLabels = { demand: "Demand", costMargin: "Margin", guidance: "Guidance", narrative: "Narrative", priceConfirmation: "Price", liquidity: "Liquidity", sentiment: "Sentiment", momentum: "Momentum", catalyst: "Catalyst", relativeStrength: "Rel. Strength" };

  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#ffffff" }}>{item.symbol}</div>
            <div style={{ fontSize: 11, color: "#7f8ea3", marginTop: 1 }}>{item.name}</div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999, background: pill.bg, color: pill.color }}>{label}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: changePos ? "#4ade80" : "#f87171" }}>{item.change}</div>
          <div style={{ fontSize: 11, color: "#7f8ea3", marginTop: 2 }}>Score: {item.score}</div>
        </div>
      </div>
      {drivers.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {drivers.map(([key, val]) => (
            <div key={key} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: val > 0 ? "rgba(74,222,128,0.1)" : val < 0 ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.06)", color: val > 0 ? "#4ade80" : val < 0 ? "#f87171" : "#7f8ea3", fontWeight: 600 }}>
              {driverLabels[key] || key} {val > 0 ? "↑" : val < 0 ? "↓" : "—"}
            </div>
          ))}
        </div>
      )}
      {article && (
        <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", gap: 10, textDecoration: "none", marginTop: 6, padding: "10px 10px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", alignItems: "flex-start" }}>
          {article.image ? (
            <img src={article.image} alt="" onError={e => e.target.style.display = "none"} style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: 8, flexShrink: 0, background: "rgba(124,196,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📰</div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "#7CC4FF", lineHeight: 1.4, marginBottom: 3 }}>{article.title}</div>
            <div style={{ fontSize: 10, color: "#7f8ea3" }}>{article.source?.name}</div>
            {article.description && <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4, marginTop: 4 }}>{article.description?.slice(0, 120)}...</div>}
          </div>
        </a>
      )}
      {onTrySimulation && (
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            className="ghostButton"
            onClick={(e) => {
              e.stopPropagation();
              onTrySimulation(item);
            }}
          >
            Try in Simulation
          </button>
        </div>
      )}
    </div>
  );
}

function CoachAskBox({ trades, onAskRayla, isLoading }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  async function handleAsk() {
    const q = question.trim();
    if (!q) return;
    const r = buildCoachReport(trades);
    if (!r) { setAnswer("No trades logged yet. Start logging trades first."); setQuestion(""); return; }
    try {
      const nextAnswer = await onAskRayla(q);
      setAnswer(nextAnswer);
      setQuestion("");
    } catch (error) {
      setAnswer(`API error: ${error?.message || "unknown error"}`);
    }
  }

  return (
    <div className="card">
      <div className="cardHeader"><h2>Ask Rayla About Your Performance</h2></div>
      <div className="cardBody">
        <p style={{ fontSize: 13, color: "#7f8ea3", margin: "0 0 12px 0" }}>Ask anything about your trades, setups, edges, or what to focus on next.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={question}
            placeholder="e.g. What's my best setup? How am I doing? Am I overtrading?"
            style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#e2e8f0", outline: "none" }}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAsk(); }}
            disabled={isLoading}
          />
          <button type="button" style={{ background: "#7CC4FF", color: "#0b1017", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }} onClick={handleAsk} disabled={isLoading}>{isLoading ? "Thinking..." : "Ask"}</button>
        </div>
        {answer && <div style={{ marginTop: 12, fontSize: 13, color: "#e2e8f0", lineHeight: 1.6 }}>{answer}</div>}
      </div>
    </div>
  );
}

function SubscriptionCard() {
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);

  const VALID_CODES = { "RAYLA5": 5, "RAYLAFREE": 20 };

  function handleApply() {
    const code = promoCode.trim().toUpperCase();
    if (VALID_CODES[code]) {
      setPromoApplied(code);
      setPromoCode("");
    } else {
      alert("Invalid promo code.");
    }
  }

  const trialDays = 14;
  const trialEnd = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="cardHeader"><h2>Subscription</h2></div>
      <div className="cardBody">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "#7f8ea3", marginBottom: 4 }}>Current plan</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>Rayla</div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: "rgba(74,222,128,0.1)", color: "#4ade80" }}>Free trial</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: "#7f8ea3" }}>Trial ends</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{trialEnd}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: "#7f8ea3" }}>Then</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>
              {promoApplied === "RAYLAFREE" ? (
                <span style={{ color: "#4ade80" }}>Free</span>
              ) : promoApplied === "RAYLA5" ? (
                <><span style={{ textDecoration: "line-through", color: "#7f8ea3", marginRight: 6 }}>$20.00</span><span style={{ color: "#4ade80" }}>$15.00 / month</span></>
              ) : "$20.00 / month"}
            </span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 999, height: 4 }}>
            <div style={{ background: "#4ade80", borderRadius: 999, height: 4, width: "100%" }} />
          </div>
          <div style={{ fontSize: 12, color: "#7f8ea3", marginTop: 6 }}>{trialDays} days remaining in trial</div>
        </div>
        {!promoApplied && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 6 }}>Promo code</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                className="authInput"
                placeholder="Enter code"
                value={promoCode}
                onChange={e => setPromoCode(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleApply(); }}
                style={{ flex: 1 }}
              />
              <button type="button" className="ghostButton" onClick={handleApply}>Apply</button>
            </div>
          </div>
        )}
        {promoApplied && (
          <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10, background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.15)", fontSize: 13, color: "#4ade80" }}>
            ✓ Promo code applied — {promoApplied === "RAYLAFREE" ? "first month free" : "$5 off per month"}
          </div>
        )}
        <button type="button" className="ghostButton" style={{ width: "100%" }}>Manage subscription</button>
        <div style={{ fontSize: 12, color: "#7f8ea3", textAlign: "center", marginTop: 10 }}>Subscription feature coming soon</div>
      </div>
    </div>
  );
}

export default function App() {
  const [selectedMarketId, setSelectedMarketId] = useState("BTC");
 const [watchlist, setWatchlist] = useState(() => {
  const saved = localStorage.getItem("rayla-watchlist");
  if (!saved) return marketSeeds;

  const parsed = JSON.parse(saved).map((item) => ({
    ...item,
    type: item.type || (item.tvSymbol?.includes("BINANCE") || item.tvSymbol?.includes("USDT") ? "crypto" : "stock"),
  }));

  const seen = new Set();
  return parsed.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
});
  useEffect(() => {
  localStorage.setItem("rayla-watchlist", JSON.stringify(watchlist));
}, [watchlist]);

useEffect(() => {
  if (watchlist.length > 0 && !watchlist.find(item => item.id === selectedMarketId)) {
    setSelectedMarketId(watchlist[0].id);
  }
}, [watchlist]);

  const marketItems = watchlist.map((item) => {
    const fallbackPrice = Number(String(item.fallbackPrice).replace(/,/g, ""));
    const fallbackChange = Number(String(item.fallbackChange).replace("%", ""));
    return {
      ...item,
      priceValue: fallbackPrice,
      changeValue: fallbackChange,
      priceText: formatCompactPrice(fallbackPrice),
      changeText: formatPctChange(fallbackChange),
    };
  });

  const [intelLoading, setIntelLoading] = useState(false);
  const [hotColdReport, setHotColdReport] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("rayla-intel-report") || "null");
    } catch {
      return null;
    }
  });
  const [isRaylaLoading, setIsRaylaLoading] = useState(false);
  const [raylaResponse, setRaylaResponse] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [capitalGuideState, setCapitalGuideState] = useState({
    active: false,
    stepIndex: 0,
    answers: {},
  });
  const [capitalGuideResult, setCapitalGuideResult] = useState(null);
  const [capitalGuideScenarioIntro, setCapitalGuideScenarioIntro] = useState("");
  const [guidedScenarioActive, setGuidedScenarioActive] = useState(false);
  const [guidedScenarioMessage, setGuidedScenarioMessage] = useState("");
  const [guidedScenarioMessageStep, setGuidedScenarioMessageStep] = useState(0);
  const [pendingGuidedScenarioLaunch, setPendingGuidedScenarioLaunch] = useState(null);
  const [alpacaConnectionLoading, setAlpacaConnectionLoading] = useState(false);
  const [alpacaAccount, setAlpacaAccount] = useState(null);
  const [alpacaPositions, setAlpacaPositions] = useState([]);
  const [brokerTradeLog, setBrokerTradeLog] = useState([]);
  const [brokerTradeLogLoading, setBrokerTradeLogLoading] = useState(false);
  const [alpacaOrderSubmitting, setAlpacaOrderSubmitting] = useState(false);
  const [alpacaOrderResult, setAlpacaOrderResult] = useState(null);
  const [pendingAlpacaOrderConfirmation, setPendingAlpacaOrderConfirmation] = useState(null);
  const [alpacaAssetSearchResults, setAlpacaAssetSearchResults] = useState([]);
  const [alpacaAssetSearchLoading, setAlpacaAssetSearchLoading] = useState(false);
  const [alpacaAssetSearchError, setAlpacaAssetSearchError] = useState("");
  const [alpacaAssetSearchOpen, setAlpacaAssetSearchOpen] = useState(false);
  const [alpacaAssetQuotes, setAlpacaAssetQuotes] = useState({});
  const [tradeMarketChart, setTradeMarketChart] = useState(null);
  const [tradeMarketChartLoading, setTradeMarketChartLoading] = useState(false);
  const [tradeChartMode, setTradeChartMode] = useState("candlestick");
  const [tradeChartRange, setTradeChartRange] = useState("1D");
  const [tradeChartLastUpdated, setTradeChartLastUpdated] = useState(null);
  const [tradeChartRefreshTick, setTradeChartRefreshTick] = useState(0);
  const [tradeViewMode, setTradeViewMode] = useState("asset");
  const [simulationLiveChart, setSimulationLiveChart] = useState(null);
  const [simulationLiveChartLoading, setSimulationLiveChartLoading] = useState(false);
  const [simulationLiveChartRefreshTick, setSimulationLiveChartRefreshTick] = useState(0);
  const [simulationLiveChartMode, setSimulationLiveChartMode] = useState("candlestick");
  const [simulationLiveChartRange, setSimulationLiveChartRange] = useState("1D");
  const [simulationLiveChartLastUpdated, setSimulationLiveChartLastUpdated] = useState(null);
  const [alpacaOrderForm, setAlpacaOrderForm] = useState({
    symbol: "",
    side: "buy",
    qty: "",
    type: "market",
    limitPrice: "",
  });
  const [activeTab, setActiveTab] = useState("home");
    const [newSymbol, setNewSymbol] = useState("");
  const [user, setUser] = useState(null);
  const [chartRange, setChartRange] = useState("ALL");
  const [displayName, setDisplayName] = useState("");
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [userLevel, setUserLevel] = useState("beginner");
    const [showBeginnerTutorial, setShowBeginnerTutorial] = useState(false);
  const [beginnerTutorialView, setBeginnerTutorialView] = useState("menu");
    const [beginnerTutorialStep, setBeginnerTutorialStep] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [lastAnalyzedCount, setLastAnalyzedCount] = useState(-1);
  const [showNoNewTrades, setShowNoNewTrades] = useState(false);
  const [coachSummary, setCoachSummary] = useState(null);
  const [equitySourceLabel, setEquitySourceLabel] = useState("R-based equity from journaled trades only. Add your first trade.");
  const [trades, setTrades] = useState([]);
  const [simulationQuotes, setSimulationQuotes] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("rayla-market-quotes") || "{}");
    } catch {
      return {};
    }
  });
  const tradePanelSymbol = String(alpacaOrderForm.symbol || "").trim().toUpperCase() || alpacaPositions[0]?.symbol || "";
  const tradePanelMatchingPosition = tradePanelSymbol
    ? alpacaPositions.find((position) => position.symbol === tradePanelSymbol) || null
    : null;
  const tradePanelQuote = tradePanelSymbol
    ? getKnownStockQuoteData(tradePanelSymbol, simulationQuotes, marketItems, alpacaAssetQuotes)
    : null;
  const tradePanelCurrentPrice = Number.isFinite(tradePanelQuote?.price)
    ? Number(tradePanelQuote.price)
    : Number.isFinite(tradePanelMatchingPosition?.currentPrice)
      ? Number(tradePanelMatchingPosition.currentPrice)
      : null;
  const tradePanelAsset = tradePanelSymbol
    ? watchlist.find((item) => item.id === tradePanelSymbol)
      || buildMarketAsset({
        symbol: tradePanelSymbol,
        description: tradePanelMatchingPosition?.symbol || tradePanelSymbol,
        exchange: tradePanelMatchingPosition?.exchange || "",
        type: "stock",
      })
    : null;
  const tradeMarketChartSeries = tradeMarketChart?.symbol === tradePanelSymbol
    ? extractChartCloseSeries(tradeMarketChart)
    : [];
  const tradeMarketChartSource = tradeMarketChartSeries.length >= 2 ? "bars" : "fallback";
  const tradeMarketDisplaySeries = tradeMarketChartSeries.length >= 2
    ? tradeMarketChartSeries
    : buildFallbackMiniChartSeries(tradePanelQuote, tradePanelMatchingPosition);
  const tradeMarketChartPoints = tradeMarketDisplaySeries.length >= 2
    ? buildSvgLinePoints(tradeMarketDisplaySeries)
    : "";
  const [simulationAsset, setSimulationAsset] = useState(null);
  const [simulationMode, setSimulationMode] = useState("live");
  const [simulationScenarioType, setSimulationScenarioType] = useState("uptrend");
  const [simulationScenarioSpeed, setSimulationScenarioSpeed] = useState("1x");
  const [simulationScenarioPlaybackDuration, setSimulationScenarioPlaybackDuration] = useState("10s");
  const simulationScenarioZoom = "wide";
  const [simulationScenarioIsPlaying, setSimulationScenarioIsPlaying] = useState(false);
  const [simulationScenarioNoLimit, setSimulationScenarioNoLimit] = useState(true);
  const [simulationScenarioSeconds, setSimulationScenarioSeconds] = useState("");
  const [simulationScenarioMinutes, setSimulationScenarioMinutes] = useState("");
  const [simulationScenarioHours, setSimulationScenarioHours] = useState("");
  const [simulationScenarioDays, setSimulationScenarioDays] = useState("");
  const [simulationScenarioWeeks, setSimulationScenarioWeeks] = useState("");
  const [simulationScenarioMonths, setSimulationScenarioMonths] = useState("");
  const [simulationScenarioYears, setSimulationScenarioYears] = useState("");
  const [simulationDirection, setSimulationDirection] = useState("long");
  const [simulationAmount, setSimulationAmount] = useState("");
  const [simulationAmountMode, setSimulationAmountMode] = useState("dollars");
  const [simulationExitMode, setSimulationExitMode] = useState("price");
  const [simulationStopLoss, setSimulationStopLoss] = useState("");
  const [simulationTakeProfit, setSimulationTakeProfit] = useState("");
  const [simulationUseStopTarget, setSimulationUseStopTarget] = useState(true);
  const [simulationUseExitPrice, setSimulationUseExitPrice] = useState(true);
  const [simulationSearchQuery, setSimulationSearchQuery] = useState("");
  const [simulationSearchResults, setSimulationSearchResults] = useState([]);
  const simulationSearchTimeoutRef = useRef(null);
  const [simulationScenarioQuotes, setSimulationScenarioQuotes] = useState({});
  const [simulationScenarioSeries, setSimulationScenarioSeries] = useState({});
  const [simulationScenarioAnchors, setSimulationScenarioAnchors] = useState({});
  const [simulationScenarioTick, setSimulationScenarioTick] = useState(0);
  const [simulationPositions, setSimulationPositions] = useState(() => {
    const stored = readSimulationStorage(
      SIMULATION_STORAGE_KEYS.openPosition,
      [],
      (value) => value === null || Array.isArray(value) || (typeof value === "object" && !Array.isArray(value))
    );
    if (Array.isArray(stored)) return stored;
    if (stored && typeof stored === "object") return [stored];
    return [];
  });
  const [simulationClosedTrade, setSimulationClosedTrade] = useState(() =>
    readSimulationStorage(
      SIMULATION_STORAGE_KEYS.closedTrade,
      null,
      (value) => value === null || (typeof value === "object" && !Array.isArray(value))
    )
  );
  const [simulatedBalance, setSimulatedBalance] = useState(() =>
    readSimulationStorage(
      SIMULATION_STORAGE_KEYS.balance,
      SIMULATION_STARTING_BALANCE,
      (value) => Number.isFinite(value)
    )
  );
  const [simulationTradeHistory, setSimulationTradeHistory] = useState(() =>
    readSimulationStorage(
      SIMULATION_STORAGE_KEYS.tradeHistory,
      [],
      (value) => Array.isArray(value)
    )
  );
  const [guidedSimulationDraft, setGuidedSimulationDraft] = useState(() =>
    readSimulationStorage(
      SIMULATION_STORAGE_KEYS.guidedDraft,
      null,
      (value) => value === null || (typeof value === "object" && !Array.isArray(value))
    )
  );
  const [activeGuidedSimulation, setActiveGuidedSimulation] = useState(null);
  const [showSimulationHelp, setShowSimulationHelp] = useState(false);
  const [isSimulationTutorialOpen, setIsSimulationTutorialOpen] = useState(false);
  const [activeSimulationTutorialStep, setActiveSimulationTutorialStep] = useState(0);
  const [selectedSimulationInfoKey, setSelectedSimulationInfoKey] = useState(null);
  const [hasCompletedFirstTradeOnboarding, setHasCompletedFirstTradeOnboarding] = useState(() =>
    readSimulationStorage(
      FIRST_TRADE_ONBOARDING_STORAGE_KEYS.completed,
      null,
      (value) => value === null || typeof value === "boolean"
    )
  );
  const [hasAttemptedFirstTradeOnboardingAutoStart, setHasAttemptedFirstTradeOnboardingAutoStart] = useState(() =>
    readSimulationStorage(
      FIRST_TRADE_ONBOARDING_STORAGE_KEYS.autoStarted,
      false,
      (value) => typeof value === "boolean"
    )
  );
  const [simulationNow, setSimulationNow] = useState(Date.now());
  const simulationSectionRefs = useRef({});
  const simulationTutorialContainerRef = useRef(null);
  const scenarioPlaybackStartedAtRef = useRef(null);
  const scenarioPlaybackElapsedMsRef = useRef(0);
  const pendingScenarioCompletionRef = useRef(null);
  const simulationTrackedAssets = useMemo(() => ([
    ...watchlist,
    ...(simulationAsset ? [simulationAsset] : []),
    ...simulationPositions
      .filter((position) => position?.asset && simulationAsset?.id !== position.asset)
      .map((position) => ({
        id: normalizeAssetId(position.asset, position.type, position.tvSymbol),
        label: position.label || position.asset,
        tvSymbol: position.tvSymbol,
        type: position.type || "stock",
        fallbackPrice: "--",
        fallbackChange: "--",
      })),
  ]), [watchlist, simulationAsset, simulationPositions]);
  const capitalGuideQuestions = useMemo(() => getCapitalGuideQuestions(), []);
  const activeCapitalGuideQuestion = capitalGuideState.active
    ? capitalGuideQuestions[capitalGuideState.stepIndex] || null
    : null;
  const simulationSymbolsKey = [...new Set(simulationTrackedAssets.map((item) => item.id))].sort().join("|");
  const hasActiveLiveSimulationTrade = simulationPositions.some((position) => (position.marketMode || "live") === "live");
  const [raylaUserCount, setRaylaUserCount] = useState(0);
  const [toast, setToast] = useState(null);
  const [showTooltip, setShowTooltip] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tradeView, setTradeView] = useState("recent");
  const [tradeForm, setTradeForm] = useState({
    asset: "", entryPrice: "", size: "", entryTime: "", setup: "", session: "", marketCondition: "", direction: "", result: "", exitPrice: "", exitTime: "",
  });
  const combinedHomeStats = useMemo(() => {
    const uniqueBrokerTradeCount = new Set(
      brokerTradeLog
        .map((trade) => {
          if (!trade?.broker_provider || !trade?.broker_order_id) return null;
          return `${trade.broker_provider}:${trade.broker_order_id}`;
        })
        .filter(Boolean)
    ).size;
    const manualResults = trades.map((trade) => parseTradeResult(trade?.result_r));
    const manualWins = manualResults.filter((result) => result > 0).length;
    const brokerTradesByKey = new Map();

    brokerTradeLog.forEach((trade) => {
      if (!trade?.broker_provider || !trade?.broker_order_id) return;
      brokerTradesByKey.set(`${trade.broker_provider}:${trade.broker_order_id}`, trade);
    });

    const orderedBrokerTrades = [...brokerTradesByKey.values()]
      .filter((trade) => {
        const status = String(trade?.status || "").toLowerCase();
        return trade?.filled_at && (status === "filled" || status === "partially_filled");
      })
      .map((trade) => ({
        ...trade,
        fillPrice: parseBrokerFillPrice(trade),
        qtyValue: Number.parseFloat(trade?.qty ?? 0),
        filledAtValue: new Date(trade.filled_at).getTime(),
      }))
      .filter((trade) => trade.fillPrice != null && Number.isFinite(trade.qtyValue) && trade.qtyValue > 0)
      .sort((a, b) => {
        const timeA = Number.isFinite(a.filledAtValue) ? a.filledAtValue : 0;
        const timeB = Number.isFinite(b.filledAtValue) ? b.filledAtValue : 0;
        return timeA - timeB;
      });

    const lotsBySymbol = new Map();
    const brokerOutcomeValues = [];

    orderedBrokerTrades.forEach((trade) => {
      const symbol = String(trade.symbol || "").toUpperCase();
      const side = String(trade.side || "").toLowerCase();
      if (!symbol || !side) return;

      if (side === "buy") {
        const existingLots = lotsBySymbol.get(symbol) || [];
        existingLots.push({ qty: trade.qtyValue, price: trade.fillPrice });
        lotsBySymbol.set(symbol, existingLots);
        return;
      }

      if (side !== "sell") return;

      const existingLots = lotsBySymbol.get(symbol) || [];
      if (!existingLots.length) return;

      let remainingQty = trade.qtyValue;
      let realizedPnl = 0;
      let matchedQty = 0;

      while (remainingQty > 0 && existingLots.length) {
        const currentLot = existingLots[0];
        const matchedLotQty = Math.min(remainingQty, currentLot.qty);
        realizedPnl += (trade.fillPrice - currentLot.price) * matchedLotQty;
        matchedQty += matchedLotQty;
        currentLot.qty -= matchedLotQty;
        remainingQty -= matchedLotQty;

        if (currentLot.qty <= 0) {
          existingLots.shift();
        }
      }

      if (existingLots.length) lotsBySymbol.set(symbol, existingLots);
      else lotsBySymbol.delete(symbol);

      if (matchedQty > 0 && remainingQty === 0) {
        brokerOutcomeValues.push(realizedPnl);
      }
    });

    const brokerWins = brokerOutcomeValues.filter((value) => value > 0).length;
    const resolvedBrokerTrades = brokerOutcomeValues.length;
    const totalResolvedTrades = trades.length + resolvedBrokerTrades;
    const totalWins = manualWins + brokerWins;

    return {
      totalTrackedTradeCount: trades.length + uniqueBrokerTradeCount,
      combinedResolvedTradeCount: totalResolvedTrades,
      totalWins,
      winRate: totalResolvedTrades ? (totalWins / totalResolvedTrades) * 100 : 0,
      // R-based metrics stay journal-only for now. Broker logs do not include
      // enough information to convert executions into risk-unit performance.
      journalWins: manualResults.filter((value) => value > 0),
      journalLosses: manualResults.filter((value) => value < 0),
      journalAverageResult: manualResults.length
        ? manualResults.reduce((sum, value) => sum + value, 0) / manualResults.length
        : 0,
      journalTotalR: manualResults.reduce((sum, value) => sum + value, 0),
    };
  }, [brokerTradeLog, trades]);

  useEffect(() => {
    if (!simulationPositions.length) return;
    const interval = setInterval(() => setSimulationNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [simulationPositions]);

  useEffect(() => {
    writeSimulationStorage(SIMULATION_STORAGE_KEYS.tradeHistory, simulationTradeHistory);
  }, [simulationTradeHistory]);

  useEffect(() => {
    writeSimulationStorage(SIMULATION_STORAGE_KEYS.closedTrade, simulationClosedTrade);
  }, [simulationClosedTrade]);

  useEffect(() => {
    writeSimulationStorage(SIMULATION_STORAGE_KEYS.openPosition, simulationPositions);
  }, [simulationPositions]);

  useEffect(() => {
    writeSimulationStorage(SIMULATION_STORAGE_KEYS.balance, simulatedBalance);
  }, [simulatedBalance]);

  useEffect(() => {
    writeSimulationStorage(SIMULATION_STORAGE_KEYS.guidedDraft, guidedSimulationDraft);
  }, [guidedSimulationDraft]);

  useEffect(() => {
    writeSimulationStorage(FIRST_TRADE_ONBOARDING_STORAGE_KEYS.completed, hasCompletedFirstTradeOnboarding);
  }, [hasCompletedFirstTradeOnboarding]);

  useEffect(() => {
    writeSimulationStorage(FIRST_TRADE_ONBOARDING_STORAGE_KEYS.autoStarted, hasAttemptedFirstTradeOnboardingAutoStart);
  }, [hasAttemptedFirstTradeOnboardingAutoStart]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedCompletion = window.localStorage.getItem(FIRST_TRADE_ONBOARDING_STORAGE_KEYS.completed);
    if (storedCompletion != null) return;

    const isTrueFirstVisit = !window.localStorage.getItem("rayla-visited");
    if (!isTrueFirstVisit) return;

    window.localStorage.setItem("rayla-visited", "true");
    setHasCompletedFirstTradeOnboarding(false);
  }, []);

  useEffect(() => {
    if (!simulationTrackedAssets.length) return;

    const pollIntervalMs = simulationMode === "live" && hasActiveLiveSimulationTrade ? 15000 : 30000;

    async function fetchSimulationQuotes() {
      try {
        const symbols = simulationTrackedAssets.map((item) => ({
          symbol: item.id,
          type: item.type || "stock",
        }));
        const { data, error } = await supabase.functions.invoke("market-data", {
          body: { symbols },
        });

        if (error || !data?.ok) return;

        setSimulationQuotes((prev) => {
          const next = { ...prev };
          Object.entries(data.quotes || {}).forEach(([symbol, quote]) => {
            if (quote?.price != null) next[symbol] = quote;
          });
          sessionStorage.setItem("rayla-market-quotes", JSON.stringify(next));
          return next;
        });
      } catch (error) {
        console.error("simulation quote fetch failed:", error);
      }
    }

    fetchSimulationQuotes();
    const interval = setInterval(fetchSimulationQuotes, pollIntervalMs);
    return () => clearInterval(interval);
  }, [simulationSymbolsKey, simulationMode, hasActiveLiveSimulationTrade]);

  useEffect(() => {
    if (simulationMode !== "scenario" || !simulationTrackedAssets.length) return;

    const nextAnchors = {};
    const nextQuotes = {};
    const nextSeries = {};

    simulationTrackedAssets.forEach((asset) => {
      const normalizedAssetId = normalizeAssetId(asset.id, asset.type, asset.tvSymbol);
      const livePrice = getLiveQuoteByAssetId(simulationQuotes, normalizedAssetId, asset.type, asset.tvSymbol)?.price;
      const fallbackPrice = marketItems.find((item) => normalizeAssetId(item.id, item.type, item.tvSymbol) === normalizedAssetId)?.priceValue;
      const basePrice = Number.isFinite(livePrice)
        ? livePrice
        : Number.isFinite(fallbackPrice)
          ? fallbackPrice
          : 100;

      nextAnchors[asset.id] = basePrice;
      nextQuotes[asset.id] = { price: basePrice };
      nextSeries[asset.id] = [];
    });

    setSimulationScenarioAnchors(nextAnchors);
    setSimulationScenarioQuotes(nextQuotes);
    setSimulationScenarioSeries(nextSeries);
    setSimulationScenarioTick(0);
    scenarioPlaybackStartedAtRef.current = null;
    scenarioPlaybackElapsedMsRef.current = 0;
    setSimulationScenarioIsPlaying(false);
    setGuidedScenarioActive(false);
    setGuidedScenarioMessage("");
    setGuidedScenarioMessageStep(0);
  }, [simulationMode, simulationScenarioType, simulationSymbolsKey]);

  function resetScenarioPlayback() {
    if (!simulationTrackedAssets.length) return;

    const nextAnchors = {};
    const nextQuotes = {};
    const nextSeries = {};

    simulationTrackedAssets.forEach((asset) => {
      const normalizedAssetId = normalizeAssetId(asset.id, asset.type, asset.tvSymbol);
      const livePrice = getLiveQuoteByAssetId(simulationQuotes, normalizedAssetId, asset.type, asset.tvSymbol)?.price;
      const fallbackPrice = marketItems.find((item) => normalizeAssetId(item.id, item.type, item.tvSymbol) === normalizedAssetId)?.priceValue;
      const basePrice = Number.isFinite(livePrice)
        ? livePrice
        : Number.isFinite(fallbackPrice)
          ? fallbackPrice
          : 100;

      nextAnchors[asset.id] = basePrice;
      nextQuotes[asset.id] = { price: basePrice };
      nextSeries[asset.id] = [];
    });

    setSimulationScenarioAnchors(nextAnchors);
    setSimulationScenarioQuotes(nextQuotes);
    setSimulationScenarioSeries(nextSeries);
    setSimulationScenarioTick(0);
    scenarioPlaybackStartedAtRef.current = null;
    scenarioPlaybackElapsedMsRef.current = 0;
    setSimulationScenarioIsPlaying(false);
    setGuidedScenarioActive(false);
    setGuidedScenarioMessage("");
    setGuidedScenarioMessageStep(0);
    setPendingGuidedScenarioLaunch(null);
  }

  function startScenarioPlayback() {
    if (simulationScenarioIsPlaying) return;

    pendingScenarioCompletionRef.current = null;
    setSimulationScenarioSeries((prevSeries) => {
      const nextSeries = { ...prevSeries };

      simulationTrackedAssets.forEach((asset) => {
        const existingSeries = prevSeries[asset.id] || [];
        if (existingSeries.length) return;
        const basePrice = simulationScenarioQuotes[asset.id]?.price
          ?? simulationScenarioAnchors[asset.id]
          ?? simulationQuotes[asset.id]?.price
          ?? 100;
        nextSeries[asset.id] = [basePrice];
      });

      return nextSeries;
    });
    if (scenarioPlaybackElapsedMsRef.current === 0) {
      scenarioPlaybackStartedAtRef.current = Date.now();
      scenarioPlaybackElapsedMsRef.current = 0;
    } else {
      scenarioPlaybackStartedAtRef.current = Date.now() - scenarioPlaybackElapsedMsRef.current;
    }

    setSimulationScenarioIsPlaying(true);
  }

  function pauseScenarioPlayback() {
    if (!simulationScenarioIsPlaying) return;

    if (scenarioPlaybackStartedAtRef.current != null) {
      scenarioPlaybackElapsedMsRef.current = Math.max(0, Date.now() - scenarioPlaybackStartedAtRef.current);
      scenarioPlaybackStartedAtRef.current = null;
    }

    setSimulationScenarioIsPlaying(false);
  }

  const scenarioIntervalMs = simulationScenarioNoLimit
    ? getScenarioSpeedInterval(simulationScenarioSpeed)
    : 1000;
  const scenarioDurationMs = (
    parseScenarioDurationValue(simulationScenarioSeconds) * 1000
    + parseScenarioDurationValue(simulationScenarioMinutes) * 60 * 1000
    + parseScenarioDurationValue(simulationScenarioHours) * 60 * 60 * 1000
    + parseScenarioDurationValue(simulationScenarioDays) * 24 * 60 * 60 * 1000
    + parseScenarioDurationValue(simulationScenarioWeeks) * 7 * 24 * 60 * 60 * 1000
    + parseScenarioDurationValue(simulationScenarioMonths) * 30 * 24 * 60 * 60 * 1000
    + parseScenarioDurationValue(simulationScenarioYears) * 365 * 24 * 60 * 60 * 1000
  );
  const scenarioDurationPointCount = simulationScenarioNoLimit
    ? null
    : Math.ceil(scenarioDurationMs / scenarioIntervalMs);
  const scenarioPlaybackDurationMs = getScenarioPlaybackDurationMs(simulationScenarioPlaybackDuration);
  const scenarioPlaybackIntervalMs = simulationScenarioNoLimit
    ? getScenarioSpeedInterval(simulationScenarioSpeed)
    : Math.max(16, Math.round(scenarioPlaybackDurationMs / Math.max(1, scenarioDurationPointCount || 1)));

  function advanceScenarioTick(prevTick) {
    let nextTick = prevTick + 1;

    if (scenarioDurationPointCount != null) {
      if (!scenarioPlaybackStartedAtRef.current) return prevTick;
      const elapsedMs = Math.max(0, Date.now() - scenarioPlaybackStartedAtRef.current);
      const progress = Math.min(1, elapsedMs / Math.max(1, scenarioPlaybackDurationMs));
      nextTick = Math.max(prevTick, Math.min(
        scenarioDurationPointCount,
        Math.round(progress * scenarioDurationPointCount)
      ));

      if (nextTick <= prevTick && progress < 1) {
        return prevTick;
      }
    }

    const boundedExitPrices = {};

    setSimulationScenarioQuotes((prevQuotes) => {
      const nextQuotes = { ...prevQuotes };
      simulationTrackedAssets.forEach((asset) => {
        const currentPrice = prevQuotes[asset.id]?.price ?? simulationScenarioAnchors[asset.id] ?? 100;
        if (simulationScenarioNoLimit) {
          const nextPrice = buildNextScenarioPrice({
            assetId: asset.id,
            currentPrice,
            anchorPrice: simulationScenarioAnchors[asset.id] ?? currentPrice,
            tick: nextTick,
            scenarioType: simulationScenarioType,
          });
          nextQuotes[asset.id] = { price: nextPrice };
          return;
        }

        const bridge = buildScenarioPlaybackBridge({
          assetId: asset.id,
          currentPrice,
          anchorPrice: simulationScenarioAnchors[asset.id] ?? currentPrice,
          fromTick: prevTick,
          toTick: nextTick,
          scenarioType: simulationScenarioType,
        });
        nextQuotes[asset.id] = { price: bridge.nextPrice };
        boundedExitPrices[asset.id] = bridge.nextPrice;
      });
      return nextQuotes;
    });

    setSimulationScenarioSeries((prevSeries) => {
      const nextSeries = { ...prevSeries };
      simulationTrackedAssets.forEach((asset) => {
        const previousSeries = prevSeries[asset.id] || [];
        const currentPrice = previousSeries[previousSeries.length - 1]
          ?? simulationScenarioQuotes[asset.id]?.price
          ?? simulationScenarioAnchors[asset.id]
          ?? 100;
        if (simulationScenarioNoLimit) {
          const nextPrice = buildNextScenarioPrice({
            assetId: asset.id,
            currentPrice,
            anchorPrice: simulationScenarioAnchors[asset.id] ?? currentPrice,
            tick: nextTick,
            scenarioType: simulationScenarioType,
          });
          nextSeries[asset.id] = [...previousSeries, nextPrice];
          return;
        }

        const bridge = buildScenarioPlaybackBridge({
          assetId: asset.id,
          currentPrice,
          anchorPrice: simulationScenarioAnchors[asset.id] ?? currentPrice,
          fromTick: prevTick,
          toTick: nextTick,
          scenarioType: simulationScenarioType,
        });
        nextSeries[asset.id] = [...previousSeries, ...bridge.points];
      });
      return nextSeries;
    });

    if (scenarioDurationPointCount != null && nextTick >= scenarioDurationPointCount) {
      pendingScenarioCompletionRef.current = simulationPositions
        .filter((position) => position.marketMode === "scenario")
        .map((position) => ({
          positionId: position.id,
          exitPrice: boundedExitPrices[position.asset] ?? simulationScenarioQuotes[position.asset]?.price ?? position.entryPrice,
        }));
      scenarioPlaybackStartedAtRef.current = null;
      scenarioPlaybackElapsedMsRef.current = scenarioPlaybackDurationMs;
      setSimulationScenarioIsPlaying(false);
      setGuidedScenarioActive(false);
      setGuidedScenarioMessage("");
      setGuidedScenarioMessageStep(0);
    }

    return nextTick;
  }

  function runScenarioTickOnce() {
    setSimulationScenarioTick((prevTick) => advanceScenarioTick(prevTick));
  }

  useEffect(() => {
    const hasScenarioPositions = simulationPositions.some((position) => position.marketMode === "scenario");
    const isScenarioPlaybackReady = simulationTrackedAssets.every((asset) => (
      simulationScenarioQuotes[asset.id]?.price != null
      && (simulationScenarioSeries[asset.id]?.length || 0) > 0
    ));
    if ((simulationMode !== "scenario" && !hasScenarioPositions) || !simulationTrackedAssets.length) return;
    if (!simulationScenarioIsPlaying) return;
    if (!scenarioPlaybackStartedAtRef.current) return;
    if (!isScenarioPlaybackReady) return;

    const interval = setInterval(() => {
      if (!scenarioPlaybackStartedAtRef.current) return;
      setSimulationScenarioTick((prevTick) => advanceScenarioTick(prevTick));
    }, scenarioPlaybackIntervalMs);

   return () => {
    clearInterval(interval);
  };

  }, [simulationMode, simulationScenarioType, simulationScenarioSpeed, simulationScenarioPlaybackDuration, simulationSymbolsKey, simulationTrackedAssets, simulationScenarioAnchors, simulationScenarioQuotes, simulationScenarioSeries, simulationPositions, simulationScenarioIsPlaying, simulationScenarioNoLimit, scenarioDurationPointCount, scenarioPlaybackDurationMs, scenarioPlaybackIntervalMs]);

  useEffect(() => {
    const pendingCompletion = pendingScenarioCompletionRef.current;
    if (!pendingCompletion?.length) return;

    pendingScenarioCompletionRef.current = null;
    pendingCompletion.forEach((item) => {
      if (Number.isFinite(item.exitPrice)) {
        finalizeSimulationTrade(item.positionId, item.exitPrice, "Scenario Complete");
      }
    });
  }, [simulationScenarioQuotes, simulationPositions]);

  useEffect(() => {
    if (
      !pendingGuidedScenarioLaunch
      || activeTab !== "simulation"
      || simulationMode !== "scenario"
    ) return;

    setGuidedScenarioActive(true);
    setGuidedScenarioMessage(pendingGuidedScenarioLaunch.message);
    setGuidedScenarioMessageStep(0);
    setPendingGuidedScenarioLaunch(null);
  }, [activeTab, pendingGuidedScenarioLaunch, simulationMode]);

  useEffect(() => {
    if (!guidedScenarioActive || activeTab !== "simulation" || simulationMode !== "scenario") return;
    if (!simulationScenarioIsPlaying) return;

    if (guidedScenarioMessageStep === 0) {
      const timer = setTimeout(() => {
        setGuidedScenarioMessage("Notice how this is moving. This matches the type of behavior you said fits you.");
        setGuidedScenarioMessageStep(1);
      }, 4000);
      return () => clearTimeout(timer);
    }

    if (guidedScenarioMessageStep === 1) {
      const timer = setTimeout(() => {
        setGuidedScenarioMessage("If you were trading this, where would you consider entering?");
        setGuidedScenarioMessageStep(2);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [activeTab, guidedScenarioActive, guidedScenarioMessageStep, simulationMode, simulationScenarioIsPlaying]);

  function showToast(message, type = "success") { setToast({ message, type }); setTimeout(() => setToast(null), 3500); }

  async function fetchAlpacaBrokerData({ silent = false } = {}) {
    if (!session) return;

    setAlpacaConnectionLoading(true);
    try {
      const { data: accountData, error: accountError } = await supabase.functions.invoke("alpaca-account", {
        body: {},
      });

      if (accountError) throw accountError;

      if (!accountData?.connected) {
        setAlpacaAccount(null);
        setAlpacaPositions([]);
        return;
      }

      setAlpacaAccount(accountData.account || null);

      const { data: positionsData, error: positionsError } = await supabase.functions.invoke("alpaca-positions", {
        body: {},
      });

      if (positionsError) throw positionsError;

      setAlpacaPositions(Array.isArray(positionsData?.positions) ? positionsData.positions : []);
    } catch (error) {
      setAlpacaAccount(null);
      setAlpacaPositions([]);
      if (!silent) {
        showToast(error?.message || "Could not load Alpaca Paper connection.", "error");
      }
    } finally {
      setAlpacaConnectionLoading(false);
    }
  }

  async function fetchBrokerTradeLog({ sync = false, silent = false } = {}) {
    if (!session) return;

    setBrokerTradeLogLoading(true);
    try {
      if (sync) {
        const { error } = await supabase.functions.invoke("alpaca-orders", { body: {} });
        if (error) throw error;
      }

      const { data, error } = await supabase
        .from("broker_trade_logs")
        .select("*")
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      setBrokerTradeLog(Array.isArray(data) ? data : []);
    } catch (error) {
      if (!silent) {
        showToast(error?.message || "Could not load broker trade log.", "error");
      }
    } finally {
      setBrokerTradeLogLoading(false);
    }
  }

  async function handleConnectAlpaca() {
    try {
      const { data, error } = await supabase.functions.invoke("alpaca-connect-start", {
        body: {},
      });

      if (error) throw error;
      if (!data?.url) throw new Error("Alpaca connect URL was not returned.");

      window.location.assign(data.url);
    } catch (error) {
      showToast(error?.message || "Could not start Alpaca connect.", "error");
    }
  }

  function getOrderEstimatePrice(symbol, limitPrice, matchingPosition) {
    if (Number.isFinite(limitPrice) && limitPrice > 0) return limitPrice;

    const normalizedSymbol = normalizeAssetId(symbol, matchingPosition?.type, matchingPosition?.tvSymbol);
    const liveQuotePrice = getLiveQuoteByAssetId(simulationQuotes, normalizedSymbol, matchingPosition?.type, matchingPosition?.tvSymbol)?.price;
    const watchlistPrice = marketItems.find((item) => normalizeAssetId(item.id, item.type, item.tvSymbol) === normalizedSymbol)?.priceValue;
    const candidates = [
      matchingPosition?.currentPrice,
      liveQuotePrice,
      watchlistPrice,
    ];

    const resolved = candidates.find((value) => Number.isFinite(value) && value > 0);
    return Number.isFinite(resolved) ? resolved : null;
  }

  async function handleSubmitAlpacaOrder(e) {
    e.preventDefault();

    const symbol = String(alpacaOrderForm.symbol || "").trim().toUpperCase();
    const qty = Number(alpacaOrderForm.qty);
    const limitPrice = alpacaOrderForm.type === "limit" ? Number(alpacaOrderForm.limitPrice) : null;

    if (!symbol) {
      showToast("Symbol is required.", "warning");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      showToast("Quantity must be greater than 0.", "warning");
      return;
    }
    if (alpacaOrderForm.type === "limit" && (!Number.isFinite(limitPrice) || limitPrice <= 0)) {
      showToast("Enter a valid limit price.", "warning");
      return;
    }

    const matchingPosition = alpacaPositions.find((position) => position.symbol === symbol) || null;
    const estimatedPrice = getOrderEstimatePrice(symbol, limitPrice, matchingPosition);
    const estimatedValue = Number.isFinite(estimatedPrice) ? estimatedPrice * qty : null;
    const currentQty = Number(matchingPosition?.qty ?? 0);
    const buyingPower = Number(alpacaAccount?.buyingPower ?? 0);
    let insight = `This trade changes your ${symbol} exposure.`;

    if (matchingPosition) {
      if (alpacaOrderForm.side === "buy") {
        insight = matchingPosition.side === "short"
          ? `This trade may reduce or close your current ${symbol} position.`
          : `This trade increases your exposure to ${symbol}.`;
      } else {
        insight = qty >= currentQty && currentQty > 0
          ? `This may close your current ${symbol} position.`
          : `This trade reduces your exposure to ${symbol}.`;
      }
    } else if (alpacaOrderForm.side === "buy") {
      insight = `This trade increases your exposure to ${symbol}.`;
    } else {
      insight = `This trade may open a new ${symbol} short position.`;
    }

    setPendingAlpacaOrderConfirmation({
      symbol,
      side: alpacaOrderForm.side,
      qty,
      type: alpacaOrderForm.type,
      limitPrice: Number.isFinite(limitPrice) ? limitPrice : null,
      timeInForce: "day",
      estimatedPrice,
      estimatedValue,
      insight,
      realityCheck: buildOrderRealityCheck({
        symbol,
        side: alpacaOrderForm.side,
        qty,
        estimatedValue,
        buyingPower,
        position: matchingPosition,
      }),
    });
  }

  async function handleConfirmAlpacaOrder() {
    if (!pendingAlpacaOrderConfirmation) return;

    try {
      setAlpacaOrderSubmitting(true);
      setAlpacaOrderResult(null);

      const payload = {
        symbol: pendingAlpacaOrderConfirmation.symbol,
        side: pendingAlpacaOrderConfirmation.side,
        qty: pendingAlpacaOrderConfirmation.qty,
        type: pendingAlpacaOrderConfirmation.type,
        time_in_force: "day",
        ...(pendingAlpacaOrderConfirmation.type === "limit"
          ? { limit_price: pendingAlpacaOrderConfirmation.limitPrice }
          : {}),
      };

      const { data, error } = await supabase.functions.invoke("alpaca-place-order", {
        body: payload,
      });

      if (error) throw error;
      if (!data?.order) throw new Error("Order was not accepted.");

      setAlpacaOrderResult(data.order);
      showToast(`Paper order submitted for ${data.order.symbol}.`, "success");
      setPendingAlpacaOrderConfirmation(null);
      await fetchAlpacaBrokerData({ silent: true });
      await fetchBrokerTradeLog({ silent: true });
    } catch (error) {
      showToast(error?.message || "Could not place Alpaca paper order.", "error");
    } finally {
      setAlpacaOrderSubmitting(false);
    }
  }

  useEffect(() => {
    const query = String(alpacaOrderForm.symbol || "").trim().toUpperCase();

    if (!alpacaAccount || !query) {
      setAlpacaAssetSearchResults([]);
      setAlpacaAssetSearchLoading(false);
      setAlpacaAssetSearchError("");
      setAlpacaAssetSearchOpen(false);
      return;
    }

    if (!alpacaAssetSearchOpen) {
      setAlpacaAssetSearchLoading(false);
      return;
    }

    let isCancelled = false;
    setAlpacaAssetSearchLoading(true);
    setAlpacaAssetSearchError("");

    const timeout = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("alpaca-assets", {
          body: { query },
        });

        if (isCancelled) return;
        if (error || !data?.ok) {
          setAlpacaAssetSearchResults([]);
          setAlpacaAssetSearchError("Unable to search tradable assets");
          return;
        }

        setAlpacaAssetSearchResults(Array.isArray(data.assets) ? data.assets : []);
        setAlpacaAssetSearchError("");
      } catch {
        if (isCancelled) return;
        setAlpacaAssetSearchResults([]);
        setAlpacaAssetSearchError("Unable to search tradable assets");
      } finally {
        if (!isCancelled) setAlpacaAssetSearchLoading(false);
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [alpacaAccount, alpacaOrderForm.symbol, alpacaAssetSearchOpen]);

  useEffect(() => {
    if (!alpacaAccount) return;

    const visibleSymbols = [
      ...alpacaAssetSearchResults.map((asset) => String(asset.symbol || "").trim().toUpperCase()),
      String(alpacaOrderForm.symbol || "").trim().toUpperCase(),
    ].filter(Boolean);

    if (!visibleSymbols.length) return;

    const uniqueSymbols = [...new Set(visibleSymbols)];
    const missingSymbols = uniqueSymbols.filter((symbol) => (
      !Number.isFinite(getKnownStockQuotePrice(symbol, simulationQuotes, marketItems, alpacaAssetQuotes))
    ));

    if (!missingSymbols.length) return;

    let isCancelled = false;

    async function fetchAlpacaAssetQuotes() {
      try {
        const { data, error } = await supabase.functions.invoke("market-data", {
          body: {
            symbols: missingSymbols.map((symbol) => ({ symbol, type: "stock" })),
          },
        });

        if (isCancelled || error || !data?.ok) return;

        setAlpacaAssetQuotes((prev) => {
          const next = { ...prev };
          Object.entries(data.quotes || {}).forEach(([symbol, quote]) => {
            if (quote?.price != null) next[symbol] = quote;
          });
          return next;
        });
      } catch {
        // Keep the order search usable even if quote lookup fails.
      }
    }

    fetchAlpacaAssetQuotes();

    return () => {
      isCancelled = true;
    };
  }, [alpacaAccount, alpacaAssetSearchResults, alpacaOrderForm.symbol, simulationQuotes, marketItems, alpacaAssetQuotes]);

  useEffect(() => {
    if (activeTab !== "trades" || !alpacaAccount || !tradePanelSymbol || !tradePanelAsset) {
      setTradeMarketChart(null);
      setTradeMarketChartLoading(false);
      return;
    }

    let isCancelled = false;
    setTradeMarketChart((prev) => (prev?.symbol === tradePanelSymbol ? prev : null));
    setTradeMarketChartLoading(true);

    async function fetchTradeMarketChart() {
      try {
        const { data, error } = await supabase.functions.invoke("market-data", {
          body: {
            chartSymbol: tradePanelSymbol,
            chartType: tradePanelAsset.type || "stock",
            chartRange: tradeChartRange,
          },
        });

        if (isCancelled) return;
        if (error || !data?.ok) {
          return;
        }

        const nextChart = data.chart || null;
        console.log("TRADE MINI CHART DATA", {
          chartSymbol: tradePanelSymbol,
          chartType: tradePanelAsset.type || "stock",
          chartRange: tradeChartRange,
          rawChart: nextChart,
          extractedSeries: extractChartCloseSeries(nextChart),
        });
        const nextSeries = extractChartCloseSeries(nextChart);
        if (nextChart && nextSeries.length >= 2) {
          setTradeMarketChart({
            ...nextChart,
            symbol: nextChart.symbol || tradePanelSymbol,
          });
          setTradeChartLastUpdated(new Date());
          return;
        }

        setTradeMarketChart((prev) => (
          prev?.symbol === tradePanelSymbol && extractChartCloseSeries(prev).length >= 2
            ? prev
            : {
                symbol: tradePanelSymbol,
                range: tradeChartRange,
                bars: [],
              }
        ));
      } catch {
        // Keep the last valid real chart for this symbol if we already have one.
      } finally {
        if (!isCancelled) setTradeMarketChartLoading(false);
      }
    }

    fetchTradeMarketChart();

    return () => {
      isCancelled = true;
    };
  }, [activeTab, alpacaAccount, tradePanelSymbol, tradePanelAsset, tradeChartRange, tradeChartRefreshTick]);

  useEffect(() => {
    if (activeTab !== "trades" || tradeChartRange !== "1D") return;
    const interval = setInterval(() => {
      setTradeChartRefreshTick((prev) => prev + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, [activeTab, tradeChartRange]);

  useEffect(() => {
  supabase.auth.getSession().then(({ data }) => {
    setSession(data.session);
    setAuthLoading(false);
  });

  const { data: listener } = supabase.auth.onAuthStateChange((_event, sessionData) => {
    setSession(sessionData);
    setAuthLoading(false);
  });

  return () => {
    listener.subscription.unsubscribe();
  };
}, []);

      useEffect(() => {
        async function loadProfile() {
          const { data: { user } } = await supabase.auth.getUser();

          if (!user) return;

          const { data, error } = await supabase
            .from("profiles")
            .select("user_level")
            .eq("id", user.id)
            .single();

          if (error) {
            console.error("Error loading profile:", error);
            return;
          }

          setProfile(data);
          setUserLevel(data.user_level || "beginner");

          console.log("USER LEVEL:", data.user_level);
        }

        loadProfile();
      }, []);

  useEffect(() => { fetchRaylaUserCount(); }, []);

  useEffect(() => {
    if (!session) {
      setAlpacaAccount(null);
      setAlpacaPositions([]);
      setBrokerTradeLog([]);
      setAlpacaOrderResult(null);
      return;
    }

    const url = new URL(window.location.href);
    const broker = url.searchParams.get("broker");
    const brokerStatus = url.searchParams.get("broker_status");
    const brokerMessage = url.searchParams.get("broker_message");

    if (broker === "alpaca") {
      setActiveTab("home");
      if (brokerStatus === "connected") {
        showToast(brokerMessage || "Connected to Alpaca Paper.", "success");
      } else if (brokerStatus === "error") {
        showToast(brokerMessage || "Alpaca connection failed.", "error");
      }

      url.searchParams.delete("broker");
      url.searchParams.delete("broker_status");
      url.searchParams.delete("broker_message");
      window.history.replaceState({}, "", url.toString());
    }

    fetchAlpacaBrokerData({ silent: true });
    fetchBrokerTradeLog({ silent: true });
  }, [session]);

  useEffect(() => {
    if (hotColdReport !== null) return;
    setIntelLoading(true);
    fetch(DAILY_INTEL_URL)
      .then(r => r.json())
      .then(data => {
        const report = { stockHot: data.stockHot || [], stockCold: data.stockCold || [], cryptoHot: data.cryptoHot || null, cryptoCold: data.cryptoCold || null };
        sessionStorage.setItem("rayla-intel-report", JSON.stringify(report));
        setHotColdReport(report);
        setIntelLoading(false);
      })
      .catch(() => {
        setHotColdReport({ stockHot: [], stockCold: [], cryptoHot: null, cryptoCold: null });
        setIntelLoading(false);
      });
  }, []);

  useEffect(() => {
    if (user) setDisplayName(user.user_metadata?.display_name || user.email?.split("@")[0] || "");
  }, [user]);



  useEffect(() => {
    async function loadUserAndTrades() {
      const { data, error } = await supabase.auth.getUser();
      if (error) { console.error(error); return; }
      const currentUser = data.user;
      setUser(currentUser);
      if (!currentUser) return;
      const { data: tradesData, error: tradesError } = await supabase.from("trades").select("*").eq("user_id", currentUser.id).order("created_at", { ascending: false });
      if (tradesError) { console.error(tradesError); return; }
      setTrades(tradesData);
      if (!localStorage.getItem("rayla-visited")) {
        setShowTutorial(true);
      }
      setEquitySourceLabel("R-based equity from journaled trades only");
    }
    loadUserAndTrades();
  }, [session]);

    const recentTrades = trades.slice(0, 5);
    const isBeginner = userLevel === "beginner";

  const topEdges = Object.values(
    trades.reduce((acc, trade) => {
      const key = `${trade.setup} × ${trade.session}`;
      if (!acc[key]) acc[key] = { name: key, trades: 0, totalR: 0 };
      acc[key].trades += 1;
      acc[key].totalR += parseFloat(trade.result_r || 0);
      return acc;
    }, {})
  ).map((edge) => ({ name: edge.name, trades: edge.trades, avgR: (edge.totalR / edge.trades).toFixed(2) + "R" }))
    .sort((a, b) => parseFloat(b.avgR) - parseFloat(a.avgR)).slice(0, 3);

  const winRate = `${combinedHomeStats.winRate.toFixed(1)}%`;
  const avgR = `${combinedHomeStats.journalAverageResult >= 0 ? "+" : ""}${combinedHomeStats.journalAverageResult.toFixed(2)}R`;
  const totalR = combinedHomeStats.journalTotalR.toFixed(2);
  const avgWin = combinedHomeStats.journalWins.length
    ? `+${(combinedHomeStats.journalWins.reduce((sum, value) => sum + value, 0) / combinedHomeStats.journalWins.length).toFixed(2)}R`
    : "--";
  const avgLoss = combinedHomeStats.journalLosses.length
    ? `-${Math.abs(combinedHomeStats.journalLosses.reduce((sum, value) => sum + value, 0) / combinedHomeStats.journalLosses.length).toFixed(2)}R`
    : "--";

  // The Home equity curve is intentionally journal-only. Broker trade logs do
  // not contain enough risk context to convert executions into a shared R curve.
  const equitySeries = trades.length
    ? trades.map((_, i) => 100 + trades.slice(0, i + 1).reduce((sum, x) => sum + parseFloat(x.result_r || 0), 0))
    : [100, 100];

  const filteredEquitySeries =
    chartRange === "1D" ? equitySeries.slice(-5)
    : chartRange === "1W" ? equitySeries.slice(-10)
    : chartRange === "1M" ? equitySeries.slice(-20)
    : chartRange === "3M" ? equitySeries.slice(-40)
    : equitySeries;

  async function handleAddTrade(e) {
    e.preventDefault();
    if (!user) { showToast("No user loaded.", "error"); return; }
    if (!tradeForm.asset || !tradeForm.entryPrice || !tradeForm.size || !tradeForm.entryTime || !tradeForm.result) { showToast("Fill out required fields.", "warning"); return; }
    const newTrade = {
      user_id: user.id, asset: tradeForm.asset, entry_price: Number(tradeForm.entryPrice),
      entry_size: Number(tradeForm.size), entry_time: tradeForm.entryTime, setup: tradeForm.setup || "",
      session: tradeForm.session || "", direction: tradeForm.direction || "", result_r: Number(tradeForm.result),
      exit_price: tradeForm.exitPrice ? Number(tradeForm.exitPrice) : null, exit_time: tradeForm.exitTime || null,
    };
    const { data, error } = await supabase.from("trades").insert([newTrade]).select().single();
    if (error) { console.error("SAVE ERROR FULL:", error); showToast(error.message, "error"); return; }
    setTrades((prev) => [data, ...prev]);
    setTradeForm({ asset: "", entryPrice: "", size: "", entryTime: "", setup: "", session: "", marketCondition: "", direction: "", result: "", exitPrice: "", exitTime: "" });
    showToast("Trade logged.", "success");
  }

  async function handleUserLevelChange(level) {
        if (!user) {
          showToast("No user loaded.", "error");
          return;
        }

        const { error } = await supabase
          .from("profiles")
          .update({ user_level: level })
          .eq("id", user.id);

        if (error) {
          console.error("USER LEVEL SAVE ERROR:", error);
          showToast("Could not save user level.", "error");
          return;
        }

        setUserLevel(level);
        setProfile((prev) => ({ ...(prev || {}), user_level: level }));
        showToast("User level updated.", "success");
      }

  async function requestRaylaAnswer(question) {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return "Question is required.";

    function buildCapitalGuideUserContext() {
      const simulationProfile = buildSimulationTraderProfile(simulationTradeHistory);
      const loggedCoachReport = buildCoachReport(trades);
      const totalObservedTrades = trades.length + simulationTradeHistory.length;
      const notes = [];

      if (totalObservedTrades < 5) {
        notes.push("I do not have much Rayla history on you yet, so this is based mostly on your answers.");
      } else {
        notes.push("This is partly based on how you have used Rayla so far.");

        if (simulationTradeHistory.length >= 5) {
          notes.push("You have been using simulation consistently, which gives me more behavior data to work with.");
        }

        if (simulationProfile.strongExecutionCount >= Math.ceil(Math.max(1, simulationProfile.totalTrades) * 0.5)) {
          notes.push("Your simulator history suggests you are more comfortable when the plan is structured and clear.");
        } else if (simulationProfile.poorManagementCount >= 2 || simulationProfile.heldLosersTooLongCount >= 2) {
          notes.push("Your simulator history suggests simpler, rules-based approaches may fit better than constant high-speed decision-making.");
        }

        if (loggedCoachReport?.bestCombo) {
          notes.push(`Your logged trades show the clearest results when you stay focused instead of spreading attention too widely.`);
        }

        if (userLevel === "beginner") {
          notes.push("Your current Rayla level is beginner, so I am leaning toward clearer and easier-to-manage directions.");
        }
      }

      return {
        totalObservedTrades,
        simulationProfile,
        loggedCoachReport,
        notes,
        confidenceLine: totalObservedTrades < 5
          ? "The more you simulate and log trades, the more personalized this gets."
          : "Keep simulating and logging trades so Rayla can personalize this more over time.",
      };
    }

    function buildCapitalGuideResponse(answers) {
      const userContext = buildCapitalGuideUserContext();
      const directions = [];
      const {
        timeHorizon,
        riskTolerance,
        goal,
        experience,
        drawdownTolerance,
        managementStyle,
        moneyImportance,
      } = answers;
      const personalizationNote = userContext.notes[0] || "This is based on your answers first.";
      const footerNote = "The more you simulate and log trades, the more personalized this gets.";
      const buildFitList = (items) => items.filter(Boolean).slice(0, 3);
      const formatFitText = (items) => [
        "Fits you because:",
        ...buildFitList(items).map((item) => `• ${item}`),
      ].join("\n");

      directions.push({
        id: timeHorizon === "long" || managementStyle === "mostly passive" ? "steady-long-term-growth" : goal === "income" ? "lower-volatility-income-focus" : "core-diversified-base",
        title: timeHorizon === "long" || managementStyle === "mostly passive" ? "Steady long-term growth" : goal === "income" ? "Lower-volatility income focus" : "Core diversified base",
        body: timeHorizon === "long"
          ? "This direction fits money that can stay invested for years and grow through multiple market cycles."
          : goal === "income"
            ? "This direction fits users who care more about steadier cash generation and lower volatility than chasing the biggest upside."
            : "This direction fits building a stable foundation before taking on more concentrated ideas.",
        fit: formatFitText([
          `your horizon is ${timeHorizon}`,
          `your management style is ${managementStyle}`,
          `the money is ${moneyImportance}`,
        ]),
      });

      if (riskTolerance === "high" || goal === "growth" || moneyImportance === "high-risk / learning capital") {
        directions.push({
          id: "higher-growth-sector-exposure",
          title: "Higher-growth sector exposure",
          body: "This direction leans toward faster-growing parts of the market with higher swings and more upside potential.",
          fit: formatFitText([
            `${goal} is your main goal`,
            `your risk tolerance is ${riskTolerance}`,
            `your drawdown response would be ${drawdownTolerance}`,
          ]),
        });
      } else {
        directions.push({
          id: "balanced-growth-and-stability",
          title: "Balanced growth and stability",
          body: "This direction splits the focus between compounding growth and limiting large drawdowns.",
          fit: formatFitText([
            "you want a middle path between opportunity and stability",
            `your drawdown tolerance sounds more like ${drawdownTolerance}`,
            `your risk tolerance is ${riskTolerance}`,
          ]),
        });
      }

      if (experience === "active trader" || goal === "learning" || moneyImportance === "high-risk / learning capital") {
        directions.push({
          id: "high-volatility-learning-sleeve",
          title: "High-volatility learning sleeve",
          body: "This direction is for a smaller experimental portion of capital used to learn how faster-moving risk behaves.",
          fit: formatFitText([
            `your experience is ${experience}`,
            `your goal is ${goal}`,
            `you described this money as ${moneyImportance}`,
          ]),
        });
      } else if (goal === "income") {
        directions.push({
          id: "cash-flow-oriented-allocation",
          title: "Cash-flow oriented allocation",
          body: "This direction prioritizes consistency and durability over the most aggressive upside.",
          fit: formatFitText([
            "income is your goal",
            `your management style is ${managementStyle}`,
            "your answers do not point to high-volatility learning capital",
          ]),
        });
      } else {
        directions.push({
          id: "measured-upside-allocation",
          title: "Measured upside allocation",
          body: "This direction adds some growth potential without making the whole plan depend on one volatile theme.",
          fit: formatFitText([
            "it matches a gradual step-up in risk",
            "it does not turn the full plan into a speculation bet",
            `your management style is ${managementStyle}`,
          ]),
        });
      }

      setCapitalGuideResult({
        directions: directions.slice(0, 3),
        confidenceLine: footerNote,
      });

      return [
        "Capital Guide summary",
        "",
        personalizationNote,
        "",
        ...directions.slice(0, 3).flatMap((direction) => [
          `${direction.title}`,
          `${direction.body}`,
          `${direction.fit}`,
          "Try in Scenario",
          "",
        ]),
        footerNote,
        "Rayla does not predict markets, and this is guidance rather than financial advice.",
      ].join("\n");
    }

    if (capitalGuideState.active) {
      const currentStep = capitalGuideQuestions[capitalGuideState.stepIndex];
      const parsedAnswer = currentStep?.parse(trimmedQuestion);

      if (!currentStep) {
        setCapitalGuideState({ active: false, stepIndex: 0, answers: {} });
      } else if (!parsedAnswer) {
        return `${currentStep.prompt} Options: ${currentStep.options.join(", ")}.`;
      } else {
        const nextAnswers = {
          ...capitalGuideState.answers,
          [currentStep.key]: parsedAnswer,
        };
        const nextStepIndex = capitalGuideState.stepIndex + 1;

        if (nextStepIndex >= capitalGuideQuestions.length) {
          setCapitalGuideState({ active: false, stepIndex: 0, answers: {} });
          return buildCapitalGuideResponse(nextAnswers);
        }

        setCapitalGuideState({
          active: true,
          stepIndex: nextStepIndex,
          answers: nextAnswers,
        });
        return capitalGuideQuestions[nextStepIndex].prompt;
      }
    }

    if (isCapitalGuideIntent(trimmedQuestion)) {
      setCapitalGuideResult(null);
      setCapitalGuideState({ active: true, stepIndex: 0, answers: {} });
      return capitalGuideQuestions[0].prompt;
    }

    setCapitalGuideResult(null);

    const response = await fetchWithTimeout(
      ASK_RAYLA_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          context: buildAskRaylaContext({
            trades,
            userLevel,
            selectedMarketId,
          }),
        }),
      }
    );

    const data = await response.json();

    if (!response.ok && !data?.answer) {
      throw new Error(data?.error || `Request failed with status ${response.status}`);
    }

    return data?.answer || data?.error || "No response.";
  }

  async function handleAskRaylaQuestion(question, { clearInput = false } = {}) {
    if (!question.trim()) return;

    setIsRaylaLoading(true);
    setRaylaResponse("");

    try {
      const answer = await requestRaylaAnswer(question);
      setRaylaResponse(answer);
      if (clearInput) setAiInput("");
      return answer;
    } catch (error) {
      const message = `API error: ${error?.message || "unknown error"}`;
      setRaylaResponse(message);
      throw error;
    } finally {
      setIsRaylaLoading(false);
    }
  }

  function handleTryCapitalGuideInScenario(direction) {
    if (!direction) return;

    const guidedDirection = direction.id === "cash-flow-oriented-allocation" ? "short" : "long";
    const guidedDraft = {
      source: "capital-guide",
      guided: true,
      status: "active",
      id: crypto.randomUUID(),
      asset: simulationAsset?.id || "SPY",
      label: direction.title,
      tvSymbol: simulationAsset?.tvSymbol || "AMEX:SPY",
      type: simulationAsset?.type || "stock",
      direction: guidedDirection,
      thesis: direction.body,
      createdAt: Date.now(),
    };

    setActiveTab("simulation");
    setSimulationMode("scenario");
    setSimulationScenarioType("realistic");
    setSimulationScenarioTick(0);
    setSimulationAsset({
      id: guidedDraft.asset,
      label: guidedDraft.label,
      tvSymbol: guidedDraft.tvSymbol,
      type: guidedDraft.type,
      fallbackPrice: "--",
      fallbackChange: "--",
    });
    setSimulationSearchQuery(guidedDraft.asset);
    setSimulationSearchResults([]);
    setSimulationDirection(guidedDraft.direction);
    setSimulationUseStopTarget(true);
    setSimulationUseExitPrice(false);
    setSimulationExitMode("price");
    setSimulationStopLoss("");
    setSimulationTakeProfit("");
    setGuidedSimulationDraft(null);
    setActiveGuidedSimulation({
      id: guidedDraft.id,
      asset: guidedDraft.asset,
      label: guidedDraft.label,
      direction: guidedDraft.direction,
      thesis: `${guidedDraft.thesis} This setup reflects the path we just talked about. Watch how price behaves first.`,
      step: "review-controls",
      startedAt: Date.now(),
    });
    setGuidedScenarioActive(false);
    setGuidedScenarioMessage("");
    setGuidedScenarioMessageStep(0);
    setPendingGuidedScenarioLaunch(null);

    if (
      direction.id === "steady-long-term-growth"
      || direction.id === "lower-volatility-income-focus"
      || direction.id === "cash-flow-oriented-allocation"
      || direction.id === "balanced-growth-and-stability"
      || direction.id === "core-diversified-base"
    ) {
      setSimulationScenarioNoLimit(false);
      setSimulationScenarioPlaybackDuration(direction.id === "steady-long-term-growth" ? "30s" : "10s");
      setSimulationScenarioSpeed("1x");
      setSimulationScenarioSeconds("");
      setSimulationScenarioMinutes("");
      setSimulationScenarioHours("");
      setSimulationScenarioDays("");
      setSimulationScenarioWeeks("");
      setSimulationScenarioMonths(direction.id === "balanced-growth-and-stability" ? "6" : direction.id === "core-diversified-base" ? "4" : "3");
      setSimulationScenarioYears(direction.id === "steady-long-term-growth" ? "1" : "");
      setCapitalGuideScenarioIntro("I set this scenario up to reflect a steadier long-term path that fits what you told me. Watch how the structure develops, then decide whether the pace and volatility feel right for you.");
    } else {
      setSimulationScenarioNoLimit(true);
      setSimulationScenarioSpeed(direction.id === "high-volatility-learning-sleeve" ? "500x" : "100x");
      setSimulationScenarioPlaybackDuration("10s");
      setSimulationScenarioSeconds("");
      setSimulationScenarioMinutes("");
      setSimulationScenarioHours("");
      setSimulationScenarioDays("");
      setSimulationScenarioWeeks("");
      setSimulationScenarioMonths("");
      setSimulationScenarioYears("");
      setCapitalGuideScenarioIntro("I set this scenario up to reflect a sharper, faster-moving path that fits the direction you picked. Watch how it behaves, then decide whether this kind of movement matches your comfort level.");
    }
  }

  async function handleScreenshotUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    showToast("Parsing screenshot...", "success");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(",")[1];
        const mimeType = file.type || "image/jpeg";
        const res = await fetch("https://uoxzzhtnzmsolvcykynu.functions.supabase.co/parse-screenshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        });
        const data = await res.json();
        if (!data.ok) { showToast("Parse failed — fill in manually.", "error"); return; }
        const f = data.fields || {};
        setTradeForm({ asset: f.asset || "", entryPrice: f.entryPrice || "", size: f.size || "", entryTime: "", setup: f.setup || "", session: f.session || "", marketCondition: "", direction: f.direction || "", result: f.result?.toString() || "", exitPrice: "", exitTime: "" });
        const missing = data.missing || [];
        showToast(`Prefilled — still need: ${missing.join(", ")}`, "warning");
      } catch { showToast("Could not parse screenshot — fill in manually.", "error"); }
    };
    reader.readAsDataURL(file);
  }

  async function handleDeleteTrade(tradeId) {
    if (!tradeId) return;
    const confirmed = window.confirm("Delete this trade?");
    if (!confirmed) return;
    const { error } = await supabase.from("trades").delete().eq("id", tradeId);
    if (error) { console.error("DELETE ERROR:", error); showToast("Could not delete trade: " + error.message, "error"); return; }
    setTrades((prev) => prev.filter((trade) => trade.id !== tradeId));
  }

  function getSimulationPrice(assetId, preferredMode = simulationMode) {
    const normalizedAssetId = normalizeAssetId(assetId);
    if (preferredMode === "scenario") {
      const scenarioPrice = simulationScenarioQuotes[assetId]?.price ?? simulationScenarioQuotes[normalizedAssetId]?.price;
      if (scenarioPrice != null) return scenarioPrice;
    }
    const livePrice = simulationQuotes[assetId]?.price ?? simulationQuotes[normalizedAssetId]?.price;
    if (livePrice != null) return livePrice;
    const item = marketItems.find((marketItem) => normalizeAssetId(marketItem.id, marketItem.type, marketItem.tvSymbol) === normalizedAssetId);
    return Number.isFinite(item?.priceValue) ? item.priceValue : null;
  }

  function calculateSimulationPnL(position, currentPrice) {
    if (!position || !Number.isFinite(currentPrice)) return { profitLoss: 0, rMultiple: null };
    const priceMove = position.direction === "long"
      ? currentPrice - position.entryPrice
      : position.entryPrice - currentPrice;
    const profitLoss = position.amountMode === "shares"
      ? position.amount * priceMove
      : position.amount * (priceMove / position.entryPrice);
    const rMultiple = position.plannedRisk > 0 ? profitLoss / position.plannedRisk : null;
    return { profitLoss, rMultiple };
  }

  function getSimulationElapsedDuration(position) {
    if (!position?.openedAt) return 0;
    if (
      position.marketMode === "scenario"
      && position.scenarioNoLimit === false
      && Number.isFinite(position.scenarioDurationMs)
      && Number.isFinite(position.scenarioDurationPointCount)
      && position.scenarioDurationPointCount > 0
    ) {
      const progress = Math.min(1, simulationScenarioTick / position.scenarioDurationPointCount);
      return position.scenarioDurationMs * progress;
    }
    if (position.marketMode === "scenario" && position.scenarioNoLimit !== false) {
      return Math.max(0, simulationNow - position.openedAt) * getScenarioSpeedMultiplier(position.scenarioSpeed);
    }
    return Math.max(0, simulationNow - position.openedAt);
  }

  function formatTimeInTrade(position) {
    if (!position?.openedAt) return "--";
    return formatSimulationDuration(getSimulationElapsedDuration(position));
  }

  function formatSimulationDuration(durationMs) {
    const safeDurationMs = Math.max(0, durationMs || 0);
    const units = [
      { label: "y", ms: 365 * 24 * 60 * 60 * 1000 },
      { label: "mo", ms: 30 * 24 * 60 * 60 * 1000 },
      { label: "w", ms: 7 * 24 * 60 * 60 * 1000 },
      { label: "d", ms: 24 * 60 * 60 * 1000 },
      { label: "h", ms: 60 * 60 * 1000 },
      { label: "m", ms: 60 * 1000 },
      { label: "s", ms: 1000 },
    ];

    const parts = [];
    let remaining = safeDurationMs;

    units.forEach((unit) => {
      if (parts.length >= 2) return;
      const amount = Math.floor(remaining / unit.ms);
      if (amount <= 0) return;
      parts.push(`${amount}${unit.label}`);
      remaining -= amount * unit.ms;
    });

    return parts.length ? parts.join(" ") : "0s";
  }

  function buildSimulationTradeSummary(position, profitLoss, rMultiple, durationMs) {
    const durationMinutes = durationMs / 60000;
    const hasRiskPlan = Number.isFinite(rMultiple);
    const isWin = profitLoss > 0;
    const isLoss = profitLoss < 0;
    const tinyWinner = isWin && ((hasRiskPlan && rMultiple < 0.5) || (!hasRiskPlan && durationMinutes < 2));
    const strongWinner = isWin && ((hasRiskPlan && rMultiple >= 1) || (!hasRiskPlan && durationMinutes >= 5));
    const heldTooLongLoss = isLoss && ((hasRiskPlan && rMultiple <= -1 && durationMinutes >= 5) || (!hasRiskPlan && durationMinutes >= 10));

    if (strongWinner) {
      return {
        outcomeLabel: "Good trade",
        coachingInsight: `You stayed patient on that ${position.direction} and let the move pay you. This is the kind of follow-through that good trade management is built on.`,
      };
    }

    if (tinyWinner) {
      return {
        outcomeLabel: "Cut too early",
        coachingInsight: `You finished green, but the reward was light for the time and risk you took. Make sure you are giving winning trades enough room to prove themselves.`,
      };
    }

    if (heldTooLongLoss) {
      return {
        outcomeLabel: "Held too long",
        coachingInsight: `This one stayed open long enough to do real damage without improving. When a trade stops earning the right to stay open, tighter management usually helps.`,
      };
    }

    if (isLoss) {
      return {
        outcomeLabel: "Controlled loss",
        coachingInsight: `Not every setup works, and this one did not. The win here is keeping the loss contained and treating it like a rep instead of a setback.`,
      };
    }

    return {
      outcomeLabel: "Managed trade",
      coachingInsight: `The result was decent, but the bigger win is practicing consistent execution. Clean decisions stack up over time.`,
    };
  }

  function buildSimulationExecutionGrade(position, profitLoss, rMultiple, durationMs, exitReason) {
    const durationMinutes = durationMs / 60000;
    const hasRiskPlan = Number.isFinite(rMultiple);
    const isWin = profitLoss > 0;
    const isLoss = profitLoss < 0;

    if (
      (hasRiskPlan && rMultiple >= 2) ||
      (isWin && exitReason === "Target Hit" && durationMinutes >= 5)
    ) {
      return {
        executionGrade: "A",
        executionGradeLabel: "Strong execution",
      };
    }

    if (
      (hasRiskPlan && rMultiple >= 1) ||
      (isWin && durationMinutes >= 3)
    ) {
      return {
        executionGrade: "B",
        executionGradeLabel: "Solid execution",
      };
    }

    if (
      (hasRiskPlan && rMultiple <= -1 && durationMinutes >= 5) ||
      (isLoss && durationMinutes >= 10 && !hasRiskPlan)
    ) {
      return {
        executionGrade: "D",
        executionGradeLabel: "Poor management",
      };
    }

    return {
      executionGrade: "C",
      executionGradeLabel: "Needs work",
    };
  }

  function buildSimulationNextStep(position, profitLoss, rMultiple, durationMs, exitReason, outcomeLabel, executionGrade) {
    const durationMinutes = durationMs / 60000;
    const hasRiskPlan = Number.isFinite(rMultiple);
    const isWin = profitLoss > 0;
    const isLoss = profitLoss < 0;

    if (executionGrade === "A") {
      return "Next time, focus on repeating this process.";
    }

    if (outcomeLabel === "Cut too early" || (isWin && hasRiskPlan && rMultiple < 0.5)) {
      return "Next time, let strong winners breathe a little longer.";
    }

    if (executionGrade === "D" || outcomeLabel === "Held too long") {
      return "Next time, cut weak trades sooner.";
    }

    if (isLoss && exitReason === "Stopped Out") {
      return "Next time, stay consistent with your risk plan and be ready for the next setup.";
    }

    if (isLoss && durationMinutes >= 5) {
      return "Next time, protect capital faster when the setup weakens.";
    }

    return "Next time, keep managing the trade with the same level of discipline.";
  }

  function buildSimulationTraderProfile(simulationTradeHistory) {
    const trades = Array.isArray(simulationTradeHistory) ? simulationTradeHistory : [];
    const totalTrades = trades.length;
    const wins = trades.filter((trade) => trade.profitLoss > 0);
    const losses = trades.filter((trade) => trade.profitLoss < 0);
    const longTrades = trades.filter((trade) => trade.direction === "long");
    const shortTrades = trades.filter((trade) => trade.direction === "short");
    const longWins = longTrades.filter((trade) => trade.profitLoss > 0);
    const shortWins = shortTrades.filter((trade) => trade.profitLoss > 0);
    const rTrades = trades.filter((trade) => Number.isFinite(trade.rMultiple));

    const assetStats = Object.values(
      trades.reduce((acc, trade) => {
        const asset = String(trade.asset || "Unknown").toUpperCase();
        if (!acc[asset]) {
          acc[asset] = { asset, trades: 0, wins: 0, totalProfitLoss: 0 };
        }
        acc[asset].trades += 1;
        acc[asset].totalProfitLoss += trade.profitLoss || 0;
        if ((trade.profitLoss || 0) > 0) acc[asset].wins += 1;
        return acc;
      }, {})
    ).map((entry) => ({
      ...entry,
      winRate: entry.trades ? (entry.wins / entry.trades) * 100 : 0,
      avgProfitLoss: entry.trades ? entry.totalProfitLoss / entry.trades : 0,
    })).sort((a, b) => {
      if (b.avgProfitLoss !== a.avgProfitLoss) return b.avgProfitLoss - a.avgProfitLoss;
      return b.winRate - a.winRate;
    });

    return {
      totalTrades,
      winRate: totalTrades ? (wins.length / totalTrades) * 100 : 0,
      avgProfitLoss: averageNumber(trades.map((trade) => trade.profitLoss)),
      avgRMultiple: rTrades.length ? averageNumber(rTrades.map((trade) => trade.rMultiple)) : null,
      avgDurationMs: averageNumber(trades.map((trade) => trade.durationMs)),
      longTradeCount: longTrades.length,
      shortTradeCount: shortTrades.length,
      longWinRate: longTrades.length ? (longWins.length / longTrades.length) * 100 : 0,
      shortWinRate: shortTrades.length ? (shortWins.length / shortTrades.length) * 100 : 0,
      averageWinnerDurationMs: wins.length ? averageNumber(wins.map((trade) => trade.durationMs)) : 0,
      averageLoserDurationMs: losses.length ? averageNumber(losses.map((trade) => trade.durationMs)) : 0,
      cutWinnersEarlyCount: trades.filter((trade) => trade.outcomeLabel === "Cut too early").length,
      heldLosersTooLongCount: trades.filter((trade) => trade.outcomeLabel === "Held too long").length,
      strongExecutionCount: trades.filter((trade) => trade.executionGrade === "A" || trade.executionGrade === "B").length,
      poorManagementCount: trades.filter((trade) => trade.executionGrade === "D").length,
      bestAsset: assetStats[0]?.asset || null,
      worstAsset: assetStats[assetStats.length - 1]?.asset || null,
    };
  }

  function buildSimulationSessionInsights(profile) {
    if (!profile || profile.totalTrades < 1) return null;

    const longBias = profile.longTradeCount > profile.shortTradeCount
      ? "You lean long more often than short."
      : profile.shortTradeCount > profile.longTradeCount
        ? "You lean short more often than long."
        : "Your long and short exposure is balanced right now.";

    const directionBias = profile.longTradeCount === 0 && profile.shortTradeCount === 0
      ? "No clear direction bias yet."
      : profile.longWinRate > profile.shortWinRate + 10
        ? "Your long setups are working better than your shorts."
        : profile.shortWinRate > profile.longWinRate + 10
          ? "Your short setups are outperforming your longs right now."
          : longBias;

    const primaryStrength = profile.strongExecutionCount >= Math.ceil(profile.totalTrades * 0.5)
      ? "Execution strength: you are stacking more solid trades than messy ones."
      : profile.winRate >= 55
        ? "Result strength: your simulation win rate is holding up well."
        : profile.bestAsset
          ? `Asset strength: ${profile.bestAsset} has been your cleanest market so far.`
          : "Strength: you are building reps and collecting usable data.";

    const primaryWeakness = profile.cutWinnersEarlyCount >= 2
      ? "Main weakness: you are cutting winners early more often than you should."
      : profile.heldLosersTooLongCount >= 2
        ? "Main weakness: some losing trades are staying open too long."
        : profile.poorManagementCount >= 2
          ? "Main weakness: trade management is slipping when positions go against you."
          : "Main weakness: your edge is still forming, so consistency matters most.";

    const executionPattern = profile.averageLoserDurationMs > profile.averageWinnerDurationMs * 1.25 && profile.averageLoserDurationMs > 0
      ? "Execution pattern: losers are lasting longer than winners, which can drag your session quality down."
      : profile.averageWinnerDurationMs > profile.averageLoserDurationMs * 1.25 && profile.averageWinnerDurationMs > 0
        ? "Execution pattern: your better trades are getting more room to work, which is a healthy sign."
        : "Execution pattern: your hold times are fairly balanced across winners and losers.";

    const marketFitNote = profile.bestAsset && profile.worstAsset && profile.bestAsset !== profile.worstAsset
      ? `Market fit: you are reading ${profile.bestAsset} better than ${profile.worstAsset} right now.`
      : profile.bestAsset
        ? `Market fit: ${profile.bestAsset} is giving you the clearest feedback so far.`
        : "Market fit: keep logging trades so Rayla can spot your best environment.";

    return {
      primaryStrength,
      primaryWeakness,
      directionBias,
      executionPattern,
      marketFitNote,
    };
  }

  function buildSimulationCloseFeedback(position, exitPrice, profitLoss, rMultiple, durationMs) {
    const durationMinutes = durationMs / 60000;
    const hasRiskPlan = Number.isFinite(rMultiple);
    const isWin = profitLoss > 0;
    const isLoss = profitLoss < 0;
    const tinyGain = isWin && hasRiskPlan && rMultiple < 0.25;
    const strongWinner = isWin && hasRiskPlan && rMultiple >= 1.5;
    const heldLongEnough = durationMinutes >= 5;
    const veryQuickTrade = durationMinutes < 2;
    const smallLoss = isLoss && hasRiskPlan && Math.abs(rMultiple) <= 0.25;

    if (strongWinner) {
      return `Strong follow-through on that ${position.direction} in ${position.asset}. You let the move work from ${formatCompactPrice(position.entryPrice)} to ${formatCompactPrice(exitPrice)} and got paid ${rMultiple.toFixed(2)}R for staying with it.`;
    }

    if (isWin && heldLongEnough) {
      return `Good patience here. You gave that ${position.direction} enough time to develop and the exit shows controlled execution instead of rushing the close.`;
    }

    if (tinyGain && veryQuickTrade) {
      return `You locked in a green trade, but it was a very quick exit for a small gain. Make sure you are not cutting winners short before the move has real room to expand.`;
    }

    if (isWin) {
      return `Solid paper trade. You stayed on the right side of the move and closed it with a clean gain instead of letting it drift back on you.`;
    }

    if (smallLoss && veryQuickTrade) {
      return `Good protection. You kept the loss small and got out quickly, which is exactly what disciplined damage control should look like.`;
    }

    if (isLoss) {
      return `Controlled loss. It did not work, but the rep still matters because you respected risk and closed it before the damage got out of hand.`;
    }

    return `Flat result overall. The main win here is practicing clean decision-making around entry, management, and exit.`;
  }

  function buildScenarioCoachingNote(position, exitPrice, exitReason, profitLoss) {
    if ((position.marketMode || "live") !== "scenario" || position.scenarioType !== "realistic") return null;

    const fullSeries = simulationScenarioSeries[position.asset] || [];
    const startIndex = Math.max(0, position.openedScenarioSeriesIndex ?? Math.max(0, fullSeries.length - 1));
    const scenarioPath = fullSeries.slice(startIndex);
    if (!scenarioPath.length || scenarioPath[scenarioPath.length - 1] !== exitPrice) {
      scenarioPath.push(exitPrice);
    }
    if (scenarioPath.length < 2) return null;

    const isLong = position.direction !== "short";
    const deltas = scenarioPath.slice(1).map((price, index) => price - scenarioPath[index]);
    const directionChanges = deltas.reduce((count, delta, index) => {
      if (index === 0) return count;
      const previousSign = Math.sign(deltas[index - 1]);
      const currentSign = Math.sign(delta);
      return previousSign !== 0 && currentSign !== 0 && previousSign !== currentSign ? count + 1 : count;
    }, 0);
    const favorableMoves = scenarioPath.map((price) => (isLong ? price - position.entryPrice : position.entryPrice - price));
    const adverseMoves = scenarioPath.map((price) => (isLong ? position.entryPrice - price : price - position.entryPrice));
    const bestExcursion = Math.max(0, ...favorableMoves);
    const worstExcursion = Math.max(0, ...adverseMoves);
    const netMove = isLong ? exitPrice - position.entryPrice : position.entryPrice - exitPrice;
    const gaveBackMeaningfully = bestExcursion > 0 && (bestExcursion - Math.max(0, netMove)) > bestExcursion * 0.35;
    const feltChoppy = directionChanges >= Math.max(2, Math.floor(deltas.length / 4));
    const strongFollowThrough = bestExcursion > Math.max(worstExcursion * 1.8, position.entryPrice * 0.004);

    if (exitReason.includes("Target") && strongFollowThrough) {
      return "Target was hit during a strong follow-through leg.";
    }
    if (exitReason.includes("Target") && feltChoppy) {
      return "You held through chop and still captured the continuation.";
    }
    if (exitReason.includes("Stop") && feltChoppy && bestExcursion > worstExcursion * 0.6) {
      return "You got shaken out during a pullback after an early push.";
    }
    if (exitReason.includes("Stop")) {
      return "The scenario reversed after momentum faded and tagged your protection.";
    }
    if (exitReason === "Manual Close" && feltChoppy) {
      return "You cut the trade during noise instead of waiting for cleaner confirmation.";
    }
    if (exitReason === "Manual Close" && gaveBackMeaningfully) {
      return "The move lost momentum before exit, and a chunk of the push was given back.";
    }
    if (exitReason === "Scenario Complete" && profitLoss > 0) {
      return "You stayed with the rep through the full scenario and kept the winning side into the close.";
    }

    return null;
  }

  function finalizeSimulationTrade(positionId, exitPrice, exitReason = "Manual Close") {
    const position = simulationPositions.find((item) => item.id === positionId);
    if (!position) return;

    const { profitLoss, rMultiple } = calculateSimulationPnL(position, exitPrice);
    const closedAt = Date.now();
    const durationMs = getSimulationElapsedDuration(position);
    const summary = buildSimulationTradeSummary(
      position,
      profitLoss,
      rMultiple,
      durationMs
    );
    const executionGrade = buildSimulationExecutionGrade(
      position,
      profitLoss,
      rMultiple,
      durationMs,
      exitReason
    );
    const nextStep = buildSimulationNextStep(
      position,
      profitLoss,
      rMultiple,
      durationMs,
      exitReason,
      summary.outcomeLabel,
      executionGrade.executionGrade
    );
    const feedback = buildSimulationCloseFeedback(
      position,
      exitPrice,
      profitLoss,
      rMultiple,
      durationMs
    );
    const scenarioCoachingNote = buildScenarioCoachingNote(
      position,
      exitPrice,
      exitReason,
      profitLoss
    );

    const closedTrade = {
      ...position,
      guided: !!position.guided,
      guidedId: position.guidedId || null,
      closedAt,
      durationMs,
      exitPrice,
      exitReason,
      profitLoss,
      rMultiple,
      outcomeLabel: summary.outcomeLabel,
      executionGrade: executionGrade.executionGrade,
      executionGradeLabel: executionGrade.executionGradeLabel,
      coachingInsight: summary.coachingInsight,
      scenarioCoachingNote,
      nextStep,
      feedback,
    };

    setSimulationClosedTrade(closedTrade);
    setSimulatedBalance((prev) => prev + profitLoss);
    setSimulationTradeHistory((prev) => [closedTrade, ...prev]);
    setSimulationPositions((prev) => prev.filter((item) => item.id !== positionId));
  }

  function handleOpenSimulationTrade() {
    const amount = Number.parseFloat(simulationAmount);
    const entryPrice = selectedSimulationItem ? getSimulationPrice(selectedSimulationItem.id) : null;
    const parsedStopLoss = Number.parseFloat(simulationStopLoss);
    const parsedTakeProfit = Number.parseFloat(simulationTakeProfit);
    const stopLoss = Number.isFinite(parsedStopLoss) ? parsedStopLoss : null;
    const takeProfit = Number.isFinite(parsedTakeProfit) ? parsedTakeProfit : null;

    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid amount to simulate.", "warning");
      return false;
    }

    if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
      showToast("Live price is not available for this asset yet.", "warning");
      return false;
    }

    if (simulationPositions.some((position) => normalizeAssetId(position.asset, position.type, position.tvSymbol) === normalizeAssetId(selectedSimulationItem.id, selectedSimulationItem.type, selectedSimulationItem.tvSymbol))) {
      showToast("You already have an open trade on this asset.", "warning");
      return false;
    }

    if (simulationExitMode === "price") {
      if (stopLoss != null) {
        const stopLossValid = simulationDirection === "long" ? stopLoss < entryPrice : stopLoss > entryPrice;
        if (!stopLossValid) {
          showToast("For longs: stop below entry. For shorts: stop above entry.", "warning");
          return false;
        }
      }

      if (takeProfit != null) {
        const takeProfitValid = simulationDirection === "long" ? takeProfit > entryPrice : takeProfit < entryPrice;
        if (!takeProfitValid) {
          showToast("For longs: target above entry. For shorts: target below entry.", "warning");
          return false;
        }
      }
    } else {
      if (stopLoss != null && stopLoss <= 0) {
        showToast("Enter a positive max loss in dollars.", "warning");
        return false;
      }
      if (takeProfit != null && takeProfit <= 0) {
        showToast("Enter a positive profit target in dollars.", "warning");
        return false;
      }
    }

    const riskPerUnit = simulationExitMode !== "price" || stopLoss == null
      ? null
      : simulationDirection === "long"
        ? entryPrice - stopLoss
        : stopLoss - entryPrice;
    const plannedRisk = simulationExitMode === "pnl"
      ? stopLoss
      : riskPerUnit == null
        ? null
        : simulationAmountMode === "shares"
          ? amount * riskPerUnit
          : amount * (riskPerUnit / entryPrice);

    setSimulationClosedTrade(null);
    setSimulationPositions((prev) => [...prev, {
      id: crypto.randomUUID(),
      asset: selectedSimulationItem.id,
      label: selectedSimulationItem.label,
      tvSymbol: selectedSimulationItem.tvSymbol,
      type: selectedSimulationItem.type,
      marketMode: simulationMode,
      scenarioType: simulationMode === "scenario" ? simulationScenarioType : null,
      scenarioSpeed: simulationMode === "scenario" ? simulationScenarioSpeed : null,
      openedScenarioTick: simulationMode === "scenario" ? simulationScenarioTick : null,
      openedScenarioSeriesIndex: simulationMode === "scenario"
        ? Math.max(0, (simulationScenarioSeries[selectedSimulationItem.id] || []).length - 1)
        : null,
      guided: !!activeGuidedSimulation,
      guidedId: activeGuidedSimulation?.id || null,
      direction: simulationDirection,
      amount,
      amountMode: simulationAmountMode,
      exitMode: simulationExitMode,
      entryPrice,
      stopLoss,
      takeProfit,
      scenarioNoLimit: simulationMode === "scenario" ? simulationScenarioNoLimit : null,
      scenarioDurationMs: simulationMode === "scenario" && !simulationScenarioNoLimit ? scenarioDurationMs : null,
      scenarioDurationPointCount: simulationMode === "scenario" && !simulationScenarioNoLimit ? scenarioDurationPointCount : null,
      riskPerUnit,
      plannedRisk,
      openedAt: Date.now(),
    }]);
    if (activeGuidedSimulation) {
      setActiveGuidedSimulation((prev) => (prev ? { ...prev, step: "position-open" } : prev));
    }
    return true;
  }

  function handleStartScenarioRep() {
    if (simulationScenarioIsPlaying) {
      pauseScenarioPlayback();
      return;
    }

    const hasScenarioPosition = simulationPositions.some((position) => position.marketMode === "scenario");
    if (!hasScenarioPosition) {
      const opened = handleOpenSimulationTrade();
      if (!opened) return;
    }

    startScenarioPlayback();
  }

  function handleCloseSimulationTrade(positionId) {
    const position = simulationPositions.find((item) => item.id === positionId);
    if (!position) return;

                          const currentPrice = getSimulationPrice(position.asset, position.marketMode || simulationMode);
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      showToast("Current price is not available yet.", "warning");
      return;
    }
    finalizeSimulationTrade(positionId, currentPrice, "Manual Close");
    if (
      position.marketMode === "scenario"
      && !simulationPositions.some((item) => item.id !== positionId && item.marketMode === "scenario")
    ) {
      scenarioPlaybackStartedAtRef.current = null;
      scenarioPlaybackElapsedMsRef.current = 0;
      setSimulationScenarioIsPlaying(false);
    }
  }

  function runAIAnalysis() {
  if (trades.length === 0) { showToast("No trades logged yet.", "warning"); return; }
  if (trades.length === lastAnalyzedCount) { showToast("No new trades since last analysis.", "warning"); return; }
  const r = buildCoachReport(trades);
  if (!r) return;
  setCoachSummary({
    strongestEdge: r.bestCombo ? `${r.bestCombo.setup} on ${r.bestCombo.asset} — ${r.bestCombo.avgR.toFixed(2)}R avg, ${r.bestCombo.winRate.toFixed(0)}% win rate (${r.bestCombo.trades} trades)` : null,
    weakestPattern: r.comboStats.length > 1 ? (() => { const w = r.comboStats[r.comboStats.length - 1]; return `${w.setup} on ${w.asset} — ${w.avgR.toFixed(2)}R avg, ${w.winRate.toFixed(0)}% win rate`; })() : null,
    warning: r.warnings[0] || null,
    nextAction: r.actions[0] || null,
    generatedAt: new Date().toLocaleTimeString(),
  });
  setLastAnalyzedCount(trades.length);
  showToast("Analysis updated.", "success");
}

  async function fetchRaylaUserCount() {
    const { data, error } = await supabase.from("trades").select("user_id");
    if (error) { console.error("Failed to fetch user count:", error); return; }
    const uniqueUsers = new Set((data || []).map((row) => row.user_id).filter(Boolean));
    setRaylaUserCount(uniqueUsers.size);
  }

function buildMarketAsset(rawOrResult) {
  const raw = (typeof rawOrResult === "string" ? rawOrResult : rawOrResult?.symbol || "").trim();
  if (!raw) return null;

  const upper = normalizeAssetId(
    raw,
    typeof rawOrResult === "object" ? rawOrResult?.type : "",
    typeof rawOrResult === "object" ? rawOrResult?.tvSymbol : ""
  );
  const assetType = typeof rawOrResult === "object" ? String(rawOrResult?.type || "").trim().toUpperCase() : "";

  const exchangeMap = {
    SPY: "AMEX:SPY",
    QQQ: "NASDAQ:QQQ",
    DIA: "AMEX:DIA",
    IWM: "AMEX:IWM",
    BTC: "BINANCE:BTCUSDT",
    ETH: "BINANCE:ETHUSDT",
    SOL: "BINANCE:SOLUSDT",
    XRP: "BINANCE:XRPUSDT",
    DOGE: "BINANCE:DOGEUSDT",
    ADA: "BINANCE:ADAUSDT",
    AVAX: "BINANCE:AVAXUSDT",
    LINK: "BINANCE:LINKUSDT",
    NRG: "NYSE:NRG",
    KO: "NYSE:KO",
    DIS: "NYSE:DIS",
    BA: "NYSE:BA",
    JPM: "NYSE:JPM",
    XOM: "NYSE:XOM",
    WMT: "NYSE:WMT",
    NKE: "NYSE:NKE",
    MCD: "NYSE:MCD",
    GS: "NYSE:GS",
  };

  const id = upper;
  const tvSymbol = typeof rawOrResult === "object" && rawOrResult?.tvSymbol
    ? rawOrResult.tvSymbol
    : upper.includes(":")
      ? upper
      : (exchangeMap[upper] || getEquityTvSymbol(upper, typeof rawOrResult === "object" ? rawOrResult?.exchange : "", assetType));
  const isCrypto = CRYPTO_SYMBOL_SET.has(id) || tvSymbol.includes("USDT") || tvSymbol.includes("BINANCE");

  return {
    id,
    label: typeof rawOrResult === "object" ? rawOrResult.description || id : id,
    exchange: typeof rawOrResult === "object" ? rawOrResult.exchange || "" : "",
    tvSymbol,
    type: isCrypto ? "crypto" : "stock",
    fallbackPrice: "--",
    fallbackChange: "--",
  };
}

  function handleAddSymbol(overrideSymbol) {
    
  const raw = (typeof overrideSymbol === "string" ? overrideSymbol : overrideSymbol?.symbol || newSymbol).trim();
  if (!raw) return;

  const nextAsset = buildMarketAsset(overrideSymbol || raw);
  const id = nextAsset.id;
  const tvSymbol = nextAsset.tvSymbol;

  const alreadyExists = watchlist.some(
    (item) => item.id === id || item.tvSymbol === tvSymbol
  );

  if (alreadyExists) {
    showToast("That symbol is already in the watchlist.", "warning");
    return;
  }

  setWatchlist((prev) => [...prev, nextAsset]);

  setSelectedMarketId(id);
  setNewSymbol("");
  showToast(`${id} added.`, "success");
}

  function handleRemoveSymbol(id) {
    const remaining = watchlist.filter((item) => item.id !== id);
    setWatchlist(remaining);
    if (selectedMarketId === id) setSelectedMarketId(remaining[0]?.id || "");
  }

  async function handleSimulationSearchChange(value) {
    setSimulationSearchQuery(value);
    if (simulationAsset && value.trim().toUpperCase() !== simulationAsset.id) {
      setSimulationAsset(null);
    }
    if (simulationSearchTimeoutRef.current) clearTimeout(simulationSearchTimeoutRef.current);
    if (value.length < 1) {
      setSimulationSearchResults([]);
      return;
    }
    simulationSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchRaylaSupportedAssets(value, Boolean(alpacaAccount));
        setSimulationSearchResults(results);
      } catch {
        setSimulationSearchResults([]);
      }
    }, 120);
  }

  function handleSelectSimulationAsset(result) {
    const nextAsset = buildMarketAsset(result);
    if (!nextAsset) return;
    setSimulationAsset(nextAsset);
    setSimulationSearchQuery(nextAsset.id);
    setSimulationSearchResults([]);
  }

  function startGuidedSimulation(draft) {
    if (!draft) return;
    setActiveGuidedSimulation({
      id: draft.id,
      asset: draft.asset,
      label: draft.label,
      direction: draft.direction,
      thesis: draft.thesis || "",
      step: "review-controls",
      startedAt: Date.now(),
    });
    setGuidedSimulationDraft(null);
  }

  function handleTryIntelInSimulation(item) {
    if (!item?.symbol) return;

    const resolvedTvSymbol = item.tvSymbol || buildMarketAsset(item.symbol)?.tvSymbol;
    const nextAsset = buildMarketAsset({
      symbol: item.symbol,
      description: item.name || item.symbol,
      tvSymbol: resolvedTvSymbol,
    });
    const upperSymbol = String(item.symbol).toUpperCase();
    const draft = {
      source: "market-intel",
      guided: true,
      status: "draft",
      id: crypto.randomUUID(),
      asset: upperSymbol,
      label: item.name || item.symbol,
      tvSymbol: resolvedTvSymbol,
      type: CRYPTO_SYMBOL_SET.has(upperSymbol) ? "crypto" : "stock",
      direction: item.score < 0 ? "short" : "long",
      thesis: item.summary || "",
      createdAt: Date.now(),
    };
    if (nextAsset) {
      setSimulationAsset(nextAsset);
    }
    setSimulationSearchQuery(upperSymbol);
    setSimulationSearchResults([]);
    setSimulationDirection(draft.direction);
    setSelectedSimulationInfoKey(null);
    setIsSimulationTutorialOpen(false);
    setActiveTab("simulation");

    if (simulationPositions.some((position) => normalizeAssetId(position.asset, position.type, position.tvSymbol) === normalizeAssetId(upperSymbol))) {
      setGuidedSimulationDraft(null);
      showToast("You already have an open trade on this asset.", "warning");
      return;
    }

    if (
      activeGuidedSimulation &&
      activeGuidedSimulation.asset !== upperSymbol &&
      activeGuidedSimulation.step !== "trade-closed"
    ) {
      setGuidedSimulationDraft(null);
      showToast("Finish the current guided trade before starting another.", "warning");
      return;
    }

    setGuidedSimulationDraft(draft);
  }

  useEffect(() => {
    if (!guidedSimulationDraft) return;

    const nextAsset = buildMarketAsset({
      symbol: guidedSimulationDraft.asset,
      description: guidedSimulationDraft.label || guidedSimulationDraft.asset,
      tvSymbol: guidedSimulationDraft.tvSymbol,
    });

    if (nextAsset) {
      setSimulationAsset(nextAsset);
    }
    setSimulationSearchQuery(guidedSimulationDraft.asset || "");
    setSimulationDirection(guidedSimulationDraft.direction || "long");
  }, [guidedSimulationDraft]);

  useEffect(() => {
    if (
      !activeGuidedSimulation ||
      simulationPositions.some((position) => position.guidedId === activeGuidedSimulation.id) ||
      activeGuidedSimulation.step === "position-open" ||
      activeGuidedSimulation.step === "trade-closed"
    ) {
      return;
    }

    const isReadyToOpen = Boolean(simulationAmount && simulationStopLoss && simulationTakeProfit);
    const nextStep = isReadyToOpen ? "ready-to-open" : "review-controls";
    if (activeGuidedSimulation.step !== nextStep) {
      setActiveGuidedSimulation((prev) => (prev ? { ...prev, step: nextStep } : prev));
    }
  }, [activeGuidedSimulation, simulationAmount, simulationStopLoss, simulationTakeProfit, simulationPositions]);

  const isActiveGuidedTradeClosed =
    !!simulationClosedTrade &&
    !!activeGuidedSimulation &&
    simulationClosedTrade.guided &&
    simulationClosedTrade.guidedId &&
    simulationClosedTrade.guidedId === activeGuidedSimulation.id;

  useEffect(() => {
    if (!isActiveGuidedTradeClosed || activeGuidedSimulation?.step === "trade-closed") return;
    setActiveGuidedSimulation((prev) => (prev ? { ...prev, step: "trade-closed" } : prev));
  }, [isActiveGuidedTradeClosed, activeGuidedSimulation]);

  const guidedSimulationTips = [];
  if (activeGuidedSimulation) {
    if (!simulationAmount) {
      guidedSimulationTips.push("Enter how much you want to simulate before opening the trade.");
    }
    if (simulationMode === "scenario" && !simulationScenarioNoLimit && scenarioDurationMs <= 0) {
      guidedSimulationTips.push("Set a scenario duration if you want a bounded rep that ends naturally when the full move is complete.");
    }
    if (simulationMode === "scenario" && simulationScenarioNoLimit) {
      guidedSimulationTips.push("No Limit keeps the scenario running continuously. Speed controls how fast simulated time passes in the chart.");
    }
    if (!simulationStopLoss) {
      guidedSimulationTips.push(simulationExitMode === "pnl" ? "Add a max loss so the simulator knows where the downside ends." : "Add a stop loss so Rayla can measure your risk.");
    }
    if (!simulationTakeProfit) {
      guidedSimulationTips.push(simulationExitMode === "pnl" ? "Add a profit target if you want the rep to auto-pay you once that dollar goal is reached." : "Add a take profit so you define where you want to get paid.");
    }
    if (simulationStopLoss && simulationTakeProfit) {
      guidedSimulationTips.push("Good — you now have a defined risk plan.");
    }
    if (simulationMode === "scenario") {
      guidedSimulationTips.push(
        simulationScenarioType === "realistic"
          ? "Realistic mode mixes trend pushes, pullbacks, chop, and fakeouts. It is the best place to review detailed AI scenario coaching afterward."
          : simulationScenarioType === "range"
            ? "Range mode rotates around a center, so practice waiting for confirmation instead of forcing trend assumptions."
            : simulationScenarioType === "downtrend"
              ? "Downtrend mode adds downward pressure with bounce attempts, so short ideas should respect failed bounce structure."
              : "Uptrend mode adds upward pressure with pullbacks, so long ideas should respect higher-low structure."
      );
      guidedSimulationTips.push("The Scenario chart starts at the fixed Now anchor and projects forward to the right as the rep plays out.");
      guidedSimulationTips.push("Use Play to start the rep, Pause to freeze it, and Resume to continue from the same scenario state.");
    } else {
      guidedSimulationTips.push(
        simulationExitMode === "pnl"
          ? "P/L mode uses dollar thresholds: max loss to stop out, profit target to get paid."
          : activeGuidedSimulation.direction === "short"
            ? "You are planning a short trade, so your stop should usually be above entry and target below."
            : "You are planning a long trade, so your stop should usually be below entry and target above."
      );
      guidedSimulationTips.push("The live chart shows the current market. Watch how price behaves after entry, then compare the rep to the plan you entered.");
    }
    if (simulationMode === "scenario") {
      guidedSimulationTips.push("Scenario mode uses generated training movement, so focus on practicing clean execution instead of reacting to live market noise.");
    } else {
      guidedSimulationTips.push("Open trades, trade summary, and Session Coach help you review execution quality, not just whether the rep won or lost.");
    }
  }

  const selectedSimulationItem = simulationAsset || marketItems.find((item) => item.id === selectedMarketId) || marketItems[0];
  const previousSelectedSimulationAssetIdRef = useRef(simulationAsset?.id || null);
  const selectedSimulationPrice = selectedSimulationItem ? getSimulationPrice(selectedSimulationItem.id) : null;
  const simulationLiveChartBars = extractChartBars(simulationLiveChart);
  const selectedScenarioSeries = selectedSimulationItem
    ? simulationScenarioSeries[selectedSimulationItem.id] || []
    : [];

  useEffect(() => {
    if (simulationMode !== "live" || !selectedSimulationItem) {
      setSimulationLiveChart(null);
      setSimulationLiveChartLoading(false);
      return;
    }

    let isCancelled = false;
    setSimulationLiveChart((prev) => (prev?.symbol === selectedSimulationItem.id ? prev : null));
    setSimulationLiveChartLoading(true);

    async function fetchSimulationLiveChart() {
      try {
        const { data, error } = await supabase.functions.invoke("market-data", {
          body: {
            chartSymbol: selectedSimulationItem.id,
            chartType: selectedSimulationItem.type || "stock",
            chartRange: simulationLiveChartRange,
          },
        });

        if (isCancelled || error || !data?.ok) return;

        const nextChart = data.chart || null;
        const nextBars = extractChartBars(nextChart);
        if (nextChart && nextBars.length >= 2) {
          setSimulationLiveChart({
            ...nextChart,
            symbol: nextChart.symbol || selectedSimulationItem.id,
          });
          setSimulationLiveChartLastUpdated(new Date());
          return;
        }

        setSimulationLiveChart({
          symbol: selectedSimulationItem.id,
          range: simulationLiveChartRange,
          bars: [],
        });
      } catch {
        // Keep the current live simulation chart stable if the latest fetch fails.
      } finally {
        if (!isCancelled) setSimulationLiveChartLoading(false);
      }
    }

    fetchSimulationLiveChart();

    return () => {
      isCancelled = true;
    };
  }, [simulationMode, selectedSimulationItem?.id, selectedSimulationItem?.type, simulationLiveChartRange, simulationLiveChartRefreshTick]);

  useEffect(() => {
    if (simulationMode !== "live" || !selectedSimulationItem || simulationLiveChartRange !== "1D") return;
    const interval = setInterval(() => {
      setSimulationLiveChartRefreshTick((prev) => prev + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, [simulationMode, selectedSimulationItem?.id, simulationLiveChartRange]);

  const scenarioHistoryCount = 12;
  const scenarioNowX = 14;
  const scenarioFutureXEnd = 96;

  const visibleScenarioChartSeries = selectedScenarioSeries;
  const scenarioChartSlotCount = simulationScenarioNoLimit
    ? Math.max(24, visibleScenarioChartSeries.length + 12)
    : Math.max(1, scenarioDurationPointCount || visibleScenarioChartSeries.length || 1);
  const boundedScenarioProgress = !simulationScenarioNoLimit && scenarioDurationPointCount
    ? Math.min(1, simulationScenarioTick / Math.max(1, scenarioDurationPointCount))
    : null;
  const scenarioChartXRatios = !simulationScenarioNoLimit && boundedScenarioProgress != null
    ? visibleScenarioChartSeries.map((_, index) => {
        if (visibleScenarioChartSeries.length <= 1) return 0;
        return boundedScenarioProgress * (index / (visibleScenarioChartSeries.length - 1));
      })
    : null;

  const scenarioChartPoints = visibleScenarioChartSeries.length >= 2
    ? buildSvgLinePoints(
        visibleScenarioChartSeries,
        simulationScenarioZoom,
        Math.max(1, scenarioChartSlotCount),
        scenarioNowX,
        scenarioFutureXEnd,
        scenarioChartXRatios
      )
    : "";

  const scenarioChartRecentPoints = visibleScenarioChartSeries.length >= 2
    ? visibleScenarioChartSeries
        .map((_, index) => index)
        .slice(-18)
        .map((index) => {
          const point = buildSvgPointCoords(
            visibleScenarioChartSeries,
            index,
            simulationScenarioZoom,
            Math.max(1, scenarioChartSlotCount),
            scenarioNowX,
            scenarioFutureXEnd,
            scenarioChartXRatios
          );
          return `${point.x},${point.y}`;
        })
        .join(" ")
    : "";

  const scenarioChartCurrentPoint = visibleScenarioChartSeries.length >= 2
    ? buildSvgPointCoords(
        visibleScenarioChartSeries,
        visibleScenarioChartSeries.length - 1,
        simulationScenarioZoom,
        Math.max(1, scenarioChartSlotCount),
        scenarioNowX,
        scenarioFutureXEnd,
        scenarioChartXRatios
      )
    : visibleScenarioChartSeries.length === 1
      ? { x: scenarioNowX, y: getScenarioAnchorY(simulationScenarioType) }
    : null;
  const scenarioChartPulseRadius = 1.7 + ((simulationScenarioTick % 6) / 10);
  const visibleNoLimitScenarioDurationMs = simulationScenarioNoLimit
    ? Math.max(0, visibleScenarioChartSeries.length - 1) * scenarioIntervalMs * getScenarioSpeedMultiplier(simulationScenarioSpeed)
    : 0;
  const scenarioAxisLeftLabel = simulationScenarioNoLimit
    ? ""
    : "History";
  const scenarioAxisMidLabel = simulationScenarioNoLimit
    ? "Now"
    : "Now";
  const scenarioAxisRightLabel = simulationScenarioNoLimit
    ? formatSimulationDuration(visibleNoLimitScenarioDurationMs)
    : formatScenarioAxisLabel(scenarioDurationMs, scenarioDurationMs);
  const selectedSimulationOpenPosition = selectedSimulationItem
    ? simulationPositions.find((position) => normalizeAssetId(position.asset, position.type, position.tvSymbol) === normalizeAssetId(selectedSimulationItem.id, selectedSimulationItem.type, selectedSimulationItem.tvSymbol) && (position.marketMode || "live") === simulationMode) || null
    : null;
  const scenarioOverlayData = [
    ...visibleScenarioChartSeries,
    selectedSimulationOpenPosition?.entryPrice,
    selectedSimulationPrice,
    selectedSimulationOpenPosition?.stopLoss,
    selectedSimulationOpenPosition?.takeProfit,
  ].filter((value) => Number.isFinite(value));
  const scenarioChartScale = buildSvgPriceScale(
    scenarioOverlayData.length >= 2 ? scenarioOverlayData : visibleScenarioChartSeries,
    6,
    simulationScenarioZoom
  );
  const scenarioEntryPoint = selectedSimulationOpenPosition
    ? (() => {
        const entryY = clampScenarioChartY(buildSvgValueY(
          scenarioOverlayData.length >= 2 ? scenarioOverlayData : [selectedSimulationOpenPosition.entryPrice, selectedSimulationPrice || selectedSimulationOpenPosition.entryPrice],
          selectedSimulationOpenPosition.entryPrice,
          simulationScenarioZoom
        ));
        if (!selectedSimulationOpenPosition.scenarioNoLimit && selectedSimulationOpenPosition.scenarioDurationPointCount) {
          const entryRatio = Math.max(0, Math.min(1, (selectedSimulationOpenPosition.openedScenarioTick || 0) / selectedSimulationOpenPosition.scenarioDurationPointCount));
          return {
            x: scenarioNowX + ((scenarioFutureXEnd - scenarioNowX) * entryRatio),
            y: entryY,
          };
        }

        const entryIndex = Math.max(0, selectedSimulationOpenPosition.openedScenarioSeriesIndex || 0);
        const entryRatio = entryIndex / Math.max(1, scenarioChartSlotCount - 1);
        return {
          x: scenarioNowX + ((scenarioFutureXEnd - scenarioNowX) * entryRatio),
          y: entryY,
        };
      })()
    : null;
  const scenarioStopY = selectedSimulationOpenPosition?.stopLoss != null
    ? clampScenarioChartY(buildSvgValueY(
        scenarioOverlayData.length >= 2 ? scenarioOverlayData : [selectedSimulationOpenPosition.stopLoss, selectedSimulationOpenPosition.entryPrice],
        selectedSimulationOpenPosition.stopLoss,
        simulationScenarioZoom
      ))
    : null;
  const scenarioTargetY = selectedSimulationOpenPosition?.takeProfit != null
    ? clampScenarioChartY(buildSvgValueY(
        scenarioOverlayData.length >= 2 ? scenarioOverlayData : [selectedSimulationOpenPosition.takeProfit, selectedSimulationOpenPosition.entryPrice],
        selectedSimulationOpenPosition.takeProfit,
        simulationScenarioZoom
      ))
    : null;
  const scenarioEntryLabelY = scenarioEntryPoint
    ? Math.max(12, scenarioEntryPoint.y - 3.4)
    : null;
  const scenarioCurrentLabelY = scenarioChartCurrentPoint
    ? Math.max(12, scenarioChartCurrentPoint.y - 3.4)
    : null;
  const visibleSimulationPositions = useMemo(
    () => simulationPositions.filter((position) => (position.marketMode || "live") === simulationMode),
    [simulationPositions, simulationMode]
  );
  const visibleSimulationTradeHistory = useMemo(
    () => simulationTradeHistory.filter((trade) => (trade.marketMode || "live") === simulationMode),
    [simulationTradeHistory, simulationMode]
  );
  const simulationCoachPosition = selectedSimulationOpenPosition || visibleSimulationPositions[0] || null;
  const simulationCoachPrice = simulationCoachPosition
    ? getSimulationPrice(simulationCoachPosition.asset, simulationCoachPosition.marketMode || simulationMode)
    : null;
  const simulationCoachMetrics = simulationCoachPosition && Number.isFinite(simulationCoachPrice)
    ? calculateSimulationPnL(simulationCoachPosition, simulationCoachPrice)
    : { profitLoss: 0, rMultiple: null };
  const simulationCoachMessage = getSimulationCoachMessage(
    simulationCoachPosition,
    simulationCoachPrice,
    simulationCoachMetrics
  );
  const simulationStatsTradeHistory = useMemo(
    () => simulationTradeHistory.filter((trade) => {
      const marketMode = trade.marketMode || "live";
      if (simulationMode === "live") return marketMode === "live";
      return marketMode === "scenario" && trade.scenarioType === "realistic";
    }),
    [simulationTradeHistory, simulationMode]
  );
  const visibleSimulationClosedTrade = simulationClosedTrade && (simulationClosedTrade.marketMode || "live") === simulationMode
    ? simulationClosedTrade
    : null;
  const simulationModeLabel = simulationMode === "scenario" ? "Scenario" : "Live";
  const simulationHowToTitle = simulationMode === "scenario" ? "How to use Scenario Training" : "How to use Live Simulation";
  const simulationHowToSteps = simulationMode === "scenario"
    ? [
        "1. Search and select the asset you want to train on",
        "2. Choose a Scenario type: Uptrend, Downtrend, Range, or Realistic",
        "3. Decide whether the rep is No Limit or bounded with a total scenario duration",
        "4. In No Limit, speed controls how quickly simulated time moves. In bounded mode, playback time controls how long the full rep takes in real time",
        "5. Choose direction, amount mode, size, and your exit plan before you start",
        "6. Press Play to begin the rep. The chart starts from the fixed Now anchor and projects forward to the right",
        "7. Use the chart overlays and open-trade panel to track entry, current price, and live P/L",
        "8. Review the summary after the trade closes. Detailed AI coaching is available in Realistic mode",
        "9. Use Scenario simulator P/L and Session Coach as Realistic-mode training feedback, then repeat with a new condition",
      ]
    : [
        "1. Search and select an asset you want to simulate live",
        "2. Choose Long or Short, then choose whether size is measured in dollars or shares",
        "3. Build your exit plan with stop loss or max loss, plus an optional take profit or profit target",
        "4. Open the simulated live trade and let the market update the rep in real time",
        "5. Use the live chart to compare price behavior with your original plan",
        "6. Watch the open-trade panel for current price, unrealized P/L, R multiple, and time in trade",
        "7. Close manually or let the simulator auto-close using your stop or target",
        "8. Review the trade summary, Session Coach feedback, and Live simulator P/L stats to understand the rep",
        "9. Use repeated live reps to improve execution, patience, and risk discipline",
      ];
  const simulationAmountPlaceholder = simulationAmountMode === "shares" ? "Shares / units" : "Amount ($)";
  const simulationStopPlaceholder = simulationExitMode === "pnl" ? "Max loss ($)" : "Stop loss price";
  const simulationTargetPlaceholder = simulationExitMode === "pnl" ? "Profit target ($)" : "Take profit price";
  const beginnerSimulationSteps = [
    {
      title: "1. Pick your asset",
      text: simulationMode === "scenario"
        ? "Search the stock or crypto you want to train on. The Scenario chart below will generate a forward-projection training move for that asset."
        : "Search the stock or crypto you want to practice. Once selected, the live simulator chart updates so you can see current market behavior immediately.",
    },
    {
      title: "2. Choose your trade size",
      text: simulationAmountMode === "dollars"
        ? "Dollars means the total cash amount you want to simulate in this trade. Shares means the number of shares or units you want to simulate."
        : "Shares means the number of shares or units you want to simulate. Dollars means the total cash amount you want to commit to the rep.",
    },
    {
      title: "3. Define your risk plan",
      text: simulationExitMode === "price"
        ? "Price mode uses chart levels. Stop loss marks where you are wrong. Take profit marks where you want to get paid if the move works."
        : "P/L mode uses dollar outcomes. Max loss closes the trade if you lose that amount. Profit target closes it when the rep makes that amount.",
    },
    {
      title: simulationMode === "scenario" ? "4. Start and manage the rep" : "4. Read the live rep",
      text: simulationMode === "scenario"
        ? "Use Play to start the scenario. No Limit keeps the tape running, while bounded mode ends naturally after the full selected duration plays out."
        : "Use the live chart and open-trade panel together. They show what price is doing now, how your position is reacting, and whether the trade is still earning the right to stay open.",
    },
    {
      title: simulationMode === "scenario" ? "5. Review the right feedback" : "5. Review the feedback loop",
      text: simulationMode === "scenario"
        ? "Realistic mode adds the most lifelike market behavior and unlocks the detailed AI scenario coaching note after the trade closes."
        : "After the trade closes, use the trade summary, Live simulator P/L, and Session Coach to review execution quality, not just whether the trade won or lost.",
    },
  ];
  const simulationStatsTotalPnL = useMemo(
    () => simulationStatsTradeHistory.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0),
    [simulationStatsTradeHistory]
  );
  const simulationStatsProfile = useMemo(
    () => buildSimulationTraderProfile(simulationStatsTradeHistory),
    [simulationStatsTradeHistory]
  );
  const simulationSessionInsights = useMemo(
    () => buildSimulationSessionInsights(simulationStatsProfile),
    [simulationStatsProfile]
  );


  useEffect(() => {
    const currentAssetId = simulationAsset?.id || null;
    if (previousSelectedSimulationAssetIdRef.current !== currentAssetId) {
      setSimulationStopLoss("");
      setSimulationTakeProfit("");
    }
    previousSelectedSimulationAssetIdRef.current = currentAssetId;
  }, [simulationAsset?.id]);

  const simulationTutorialSteps = useMemo(
    () =>
      SIMULATION_TUTORIAL_SECTIONS.filter((step) => {
        if (step.key === "open-position") return visibleSimulationPositions.length > 0;
        if (step.key === "summary") return !!visibleSimulationClosedTrade;
        return true;
      }),
    [visibleSimulationPositions, visibleSimulationClosedTrade]
  );
  const activeSimulationTutorialConfig = isSimulationTutorialOpen
    ? simulationTutorialSteps[activeSimulationTutorialStep] || simulationTutorialSteps[0] || null
    : null;
  const resolvedActiveSimulationTutorialKey = activeSimulationTutorialConfig?.key === "risk"
    ? "controls"
    : activeSimulationTutorialConfig?.key || null;
  const activeSimulationInfoKey = isSimulationTutorialOpen
    ? resolvedActiveSimulationTutorialKey
    : selectedSimulationInfoKey;
  const [simulationWalkthroughCardStyle, setSimulationWalkthroughCardStyle] = useState({
    top: 18,
    left: null,
    right: 18,
    width: 360,
  });

  useEffect(() => {
    for (const position of simulationPositions) {
      const currentPrice = getSimulationPrice(position.asset, position.marketMode || simulationMode);
      if (!Number.isFinite(currentPrice)) continue;
      const metrics = calculateSimulationPnL(position, currentPrice);

      if (position.exitMode === "pnl") {
        if (position.stopLoss != null && metrics.profitLoss <= -Math.abs(position.stopLoss)) {
          finalizeSimulationTrade(position.id, currentPrice, "P/L Stop Hit");
          return;
        }
        if (position.takeProfit != null && metrics.profitLoss >= position.takeProfit) {
          finalizeSimulationTrade(position.id, currentPrice, "P/L Target Hit");
          return;
        }
        continue;
      }

      if (position.direction === "long") {
        if (position.stopLoss != null && currentPrice <= position.stopLoss) {
          finalizeSimulationTrade(position.id, position.stopLoss, "Stopped Out");
          return;
        }
        if (position.takeProfit != null && currentPrice >= position.takeProfit) {
          finalizeSimulationTrade(position.id, position.takeProfit, "Target Hit");
          return;
        }
        continue;
      }

      if (position.stopLoss != null && currentPrice >= position.stopLoss) {
        finalizeSimulationTrade(position.id, position.stopLoss, "Stopped Out");
        return;
      }
      if (position.takeProfit != null && currentPrice <= position.takeProfit) {
        finalizeSimulationTrade(position.id, position.takeProfit, "Target Hit");
        return;
      }
    }
  }, [simulationPositions, simulationQuotes, simulationScenarioQuotes, simulationMode, marketItems]);

  useEffect(() => {
    if (!isSimulationTutorialOpen) return;
    if (!simulationTutorialSteps.length) {
      setIsSimulationTutorialOpen(false);
      return;
    }
    if (activeSimulationTutorialStep > simulationTutorialSteps.length - 1) {
      setActiveSimulationTutorialStep(simulationTutorialSteps.length - 1);
    }
  }, [isSimulationTutorialOpen, activeSimulationTutorialStep, simulationTutorialSteps]);

  useEffect(() => {
    if (
      activeTab !== "simulation" ||
      showTutorial ||
      isSimulationTutorialOpen ||
      hasCompletedFirstTradeOnboarding !== false ||
      hasAttemptedFirstTradeOnboardingAutoStart
    ) {
      return;
    }

    setHasAttemptedFirstTradeOnboardingAutoStart(true);
    openSimulationWalkthrough();
  }, [
    activeTab,
    showTutorial,
    isSimulationTutorialOpen,
    hasCompletedFirstTradeOnboarding,
    hasAttemptedFirstTradeOnboardingAutoStart,
  ]);

  useEffect(() => {
    if (activeGuidedSimulation && showSimulationHelp) {
      setShowSimulationHelp(false);
    }
  }, [activeGuidedSimulation, showSimulationHelp]);

  function openSimulationWalkthrough() {
    setHasAttemptedFirstTradeOnboardingAutoStart(true);
    setSelectedSimulationInfoKey(null);
    setIsSimulationTutorialOpen(true);
    setActiveSimulationTutorialStep(0);
  }

  function closeSimulationWalkthrough() {
    setIsSimulationTutorialOpen(false);
    setActiveSimulationTutorialStep(0);
  }

  function markFirstTradeOnboardingComplete() {
    setHasCompletedFirstTradeOnboarding(true);
    setHasAttemptedFirstTradeOnboardingAutoStart(true);
  }

  function handleSkipFirstTradeOnboarding() {
    markFirstTradeOnboardingComplete();
    closeSimulationWalkthrough();
  }

  function goToNextSimulationStep() {
    if (activeSimulationTutorialStep >= simulationTutorialSteps.length - 1) {
      markFirstTradeOnboardingComplete();
      closeSimulationWalkthrough();
      return;
    }
    setActiveSimulationTutorialStep((prev) => prev + 1);
  }

  function goToPreviousSimulationStep() {
    setActiveSimulationTutorialStep((prev) => Math.max(0, prev - 1));
  }

  function handleSimulationInfoToggle(key) {
    if (isSimulationTutorialOpen) return;
    setSelectedSimulationInfoKey((prev) => (prev === key ? null : key));
  }

  function getSimulationSectionMeta(key) {
    const baseMeta = SIMULATION_TUTORIAL_SECTIONS.find((section) => section.key === key) || null;
    if (!baseMeta || simulationMode !== "scenario") return baseMeta;

    const scenarioDescriptions = {
      controls: "Use the same trade controls as Live mode, but practice inside generated market behavior instead of live market data.",
      risk: "Your stop loss and take profit still control risk here, but Scenario mode lets you practice the same decisions inside training conditions.",
      account: "This account snapshot still tracks your paper-trading results while you practice scenario-based execution.",
      chart: "This training chart shows generated price movement for the selected scenario type and speed instead of live market data.",
      "open-position": "This panel tracks only your open Scenario trades with unrealized P/L, unrealized R, and the active training price.",
      summary: "After a Scenario trade closes, Rayla still gives you a review so you can learn from the training rep.",
      history: "This history shows only Scenario trades so your training reps stay separate from Live practice.",
    };

    return {
      ...baseMeta,
      description: scenarioDescriptions[key] || baseMeta.description,
    };
  }

  function setSimulationSectionRef(key) {
    return (node) => {
      if (node) simulationSectionRefs.current[key] = node;
      else delete simulationSectionRefs.current[key];
    };
  }

  function getSimulationSectionStyle(key, baseStyle = {}) {
    const isHighlighted = activeSimulationInfoKey === key;
    return {
      ...baseStyle,
      position: "relative",
      zIndex: isHighlighted ? 2 : 0,
      boxShadow: isHighlighted ? "0 0 0 2px rgba(124,196,255,0.22)" : baseStyle.boxShadow,
      border: isHighlighted
        ? "1px solid rgba(124,196,255,0.35)"
        : baseStyle.border,
      transition: "box-shadow 160ms ease, border-color 160ms ease",
    };
  }

  function renderSimulationInfoButton(key, label = "What is this?") {
    return (
      <button
        type="button"
        className="ghostButton"
        onClick={(e) => {
          e.stopPropagation();
          handleSimulationInfoToggle(key);
        }}
        style={{ padding: "6px 10px", fontSize: 12, opacity: activeSimulationInfoKey === key ? 1 : 0.8 }}
      >
        {label}
      </button>
    );
  }

  function renderSimulationInfoCard(key) {
    const meta = getSimulationSectionMeta(key);
    if (!meta || activeSimulationInfoKey !== key || isSimulationTutorialOpen) return null;

    return (
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          marginTop: 12,
          padding: 14,
          borderRadius: 14,
          background: "rgba(11,16,23,0.96)",
          border: "1px solid rgba(124,196,255,0.24)",
          boxShadow: "0 12px 32px rgba(0,0,0,0.24)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>
          {meta.title}
        </div>
        <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
          {meta.description}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="ghostButton"
            onClick={() => setSelectedSimulationInfoKey(null)}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  function renderSimulationWalkthroughCard() {
    if (!isSimulationTutorialOpen || !activeSimulationTutorialConfig) return null;

    const isLastStep = activeSimulationTutorialStep >= simulationTutorialSteps.length - 1;

    return (
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: simulationWalkthroughCardStyle.top,
          left: simulationWalkthroughCardStyle.left,
          right: simulationWalkthroughCardStyle.right,
          width: simulationWalkthroughCardStyle.width,
          maxWidth: "calc(100% - 24px)",
          padding: 14,
          borderRadius: 14,
          background: "rgba(11,16,23,0.96)",
          border: "1px solid rgba(124,196,255,0.24)",
          boxShadow: "0 12px 32px rgba(0,0,0,0.24)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 3,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7CC4FF" }}>
          Step {activeSimulationTutorialStep + 1} of {simulationTutorialSteps.length}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>
          {activeSimulationTutorialConfig.title}
        </div>
        <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
          {activeSimulationTutorialConfig.description}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="ghostButton"
            onClick={handleSkipFirstTradeOnboarding}
          >
            Skip
          </button>
          <button
            type="button"
            className="ghostButton"
            onClick={goToPreviousSimulationStep}
            disabled={activeSimulationTutorialStep === 0}
            style={activeSimulationTutorialStep === 0 ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          >
            Back
          </button>
          <button
            type="button"
            className="ghostButton"
            onClick={goToNextSimulationStep}
          >
            {isLastStep ? "Done" : "Next"}
          </button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!isSimulationTutorialOpen || !resolvedActiveSimulationTutorialKey) return;

    const targetNode = simulationSectionRefs.current[resolvedActiveSimulationTutorialKey];
    if (!targetNode) return;

    const frameId = window.requestAnimationFrame(() => {
      targetNode.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isSimulationTutorialOpen, resolvedActiveSimulationTutorialKey]);

  useEffect(() => {
    if (!isSimulationTutorialOpen || !resolvedActiveSimulationTutorialKey) return;

    function updateSimulationWalkthroughCardPosition() {
      const targetNode = simulationSectionRefs.current[resolvedActiveSimulationTutorialKey];
      const containerNode = simulationTutorialContainerRef.current;
      if (!targetNode || !containerNode || typeof window === "undefined") return;

      const targetRect = targetNode.getBoundingClientRect();
      const containerRect = containerNode.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const horizontalPadding = 18;
      const verticalGap = 14;
      const desiredWidth = window.innerWidth < 768
        ? Math.min(340, containerRect.width - 24)
        : 360;
      const cardWidth = Math.max(260, desiredWidth);
      const availableRight = containerRect.right - targetRect.right - horizontalPadding;
      const availableLeft = targetRect.left - containerRect.left - horizontalPadding;

      let nextTop = 18;
      let nextLeft = null;
      let nextRight = 18;

      if (window.innerWidth >= 1024 && availableRight >= cardWidth) {
        nextTop = Math.max(18, targetRect.top - containerRect.top);
        nextLeft = targetRect.right - containerRect.left + horizontalPadding;
        nextRight = null;
      } else if (window.innerWidth >= 1024 && availableLeft >= cardWidth) {
        nextTop = Math.max(18, targetRect.top - containerRect.top);
        nextLeft = Math.max(horizontalPadding, targetRect.left - containerRect.left - cardWidth - horizontalPadding);
        nextRight = null;
      } else {
        const spaceBelow = viewportHeight - targetRect.bottom;
        const spaceAbove = targetRect.top;
        const placeAbove = spaceAbove > spaceBelow && spaceAbove > 260;
        nextTop = placeAbove
          ? Math.max(18, targetRect.top - containerRect.top - 220 - verticalGap)
          : Math.max(18, targetRect.bottom - containerRect.top + verticalGap);
        nextLeft = Math.min(
          Math.max(horizontalPadding, targetRect.left - containerRect.left),
          Math.max(horizontalPadding, containerRect.width - cardWidth - horizontalPadding)
        );
        nextRight = null;
      }

      setSimulationWalkthroughCardStyle({
        top: nextTop,
        left: nextLeft,
        right: nextRight,
        width: cardWidth,
      });
    }

    updateSimulationWalkthroughCardPosition();
    window.addEventListener("resize", updateSimulationWalkthroughCardPosition);
    window.addEventListener("scroll", updateSimulationWalkthroughCardPosition, { passive: true });

    return () => {
      window.removeEventListener("resize", updateSimulationWalkthroughCardPosition);
      window.removeEventListener("scroll", updateSimulationWalkthroughCardPosition);
    };
  }, [isSimulationTutorialOpen, resolvedActiveSimulationTutorialKey]);

  

if (!session) return <Login onLogin={() => setShowSplash(false)} />;

async function handleDeleteAccount() {
  const confirmDelete = window.confirm(
    "Are you sure you want to delete your account? This will permanently delete all your data and cannot be undone."
  );

  if (!confirmDelete) return;

  try {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    const accessToken = currentSession?.access_token;
    if (!accessToken) {
      throw new Error("No active session found.");
    }

    const { data, error } = await supabase.functions.invoke("delete-account", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log("[delete-account] invoke_result", {
      invokeError: error?.message || null,
      data,
    });

    if (error) {
      throw new Error(error.message || "Delete account failed.");
    }

    if (!data?.ok) {
      const detailSuffix = data?.details ? ` (${data.details})` : "";
      throw new Error(`Delete account failed [${data?.stage || "unknown"}]: ${data?.error || "Unknown error"}${detailSuffix}`);
    }

    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) {
      console.error("[delete-account] local_sign_out_failed_after_success", signOutError.message || signOutError);
    }

    setSession(null);
    setUser(null);
    setProfile(null);
    setTrades([]);
    setHotColdReport(null);
    setRaylaResponse("");
    localStorage.removeItem("rayla_sim_trade_history");
    localStorage.removeItem("rayla_sim_closed_trade");
    localStorage.removeItem("rayla_sim_open_position");
    localStorage.removeItem("rayla_sim_balance");
    sessionStorage.removeItem("rayla-intel-report");
    showToast(data?.message || "Account deleted successfully.", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete account failed.";
    console.error("[delete-account] frontend_failure", error);
    showToast(message, "error");
  }
}

return (

  
  
    <div className="appShell">
      {showTutorial && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#0b1017" }}>
          <Tutorial onDone={() => { localStorage.setItem("rayla-visited", "true"); setShowTutorial(false); }} />
        </div>
      )}

              {showBeginnerTutorial && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.72)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 9999,
                    padding: 20
                  }}
                  onClick={() => setShowBeginnerTutorial(false)}
                >
                  <div
                    className="card"
                    style={{
                      width: "100%",
                      maxWidth: 760,
                      maxHeight: "85vh",
                      overflowY: "auto",
                      border: "1px solid rgba(255,255,255,0.1)"
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="cardHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h2>
                        {beginnerTutorialView === "menu" && "Beginner Help"}
                        {beginnerTutorialView === "basics" && "Investing & Stock Trading Basics"}
                        {beginnerTutorialView === "app" && "How To Use Beginner Rayla"}
                      </h2>
                      <button
                        type="button"
                        className="ghostButton"
                        onClick={() => setShowBeginnerTutorial(false)}
                      >
                        Close
                      </button>
                    </div>

                    <div className="cardBody">
                      {beginnerTutorialView === "menu" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                          <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.7 }}>
                            What do you want help with?
                          </div>

                          {/* BASICS CARD */}
                          <div
                            onClick={() => {
                              setBeginnerTutorialStep(0);
                              setBeginnerTutorialView("basics");
                            }}
                            style={{
                              padding: 18,
                              borderRadius: 14,
                              background: "rgba(124,196,255,0.08)",
                              border: "1px solid rgba(124,196,255,0.2)",
                              cursor: "pointer"
                            }}
                          >
                            <div style={{ fontSize: 28, marginBottom: 6 }}>📚</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>
                              Learn Investing Basics
                            </div>
                            <div style={{ fontSize: 13, color: "#94a3b8" }}>
                              Quick, simple explanations of trading, stocks, and how everything works.
                            </div>
                          </div>

                          {/* APP CARD */}
                          <div
                            onClick={() => {
                              setBeginnerTutorialStep(0);
                              setBeginnerTutorialView("app");
                            }}
                            style={{
                              padding: 18,
                              borderRadius: 14,
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              cursor: "pointer"
                            }}
                          >
                            <div style={{ fontSize: 28, marginBottom: 6 }}>📱</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>
                              Learn How to Use Rayla
                            </div>
                            <div style={{ fontSize: 13, color: "#94a3b8" }}>
                              Walk through the beginner version of the app step by step.
                            </div>
                          </div>

                        </div>
                      )}

                                      {beginnerTutorialView === "basics" && (
                                <div
                                    key={`${beginnerTutorialView}-${beginnerTutorialStep}`}
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 16,
                                      animation: "fadeSlideIn 0.25s ease"
                                    }}
                                  >           
                                                    <div style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
                              Step {beginnerTutorialStep + 1} of 11
                            </div>
                            <div
                              style={{
                                width: "100%",
                                height: 8,
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.08)",
                                overflow: "hidden"
                              }}
                            >
                              <div
                                style={{
                                  width: `${((beginnerTutorialStep + 1) / 11) * 100}%`,
                                  height: "100%",
                                  background: "#7CC4FF",
                                  borderRadius: 999,
                                  transition: "width 0.25s ease"
                                }}
                              />
                            </div>
                          </div>
                          {beginnerTutorialStep === 0 && (
                            <>
                              <div style={{ fontSize: 40 }}>💰</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>What is Investing?</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                Investing means putting your money into something so it can grow over time.
                              </div>
                            </>
                          )}

                          {beginnerTutorialStep === 1 && (
                            <>
                              <div style={{ fontSize: 40 }}>🏢</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>What is a Stock?</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                A stock means you own a small piece of a company.
                                <br /><br />
                                If the company grows, your money can grow too.
                              </div>
                            </>
                          )}

                          {beginnerTutorialStep === 2 && (
                            <>
                              <div style={{ fontSize: 40 }}>📈</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>What is Trading?</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                Trading is buying and selling more often to make money from price movement.
                              </div>
                            </>
                          )}

                          {beginnerTutorialStep === 3 && (
                            <>
                              <div style={{ fontSize: 40 }}>🎯</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>Win Rate</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                Win rate is the percent of your trades that were winners.
                              </div>
                            </>
                          )}

                          {beginnerTutorialStep === 4 && (
                            <>
                              <div style={{ fontSize: 40 }}>📊</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>Result</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                Result shows how much you made or lost on a trade.
                              </div>
                            </>
                          )}

                          {beginnerTutorialStep === 5 && (
                            <>
                              <div style={{ fontSize: 40 }}>⚠️</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>Risk</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                Risk is how much you could lose if a trade goes wrong.
                              </div>
                            </>
                          )}

                          {beginnerTutorialStep === 6 && (
                            <>
                              <div style={{ fontSize: 40 }}>🧠</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>The Real Goal</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                You do not need to be perfect.
                                <br /><br />
                                Focus on learning, staying consistent, and improving over time.
                              </div>
                            </>
                          )}


                          {beginnerTutorialStep === 7 && (
                            <>
                              <div style={{ fontSize: 40 }}>🔤</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>Tickers & Assets</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                A ticker is the short name for an asset.
                                <br /><br />
                                Examples:
                                <br />
                                AAPL = Apple
                                <br />
                                TSLA = Tesla
                                <br />
                                BTC = Bitcoin
                                <br /><br />
                                These are what you buy and sell.
                              </div>
                            </>
                          )}

                          {beginnerTutorialStep === 8 && (
                            <>
                              <div style={{ fontSize: 40 }}>📈</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>Reading the Market</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                When prices go up → buyers are stronger.
                                <br />
                                When prices go down → sellers are stronger.
                                <br /><br />
                                You’re watching movement and deciding when to enter and exit.
                              </div>
                            </>
                          )}

                          {beginnerTutorialStep === 9 && (
                            <>
                              <div style={{ fontSize: 40 }}>📊</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>Equity Curve</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                Your equity curve shows how your results are changing over time.
                                <br /><br />
                                Up = you're improving  
                                Down = something needs adjusting
                              </div>
                            </>
                          )}

                          {beginnerTutorialStep === 10 && (
                            <>
                              <div style={{ fontSize: 40 }}>🤝</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>You’re Not Alone</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                Rayla is here to answer all of your questions about investing and trading.
                              </div>
                            </>
                          )}

                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                            <button
                              type="button"
                              className="ghostButton"
                              onClick={() => {
                                if (beginnerTutorialStep === 0) {
                                  setBeginnerTutorialView("menu");
                                } else {
                                  setBeginnerTutorialStep(prev => prev - 1);
                                }
                              }}
                            >
                              Back
                            </button>

                            {beginnerTutorialStep < 10 ? (
                              <button
                                type="button"
                                className="ghostButton"
                                onClick={() => setBeginnerTutorialStep(prev => prev + 1)}
                              >
                                Next
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="ghostButton"
                                onClick={() => {
                                  setShowBeginnerTutorial(false);
                                  setActiveTab("ai");
                                }}
                              >
                                Go to Ask Rayla
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {beginnerTutorialView === "app" && (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
        Beginner Rayla Walkthrough
      </div>
      <div
        style={{
          width: "100%",
          height: 8,
          borderRadius: 999,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            width:
              beginnerTutorialStep === 0 ? "25%" :
              beginnerTutorialStep === 1 ? "50%" :
              beginnerTutorialStep === 2 ? "75%" :
              "100%",
            height: "100%",
            background: "#7CC4FF",
            borderRadius: 999,
            transition: "width 0.25s ease"
          }}
        />
      </div>
    </div>

    {beginnerTutorialStep === 0 && (
      <>
        <div style={{ fontSize: 40 }}>🏠</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Your Home Screen</div>
        <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
          This beginner version of Rayla is designed to keep things simple, clean, and easy to follow.
        </div>
      </>
    )}

    {beginnerTutorialStep === 1 && (
      <>
        <div style={{ fontSize: 40 }}>📊</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Your Main Numbers</div>
        <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
          <strong>Trades Taken:</strong> how many trades you have logged.
          <br />
          <strong>Trades Won:</strong> the percent of your trades that were positive.
          <br />
          <strong>Average Result:</strong> how your trades are doing on average.
          <br />
          <strong>Overall Progress:</strong> your total progress across all logged trades.
        </div>
      </>
    )}

    {beginnerTutorialStep === 2 && (
      <>
        <div style={{ fontSize: 40 }}>📈</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Your Tools</div>
        <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
          <strong>Equity Curve:</strong> shows how your results are moving over time.
          <br />
          <strong>Live Market:</strong> lets you quickly watch assets and charts.
          <br />
          <strong>Recent Trades:</strong> helps you track what you’ve been doing.
        </div>
      </>
    )}

    {beginnerTutorialStep === 3 && (
      <>
        <div style={{ fontSize: 40 }}>🚀</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>As You Improve</div>
        <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
          As you get more comfortable, you can switch to Intermediate or Experienced in your profile to unlock more detail.
        </div>
      </>
    )}

    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
      <button
        type="button"
        className="ghostButton"
        onClick={() => {
          if (beginnerTutorialStep === 0) {
            setBeginnerTutorialView("menu");
          } else {
            setBeginnerTutorialStep(prev => prev - 1);
          }
        }}
      >
        Back
      </button>

      {beginnerTutorialStep < 3 ? (
        <button
          type="button"
          className="ghostButton"
          onClick={() => setBeginnerTutorialStep(prev => prev + 1)}
        >
          Next
        </button>
      ) : (
        <button
          type="button"
          className="ghostButton"
          onClick={() => setBeginnerTutorialView("menu")}
        >
          Done
        </button>
      )}
    </div>

  </div>
)}
                    </div>
                  </div>
                </div>
              )}

      <nav className="desktopSidebar">
        <div className="desktopSidebarBrand">Rayla</div>
        <div className={`desktopSidebarTotalR ${parseFloat(totalR) >= 0 ? "positive" : "negative"}`}>
          {parseFloat(totalR) >= 0 ? "+" : ""}{totalR}R
        </div>
        {NAV_TABS.map(tab => (
          <button key={tab.id} className={`desktopSidebarBtn ${activeTab === tab.id ? "active" : ""}`} onClick={() => { setActiveTab(tab.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            {tab.icon}{tab.label}
          </button>
        ))}
        <div className="desktopSidebarSpacer" />
        <div className="desktopSidebarDivider" />
        <button className={`desktopSidebarBtn ${activeTab === "profile" ? "active" : ""}`} onClick={() => { setActiveTab("profile"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
          <User size={18} />Profile
        </button>
      </nav>

      <div className="appShellInner">
        <div className="topbar">
          <div>
            <p className="eyebrow">Rayla</p>
            <div className={`portfolioValue ${parseFloat(totalR) >= 0 ? "positive" : "negative"}`}>
              {parseFloat(totalR) >= 0 ? "+" : ""}{totalR}R
            </div>
            <p className="subheading">Total Performance</p>
          </div>
        </div>

        {activeTab === "home" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 12, marginBottom: 18 }}>
                            {(isBeginner
                ? [
                    { label: "Trades Taken", value: combinedHomeStats.totalTrackedTradeCount },
                    {
                    label: "Trades Won",
                    value: winRate,
                    tone:
                      combinedHomeStats.winRate >= 50
                        ? "positive"
                        : "negative",
                    tooltipKey: "winrate"
                  },
                    {
                      label: "Average Result",
                      value: avgR,
                      tone:
                        combinedHomeStats.journalAverageResult >= 0
                          ? "positive"
                          : "negative",
                      tooltipKey: "avgres"
                    },
                    {
                      label: "Overall Progress",
                      value: `${parseFloat(totalR) >= 0 ? "+" : ""}${totalR}R`,
                      tone: parseFloat(totalR) >= 0 ? "positive" : "negative",
                      tooltipKey: "totalr"
                    }
                  ]
                : [
                    { label: "Trades", value: combinedHomeStats.totalTrackedTradeCount },
                    {
                      label: "Win Rate",
                      value: winRate,
                      tone:
                        combinedHomeStats.winRate >= 50
                          ? "positive"
                          : "negative"
                    },
                    {
                      label: "Avg R",
                      value: avgR,
                      tone:
                        combinedHomeStats.journalAverageResult >= 0
                          ? "positive"
                          : "negative"
                    },
                    {
                      label: "Total R",
                      value: `${parseFloat(totalR) >= 0 ? "+" : ""}${totalR}R`,
                      tone: parseFloat(totalR) >= 0 ? "positive" : "negative"
                    },
                    {
                      label: "Avg Win",
                      value: avgWin,
                      tone: "positive"
                    },
                    {
                      label: "Avg Loss",
                      value: avgLoss,
                      tone: "negative"
                    }
                  ]
              ).map(item => (
                <div
                  key={item.label}
                  onClick={() => {
                    if (isBeginner && item.tooltipKey) {
                      setShowTooltip(item.tooltipKey);
                    }
                  }}
                  style={{
                    background: "rgba(18,26,38,0.86)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    padding: "14px 16px",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
                    cursor: isBeginner && item.tooltipKey ? "pointer" : "default"
                  }}
                >
                  <div style={{ fontSize: 11, color: "#94a6bb", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: item.tone === "positive" ? "#4ade80" : item.tone === "negative" ? "#f87171" : "#f3f7fc" }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {showTooltip === "winrate" && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 9999
                }}
                onClick={() => setShowTooltip(null)}
              >
                <div
                  className="card"
                  style={{ maxWidth: 400 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="cardHeader">
                    <h2>Win Rate</h2>
                  </div>

                  <div className="cardBody" style={{ lineHeight: 1.7 }}>
                    Win rate is the percentage of your trades that were winners.
                    <br /><br />
                    Example:
                    <br />
                    If you took 10 trades and 6 were profitable, your win rate is 60%.
                    <br /><br />
                    Higher doesn’t always mean better — what matters is how much you make vs lose.
                  </div>

                  <button
                    className="ghostButton"
                    onClick={() => setShowTooltip(null)}
                    style={{ marginTop: 10 }}
                  >
                    Got it
                  </button>
                </div>
              </div>
            )}

            {showTooltip === "avgres" && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 9999
                  }}
                  onClick={() => setShowTooltip(null)}
                >
                  <div
                    className="card"
                    style={{ maxWidth: 400 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="cardHeader">
                      <h2>Average Result</h2>
                    </div>

                    <div className="cardBody" style={{ lineHeight: 1.7 }}>
                      Average Result shows how your trades are doing on average.
                      <br /><br />
                      Example:
                      <br />
                      If your trades average +0.50R, that means each trade is making half of your risk on average.
                      <br /><br />
                      A positive number is good. A negative number means your average trade is losing.
                    </div>

                    <button
                      className="ghostButton"
                      onClick={() => setShowTooltip(null)}
                      style={{ marginTop: 10 }}
                    >
                      Got it
                    </button>
                  </div>
                </div>
              )}

              {showTooltip === "totalr" && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 9999
                  }}
                  onClick={() => setShowTooltip(null)}
                >
                  <div
                    className="card"
                    style={{ maxWidth: 400 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="cardHeader">
                      <h2>Overall Progress</h2>
                    </div>

                    <div className="cardBody" style={{ lineHeight: 1.7 }}>
                      Overall Progress shows your total R-based performance across your journaled trades.
                      <br /><br />
                      It’s measured in R (risk units), not dollars.
                      <br /><br />
                      Example:
                      <br />
                      +5R means you’ve gained 5 times your risk.
                      <br />
                      -3R means you’ve lost 3 times your risk.
                      <br /><br />
                      This is one of the most important numbers to track your progress over time.
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                      <button
                        className="ghostButton"
                        onClick={() => setShowTooltip(null)}
                      >
                        Got it
                      </button>

                      <button
                        className="ghostButton"
                        onClick={() => {
                          setShowTooltip(null);
                          setActiveTab("ai");
                          setTimeout(() => {
                            setAiInput("Explain my win rate and how I can improve it");
                          }, 100);
                        }}
                      >
                        Ask Rayla
                      </button>
                    </div>
                  </div>
                </div>
              )}
                        {isBeginner && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
                          <button
                            type="button"
                            className="ghostButton"
                            onClick={() => {
                              setBeginnerTutorialView("menu");
                              setBeginnerTutorialStep(0);
                              setShowBeginnerTutorial(true);
                            }}
                          >
                            Beginner Help
                          </button>
                        </div>
                      )}
            <div className="mainGrid">
              <div className="span6">
                <EquityCurveCard equitySeries={filteredEquitySeries} sourceLabel={equitySourceLabel} chartRange={chartRange} setChartRange={setChartRange} />
              </div>
              <div className="span6">
                <MarketCard items={marketItems} selectedId={selectedMarketId} onSelect={setSelectedMarketId} onRemove={handleRemoveSymbol} newSymbol={newSymbol} setNewSymbol={setNewSymbol} onAddSymbol={handleAddSymbol} alpacaConnected={Boolean(alpacaAccount)} />
              </div>
              <div className="span4">
                <RecentTradesCard recentTrades={recentTrades} onDeleteTrade={handleDeleteTrade} />
              </div>
              <div className="span4">
                              {!isBeginner && (
                              <>
                                <div className="span4">
                                  <div className="card" style={{ height: "100%" }}>
                                    <div className="cardHeader"><h2>Top Edges</h2></div>
                                    <div className="cardBody">
                                      <div className="list">
                                        {topEdges.map((edge, index) => (
                                          <div className="listRow" key={edge.name}>
                                            <div>
                                              <div className="listTitle">{index + 1}. {edge.name}</div>
                                              <div className="listSubtext">{edge.trades} trades</div>
                                            </div>
                                            <div className="pill">{edge.avgR}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="span4">
                                  {(() => {
                                    const r = buildCoachReport(trades);
                                    if (!r) return (
                                      <div className="card" style={{ height: "100%" }}>
                                        <div className="cardHeader"><h2>Coach Insights</h2></div>
                                        <div className="cardBody"><div style={{ fontSize: 13, color: "#7f8ea3" }}>Log trades to unlock coach insights.</div></div>
                                      </div>
                                    );
                                    return (
                                      <div className="card" style={{ height: "100%", borderColor: "rgba(124,196,255,0.2)" }}>
                                        <div className="cardHeader"><h2>Coach Insights</h2></div>
                                        <div className="cardBody">
                                          <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.7 }}>
                                            {`Win Rate: ${r.winRate.toFixed(1)}% · Avg R: ${r.avgR >= 0 ? "+" : ""}${r.avgR.toFixed(2)}R · ${r.trades} trades`}
                                          </div>
                                          {r.bestCombo && (
                                            <div style={{ marginTop: 8, fontSize: 13, color: "#e2e8f0", lineHeight: 1.7 }}>
                                              {`Strongest edge: ${r.bestCombo.setup} on ${r.bestCombo.asset} — ${r.bestCombo.avgR.toFixed(2)}R avg`}
                                            </div>
                                          )}
                                          {r.warnings.length > 0 && (
                                            <div style={{ marginTop: 8, fontSize: 13, color: "#fbbf24", lineHeight: 1.7 }}>
                                              {r.warnings[0]}
                                            </div>
                                          )}
                                          {r.actions.length > 0 && (
                                            <div style={{ marginTop: 8, fontSize: 13, color: "#7CC4FF", lineHeight: 1.7 }}>
                                              {`Next: ${r.actions[0]}`}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </>
                            )}
              </div>
            </div>

          </>
        )}

        {activeTab === "trades" && (
          <div className="mainGrid" style={{ overflow: "visible" }}>
            <div className="span12">
              {pendingAlpacaOrderConfirmation && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 9999,
                    padding: 20,
                  }}
                  onClick={() => !alpacaOrderSubmitting && setPendingAlpacaOrderConfirmation(null)}
                >
                  <div
                    className="card"
                    style={{ maxWidth: 420, width: "100%" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="cardHeader"><h2>Confirm Paper Order</h2></div>
                    <div className="cardBody" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Symbol</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{pendingAlpacaOrderConfirmation.symbol}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Side</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: pendingAlpacaOrderConfirmation.side === "buy" ? "#4ade80" : "#f87171" }}>
                            {pendingAlpacaOrderConfirmation.side === "buy" ? "Buy" : "Sell"}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Quantity</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{pendingAlpacaOrderConfirmation.qty}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Order Type</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
                            {pendingAlpacaOrderConfirmation.type === "limit" ? "Limit" : "Market"}
                          </div>
                        </div>
                        {pendingAlpacaOrderConfirmation.type === "limit" && (
                          <div>
                            <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Limit Price</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
                              {formatCurrency(pendingAlpacaOrderConfirmation.limitPrice)}
                            </div>
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Estimated Price</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
                            {pendingAlpacaOrderConfirmation.estimatedPrice != null
                              ? formatCurrency(pendingAlpacaOrderConfirmation.estimatedPrice)
                              : "--"}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Estimated Value</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
                            {pendingAlpacaOrderConfirmation.estimatedValue != null
                              ? formatCurrency(pendingAlpacaOrderConfirmation.estimatedValue)
                              : "--"}
                          </div>
                        </div>
                      </div>

                      <div style={{ padding: 12, borderRadius: 12, background: "rgba(124,196,255,0.08)", border: "1px solid rgba(124,196,255,0.16)" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "#7CC4FF", marginBottom: 6 }}>
                          Rayla Insight
                        </div>
                        <div style={{ fontSize: 13, color: "#dbeafe", lineHeight: 1.6 }}>
                          {pendingAlpacaOrderConfirmation.insight}
                        </div>
                      </div>

                      {pendingAlpacaOrderConfirmation.realityCheck?.length ? (
                        <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "#94a3b8", marginBottom: 6 }}>
                            Reality Check
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {pendingAlpacaOrderConfirmation.realityCheck.map((item) => (
                              <div key={item} style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                                • {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="ghostButton"
                          onClick={() => setPendingAlpacaOrderConfirmation(null)}
                          disabled={alpacaOrderSubmitting}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="ghostButton"
                          onClick={handleConfirmAlpacaOrder}
                          disabled={alpacaOrderSubmitting}
                          style={{ background: "rgba(124,196,255,0.18)", borderColor: "rgba(124,196,255,0.34)", color: "#f8fafc" }}
                        >
                          {alpacaOrderSubmitting ? "Submitting..." : "Confirm"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="card" style={{ marginBottom: 16, overflow: "visible" }}>
                <div className="cardHeader"><h2>Alpaca Paper Trading</h2></div>
                <div className="cardBody" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                    Trade is where Rayla handles broker connectivity and user-confirmed paper stock execution.
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                    <div style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "#7f8ea3" }}>
                        Connection Status
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: alpacaAccount ? "#4ade80" : "#e2e8f0" }}>
                        {alpacaAccount ? "Connected to Alpaca Paper" : "Not connected"}
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                        Paper trading. Orders are submitted after you confirm.
                      </div>
                      {!alpacaAccount ? (
                        <button type="button" className="ghostButton" onClick={handleConnectAlpaca}>
                          Connect Alpaca
                        </button>
                      ) : (
                        <button type="button" className="ghostButton" onClick={() => fetchAlpacaBrokerData()}>
                          Refresh
                        </button>
                      )}
                    </div>

                    <div style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "#7f8ea3" }}>
                        Account Summary
                      </div>
                      {alpacaAccount ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                          {[
                            { label: "Status", value: alpacaAccount.status || "--" },
                            { label: "Buying Power", value: formatCurrency(alpacaAccount.buyingPower) },
                            { label: "Cash", value: formatCurrency(alpacaAccount.cash) },
                            { label: "Portfolio", value: formatCurrency(alpacaAccount.portfolioValue) },
                            { label: "Equity", value: formatCurrency(alpacaAccount.equity) },
                          ].map((item) => (
                            <div key={item.label}>
                              <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>{item.label}</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{item.value}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                          Connect Alpaca Paper to load your account status, buying power, cash, portfolio value, and equity.
                        </div>
                      )}
                    </div>
                  </div>

                  {alpacaConnectionLoading && (
                    <div style={{ fontSize: 13, color: "#94a3b8" }}>
                      Loading Alpaca Paper data...
                    </div>
                  )}

                  {alpacaAccount && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
                      <div style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "#7f8ea3" }}>
                          Positions
                        </div>
                        {alpacaPositions.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ fontSize: 10, color: "#7f8ea3", letterSpacing: "0.4px" }}>Select asset to view</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                              <button
                                type="button"
                                onClick={() => setTradeViewMode("portfolio")}
                                style={{
                                  padding: "4px 11px",
                                  borderRadius: 7,
                                  border: "1px solid",
                                  borderColor: tradeViewMode === "portfolio" ? "rgba(96,165,250,0.6)" : "rgba(255,255,255,0.1)",
                                  background: tradeViewMode === "portfolio" ? "rgba(96,165,250,0.14)" : "transparent",
                                  color: tradeViewMode === "portfolio" ? "#93c5fd" : "#7f8ea3",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                Portfolio
                              </button>
                              {alpacaPositions.map((pos) => {
                                const isSelected = tradeViewMode === "asset" && tradePanelSymbol === pos.symbol;
                                return (
                                  <button
                                    key={pos.symbol}
                                    type="button"
                                    onClick={() => {
                                      setAlpacaOrderForm((prev) => ({ ...prev, symbol: pos.symbol }));
                                      setAlpacaAssetSearchResults([]);
                                      setAlpacaAssetSearchError("");
                                      setAlpacaAssetSearchOpen(false);
                                      setTradeViewMode("asset");
                                    }}
                                    style={{
                                      padding: "4px 11px",
                                      borderRadius: 7,
                                      border: "1px solid",
                                      borderColor: isSelected ? "rgba(124,196,255,0.55)" : "rgba(255,255,255,0.1)",
                                      background: isSelected ? "rgba(124,196,255,0.13)" : "transparent",
                                      color: isSelected ? "#d7efff" : "#94a3b8",
                                      fontSize: 11,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    {pos.symbol}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {alpacaPositions.length ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {alpacaPositions.map((position) => (
                              <button
                                key={position.symbol}
                                type="button"
                                onClick={() => {
                                  setAlpacaOrderForm((prev) => ({ ...prev, symbol: position.symbol }));
                                  setAlpacaAssetSearchResults([]);
                                  setAlpacaAssetSearchError("");
                                  setAlpacaAssetSearchOpen(false);
                                  setTradeViewMode("asset");
                                }}
                                style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", textAlign: "left", width: "100%", transition: "border-color 160ms ease, background 160ms ease, transform 160ms ease" }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = "rgba(124,196,255,0.18)";
                                  e.currentTarget.style.background = "rgba(124,196,255,0.05)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                                  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                                  <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{position.symbol}</div>
                                  <div style={{ fontSize: 12, color: position.unrealizedPl >= 0 ? "#4ade80" : "#f87171", fontWeight: 700 }}>
                                    {`${position.unrealizedPl >= 0 ? "+" : ""}${formatCurrency(position.unrealizedPl)}`}
                                  </div>
                                </div>
                                <div style={{ marginTop: 6, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                                  Qty {position.qty} • Avg {formatCurrency(position.avgEntryPrice)} • Current {formatCurrency(tradePanelSymbol === position.symbol && Number.isFinite(tradePanelCurrentPrice) ? tradePanelCurrentPrice : position.currentPrice)} • Value {formatCurrency(position.marketValue)}
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                            No Alpaca Paper stock positions yet.
                          </div>
                        )}
                      </div>

                      {(() => {
                        return (
                          <div style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "#7f8ea3" }}>
                              Live Market
                            </div>
                            {!tradePanelSymbol ? (
                              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                                Select an asset or click a position to view live market context.
                              </div>
                            ) : (
                              <>
                                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                  <div>
                                    <div style={{ fontSize: 17, fontWeight: 700, color: "#e2e8f0" }}>{tradePanelSymbol}</div>
                                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                                      {Number.isFinite(tradePanelCurrentPrice) ? formatCurrency(tradePanelCurrentPrice) : "--"}
                                      {tradePanelQuote?.change != null ? ` · ${tradePanelQuote.change >= 0 ? "+" : ""}${tradePanelQuote.change.toFixed(2)}%` : ""}
                                    </div>
                                  </div>
                                  {tradePanelMatchingPosition ? (
                                    <div style={{ fontSize: 12, fontWeight: 700, color: tradePanelMatchingPosition.unrealizedPl >= 0 ? "#4ade80" : "#f87171" }}>
                                      {`${tradePanelMatchingPosition.unrealizedPl >= 0 ? "+" : ""}${formatCurrency(tradePanelMatchingPosition.unrealizedPl)}`}
                                    </div>
                                  ) : null}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                      {["1D", "1W", "1M", "3M", "1Y", "5Y", "MAX"].map((range) => (
                                        <button
                                          key={range}
                                          type="button"
                                          onClick={() => setTradeChartRange(range)}
                                          style={{
                                            padding: "3px 9px",
                                            borderRadius: 6,
                                            border: "1px solid",
                                            borderColor: tradeChartRange === range ? "rgba(124,196,255,0.5)" : "rgba(255,255,255,0.1)",
                                            background: tradeChartRange === range ? "rgba(124,196,255,0.13)" : "transparent",
                                            color: tradeChartRange === range ? "#d7efff" : "#7f8ea3",
                                            fontSize: 10,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                            letterSpacing: "0.5px",
                                          }}
                                        >
                                          {range}
                                        </button>
                                      ))}
                                    </div>
                                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                      {[["line", "Line"], ["candlestick", "Candles"]].map(([mode, label]) => (
                                        <button
                                          key={mode}
                                          type="button"
                                          onClick={() => setTradeChartMode(mode)}
                                          style={{
                                            padding: "3px 9px",
                                            borderRadius: 6,
                                            border: "1px solid",
                                            borderColor: tradeChartMode === mode ? "rgba(124,196,255,0.5)" : "rgba(255,255,255,0.1)",
                                            background: tradeChartMode === mode ? "rgba(124,196,255,0.13)" : "transparent",
                                            color: tradeChartMode === mode ? "#d7efff" : "#7f8ea3",
                                            fontSize: 10,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                            letterSpacing: "0.5px",
                                          }}
                                        >
                                          {label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  {tradeChartLastUpdated && (
                                    <div style={{ fontSize: 10, color: "#7f8ea3" }}>
                                      Updated {tradeChartLastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </div>
                                  )}
                                </div>
                                {tradeViewMode === "portfolio" ? (() => {
                                  const palette = ["#60a5fa", "#34d399", "#f59e0b", "#f87171", "#a78bfa", "#fb923c"];
                                  const xL = 10, xR = 195, yT = 5, yB = 108;
                                  const chartW = xR - xL;
                                  const chartH = yB - yT;
                                  const portfolioLines = alpacaPositions.map((pos, pi) => {
                                    const q = getKnownStockQuoteData(pos.symbol, simulationQuotes, marketItems, alpacaAssetQuotes);
                                    const raw = buildFallbackMiniChartSeries(q, pos);
                                    const base = raw[0] || 1;
                                    return { symbol: pos.symbol, series: raw.map((v) => ((v - base) / base) * 100), color: palette[pi % palette.length] };
                                  });
                                  const allVals = portfolioLines.flatMap((l) => l.series).filter(Number.isFinite);
                                  if (allVals.length < 2) return (
                                    <div style={{ height: 260, borderRadius: 12, background: "rgba(13,17,23,0.8)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8" }}>No positions to display</div>
                                  );
                                  const pMin = Math.min(...allVals), pMax = Math.max(...allVals);
                                  const pPad = (pMax - pMin) * 0.14 || 0.5;
                                  const pLo = pMin - pPad, pHi = pMax + pPad;
                                  const vy = (v) => yB - ((v - pLo) / (pHi - pLo || 1)) * chartH;
                                  const ySteps = Array.from({ length: 4 }, (_, i) => {
                                    const ratio = i / 3;
                                    return { y: yT + chartH * ratio, val: pHi - (pHi - pLo) * ratio };
                                  });
                                  return (
                                    <div style={{ height: 260, borderRadius: 12, background: "rgba(13,17,23,0.8)", border: "1px solid rgba(255,255,255,0.08)", padding: "10px 6px 6px 6px" }}>
                                      <svg viewBox="0 0 210 120" style={{ width: "100%", height: "100%" }}>
                                        {ySteps.map(({ y, val }, i) => (
                                          <g key={i}>
                                            <line x1={xL} y1={y} x2={xR} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
                                            <text x={xL - 1} y={y + 1.5} textAnchor="end" fontSize="5.5" fill="#7f8ea3" fontFamily="monospace">{val >= 0 ? "+" : ""}{val.toFixed(1)}%</text>
                                          </g>
                                        ))}
                                        <line x1={xL} y1={yT} x2={xL} y2={yB} stroke="rgba(255,255,255,0.1)" strokeWidth="0.4" />
                                        <line x1={xL} y1={yB} x2={xR} y2={yB} stroke="rgba(255,255,255,0.1)" strokeWidth="0.4" />
                                        {portfolioLines.map(({ symbol, series, color }) => {
                                          const n = series.length;
                                          if (n < 2) return null;
                                          const pts = series.map((v, i) => `${xL + (i / (n - 1)) * chartW},${vy(v)}`).join(" ");
                                          return <polyline key={symbol} points={pts} fill="none" stroke={color} strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />;
                                        })}
                                        {portfolioLines.map(({ symbol, series, color }) => {
                                          const n = series.length;
                                          const lastV = series[n - 1];
                                          const dotX = xL + chartW;
                                          const dotY = Math.max(8, Math.min(vy(lastV), yB - 2));
                                          return (
                                            <g key={symbol}>
                                              <circle cx={dotX} cy={dotY} r="3" fill={color} opacity="0.25">
                                                <animate attributeName="r" values="2;5;2" dur="2s" repeatCount="indefinite" />
                                                <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
                                              </circle>
                                              <circle cx={dotX} cy={dotY} r="2" fill={color} />
                                              <text x={dotX + 3} y={dotY + 1.8} fontSize="5.5" fill={color} fontFamily="monospace" fontWeight="bold">{symbol}</text>
                                            </g>
                                          );
                                        })}
                                      </svg>
                                    </div>
                                  );
                                })() : (
                                  <div style={{ height: 260, borderRadius: 12, overflow: "hidden", background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    {tradeMarketChartLoading && extractChartBars(tradeMarketChart).length < 2 ? (
                                      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8" }}>
                                        Loading chart...
                                      </div>
                                    ) : extractChartBars(tradeMarketChart).length < 2 ? (
                                      <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 6, alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "0 24px" }}>
                                        <div>Chart unavailable</div>
                                        <div>Alpaca does not provide chart bars for this asset yet, but live quote data is still available and was added to your watchlist.</div>
                                      </div>
                                    ) : (
                                      <TradeChart
                                        bars={extractChartBars(tradeMarketChart)}
                                        mode={tradeChartMode}
                                        latestPrice={tradePanelCurrentPrice}
                                        assetSymbol={tradePanelSymbol}
                                        assetName={tradePanelAsset?.description || tradePanelAsset?.name || tradePanelSymbol}
                                      />
                                    )}
                                  </div>
                                )}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                                  <div>
                                    <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Qty Held</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{tradePanelMatchingPosition ? tradePanelMatchingPosition.qty : "--"}</div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Avg Entry</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
                                      {tradePanelMatchingPosition ? formatCurrency(tradePanelMatchingPosition.avgEntryPrice) : "--"}
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Position Value</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
                                      {tradePanelMatchingPosition && Number.isFinite(tradePanelMatchingPosition.marketValue) ? formatCurrency(tradePanelMatchingPosition.marketValue) : "--"}
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Unrealized P/L</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: tradePanelMatchingPosition?.unrealizedPl >= 0 ? "#4ade80" : tradePanelMatchingPosition ? "#f87171" : "#e2e8f0" }}>
                                      {tradePanelMatchingPosition && Number.isFinite(tradePanelMatchingPosition.unrealizedPl)
                                        ? `${tradePanelMatchingPosition.unrealizedPl >= 0 ? "+" : ""}${formatCurrency(tradePanelMatchingPosition.unrealizedPl)}${Number.isFinite(tradePanelMatchingPosition.unrealizedPlpc) ? ` (${tradePanelMatchingPosition.unrealizedPlpc >= 0 ? "+" : ""}${(tradePanelMatchingPosition.unrealizedPlpc * 100).toFixed(1)}%)` : ""}`
                                        : "--"}
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()}

                      <div style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "#7f8ea3" }}>
                          Trade Order
                        </div>
                        {(() => {
                          const selectedSymbol = String(alpacaOrderForm.symbol || "").trim().toUpperCase();
                          if (!selectedSymbol) return null;

                          const matchingPosition = alpacaPositions.find((position) => position.symbol === selectedSymbol) || null;
                          const selectedOrderAssetPrice = Number.isFinite(tradePanelCurrentPrice) && selectedSymbol === tradePanelSymbol
                            ? tradePanelCurrentPrice
                            : getKnownStockQuotePrice(selectedSymbol, simulationQuotes, marketItems, alpacaAssetQuotes);
                          const currentPositionPrice = Number.isFinite(selectedOrderAssetPrice)
                            ? selectedOrderAssetPrice
                            : matchingPosition?.currentPrice;
                          const unrealizedPl = matchingPosition?.unrealizedPl ?? null;
                          const unrealizedPlpc = matchingPosition?.unrealizedPlpc ?? null;

                          return (
                            <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 8 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "#7f8ea3" }}>
                                Position Summary
                              </div>
                              {matchingPosition ? (
                                <>
                                  <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{selectedSymbol}</div>
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                                    <div>
                                      <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Shares</div>
                                      <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{matchingPosition.qty}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Avg Price</div>
                                      <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{formatCurrency(matchingPosition.avgEntryPrice)}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Current Price</div>
                                      <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
                                        {Number.isFinite(currentPositionPrice) ? formatCurrency(currentPositionPrice) : "--"}
                                      </div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Unrealized P/L</div>
                                      <div style={{ fontSize: 14, fontWeight: 700, color: unrealizedPl >= 0 ? "#4ade80" : "#f87171" }}>
                                        {Number.isFinite(unrealizedPl)
                                          ? `${unrealizedPl >= 0 ? "+" : ""}${formatCurrency(unrealizedPl)}${Number.isFinite(unrealizedPlpc) ? ` (${unrealizedPlpc >= 0 ? "+" : ""}${(unrealizedPlpc * 100).toFixed(1)}%)` : ""}`
                                          : "--"}
                                      </div>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                                  {`No current position in ${selectedSymbol}.`}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        <form onSubmit={handleSubmitAlpacaOrder} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ position: "relative" }}>
                            {(() => {
                              const selectedOrderAssetPrice = Number.isFinite(tradePanelCurrentPrice) && String(alpacaOrderForm.symbol || "").trim().toUpperCase() === tradePanelSymbol
                                ? tradePanelCurrentPrice
                                : getKnownStockQuotePrice(alpacaOrderForm.symbol, simulationQuotes, marketItems, alpacaAssetQuotes);
                              return (
                                <>
                            <input
                              className="authInput"
                              placeholder="Search tradable asset (AAPL)"
                              value={alpacaOrderForm.symbol}
                              onChange={(e) => {
                                setAlpacaOrderForm((prev) => ({ ...prev, symbol: e.target.value.toUpperCase() }));
                                setAlpacaAssetSearchError("");
                                setAlpacaAssetSearchOpen(Boolean(e.target.value.trim()));
                              }}
                              onFocus={() => {
                                if (alpacaOrderForm.symbol.trim()) setAlpacaAssetSearchOpen(true);
                              }}
                              onBlur={() => {
                                window.setTimeout(() => {
                                  setAlpacaAssetSearchOpen(false);
                                }, 120);
                              }}
                              onKeyDown={(e) => {
                                if (e.key !== "Enter") return;
                                e.preventDefault();
                                e.stopPropagation();
                                return;
                              }}
                              autoComplete="off"
                            />
                                  {alpacaOrderForm.symbol.trim() && Number.isFinite(selectedOrderAssetPrice) ? (
                                    <div style={{ marginTop: 6, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                                      {`${alpacaOrderForm.symbol.trim().toUpperCase()} · ${formatCurrency(selectedOrderAssetPrice)}`}
                                    </div>
                                  ) : null}
                            {alpacaAssetSearchOpen && (
                              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 999, background: "#111827", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, maxHeight: 220, overflowY: "auto" }}>
                                {alpacaAssetSearchLoading ? (
                                  <div style={{ padding: "10px 14px", fontSize: 12, color: "#94a3b8" }}>
                                    Searching tradable Alpaca assets...
                                  </div>
                                ) : alpacaAssetSearchError ? (
                                  <div style={{ padding: "10px 14px", fontSize: 12, color: "#fca5a5" }}>
                                    {alpacaAssetSearchError}
                                  </div>
                                ) : alpacaAssetSearchResults.length > 0 ? (
                                  alpacaAssetSearchResults.map((asset) => (
                                    <button
                                      key={asset.symbol}
                                      type="button"
                                      onClick={() => {
                                        setAlpacaOrderForm((prev) => ({ ...prev, symbol: asset.symbol }));
                                        setAlpacaAssetSearchResults([]);
                                        setAlpacaAssetSearchError("");
                                        setAlpacaAssetSearchOpen(false);
                                      }}
                                      style={{ width: "100%", textAlign: "left", padding: "10px 14px", cursor: "pointer", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "transparent", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                                    >
                                      <div>
                                        <div style={{ fontWeight: 700, color: "#fff", fontSize: 13 }}>{asset.symbol}</div>
                                        <div style={{ color: "#7f8ea3", fontSize: 12, marginTop: 2 }}>{asset.name}</div>
                                        {Number.isFinite(getKnownStockQuotePrice(asset.symbol, simulationQuotes, marketItems, alpacaAssetQuotes)) ? (
                                          <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>
                                            {`${asset.exchange || "--"} · ${formatCurrency(getKnownStockQuotePrice(asset.symbol, simulationQuotes, marketItems, alpacaAssetQuotes))}`}
                                          </div>
                                        ) : (
                                          <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>
                                            {asset.exchange || "--"}
                                          </div>
                                        )}
                                      </div>
                                    </button>
                                  ))
                                ) : alpacaOrderForm.symbol.trim() ? (
                                  <div style={{ padding: "10px 14px", fontSize: 12, color: "#94a3b8" }}>
                                    No tradable Alpaca asset found
                                  </div>
                                ) : null}
                              </div>
                            )}
                                </>
                              );
                            })()}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                            <select
                              className="authInput"
                              value={alpacaOrderForm.side}
                              onChange={(e) => setAlpacaOrderForm((prev) => ({ ...prev, side: e.target.value }))}
                            >
                              <option value="buy">Buy</option>
                              <option value="sell">Sell</option>
                            </select>
                            <input
                              className="authInput"
                              type="number"
                              min="0"
                              step="0.0001"
                              placeholder="Qty"
                              value={alpacaOrderForm.qty}
                              onChange={(e) => setAlpacaOrderForm((prev) => ({ ...prev, qty: e.target.value }))}
                            />
                          </div>
                          <select
                            className="authInput"
                            value={alpacaOrderForm.type}
                            onChange={(e) => setAlpacaOrderForm((prev) => ({ ...prev, type: e.target.value }))}
                          >
                            <option value="market">Market</option>
                            <option value="limit">Limit</option>
                          </select>
                          {alpacaOrderForm.type === "limit" && (
                            <input
                              className="authInput"
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Limit Price"
                              value={alpacaOrderForm.limitPrice}
                              onChange={(e) => setAlpacaOrderForm((prev) => ({ ...prev, limitPrice: e.target.value }))}
                            />
                          )}
                          <button type="submit" className="ghostButton" disabled={alpacaOrderSubmitting}>
                            {alpacaOrderSubmitting ? "Submitting..." : "Submit Paper Order"}
                          </button>
                        </form>
                        {alpacaOrderResult && (
                          <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.6, padding: 12, borderRadius: 12, background: "rgba(124,196,255,0.08)", border: "1px solid rgba(124,196,255,0.16)" }}>
                            {alpacaOrderResult.symbol} {alpacaOrderResult.side} {alpacaOrderResult.qty} share(s) • {alpacaOrderResult.type} •{" "}
                            <span
                              style={{
                                color: getBrokerOrderStatusPresentation(alpacaOrderResult.status).color,
                                fontWeight: 700,
                              }}
                            >
                              {getBrokerOrderStatusPresentation(alpacaOrderResult.status).label}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <BrokerTradeLogCard
                  trades={brokerTradeLog}
                  isLoading={brokerTradeLogLoading}
                  onRefresh={() => fetchBrokerTradeLog({ sync: true })}
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button type="button" className="ghostButton" onClick={() => setTradeView("log")} style={{ opacity: tradeView === "log" ? 1 : 0.5 }}>Log Trade</button>
                <button type="button" className="ghostButton" onClick={() => setTradeView("recent")} style={{ opacity: tradeView === "recent" ? 1 : 0.5 }}>Recent Trades</button>
                <button type="button" className="ghostButton" onClick={() => setTradeView("all")} style={{ opacity: tradeView === "all" ? 1 : 0.5 }}>All Trades</button>
              </div>
              {tradeView === "log" && (
                <div className="card">
                  <h3>Log Trade</h3>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", background: "rgba(124,196,255,0.08)", border: "1px dashed rgba(124,196,255,0.3)", borderRadius: 10, cursor: "pointer", fontSize: 13, color: "#7CC4FF", fontWeight: 600 }}>
                      📸 Upload Trade Screenshot
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleScreenshotUpload} />
                    </label>
                  </div>
                  <form onSubmit={handleAddTrade} className="tradeEntryRow">
                    <input className="authInput" placeholder="Asset (BTC, AAPL)" value={tradeForm.asset} onChange={(e) => setTradeForm({ ...tradeForm, asset: e.target.value })} />
                    <input className="authInput" placeholder="Entry Price" value={tradeForm.entryPrice} onChange={(e) => setTradeForm({ ...tradeForm, entryPrice: e.target.value })} />
                    <input className="authInput" placeholder="Size ($)" value={tradeForm.size} onChange={(e) => setTradeForm({ ...tradeForm, size: e.target.value })} />
                    <input className="authInput" type="datetime-local" value={tradeForm.entryTime} onChange={(e) => setTradeForm({ ...tradeForm, entryTime: e.target.value })} />
                    <select className="authInput" value={tradeForm.setup} onChange={(e) => setTradeForm({ ...tradeForm, setup: e.target.value })}>
                      <option value="">Select Setup (optional)</option>
                      {SETUP_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select className="authInput" value={tradeForm.session} onChange={(e) => setTradeForm({ ...tradeForm, session: e.target.value })}>
                      <option value="">Select Session (optional)</option>
                      {SESSION_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select className="authInput" value={tradeForm.direction} onChange={(e) => setTradeForm({ ...tradeForm, direction: e.target.value })}>
                      <option value="">Direction (optional)</option>
                      <option value="long">Long</option>
                      <option value="short">Short</option>
                    </select>
                    <select className="authInput" value={tradeForm.marketCondition} onChange={(e) => setTradeForm({ ...tradeForm, marketCondition: e.target.value })}>
                      <option value="">Market Condition (optional)</option>
                      <option value="trending">Trending</option>
                      <option value="ranging">Ranging</option>
                      <option value="volatile">Volatile</option>
                      <option value="weak_trend">Weak Trend</option>
                    </select>
                    <input className="authInput" placeholder="Result (R)" value={tradeForm.result} onChange={(e) => setTradeForm({ ...tradeForm, result: e.target.value })} />
                    <button type="submit" className="ghostButton">Save Trade</button>
                  </form>
                </div>
              )}
              {tradeView === "recent" && <RecentTradesCard recentTrades={recentTrades} onDeleteTrade={handleDeleteTrade} />}
              {tradeView === "all" && <RecentTradesCard recentTrades={trades} onDeleteTrade={handleDeleteTrade} />}
            </div>
          </div>
        )}

        {activeTab === "simulation" && (
          <div className="mainGrid">
            <div className="span12">
              <div className="card">
                <div className="cardHeader">
                  <h2>Simulation</h2>
                </div>
                <div ref={simulationTutorialContainerRef} className="cardBody" style={{ display: "flex", flexDirection: "column", gap: 18, position: "relative" }}>
                  {isSimulationTutorialOpen && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(11,16,23,0.72)",
                        borderRadius: 16,
                        zIndex: 1,
                      }}
                    />
                  )}
                  {renderSimulationWalkthroughCard()}

                  <div style={{ padding: 16, borderRadius: 14, background: simulationMode === "scenario" ? "rgba(124,196,255,0.08)" : "rgba(255,255,255,0.04)", border: simulationMode === "scenario" ? "1px solid rgba(124,196,255,0.18)" : "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>Simulation Mode</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, lineHeight: 1.55 }}>
                          Live follows current market quotes. Scenario creates structured training conditions for practice.
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="ghostButton"
                          onClick={() => setSimulationMode("live")}
                          style={simulationMode === "live" ? { background: "rgba(124,196,255,0.18)", borderColor: "rgba(124,196,255,0.34)", color: "#f8fafc" } : undefined}
                        >
                          Live
                        </button>
                        <button
                          type="button"
                          className="ghostButton"
                          onClick={() => setSimulationMode("scenario")}
                          style={simulationMode === "scenario" ? { background: "rgba(124,196,255,0.18)", borderColor: "rgba(124,196,255,0.34)", color: "#f8fafc" } : undefined}
                        >
                          Scenario
                        </button>
                      </div>
                  </div>
                    {simulationMode === "scenario" && capitalGuideScenarioIntro && (
                      <div style={{ fontSize: 12, color: "#dbeafe", lineHeight: 1.6, padding: 12, borderRadius: 12, background: "rgba(124,196,255,0.08)", border: "1px solid rgba(124,196,255,0.16)" }}>
                        {capitalGuideScenarioIntro}
                      </div>
                    )}
                  </div>

                  {guidedSimulationDraft && (
                    <div style={{ padding: 16, borderRadius: 14, background: "rgba(124,196,255,0.08)", border: "1px solid rgba(124,196,255,0.18)", display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: "#7CC4FF" }}>
                        {simulationMode === "scenario" ? "Guided simulated scenario trade" : "Guided simulated live trade"}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc", lineHeight: 1.35 }}>
                        {guidedSimulationDraft.label || guidedSimulationDraft.asset} • {guidedSimulationDraft.direction === "short" ? "Short" : "Long"}
                      </div>
                      {guidedSimulationDraft.thesis ? (
                        <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.65 }}>
                          {guidedSimulationDraft.thesis}
                        </div>
                      ) : null}
                      {simulationMode === "scenario" && (
                        <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.65 }}>
                          Scenario mode uses generated training movement. The goal here is practicing execution and decision-making under a chosen market condition.
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        {!activeGuidedSimulation ? (
                          <button
                            type="button"
                            className="ghostButton"
                            style={{ background: "rgba(124,196,255,0.18)", borderColor: "rgba(124,196,255,0.38)", color: "#f8fafc", fontWeight: 700 }}
                            onClick={() => {
                              if (!guidedSimulationDraft) return;
                              startGuidedSimulation(guidedSimulationDraft);
                              showToast("Guided trade started.", "success");
                            }}
                          >
                            {simulationMode === "scenario" ? "Start guided simulated scenario trade" : "Start guided simulated live trade"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ghostButton"
                            disabled
                            style={{ opacity: 0.5, cursor: "not-allowed" }}
                          >
                            Guided Trade Active
                          </button>
                        )}
                        <button
                          type="button"
                          className="ghostButton"
                          onClick={() => {
                            setGuidedSimulationDraft(null);
                            setSimulationAsset(null);
                            setSimulationSearchQuery("");
                            setSimulationDirection("long");
                            setSimulationSearchResults([]);
                          }}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  {activeGuidedSimulation && (
                    <div style={{ padding: 16, borderRadius: 14, background: "rgba(124,196,255,0.08)", border: "1px solid rgba(124,196,255,0.18)", display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: "#7CC4FF" }}>
                          {simulationMode === "scenario" ? "Guided simulated scenario trade" : "Guided simulated live trade"}
                        </div>
                        <div style={{ padding: "4px 10px", borderRadius: 999, background: activeGuidedSimulation.step === "trade-closed" ? "rgba(74,222,128,0.14)" : activeGuidedSimulation.step === "position-open" ? "rgba(124,196,255,0.18)" : "rgba(255,255,255,0.08)", border: activeGuidedSimulation.step === "trade-closed" ? "1px solid rgba(74,222,128,0.22)" : "1px solid rgba(124,196,255,0.22)", fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: activeGuidedSimulation.step === "trade-closed" ? "#4ade80" : "#dbeafe" }}>
                          {activeGuidedSimulation.step === "ready-to-open"
                            ? "Ready To Open"
                            : activeGuidedSimulation.step === "position-open"
                              ? "Position Open"
                              : activeGuidedSimulation.step === "trade-closed"
                                ? "Trade Closed"
                              : "Review Controls"}
                        </div>
                      </div>
                      {simulationMode === "scenario" ? (
                        <>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc", lineHeight: 1.35 }}>
                            {activeGuidedSimulation.label || activeGuidedSimulation.asset} • {activeGuidedSimulation.direction === "short" ? "Short" : "Long"}
                          </div>
                          {activeGuidedSimulation.thesis ? (
                            <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                              {activeGuidedSimulation.thesis}
                            </div>
                          ) : null}
                          <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7CC4FF" }}>
                              Current Rayla Coaching
                            </div>
                            <div style={{ fontSize: 13, color: activeGuidedSimulation.step === "trade-closed" ? "#86efac" : "#dbeafe", lineHeight: 1.6 }}>
                              {guidedSimulationTips[0] || "Use this rep to watch the path first, then decide how you would want to manage it."}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 13, color: activeGuidedSimulation.step === "trade-closed" ? "#86efac" : "#cbd5e1", lineHeight: 1.6 }}>
                            {activeGuidedSimulation.step === "ready-to-open"
                              ? "Your live simulation plan is defined. Open the trade when you're ready."
                              : activeGuidedSimulation.step === "position-open"
                                ? "The live simulated trade is open. Use the chart and open-trade panel to manage it with discipline."
                                : activeGuidedSimulation.step === "trade-closed"
                                  ? "Nice — the trade is closed. Review the summary, Session Coach, and Live simulator P/L before you start another rep."
                                  : "Set up the asset, direction, amount, and exit plan before you open the live simulated trade."}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc", lineHeight: 1.35 }}>
                            {activeGuidedSimulation.label || activeGuidedSimulation.asset} • {activeGuidedSimulation.direction === "short" ? "Short" : "Long"}
                          </div>
                          {activeGuidedSimulation.thesis ? (
                            <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.65 }}>
                              {activeGuidedSimulation.thesis}
                            </div>
                          ) : null}
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {guidedSimulationTips.map((tip) => (
                              <div key={tip} style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.6 }}>
                                • {tip}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div style={{ padding: 16, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>
                        {simulationHowToTitle}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="ghostButton"
                          onClick={openSimulationWalkthrough}
                        >
                          {hasCompletedFirstTradeOnboarding
                            ? simulationMode === "scenario" ? "Guided simulated scenario trade" : "Guided simulated live trade"
                            : simulationMode === "scenario" ? "Guided simulated scenario trade" : "Guided simulated live trade"}
                        </button>
                        <button
                          type="button"
                          className="ghostButton"
                          onClick={() => setShowSimulationHelp((prev) => !prev)}
                        >
                          {showSimulationHelp ? "Hide Beginner Help" : "Show Beginner Help"}
                        </button>
                      </div>
                    </div>
                    {showSimulationHelp && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                        {simulationHowToSteps.map((step) => (
                          <div key={step}>{step}</div>
                        ))}
                        {simulationMode === "scenario" && (
                          <div style={{ marginTop: 4, color: "#94a3b8" }}>
                            Scenario uses generated training movement, not real market data. Scenario type controls behavior, and speed compresses time so you can practice more reps.
                          </div>
                        )}
                      </div>
                    )}
                    {!showSimulationHelp && activeGuidedSimulation && (
                      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                        Guided trade mode is leading the learning right now. Open Beginner Help anytime if you want the extra reference walkthrough.
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: 13, color: "#94a3b8" }}>
                    Practice trading with fake money and simulated outcomes.
                  </div>

                  <div style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7f8ea3" }}>
                      Rayla Coach
                    </div>
                    <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                      {simulationCoachMessage}
                    </div>
                  </div>

                  <div ref={setSimulationSectionRef("controls")} style={getSimulationSectionStyle("controls", { padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 14 })}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7f8ea3" }}>
                        Trade Controls
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {renderSimulationInfoButton("controls")}
                        {selectedSimulationOpenPosition && (
                          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#4ade80", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 999, padding: "5px 10px" }}>
                            Position Open
                          </div>
                        )}
                      </div>
                    </div>
                    {simulationMode === "scenario" && (
                      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                        Set up your trade, then press Play to begin the scenario. Realistic mode is the best place to practice full rep review with detailed AI coaching.
                      </div>
                    )}

                    {isBeginner && showSimulationHelp && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                        {beginnerSimulationSteps.map((step) => (
                          <div
                            key={step.title}
                            style={{
                              padding: 12,
                              borderRadius: 12,
                              background: "rgba(124,196,255,0.07)",
                              border: "1px solid rgba(124,196,255,0.16)",
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{step.title}</div>
                            <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.55 }}>{step.text}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ position: "relative" }}>
                      {isBeginner && showSimulationHelp && (
                        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8, lineHeight: 1.55 }}>
                          Start by searching for the asset you want to practice. Rayla will load the chart for you so you can review the setup before opening anything.
                        </div>
                      )}
                      <input
                        type="text"
                        value={simulationSearchQuery}
                        onChange={(e) => handleSimulationSearchChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                          }
                        }}
                        placeholder="Search any asset for simulation"
                        className="authInput"
                      />
                      {simulationSearchResults.length > 0 && (
                        <div style={{ position: "absolute", zIndex: 999, background: "#111827", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, width: "100%", maxHeight: 220, overflowY: "auto", marginTop: 4 }}>
                          {simulationSearchResults.map((result) => (
                            <div
                              key={result.symbol}
                              onClick={() => handleSelectSimulationAsset(result)}
                              style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                            >
                              <span style={{ fontWeight: 700, color: "#fff", fontSize: 13 }}>{result.symbol}</span>
                              <span style={{ color: "#7f8ea3", fontSize: 12, marginLeft: 8 }}>{result.description}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div
                      key={`simulation-controls-${simulationAsset?.id || "none"}`}
                      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, alignItems: "start" }}
                    >
                      {simulationMode === "scenario" && (
                        <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>Scenario setup</div>
                          <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.55 }}>
                            Pick the market condition first, then set how fast you want the rep to unfold.
                          </div>
                          <select className="authInput" value={simulationScenarioType} onChange={(e) => setSimulationScenarioType(e.target.value)}>
                            <option value="uptrend">Uptrend</option>
                            <option value="downtrend">Downtrend</option>
                            <option value="range">Range</option>
                            <option value="realistic">Realistic</option>
                          </select>
                          {simulationScenarioNoLimit ? (
                            <select className="authInput" value={simulationScenarioSpeed} onChange={(e) => setSimulationScenarioSpeed(e.target.value)}>
                              <option value="1x">1x</option>
                              <option value="10x">10x</option>
                              <option value="50x">50x</option>
                              <option value="100x">100x</option>
                              <option value="500x">500x</option>
                              <option value="1000x">1000x</option>
                              <option value="10000x">10000x</option>
                            </select>
                          ) : (
                            <select className="authInput" value={simulationScenarioPlaybackDuration} onChange={(e) => setSimulationScenarioPlaybackDuration(e.target.value)}>
                              <option value="5s">5s</option>
                              <option value="10s">10s</option>
                              <option value="30s">30s</option>
                              <option value="1m">1m</option>
                            </select>
                          )}
                          <div style={{ fontSize: 11, color: "#7CC4FF", lineHeight: 1.5 }}>
                            Realistic mode gives you the fullest rep review with detailed AI coaching.
                          </div>
                        </div>
                      )}

                      <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>Trade direction</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.55 }}>
                          {simulationMode === "scenario"
                            ? "Long means you want the generated scenario price to rise. Short means you want the generated scenario price to fall."
                            : "Long means you want price to go up. Short means you want price to go down."}
                        </div>
                        <select
                          className="authInput"
                          value={simulationDirection}
                          onChange={(e) => setSimulationDirection(e.target.value)}
                        >
                          <option value="long">Buy / Long</option>
                          <option value="short">Sell / Short</option>
                        </select>
                      </div>

                      <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>Amount</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.55 }}>
                          {simulationMode === "scenario"
                            ? "Choose whether you think about training size in total dollars or in shares/units, then enter the amount for this scenario rep."
                            : "Choose whether you think about size in total dollars or in shares/units, then enter the amount you want to practice with."}
                        </div>
                        <select
                          className="authInput"
                          value={simulationAmountMode}
                          onChange={(e) => setSimulationAmountMode(e.target.value)}
                        >
                          <option value="dollars">Amount in Dollars</option>
                          <option value="shares">Amount in Shares</option>
                        </select>
                        <input
                          className="authInput"
                          placeholder={simulationAmountPlaceholder}
                          type="number"
                          step="0.01"
                          value={simulationAmount}
                          onChange={(e) => setSimulationAmount(e.target.value)}
                        />
                      </div>

                      <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>Exit plan</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.55 }}>
                          {simulationMode === "scenario"
                            ? "Price mode uses scenario chart levels. P/L mode uses total dollars gained or lost during the generated training move."
                            : "Price mode uses chart levels. P/L mode uses total dollars gained or lost on the trade."}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="ghostButton"
                            onClick={() => {
                              if (simulationUseStopTarget) {
                                setSimulationStopLoss("");
                                setSimulationTakeProfit("");
                              }
                              setSimulationUseStopTarget((prev) => !prev);
                            }}
                            style={simulationUseStopTarget ? { background: "rgba(124,196,255,0.16)", borderColor: "rgba(124,196,255,0.28)", color: "#f8fafc" } : undefined}
                          >
                            {simulationUseStopTarget ? "Stop/Target On" : "Stop/Target Off"}
                          </button>
                        </div>
                        {simulationUseStopTarget && (
                          <>
                            <select
                              className="authInput"
                              value={simulationExitMode}
                              onChange={(e) => setSimulationExitMode(e.target.value)}
                            >
                              <option value="price">Exit by Price</option>
                              <option value="pnl">Exit by P/L</option>
                            </select>
                            <input
                              key={`stop-${simulationAsset?.id || "none"}`}
                              name={`simulation-stop-loss-${simulationAsset?.id || "none"}`}
                              className="authInput"
                              placeholder={simulationStopPlaceholder}
                              type="number"
                              step="0.01"
                              autoComplete="off"
                              value={simulationStopLoss}
                              onChange={(e) => setSimulationStopLoss(e.target.value)}
                            />
                            <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                              {simulationExitMode === "price"
                                ? "Stop loss is the price where you want to exit if the trade is not working."
                                : "Max loss is the total dollar loss where Rayla should close the trade."}
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                className="ghostButton"
                                onClick={() => {
                                  if (simulationUseExitPrice) setSimulationTakeProfit("");
                                  setSimulationUseExitPrice((prev) => !prev);
                                }}
                                style={simulationUseExitPrice ? { background: "rgba(124,196,255,0.16)", borderColor: "rgba(124,196,255,0.28)", color: "#f8fafc" } : undefined}
                              >
                                {simulationExitMode === "price"
                                  ? "Use take profit"
                                  : "Use profit target"}
                              </button>
                            </div>
                            {simulationUseExitPrice && (
                              <>
                                <input
                                  key={`target-${simulationAsset?.id || "none"}`}
                                  name={`simulation-take-profit-${simulationAsset?.id || "none"}`}
                                  className="authInput"
                                  placeholder={simulationTargetPlaceholder}
                                  type="number"
                                  step="0.01"
                                  autoComplete="off"
                                  value={simulationTakeProfit}
                                  onChange={(e) => setSimulationTakeProfit(e.target.value)}
                                />
                                <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                                  {simulationExitMode === "price"
                                    ? "Take profit is the price where you want to lock in a win."
                                    : "Profit target is the total dollar gain where Rayla should close the trade."}
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>

                      {simulationMode === "scenario" && (
                        <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>Scenario duration</div>
                          <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.55 }}>
                            Enter how long you want this training cycle to run. No limit keeps the scenario rolling continuously, while a set duration creates a bounded rep that can finish naturally.
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              className="ghostButton"
                              onClick={() => setSimulationScenarioNoLimit((prev) => !prev)}
                              style={simulationScenarioNoLimit ? { background: "rgba(124,196,255,0.16)", borderColor: "rgba(124,196,255,0.28)", color: "#f8fafc" } : undefined}
                            >
                              {simulationScenarioNoLimit ? "No Limit On" : "No Limit Off"}
                            </button>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))", gap: 8, opacity: simulationScenarioNoLimit ? 0.5 : 1 }}>
                            {[
                              { label: "Seconds", value: simulationScenarioSeconds, setter: setSimulationScenarioSeconds },
                              { label: "Minutes", value: simulationScenarioMinutes, setter: setSimulationScenarioMinutes },
                              { label: "Hours", value: simulationScenarioHours, setter: setSimulationScenarioHours },
                              { label: "Days", value: simulationScenarioDays, setter: setSimulationScenarioDays },
                              { label: "Weeks", value: simulationScenarioWeeks, setter: setSimulationScenarioWeeks },
                              { label: "Months", value: simulationScenarioMonths, setter: setSimulationScenarioMonths },
                              { label: "Years", value: simulationScenarioYears, setter: setSimulationScenarioYears },
                            ].map((field) => (
                              <input
                                key={field.label}
                                className="authInput"
                                type="number"
                                min="0"
                                step="1"
                                placeholder={field.label}
                                value={field.value}
                                disabled={simulationScenarioNoLimit}
                                onChange={(e) => field.setter(e.target.value)}
                              />
                            ))}
                          </div>
                          <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.55 }}>
                            {simulationScenarioNoLimit ? "Unlimited" : `Total duration: ${formatScenarioDurationSummary(scenarioDurationMs)}`}
                          </div>
                        </div>
                      )}

                      <div style={{ padding: 12, borderRadius: 12, background: "rgba(124,196,255,0.06)", border: "1px solid rgba(124,196,255,0.16)", display: "flex", flexDirection: "column", gap: 10, justifyContent: "space-between" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>Before you open</div>
                          <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                            {simulationMode === "scenario"
                              ? "Make sure your asset, scenario condition, size, and exit plan all make sense. The goal is practicing clean decisions in a structured market environment."
                              : "Make sure your asset, size, and exit plan all make sense. This is practice, so the goal is learning how to plan a trade clearly."}
                          </div>
                        </div>
                        {simulationMode === "scenario" ? (
                          <div
                            style={{
                              padding: "12px 14px",
                              borderRadius: 10,
                              background: "rgba(124,196,255,0.08)",
                              border: "1px solid rgba(124,196,255,0.18)",
                              fontSize: 13,
                              color: "#cbd5e1",
                              lineHeight: 1.6,
                            }}
                          >
                            Set up your trade, then press <span style={{ color: "#dbeafe", fontWeight: 700 }}>Play</span> on the chart to begin the scenario.
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="ghostButton"
                            onClick={handleOpenSimulationTrade}
                            disabled={!selectedSimulationItem || !!selectedSimulationOpenPosition}
                            style={selectedSimulationOpenPosition ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                          >
                            {selectedSimulationOpenPosition ? "Trade Active" : "Open Trade"}
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {showSimulationHelp && (
                      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                        {simulationAmountMode === "dollars"
                          ? "Amount in Dollars means your trade size is the total cash allocation."
                          : "Amount in Shares means your trade size is the number of shares or units."}
                        {" "}
                        {simulationExitMode === "price"
                          ? "Exit by Price uses chart price levels for stop loss and take profit."
                          : "Exit by P/L uses total trade profit or loss in dollars to auto-close the trade."}
                      </div>
                    )}
                    <div ref={setSimulationSectionRef("risk")} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, flexWrap: "wrap", fontSize: 12, color: "#94a3b8" }}>
                      {renderSimulationInfoButton("risk", "Risk help")}
                    </div>
                    {renderSimulationInfoCard("risk")}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "0 2px" }}>
                    <div style={{ fontSize: 13, color: "#e2e8f0" }}>
                      {selectedSimulationItem ? `${selectedSimulationItem.label} (${selectedSimulationItem.id})` : "No asset selected"}
                    </div>
                    <div style={{ fontSize: 13, color: "#94a3b8" }}>
                      {simulationMode === "scenario" ? "Scenario price" : "Current price"}: <span style={{ color: "#e2e8f0", fontWeight: 700 }}>
                        {selectedSimulationPrice != null ? `$${formatCompactPrice(selectedSimulationPrice)}` : "--"}
                      </span>
                    </div>
                  </div>

                  <div ref={setSimulationSectionRef("account")} style={getSimulationSectionStyle("account", { padding: 16, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 14 })}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7f8ea3" }}>
                          {simulationMode === "scenario" ? "Scenario simulator P/L" : "Live simulator P/L"}
                        </div>
                        {simulationMode === "scenario" && (
                          <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                            Based on Realistic mode trades.
                          </div>
                        )}
                      </div>
                      {renderSimulationInfoButton("account")}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Total P/L</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: simulationStatsTotalPnL >= 0 ? "#4ade80" : "#f87171" }}>
                          {`${simulationStatsTotalPnL >= 0 ? "+" : ""}$${simulationStatsTotalPnL.toFixed(2)}`}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Closed Trades</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0" }}>
                          {simulationStatsTradeHistory.length}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Avg P/L</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: simulationStatsProfile.avgProfitLoss >= 0 ? "#4ade80" : "#f87171" }}>
                          {`${simulationStatsProfile.avgProfitLoss >= 0 ? "+" : ""}$${simulationStatsProfile.avgProfitLoss.toFixed(2)}`}
                        </div>
                      </div>
                    </div>
                    {renderSimulationInfoCard("account")}
                  </div>

                  <div style={{ padding: 16, borderRadius: 14, background: "rgba(124,196,255,0.08)", border: "1px solid rgba(124,196,255,0.18)", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7CC4FF" }}>
                        Session Coach
                      </div>
                      <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                        {simulationStatsProfile.totalTrades} {simulationMode === "scenario" ? "realistic scenario" : "live"} trades
                      </div>
                    </div>

                    {simulationStatsProfile.totalTrades < 5 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>
                          Warming Up
                        </div>
                        <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                          Complete 5 simulation trades to unlock your trader profile and insights.
                        </div>
                        <div style={{ fontSize: 13, color: "#7CC4FF", fontWeight: 600 }}>
                          {`${simulationStatsProfile.totalTrades} / 5 trades logged`}
                        </div>
                      </div>
                    ) : simulationSessionInsights ? (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Win Rate</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>
                              {`${simulationStatsProfile.winRate.toFixed(1)}%`}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Avg P/L</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: simulationStatsProfile.avgProfitLoss >= 0 ? "#4ade80" : "#f87171" }}>
                              {`${simulationStatsProfile.avgProfitLoss >= 0 ? "+" : ""}$${simulationStatsProfile.avgProfitLoss.toFixed(2)}`}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Avg R</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: simulationStatsProfile.avgRMultiple == null ? "#e2e8f0" : simulationStatsProfile.avgRMultiple >= 0 ? "#4ade80" : "#f87171" }}>
                              {simulationStatsProfile.avgRMultiple == null ? "--" : `${simulationStatsProfile.avgRMultiple >= 0 ? "+" : ""}${simulationStatsProfile.avgRMultiple.toFixed(2)}R`}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Avg Duration</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>
                              {formatSimulationDuration(simulationStatsProfile.avgDurationMs)}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {[simulationSessionInsights.primaryStrength, simulationSessionInsights.primaryWeakness, simulationSessionInsights.directionBias, simulationSessionInsights.executionPattern, simulationSessionInsights.marketFitNote].filter(Boolean).slice(0, 5).map((insight) => (
                            <div key={insight} style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.6 }}>
                              • {insight}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>

                  <div ref={setSimulationSectionRef("chart")} style={getSimulationSectionStyle("chart", { display: "flex", flexDirection: "column", gap: 10, marginBottom: simulationMode === "scenario" ? 8 : 0 })}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7f8ea3" }}>
                        {simulationMode === "scenario" ? "Scenario Chart" : "Live Chart"}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {simulationMode === "scenario" && (
                          <>
                            <div style={{ fontSize: 12, color: "#94a3b8" }}>
                              {simulationScenarioType === "uptrend" ? "Uptrend" : simulationScenarioType === "downtrend" ? "Downtrend" : simulationScenarioType === "realistic" ? "Realistic" : "Range"} · {simulationScenarioNoLimit ? simulationScenarioSpeed : simulationScenarioPlaybackDuration}
                            </div>
                            <button
                              type="button"
                              className="ghostButton"
                              onClick={handleStartScenarioRep}
                              style={{ padding: "5px 10px", fontSize: 11, color: "#cbd5e1" }}
                            >
                              {!simulationScenarioIsPlaying && scenarioPlaybackElapsedMsRef.current === 0
                                ? "Play"
                                : simulationScenarioIsPlaying
                                  ? "Pause"
                                  : "Resume"}
                            </button>
                          </>
                        )}
                        {simulationMode === "live" && (
                          <>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                {["1D", "1W", "1M", "3M", "1Y", "5Y", "MAX"].map((range) => (
                                  <button
                                    key={range}
                                    type="button"
                                    className="ghostButton"
                                    onClick={() => setSimulationLiveChartRange(range)}
                                    style={{
                                      padding: "3px 9px",
                                      fontSize: 10,
                                      borderRadius: 6,
                                      borderColor: simulationLiveChartRange === range ? "rgba(124,196,255,0.5)" : "rgba(255,255,255,0.1)",
                                      background: simulationLiveChartRange === range ? "rgba(124,196,255,0.13)" : "transparent",
                                      color: simulationLiveChartRange === range ? "#d7efff" : "#7f8ea3",
                                      fontWeight: 700,
                                      letterSpacing: "0.5px",
                                    }}
                                  >
                                    {range}
                                  </button>
                                ))}
                              </div>
                              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                {[["line", "Line"], ["candlestick", "Candles"]].map(([mode, label]) => (
                                  <button
                                    key={mode}
                                    type="button"
                                    className="ghostButton"
                                    onClick={() => setSimulationLiveChartMode(mode)}
                                    style={{
                                      padding: "3px 9px",
                                      fontSize: 10,
                                      borderRadius: 6,
                                      borderColor: simulationLiveChartMode === mode ? "rgba(124,196,255,0.5)" : "rgba(255,255,255,0.1)",
                                      background: simulationLiveChartMode === mode ? "rgba(124,196,255,0.13)" : "transparent",
                                      color: simulationLiveChartMode === mode ? "#d7efff" : "#7f8ea3",
                                      fontWeight: 700,
                                      letterSpacing: "0.5px",
                                    }}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {simulationLiveChartLastUpdated && (
                              <div style={{ fontSize: 10, color: "#7f8ea3" }}>
                                Updated {simulationLiveChartLastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            )}
                          </>
                        )}
                        {renderSimulationInfoButton("chart")}
                      </div>
                    </div>
                  <div className="tradingviewFrameWrapFull" style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, overflow: "hidden" }}>
                    {simulationMode === "scenario" ? (
                      <div style={{ minHeight: 336, padding: 16, background: "linear-gradient(180deg, rgba(8,12,18,0.99) 0%, rgba(11,16,25,0.96) 52%, rgba(9,14,22,0.99) 100%)", display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ fontSize: 11, color: "#7f8ea3", letterSpacing: "1px", textTransform: "uppercase" }}>Scenario Price</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: "#f8fafc", lineHeight: 1 }}>
                              {selectedSimulationPrice != null ? `$${formatCompactPrice(selectedSimulationPrice)}` : "--"}
                            </div>
                          </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <div style={{ padding: "5px 10px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 11, color: "#cbd5e1" }}>
                              Scenario Training
                          </div>
                          <div style={{ padding: "5px 10px", borderRadius: 999, background: "rgba(124,196,255,0.08)", border: "1px solid rgba(124,196,255,0.16)", fontSize: 11, color: "#dbeafe" }}>
                            {simulationScenarioType === "uptrend" ? "Uptrend" : simulationScenarioType === "downtrend" ? "Downtrend" : simulationScenarioType === "realistic" ? "Realistic" : "Range"}
                          </div>
                          <div style={{ padding: "5px 10px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 11, color: "#cbd5e1" }}>
                            {simulationScenarioNoLimit ? simulationScenarioSpeed : simulationScenarioPlaybackDuration}
                          </div>
                          <div style={{ display: "flex", gap: 6, marginLeft: 2 }}>
                            <button
                              type="button"
                              className="ghostButton"
                              onClick={handleStartScenarioRep}
                              style={{ padding: "5px 10px", fontSize: 11, color: "#cbd5e1" }}
                            >
                              {simulationScenarioIsPlaying
                                ? "Pause"
                                : simulationScenarioTick > 0 || scenarioPlaybackElapsedMsRef.current > 0
                                  ? "Resume"
                                  : "Play"}
                            </button>
                            <button
                              type="button"
                              className="ghostButton"
                              onClick={resetScenarioPlayback}
                              style={{ padding: "5px 10px", fontSize: 11, color: "#cbd5e1" }}
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                          Structured generated movement for practice. Use it like a training market, not a live feed.
                        </div>
                        {guidedScenarioActive && guidedScenarioMessage && (
                          <div style={{ alignSelf: "flex-start", maxWidth: 420, padding: 12, borderRadius: 12, background: "rgba(124,196,255,0.08)", border: "1px solid rgba(124,196,255,0.18)", boxShadow: "0 12px 24px rgba(8,12,18,0.18)" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.3px", textTransform: "uppercase", color: "#7CC4FF", marginBottom: 6 }}>
                              Rayla Guidance
                            </div>
                            <div style={{ fontSize: 12, color: "#dbeafe", lineHeight: 1.6 }}>
                              {guidedScenarioMessage}
                            </div>
                          </div>
                        )}
                        <div style={{ flex: 1, minHeight: 336, borderRadius: 16, border: "1px solid rgba(124,196,255,0.14)", background: "linear-gradient(180deg, rgba(255,255,255,0.022) 0%, rgba(255,255,255,0.008) 100%)", padding: 10, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)" }}>
                          <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 316, paddingRight: 58, paddingBottom: 26 }}>
                              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", top: 0, left: 0, right: 58, bottom: 26, width: "calc(100% - 58px)", height: "calc(100% - 26px)" }}>
                                {[14, 28, 42, 56, 70, 84].map((y) => (
                                  <line key={`h-${y}`} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="0.55" />
                                ))}
                                {[12, 24, 36, 48, 60, 72, 84].map((x) => (
                                  <line key={`v-${x}`} x1={x} y1="10" x2={x} y2="90" stroke="rgba(255,255,255,0.035)" strokeWidth="0.55" />
                                ))}
                                <line x1={scenarioNowX} y1="10" x2={scenarioNowX} y2="90" stroke="rgba(124,196,255,0.12)" strokeWidth="0.7" strokeDasharray="1.2 2.8" />
                                <polyline points={scenarioChartPoints} fill="none" stroke="rgba(124,196,255,0.42)" strokeWidth="1.15" strokeLinejoin="round" strokeLinecap="round" />
                                {scenarioChartRecentPoints ? (
                                  <polyline points={scenarioChartRecentPoints} fill="none" stroke="#d7efff" strokeWidth="1.55" strokeLinejoin="round" strokeLinecap="round" />
                                ) : null}
                                {selectedSimulationOpenPosition && scenarioEntryPoint ? (
                                  <>
                                    <line x1={scenarioEntryPoint.x} y1="10" x2={scenarioEntryPoint.x} y2="90" stroke="rgba(255,255,255,0.12)" strokeWidth="0.65" strokeDasharray="2 3" />
                                    <circle cx={scenarioEntryPoint.x} cy={scenarioEntryPoint.y} r="1.15" fill="#f8fafc" />
                                    <text x={scenarioEntryPoint.x} y={scenarioEntryLabelY} textAnchor="middle" fill="rgba(248,250,252,0.82)" fontSize="3.2">
                                      Entry
                                    </text>
                                  </>
                                ) : null}
                                {scenarioChartCurrentPoint ? (
                                  <>
                                    {scenarioChartCurrentPoint.x > scenarioNowX ? (
                                      <line x1={scenarioChartCurrentPoint.x} y1="10" x2={scenarioChartCurrentPoint.x} y2="90" stroke="rgba(124,196,255,0.09)" strokeWidth="0.65" strokeDasharray="1.2 2.8" />
                                    ) : null}
                                    <circle cx={scenarioChartCurrentPoint.x} cy={scenarioChartCurrentPoint.y} r={Math.max(1.5, scenarioChartPulseRadius - 0.45)} fill="rgba(124,196,255,0.16)" />
                                    <circle cx={scenarioChartCurrentPoint.x} cy={scenarioChartCurrentPoint.y} r="1.1" fill="#eaf6ff" />
                                    {selectedSimulationOpenPosition ? (
                                      <text x={scenarioChartCurrentPoint.x} y={scenarioCurrentLabelY} textAnchor="middle" fill="rgba(191,229,255,0.82)" fontSize="3.2">
                                        Current
                                      </text>
                                    ) : null}
                                  </>
                                ) : null}
                              </svg>
                              <div style={{ position: "absolute", top: 0, right: 0, bottom: 26, width: 54, pointerEvents: "none", borderLeft: "1px solid rgba(255,255,255,0.06)", background: "linear-gradient(180deg, rgba(8,12,18,0.36) 0%, rgba(8,12,18,0.18) 100%)" }}>
                                {scenarioChartScale.map((mark) => (
                                  <div
                                    key={`${mark.y}-${mark.label}`}
                                    style={{
                                      position: "absolute",
                                      top: `${mark.y}%`,
                                      right: 6,
                                      transform: "translateY(-50%)",
                                      fontSize: 11,
                                      color: "#7f8ea3",
                                      lineHeight: 1,
                                      letterSpacing: "0.2px",
                                    }}
                                  >
                                    {mark.label}
                                  </div>
                                ))}
                              </div>
                              <div style={{ position: "absolute", left: 0, right: 58, bottom: 4, height: 18, fontSize: 11, color: "#7f8ea3", letterSpacing: "0.2px", pointerEvents: "none" }}>
                                <span style={{ position: "absolute", left: 0, bottom: 0 }}>
                                  {scenarioAxisLeftLabel}
                                </span>

                                <span style={{ position: "absolute", left: "14%", bottom: 0, transform: "translateX(-50%)" }}>
                                  {scenarioAxisMidLabel}
                                </span>

                                <span style={{ position: "absolute", right: 0, bottom: 0 }}>
                                  {scenarioAxisRightLabel}
                                </span>
                              </div>
                          </div>
                        </div>
                      </div>
                    ) : selectedSimulationItem ? (
                      <div style={{ height: 440, minHeight: 440, background: "#0d1117", paddingBottom: 10 }}>
                        {simulationLiveChartLoading && simulationLiveChartBars.length < 2 ? (
                          <div style={{ minHeight: 440, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8" }}>
                            Loading chart...
                          </div>
                        ) : simulationLiveChartBars.length < 2 ? (
                          <div style={{ minHeight: 440, display: "flex", flexDirection: "column", gap: 6, alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "0 24px" }}>
                            <div>Chart unavailable</div>
                            <div>Alpaca does not provide chart bars for this asset yet, but live quote data is still available and was added to your watchlist.</div>
                          </div>
                        ) : (
                          <TradeChart
                            bars={simulationLiveChartBars}
                            mode={simulationLiveChartMode}
                            latestPrice={selectedSimulationPrice}
                            assetSymbol={selectedSimulationItem.id}
                            assetName={selectedSimulationItem.description || selectedSimulationItem.name || selectedSimulationItem.id}
                            height={440}
                          />
                        )}
                      </div>
                    ) : null}
                  </div>
                  {renderSimulationInfoCard("chart")}
                  </div>

                  {visibleSimulationPositions.length > 0 && (
                    <div ref={setSimulationSectionRef("open-position")} style={getSimulationSectionStyle("open-position", { padding: 16, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 14 })}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7f8ea3" }}>
                          Open Trades
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {renderSimulationInfoButton("open-position")}
                          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#4ade80", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 999, padding: "5px 10px" }}>
                            {simulationModeLabel}
                          </div>
                          <div style={{ fontSize: 12, color: "#94a3b8" }}>
                            {visibleSimulationPositions.length} open
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {visibleSimulationPositions.map((position) => {
                          const currentPrice = getSimulationPrice(position.asset, position.marketMode || simulationMode);
                          const hasCurrentPrice = Number.isFinite(currentPrice);
                          const currentLiveQuote = getLiveQuoteByAssetId(simulationQuotes, position.asset, position.type, position.tvSymbol);
                          const metrics = Number.isFinite(currentPrice)
                            ? calculateSimulationPnL(position, currentPrice)
                            : { profitLoss: 0, rMultiple: null };

                          return (
                            <div key={position.id} style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 14 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                <div>
                                  <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>{position.asset}</div>
                                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                                    {position.label || position.asset} · {position.direction === "short" ? "Short" : "Long"} · {position.marketMode === "scenario" ? "Scenario" : "Live"} · Time in trade {formatTimeInTrade(position)}
                                  </div>
                                </div>
                                <button type="button" className="ghostButton" onClick={() => handleCloseSimulationTrade(position.id)}>
                                  Close Trade
                                </button>
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                                <div>
                                  <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Entry Price</div>
                                  <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>${formatCompactPrice(position.entryPrice)}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>
                                    {position.exitMode === "pnl" ? "Max Loss" : "Stop Loss"}
                                  </div>
                                  <div style={{ fontSize: 18, fontWeight: 700, color: "#f87171" }}>
                                    {position.stopLoss != null
                                      ? position.exitMode === "pnl"
                                        ? `-$${formatCompactPrice(position.stopLoss)}`
                                        : `$${formatCompactPrice(position.stopLoss)}`
                                      : "--"}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>
                                    {position.exitMode === "pnl" ? "Profit Target" : "Take Profit"}
                                  </div>
                                  <div style={{ fontSize: 18, fontWeight: 700, color: "#4ade80" }}>
                                    {position.takeProfit != null
                                      ? position.exitMode === "pnl"
                                        ? `+$${formatCompactPrice(position.takeProfit)}`
                                        : `$${formatCompactPrice(position.takeProfit)}`
                                      : "--"}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Current Price</div>
                                  <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>
                                    {hasCurrentPrice ? `$${formatCompactPrice(currentPrice)}` : "--"}
                                  </div>
                                  {(position.marketMode || simulationMode) === "live" && (
                                    <div style={{ fontSize: 11, color: "#7f8ea3", marginTop: 4 }}>
                                      Last updated {formatQuoteUpdatedAt(currentLiveQuote?.updatedAt)}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Unrealized P/L</div>
                                  <div style={{ fontSize: 18, fontWeight: 700, color: !hasCurrentPrice ? "#94a3b8" : metrics.profitLoss >= 0 ? "#4ade80" : "#f87171" }}>
                                    {hasCurrentPrice ? `${metrics.profitLoss >= 0 ? "+" : ""}$${metrics.profitLoss.toFixed(2)}` : "--"}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Unrealized R</div>
                                  <div style={{ fontSize: 18, fontWeight: 700, color: !hasCurrentPrice || metrics.rMultiple == null ? "#94a3b8" : metrics.rMultiple >= 0 ? "#4ade80" : "#f87171" }}>
                                    {!hasCurrentPrice || metrics.rMultiple == null ? "--" : `${metrics.rMultiple >= 0 ? "+" : ""}${metrics.rMultiple.toFixed(2)}R`}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Planned Risk</div>
                                  <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>
                                    {position.plannedRisk != null ? `$${position.plannedRisk.toFixed(2)}` : "--"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {activeGuidedSimulation && (
                        <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                          Guided trade is live — manage it according to your plan.
                        </div>
                      )}
                      {renderSimulationInfoCard("open-position")}
                    </div>
                  )}

                  {visibleSimulationClosedTrade && (
                    <div ref={setSimulationSectionRef("summary")} style={getSimulationSectionStyle("summary", { padding: 16, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" })}>
                      {isActiveGuidedTradeClosed && (
                        <div style={{ marginBottom: 14, padding: 14, borderRadius: 12, background: "rgba(124,196,255,0.08)", border: "1px solid rgba(124,196,255,0.18)", display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: "#7CC4FF" }}>
                              Guided First Trade Complete
                            </div>
                            <div style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(74,222,128,0.14)", border: "1px solid rgba(74,222,128,0.22)", fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#4ade80" }}>
                              Completed
                            </div>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.4 }}>
                            {visibleSimulationClosedTrade.asset}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.6 }}>
                              • You completed your first guided {simulationMode === "scenario" ? "scenario" : "simulation"} trade.
                            </div>
                            <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.6 }}>
                              • {visibleSimulationClosedTrade.profitLoss > 0
                                ? "Nice job — this one closed green."
                                : visibleSimulationClosedTrade.profitLoss < 0
                                  ? "That one did not work, which is normal. The win is completing the process with a review."
                                  : "That trade finished flat, which still counts as completing the process with a review."}
                            </div>
                            <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.6 }}>
                              • {visibleSimulationClosedTrade.executionGrade === "A" || visibleSimulationClosedTrade.executionGrade === "B"
                                ? "Your execution was solid for this rep."
                                : "The goal now is learning what to tighten up on the next rep."}
                            </div>
                            <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.6 }}>
                              • Review the summary below, then either try another simulation or replay guided mode later.
                            </div>
                          </div>
                          <div>
                            <button
                              type="button"
                              className="ghostButton"
                              style={{ background: "rgba(124,196,255,0.18)", borderColor: "rgba(124,196,255,0.38)", color: "#f8fafc", fontWeight: 700 }}
                              onClick={() => {
                                setActiveGuidedSimulation(null);
                                setHasCompletedFirstTradeOnboarding(true);
                                setHasAttemptedFirstTradeOnboardingAutoStart(true);
                                showToast("Guided first trade complete.", "success");
                              }}
                            >
                              Finish Guided Trade
                            </button>
                          </div>
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7f8ea3" }}>
                          Trade Summary
                        </div>
                        {renderSimulationInfoButton("summary")}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ minWidth: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: visibleSimulationClosedTrade.executionGrade === "A" ? "rgba(74,222,128,0.14)" : visibleSimulationClosedTrade.executionGrade === "B" ? "rgba(124,196,255,0.14)" : visibleSimulationClosedTrade.executionGrade === "C" ? "rgba(255,255,255,0.08)" : "rgba(248,113,113,0.14)", border: visibleSimulationClosedTrade.executionGrade === "A" ? "1px solid rgba(74,222,128,0.24)" : visibleSimulationClosedTrade.executionGrade === "B" ? "1px solid rgba(124,196,255,0.24)" : visibleSimulationClosedTrade.executionGrade === "C" ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(248,113,113,0.24)", fontSize: 20, fontWeight: 800, color: visibleSimulationClosedTrade.executionGrade === "D" ? "#f87171" : "#e2e8f0" }}>
                            {visibleSimulationClosedTrade.executionGrade}
                          </div>
                          <div>
                            <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 2 }}>Execution Grade</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>
                              {visibleSimulationClosedTrade.executionGradeLabel}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Outcome</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: visibleSimulationClosedTrade.profitLoss >= 0 ? "#4ade80" : "#f87171" }}>
                            {visibleSimulationClosedTrade.outcomeLabel}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Profit/Loss</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: visibleSimulationClosedTrade.profitLoss >= 0 ? "#4ade80" : "#f87171" }}>
                            {`${visibleSimulationClosedTrade.profitLoss >= 0 ? "+" : ""}$${visibleSimulationClosedTrade.profitLoss.toFixed(2)}`}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>R Multiple</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: visibleSimulationClosedTrade.rMultiple == null ? "#e2e8f0" : visibleSimulationClosedTrade.rMultiple >= 0 ? "#4ade80" : "#f87171" }}>
                            {visibleSimulationClosedTrade.rMultiple == null ? "--" : `${visibleSimulationClosedTrade.rMultiple >= 0 ? "+" : ""}${visibleSimulationClosedTrade.rMultiple.toFixed(2)}R`}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Time in Trade</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>
                            {formatSimulationDuration(visibleSimulationClosedTrade.durationMs)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Exit</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: visibleSimulationClosedTrade.exitReason.includes("Target") ? "#4ade80" : visibleSimulationClosedTrade.exitReason.includes("Stop") ? "#f87171" : "#e2e8f0" }}>
                            {visibleSimulationClosedTrade.exitReason}
                          </div>
                        </div>
                      </div>
                    <div style={{ marginTop: 14, fontSize: 13, color: "#e2e8f0", lineHeight: 1.6 }}>
                      {visibleSimulationClosedTrade.coachingInsight}
                    </div>
                    {visibleSimulationClosedTrade.scenarioCoachingNote && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "#7CC4FF", lineHeight: 1.6 }}>
                        {visibleSimulationClosedTrade.scenarioCoachingNote}
                      </div>
                    )}
                    <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                      {visibleSimulationClosedTrade.nextStep}
                    </div>
                    {renderSimulationInfoCard("summary")}
                  </div>
                )}

                  <div ref={setSimulationSectionRef("history")} style={getSimulationSectionStyle("history", { padding: 16, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 14 })}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7f8ea3" }}>
                        Trade History
                      </div>
                      {renderSimulationInfoButton("history")}
                    </div>
                    {visibleSimulationTradeHistory.length ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {visibleSimulationTradeHistory.slice(0, 8).map((trade, index) => (
                          <div
                            key={`${trade.asset}-${trade.closedAt || index}`}
                            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                          >
                            <div>
                              <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Asset</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{trade.asset}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Direction</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", textTransform: "capitalize" }}>{trade.direction}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Entry Price</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>${formatCompactPrice(trade.entryPrice)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Exit Price</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>${formatCompactPrice(trade.exitPrice)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Profit/Loss</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: trade.profitLoss >= 0 ? "#4ade80" : "#f87171" }}>
                                {`${trade.profitLoss >= 0 ? "+" : ""}$${trade.profitLoss.toFixed(2)}`}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>R Multiple</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: trade.rMultiple == null ? "#e2e8f0" : trade.rMultiple >= 0 ? "#4ade80" : "#f87171" }}>
                                {trade.rMultiple == null ? "--" : `${trade.rMultiple >= 0 ? "+" : ""}${trade.rMultiple.toFixed(2)}R`}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Exit Reason</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{trade.exitReason}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: "#94a3b8" }}>
                        No closed {simulationMode === "scenario" ? "scenario" : "live"} trades yet.
                      </div>
                    )}
                    {renderSimulationInfoCard("history")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "ai" && (
          <div className="mainGrid">
            <div className="span12" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <CoachAskBox trades={trades} onAskRayla={requestRaylaAnswer} isLoading={isRaylaLoading} />
              <AICoachTab trades={trades} onRunAnalysis={runAIAnalysis} showNoNewTrades={showNoNewTrades} coachSummary={coachSummary} />
            </div>
          </div>
        )}

        {activeTab === "ask" && (
          <div className="card">
            <div className="cardHeader">
              <h2>Ask Rayla</h2>
            </div>

            <div className="cardBody" style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              <div style={{ fontSize: 13, color: "#94a3b8" }}>
                Ask anything about trading, your performance, the market, or the Rayla app.
              </div>
              {capitalGuideState.active && (
                <div style={{ fontSize: 12, color: "#7CC4FF", lineHeight: 1.5 }}>
                  Capital Guide is active. Answer the current question to keep going.
                </div>
              )}
              {activeCapitalGuideQuestion && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                    Choose the best fit for this step:
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {activeCapitalGuideQuestion.options.map((option) => (
                      <button
                        key={`${activeCapitalGuideQuestion.key}-${option}`}
                        type="button"
                        className="ghostButton"
                        disabled={isRaylaLoading}
                        onClick={async () => {
                          try {
                            await handleAskRaylaQuestion(option, { clearInput: true });
                          } catch (err) {
                            console.error("CAPITAL GUIDE OPTION ERROR:", err);
                          }
                        }}
                        style={{
                          padding: "8px 12px",
                          fontSize: 12,
                          color: "#e2e8f0",
                          borderColor: "rgba(124,196,255,0.2)",
                          background: "rgba(124,196,255,0.08)",
                        }}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <textarea
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Ask Rayla anything..."
                style={{
                  width: "100%",
                  minHeight: 100,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(0,0,0,0.2)",
                  color: "#e2e8f0",
                  padding: 10,
                  fontSize: 14,
                  resize: "none"
                }}
              />

              {isRaylaLoading && (
                <div style={{ fontSize: 13, color: "#94a3b8" }}>
                  Rayla is thinking...
                </div>
              )}

              <button
                className="ghostButton"
                onClick={async () => {
                try {
                  await handleAskRaylaQuestion(aiInput, { clearInput: true });
                } catch (err) {
                  console.error("ASK RAYLA FETCH ERROR:", err);
                }
              }}
              >
                Ask Rayla
              </button>

              {raylaResponse && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 12,
                    borderRadius: 10,
                    background: "rgba(124,196,255,0.08)",
                    border: "1px solid rgba(124,196,255,0.2)",
                    fontSize: 14,
                    lineHeight: 1.6
                  }}
                >
                  {raylaResponse}
                </div>
              )}
              {capitalGuideResult?.directions?.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {capitalGuideResult.directions.map((direction) => (
                    <div
                      key={direction.id}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{direction.title}</div>
                      <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>{direction.body}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{direction.fit}</div>
                      <div>
                        <button
                          type="button"
                          className="ghostButton"
                          onClick={() => handleTryCapitalGuideInScenario(direction)}
                        >
                          Try in Scenario
                        </button>
                      </div>
                    </div>
                  ))}
                  {capitalGuideResult.confidenceLine && (
                    <div style={{ fontSize: 12, color: "#7f8ea3", lineHeight: 1.6 }}>
                      {capitalGuideResult.confidenceLine}
                    </div>
                  )}
                </div>
              ) : null}

            </div>
          </div>
        )}

        {activeTab === "intel" && (
          <div className="mainGrid">
            <div className="span12">
              <div className="card">
                <h3>Market Intel</h3>
                <div className="card" style={{ marginTop: 24 }}>
                  <h4>Ask Rayla About The Market</h4>
                  <form onSubmit={async e => {
                    e.preventDefault();
                    const question = e.target.elements.raylaq.value.trim();
                    if (!question) return;
                    try {
                      await handleAskRaylaQuestion(question);
                      e.target.reset();
                    } catch {
                      setRaylaResponse("API error.");
                    }
                  }} style={{ marginBottom: 16 }}>
                    <input name="raylaq" type="text" placeholder="e.g. Is NVDA hot or cold today? What's the signal on BTC?" style={{ flex: 1, marginRight: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#e2e8f0", outline: "none" }} autoComplete="off" disabled={isRaylaLoading} />
                    <button type="submit" disabled={isRaylaLoading} style={{ background: "#7CC4FF", color: "#0b1017", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Ask Rayla</button>
                  </form>
                  {isRaylaLoading && <div style={{ fontSize: 13, color: "#7f8ea3", marginTop: 8 }}>Thinking...</div>}
                  {raylaResponse && (
                    <div style={{ marginTop: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12 }}>
                      <div style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "#e2e8f0", lineHeight: 1.6 }}>{raylaResponse}</div>
                    </div>
                  )}
                </div>
                {(intelLoading || !hotColdReport) && <div className="listSubtext" style={{ marginTop: "10px" }}>Loading today's report...</div>}
                {hotColdReport && (
                  <>
                    {[["Hot Stocks", "#ef4444", hotColdReport.stockHot], ["Cold Stocks", "#7CC4FF", hotColdReport.stockCold]].map(([label, color, items]) => (
                      <div key={label} style={{ marginTop: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7f8ea3" }}>{label}</div>
                        </div>
                        {items?.slice(0, 3).map((item) => <IntelAssetCard key={`${label}-${item.symbol}`} item={item} onTrySimulation={handleTryIntelInSimulation} />)}
                      </div>
                    ))}
                    {[["Hot Crypto", "#ef4444", hotColdReport.cryptoHot], ["Cold Crypto", "#7CC4FF", hotColdReport.cryptoCold]].map(([label, color, item]) => (
                      <div key={label} style={{ marginTop: "22px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7f8ea3" }}>{label}</div>
                        </div>
                        {item && <IntelAssetCard item={item} onTrySimulation={handleTryIntelInSimulation} />}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

       {activeTab === "profile" && (
  <div className="mainGrid">
    <div className="span12">
      <div className="card profileCard">
        <h3>Profile</h3>
        <div className="list">
          <div className="listRow">
            <div>
              <input className="authInput" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              <div className="listSubtext">{user?.email || "No email found"}</div>
                            <div style={{ marginTop: 16 }}>
                <div className="listSubtext" style={{ marginBottom: 8 }}>
                  User Level
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="ghostButton"
                    onClick={() => handleUserLevelChange("beginner")}
                    style={{
                      border: userLevel === "beginner" ? "1px solid #7CC4FF" : undefined,
                      background: userLevel === "beginner" ? "rgba(124,196,255,0.12)" : undefined
                    }}
                  >
                    Beginner
                  </button>

                  <button
                    type="button"
                    className="ghostButton"
                    onClick={() => handleUserLevelChange("intermediate")}
                    style={{
                      border: userLevel === "intermediate" ? "1px solid #7CC4FF" : undefined,
                      background: userLevel === "intermediate" ? "rgba(124,196,255,0.12)" : undefined
                    }}
                  >
                    Intermediate
                  </button>

                  <button
                    type="button"
                    className="ghostButton"
                    onClick={() => handleUserLevelChange("experienced")}
                    style={{
                      border: userLevel === "experienced" ? "1px solid #7CC4FF" : undefined,
                      background: userLevel === "experienced" ? "rgba(124,196,255,0.12)" : undefined
                    }}
                  >
                    Experienced
                  </button>
                </div>
              </div>
            </div>
          </div>
          <button className="ghostButton" type="button" onClick={async () => {
            const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
            if (error) { showToast("Could not save name.", "error"); return; }
            showToast("Name updated.", "success");
            window.location.reload();
          }}>Save Name</button>
          <button className="ghostButton" type="button" onClick={() => setShowTutorial(true)}>View Tutorial</button>
          <button className="ghostButton" type="button" onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}>Sign Out</button>
          <button className="ghostButton" type="button" onClick={handleDeleteAccount}>
            Delete Account
          </button>
          <div className="listRow"><div><div className="listTitle">Trades Logged</div><div className="listSubtext">{trades.length}</div></div></div>
          <div className="listRow"><div><div className="listTitle">Win Rate</div><div className="listSubtext">{winRate}</div></div></div>
          <div className="listRow"><div><div className="listTitle">Average R</div><div className="listSubtext">{avgR}</div></div></div>
        </div>
      </div>
      <SubscriptionCard />
    </div>
  </div>
)}



        <div className="mobileNav">
          {NAV_TABS.map(tab => (
            <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => { setActiveTab(tab.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              {tab.icon}<span>{tab.label}</span>
            </button>
          ))}
          <button className={activeTab === "profile" ? "active" : ""} onClick={() => { setActiveTab("profile"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <User size={18} /><span>Profile</span>
          </button>
        </div>
        {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
      </div>
    </div>
  );
}
