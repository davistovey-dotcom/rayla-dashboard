import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import Login from "./Login";
import { supabase } from "./supabase";
import TradeChart from "./TradeChart";
import KLineTradeChart from "./KLineTradeChart";
import TradingViewLiveChart from "./TradingViewLiveChart";
import EquityComparisonChart from "./EquityComparisonChart";
import AssetCarousel from "./components/AssetCarousel";
import MobileSegmentedPager from "./components/MobileSegmentedPager";
import { LayoutDashboard, PlusSquare, Brain, User, ClipboardList, Target, Gamepad2, BookOpen } from "lucide-react";
import { Tutorial } from "./Login";

const CRYPTO_SYMBOL_SET = new Set(["BTC","ETH","SOL","XRP","DOGE","BNB","ADA","AVAX","LINK","MATIC","DOT","UNI","ATOM","LTC","BCH","ALGO","NEAR","FTM","SAND","MANA","TRX","TRON"]);
const DEBUG_CHARTS = import.meta.env.VITE_DEBUG_CHARTS === "true";
const TICKER_ALIASES = {
  APPL: "AAPL",
  APPLE: "AAPL",
  TESLA: "TSLA",
  GOOGLE: "GOOGL",
  ALPHABET: "GOOGL",
  AMAZON: "AMZN",
  NVIDIA: "NVDA",
  MICROSOFT: "MSFT",
};

function resolveTickerAlias(raw) {
  const upper = String(raw || "").trim().toUpperCase();
  return TICKER_ALIASES[upper] || upper;
}
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
  { symbol: "SHIB", description: "Shiba Inu", exchange: "CRYPTO", type: "crypto" },
  { symbol: "APT", description: "Aptos", exchange: "CRYPTO", type: "crypto" },
  { symbol: "ARB", description: "Arbitrum", exchange: "CRYPTO", type: "crypto" },
  { symbol: "OP", description: "Optimism", exchange: "CRYPTO", type: "crypto" },
  { symbol: "SUI", description: "Sui", exchange: "CRYPTO", type: "crypto" },
  { symbol: "INJ", description: "Injective", exchange: "CRYPTO", type: "crypto" },
  { symbol: "FIL", description: "Filecoin", exchange: "CRYPTO", type: "crypto" },
  { symbol: "ICP", description: "Internet Computer", exchange: "CRYPTO", type: "crypto" },
  { symbol: "HBAR", description: "Hedera", exchange: "CRYPTO", type: "crypto" },
  { symbol: "VET", description: "VeChain", exchange: "CRYPTO", type: "crypto" },
];

const SUPPORTED_POPULAR_STOCKS = [
  { symbol: "AAPL", description: "Apple Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "MSFT", description: "Microsoft Corp.", exchange: "NASDAQ", type: "stock" },
  { symbol: "NVDA", description: "NVIDIA Corp.", exchange: "NASDAQ", type: "stock" },
  { symbol: "TSLA", description: "Tesla Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "AMZN", description: "Amazon.com Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "GOOGL", description: "Alphabet Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "META", description: "Meta Platforms Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "NFLX", description: "Netflix Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "AMD", description: "Advanced Micro Devices", exchange: "NASDAQ", type: "stock" },
  { symbol: "INTC", description: "Intel Corp.", exchange: "NASDAQ", type: "stock" },
  { symbol: "PYPL", description: "PayPal Holdings", exchange: "NASDAQ", type: "stock" },
  { symbol: "COIN", description: "Coinbase Global", exchange: "NASDAQ", type: "stock" },
  { symbol: "HOOD", description: "Robinhood Markets", exchange: "NASDAQ", type: "stock" },
  { symbol: "PLTR", description: "Palantir Technologies", exchange: "NYSE", type: "stock" },
  { symbol: "RBLX", description: "Roblox Corp.", exchange: "NYSE", type: "stock" },
  { symbol: "UBER", description: "Uber Technologies", exchange: "NYSE", type: "stock" },
  { symbol: "ABNB", description: "Airbnb Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "SHOP", description: "Shopify Inc.", exchange: "NYSE", type: "stock" },
  { symbol: "SNOW", description: "Snowflake Inc.", exchange: "NYSE", type: "stock" },
  { symbol: "NET", description: "Cloudflare Inc.", exchange: "NYSE", type: "stock" },
  { symbol: "CRWD", description: "CrowdStrike Holdings", exchange: "NASDAQ", type: "stock" },
  { symbol: "DKNG", description: "DraftKings Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "RIVN", description: "Rivian Automotive", exchange: "NASDAQ", type: "stock" },
  { symbol: "NIO", description: "NIO Inc.", exchange: "NYSE", type: "stock" },
  { symbol: "LCID", description: "Lucid Group", exchange: "NASDAQ", type: "stock" },
  { symbol: "GME", description: "GameStop Corp.", exchange: "NYSE", type: "stock" },
  { symbol: "AMC", description: "AMC Entertainment", exchange: "NYSE", type: "stock" },
  { symbol: "JPM", description: "JPMorgan Chase & Co.", exchange: "NYSE", type: "stock" },
  { symbol: "BAC", description: "Bank of America Corp.", exchange: "NYSE", type: "stock" },
  { symbol: "GS", description: "Goldman Sachs Group", exchange: "NYSE", type: "stock" },
  { symbol: "JNJ", description: "Johnson & Johnson", exchange: "NYSE", type: "stock" },
  { symbol: "PFE", description: "Pfizer Inc.", exchange: "NYSE", type: "stock" },
  { symbol: "MRNA", description: "Moderna Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "XOM", description: "Exxon Mobil Corp.", exchange: "NYSE", type: "stock" },
  { symbol: "CVX", description: "Chevron Corp.", exchange: "NYSE", type: "stock" },
  { symbol: "DIS", description: "Walt Disney Co.", exchange: "NYSE", type: "stock" },
  { symbol: "BA", description: "Boeing Co.", exchange: "NYSE", type: "stock" },
  { symbol: "F", description: "Ford Motor Co.", exchange: "NYSE", type: "stock" },
  { symbol: "GM", description: "General Motors Co.", exchange: "NYSE", type: "stock" },
  { symbol: "SPY", description: "SPDR S&P 500 ETF", exchange: "AMEX", type: "stock" },
  { symbol: "QQQ", description: "Invesco QQQ ETF (Nasdaq 100)", exchange: "NASDAQ", type: "stock" },
  { symbol: "IWM", description: "iShares Russell 2000 ETF", exchange: "AMEX", type: "stock" },
  { symbol: "GLD", description: "SPDR Gold Shares ETF", exchange: "AMEX", type: "stock" },
  { symbol: "TLT", description: "iShares 20+ Year Treasury Bond ETF", exchange: "NASDAQ", type: "stock" },
  { symbol: "ARKK", description: "ARK Innovation ETF", exchange: "AMEX", type: "stock" },
  { symbol: "VOO", description: "Vanguard S&P 500 ETF", exchange: "AMEX", type: "stock" },
  { symbol: "VTI", description: "Vanguard Total Stock Market ETF", exchange: "AMEX", type: "stock" },
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

function buildChartDrawingsStorageKey(symbol, chartType) {
  const normalizedSymbol = normalizeAssetId(symbol) || "UNKNOWN";
  return `rayla_drawings_${normalizedSymbol}_${chartType}`;
}

function normalizeStoredChartDrawing(drawing) {
  if (!drawing || typeof drawing !== "object") return null;
  const type = drawing.type === "note" ? "text" : String(drawing.type || "").toLowerCase();
  if (!["horizontal", "trendline", "text"].includes(type)) return null;
  const points = Array.isArray(drawing.points)
    ? drawing.points
        .map((point) => {
          if (!point || typeof point !== "object") return null;
          const normalizedPoint = {};
          if (Number.isFinite(Number(point.time))) normalizedPoint.time = Number(point.time);
          if (Number.isFinite(Number(point.price))) normalizedPoint.price = Number(point.price);
          if (Number.isFinite(Number(point.xPct))) normalizedPoint.xPct = Math.max(0, Math.min(100, Number(point.xPct)));
          if (Number.isFinite(Number(point.yPct))) normalizedPoint.yPct = Math.max(0, Math.min(100, Number(point.yPct)));
          return Object.keys(normalizedPoint).length ? normalizedPoint : null;
        })
        .filter(Boolean)
    : [];
  if (!points.length) return null;
  return {
    id: String(drawing.id || crypto.randomUUID()),
    type,
    points,
    text: type === "text" ? String(drawing.text || "").trim().slice(0, 80) : "",
  };
}

function readChartDrawingsFromStorage(storageKey) {
  if (!storageKey || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeStoredChartDrawing).filter(Boolean);
  } catch {
    return [];
  }
}

function writeChartDrawingsToStorage(storageKey, drawings) {
  if (!storageKey || typeof window === "undefined") return;
  try {
    if (!Array.isArray(drawings) || !drawings.length) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(drawings.map(normalizeStoredChartDrawing).filter(Boolean)));
  } catch {
    // Ignore localStorage write failures.
  }
}

function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("Request timed out"), timeoutMs);

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
    alpacaSupported: typeof result?.tradable === "boolean"
      ? Boolean(result.tradable)
      : (CRYPTO_SYMBOL_SET.has(symbol) ? true : result?.alpacaSupported),
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
  const normalizedQuery = resolveTickerAlias(String(query || "").trim().toUpperCase());
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
  } else {
    stockResults = SUPPORTED_POPULAR_STOCKS
      .filter((asset) => (
        asset.symbol.includes(normalizedQuery)
        || asset.description.toUpperCase().includes(normalizedQuery)
      ))
      .map(normalizeSearchResult);
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
    .slice(0, 8);

  supportedSearchCache.set(cacheKey, results);
  return results;
}

const PRODUCT_SUPABASE_FUNCTIONS_BASE_URL = "https://uoxzzhtnzmsolvcykynu.functions.supabase.co";
const LOCAL_SUPABASE_FUNCTIONS_BASE_URL = "http://localhost:54321/functions/v1";
const SHOULD_USE_LOCAL_SUPABASE_FUNCTIONS = import.meta.env.VITE_USE_LOCAL_SUPABASE_FUNCTIONS === "true";
const DAILY_INTEL_URL = `${PRODUCT_SUPABASE_FUNCTIONS_BASE_URL}/daily-intel`;
const ASK_RAYLA_URL = `${(SHOULD_USE_LOCAL_SUPABASE_FUNCTIONS ? LOCAL_SUPABASE_FUNCTIONS_BASE_URL : PRODUCT_SUPABASE_FUNCTIONS_BASE_URL)}/ask-rayla`;
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
const RAYLA_ADAPTIVE_STORAGE_KEY = "rayla_adaptive_learning_profile";
const RAYLA_MODE_STORAGE_KEY = "rayla_mode_preference";

function isPopulatedIntelReport(report) {
  if (!report || typeof report !== "object") return false;
  const hasStockHot = Array.isArray(report.stockHot) && report.stockHot.length > 0;
  const hasStockCold = Array.isArray(report.stockCold) && report.stockCold.length > 0;
  const hasCryptoHot = Boolean(report.cryptoHot?.symbol);
  const hasCryptoCold = Boolean(report.cryptoCold?.symbol);
  return hasStockHot || hasStockCold || hasCryptoHot || hasCryptoCold;
}

const marketSeeds = [
  { id: "BTC", type: "crypto", label: "Bitcoin", tvSymbol: "BINANCE:BTCUSDT", fallbackPrice: "64,210", fallbackChange: "+1.2%", alpacaSupported: true, tradable: true },
  { id: "ETH", type: "crypto", label: "Ethereum", tvSymbol: "BINANCE:ETHUSDT", fallbackPrice: "3,120", fallbackChange: "+0.9%", alpacaSupported: true, tradable: true },
  { id: "SPY", type: "stock", label: "SPDR S&P 500 ETF", tvSymbol: "AMEX:SPY", fallbackPrice: "521.14", fallbackChange: "-0.4%", alpacaSupported: true, tradable: true },
  { id: "NVDA", type: "stock", label: "NVIDIA", tvSymbol: "NASDAQ:NVDA", fallbackPrice: "908.55", fallbackChange: "+3.2%", alpacaSupported: true, tradable: true },
  { id: "AAPL", type: "stock", label: "Apple", tvSymbol: "NASDAQ:AAPL", fallbackPrice: "212.44", fallbackChange: "-0.4%", alpacaSupported: true, tradable: true },
];

const SETUP_OPTIONS = ["rejection","breakout","pullback","reversal","range"];
const SESSION_OPTIONS = ["Asia","London","New York","After Hours"];
const SIMULATION_TUTORIAL_SECTIONS = [
  {
    key: "controls",
    title: "Trade Controls",
    description: "Pick asset, direction, and size. Set your exit plan before you start.",
  },
  {
    key: "risk",
    title: "Risk Inputs",
    description: "Stop = where you're wrong. Target = where you get paid. Define both before entering.",
  },
  {
    key: "account",
    title: "Simulator Stats",
    description: "Live and Scenario P/L tracked separately. Watch R multiple, not just dollar swings.",
  },
  {
    key: "chart",
    title: "Chart View",
    description: "Live mode shows real price. Scenario mode projects forward from the Now anchor.",
  },
  {
    key: "open-position",
    title: "Open Position Panel",
    description: "Tracks current price, P/L, R multiple, and time in trade against your original plan.",
  },
  {
    key: "summary",
    title: "Trade Summary",
    description: "Outcome, execution grade, and one coaching note. Review every close.",
  },
  {
    key: "history",
    title: "Trade History",
    description: "Your recent reps. Use it to spot patterns in your decisions, not just outcomes.",
  },
];
const NAV_TABS = [
  { id: "home", icon: <LayoutDashboard size={18} />, label: "Home" },
  { id: "trades", icon: <PlusSquare size={18} />, label: "My Trades" },
  { id: "simulation", icon: <Gamepad2 size={18} />, label: "Simulation" },
  { id: "ai", icon: <Target size={18} />, label: "Performance" },
  { id: "journal", icon: <BookOpen size={18} />, label: "Journal" },
  { id: "intel", icon: <ClipboardList size={18} />, label: "Intel" },
];
const ASK_RAYLA_SUGGESTIONS = [
  "Explain this chart",
  "Is this a good entry?",
  "Where should my stop be?",
  "Should I exit now?",
  "Why did this trade lose?",
  "What's my edge here?",
];

const RAYLA_ADAPTIVE_ONBOARDING_QUESTIONS = [
  {
    key: "experience",
    title: "Markets experience",
    prompt: "What best matches your experience so far?",
    options: ["brand new", "some experience", "active trader"],
  },
  {
    key: "familiarity",
    title: "Term familiarity",
    prompt: "How comfortable are you with charts, risk, and order terms?",
    options: ["not very", "somewhat comfortable", "very comfortable"],
  },
  {
    key: "goal",
    title: "Main goal",
    prompt: "What do you want Rayla to help you with most right now?",
    options: ["learn the basics", "improve execution", "analyze performance", "build investing confidence"],
  },
];

function createDefaultRaylaAdaptiveState() {
  return {
    onboardingCompleted: false,
    onboardingAnswers: {},
    interactions: {
      questionCount: 0,
      confusionCount: 0,
      advancedCount: 0,
      recentQuestions: [],
    },
  };
}

function isRaylaConfusionQuestion(question) {
  const normalized = String(question || "").toLowerCase();
  return [
    "i don't understand",
    "i dont understand",
    "confused",
    "simpler",
    "simplify",
    "explain again",
    "what does that mean",
    "break that down",
    "too complex",
    "lost me",
  ].some((phrase) => normalized.includes(phrase));
}

function isRaylaAdvancedQuestion(question) {
  const normalized = String(question || "").toLowerCase();
  return [
    "risk reward",
    "risk/reward",
    "drawdown",
    "liquidity",
    "execution",
    "position sizing",
    "thesis",
    "probability",
    "correlation",
    "timeframe alignment",
    "market structure",
    "invalid",
    "r-multiple",
    "expectancy",
  ].some((phrase) => normalized.includes(phrase));
}

function buildNextRaylaAdaptiveState(state, question) {
  const nextState = state || createDefaultRaylaAdaptiveState();
  const trimmedQuestion = String(question || "").trim();
  if (!trimmedQuestion) return nextState;

  return {
    ...nextState,
    interactions: {
      questionCount: (nextState.interactions?.questionCount || 0) + 1,
      confusionCount: (nextState.interactions?.confusionCount || 0) + (isRaylaConfusionQuestion(trimmedQuestion) ? 1 : 0),
      advancedCount: (nextState.interactions?.advancedCount || 0) + (isRaylaAdvancedQuestion(trimmedQuestion) ? 1 : 0),
      recentQuestions: [
        trimmedQuestion,
        ...((nextState.interactions?.recentQuestions || []).slice(0, 5)),
      ],
    },
  };
}

function buildRaylaAdaptiveProfile({
  adaptiveState,
  currentQuestion,
  trades,
  simulationTradeHistory,
  selectedMarketId,
}) {
  const nextState = adaptiveState || createDefaultRaylaAdaptiveState();
  const answers = nextState.onboardingAnswers || {};
  const interactions = nextState.interactions || {};
  const simulationProfile = {
    totalTrades: Array.isArray(simulationTradeHistory) ? simulationTradeHistory.length : 0,
  };
  const coachReport = buildCoachReport(trades || []);
  const currentQuestionIsConfused = isRaylaConfusionQuestion(currentQuestion);
  const currentQuestionIsAdvanced = isRaylaAdvancedQuestion(currentQuestion);

  let complexityScore = 0;

  if (answers.experience === "brand new") complexityScore -= 2;
  if (answers.experience === "some experience") complexityScore += 0;
  if (answers.experience === "active trader") complexityScore += 2;

  if (answers.familiarity === "not very") complexityScore -= 2;
  if (answers.familiarity === "somewhat comfortable") complexityScore += 0;
  if (answers.familiarity === "very comfortable") complexityScore += 2;

  if ((interactions.questionCount || 0) >= 6) complexityScore += 1;
  if ((interactions.advancedCount || 0) >= 3) complexityScore += 2;
  if ((simulationProfile?.totalTrades || 0) >= 5) complexityScore += 1;
  if ((coachReport?.trades || 0) >= 5) complexityScore += 1;
  if ((interactions.confusionCount || 0) >= 2) complexityScore -= 2;
  if (currentQuestionIsConfused) complexityScore -= 3;
  if (currentQuestionIsAdvanced) complexityScore += 2;

  const explanationDepth = currentQuestionIsConfused || complexityScore <= -1
    ? "simple"
    : complexityScore >= 4
      ? "advanced"
      : "balanced";

  const guidanceNotes = [];
  if (explanationDepth === "simple") {
    guidanceNotes.push("Use plain language, short steps, and define terms only when needed.");
    guidanceNotes.push("Assume the user may want simpler framing right now.");
  } else if (explanationDepth === "advanced") {
    guidanceNotes.push("The user likely understands the basics, so avoid repeating beginner definitions unless asked.");
    guidanceNotes.push("It is okay to be a bit more technical and connect ideas across execution, risk, and market structure.");
  } else {
    guidanceNotes.push("Use a balanced explanation depth with clear reasoning and light jargon.");
  }

  if (answers.goal === "learn the basics") {
    guidanceNotes.push("Bias toward teaching-first explanations and concrete examples.");
  } else if (answers.goal === "improve execution") {
    guidanceNotes.push("Bias toward actionable execution feedback and trade management details.");
  } else if (answers.goal === "analyze performance") {
    guidanceNotes.push("Bias toward pattern recognition, review, and performance framing.");
  }

  return {
    onboardingCompleted: !!nextState.onboardingCompleted,
    onboardingAnswers: answers,
    selectedMarketId,
    questionCount: interactions.questionCount || 0,
    confusionCount: interactions.confusionCount || 0,
    advancedCount: interactions.advancedCount || 0,
    explanationDepth,
    currentQuestionIsConfused,
    currentQuestionIsAdvanced,
    guidanceNotes,
  };
}

function renderRaylaMessageContent(content) {
  const text = String(content || "").trim();
  if (!text) return null;

  return text.split(/\n\s*\n/).map((block, blockIndex) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const segments = [];
    let paragraphLines = [];
    let bulletItems = [];

    function flushParagraph() {
      if (!paragraphLines.length) return;
      segments.push(
        <p key={`p-${blockIndex}-${segments.length}`} style={{ margin: 0, lineHeight: 1.7 }}>
          {paragraphLines.join(" ")}
        </p>
      );
      paragraphLines = [];
    }

    function flushBullets() {
      if (!bulletItems.length) return;
      segments.push(
        <ul
          key={`ul-${blockIndex}-${segments.length}`}
          style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}
        >
          {bulletItems.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      );
      bulletItems = [];
    }

    lines.forEach((line) => {
      if (/^[-•*]\s+/.test(line)) {
        flushParagraph();
        bulletItems.push(line.replace(/^[-•*]\s+/, ""));
      } else {
        flushBullets();
        paragraphLines.push(line);
      }
    });

    flushParagraph();
    flushBullets();

    return (
      <div key={blockIndex} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {segments}
      </div>
    );
  });
}

function parseTradeResult(value) {
  const parsed = Number.parseFloat(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getTradeOutcomeValue(trade) {
  const pnlValue = Number(trade?.pnl_value);
  if (Number.isFinite(pnlValue)) return pnlValue;
  return parseTradeResult(trade?.result_r);
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

function buildNormalizedBrokerTrades(brokerTradeLog) {
  const brokerTradesByKey = new Map();
  (brokerTradeLog || []).forEach((trade) => {
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
  const normalizedClosedTrades = [];

  orderedBrokerTrades.forEach((trade) => {
    const symbol = String(trade.symbol || "").toUpperCase();
    const side = String(trade.side || "").toLowerCase();
    if (!symbol || !side) return;

    if (side === "buy") {
      const existingLots = lotsBySymbol.get(symbol) || [];
      existingLots.push({
        qty: trade.qtyValue,
        price: trade.fillPrice,
        filledAt: trade.filled_at,
      });
      lotsBySymbol.set(symbol, existingLots);
      return;
    }

    if (side !== "sell") return;

    const existingLots = lotsBySymbol.get(symbol) || [];
    if (!existingLots.length) return;

    let remainingQty = trade.qtyValue;
    let realizedPnl = 0;
    let matchedQty = 0;
    let matchedCost = 0;
    let earliestEntryTime = null;

    while (remainingQty > 0 && existingLots.length) {
      const currentLot = existingLots[0];
      const matchedLotQty = Math.min(remainingQty, currentLot.qty);
      realizedPnl += (trade.fillPrice - currentLot.price) * matchedLotQty;
      matchedQty += matchedLotQty;
      matchedCost += currentLot.price * matchedLotQty;
      if (!earliestEntryTime && currentLot.filledAt) earliestEntryTime = currentLot.filledAt;
      currentLot.qty -= matchedLotQty;
      remainingQty -= matchedLotQty;

      if (currentLot.qty <= 0) {
        existingLots.shift();
      }
    }

    if (existingLots.length) lotsBySymbol.set(symbol, existingLots);
    else lotsBySymbol.delete(symbol);

    if (matchedQty > 0 && remainingQty === 0) {
      const avgEntryPrice = matchedCost / matchedQty;
      normalizedClosedTrades.push({
        id: `broker:${trade.broker_provider}:${trade.broker_order_id}`,
        asset: symbol,
        setup: "Broker Import",
        session: "Broker",
        direction: "long",
        entry_price: avgEntryPrice,
        exit_price: trade.fillPrice,
        entry_size: matchedCost,
        entry_time: earliestEntryTime || trade.filled_at,
        exit_time: trade.filled_at,
        result_r: realizedPnl,
        pnl_value: realizedPnl,
        source: trade.source === "rayla" ? "rayla" : "broker",
        source_label: trade.source === "rayla" ? "Placed in Rayla" : "Imported from Alpaca",
        broker_provider: trade.broker_provider,
        broker_order_id: trade.broker_order_id,
        status: trade.status,
        coachTag: trade.source === "rayla" ? "Executed in Rayla" : "Imported from broker",
        isBrokerTrade: true,
      });
    }
  });

  return normalizedClosedTrades.sort((a, b) => {
    const aTime = parseTradeTimeMs(a) || 0;
    const bTime = parseTradeTimeMs(b) || 0;
    return bTime - aTime;
  });
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

function getAlpacaOrderPayloadSide(action) {
  if (action === "sell" || action === "short_sell") return "sell";
  return "buy";
}

function getAlpacaOrderActionLabel(action) {
  if (action === "short_sell") return "Short Sell";
  if (action === "buy_to_cover") return "Buy to Cover";
  if (action === "sell") return "Sell";
  return "Buy";
}

function getAlpacaOrderTypeLabel(type) {
  if (type === "stop_limit") return "Stop Limit";
  if (type === "stop") return "Stop";
  if (type === "limit") return "Limit";
  return "Market";
}

function getAlpacaTimeInForceLabel(value) {
  if (value === "gtc") return "GTC";
  if (value === "ioc") return "IOC";
  if (value === "fok") return "FOK";
  return String(value || "").toUpperCase();
}

function getLeverageMultiplierValue(value) {
  const parsed = Number(String(value || "1x").replace(/x/gi, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function getAvailableLeverageOptions(multiplier) {
  const normalizedMax = Math.max(1, Math.floor(Number(multiplier) || 1));
  const values = [1];

  [2, 4].forEach((candidate) => {
    if (candidate <= normalizedMax && !values.includes(candidate)) {
      values.push(candidate);
    }
  });

  if (!values.includes(normalizedMax)) {
    values.push(normalizedMax);
  }

  return values
    .filter((value) => value >= 1)
    .sort((a, b) => a - b)
    .map((value) => ({ value: `${value}x`, label: `${value}x` }));
}

function getSimulationCoachMessage(position, currentPrice, metrics) {
  if (!position) return "Ready for your next setup.";
  if (!Number.isFinite(currentPrice)) return "Trade is open. Stick to the plan.";

  if (position.exitMode === "pnl") {
    if (position.stopLoss != null && Number.isFinite(metrics?.profitLoss) && metrics.profitLoss < 0) {
      const stopProgress = Math.abs(metrics.profitLoss) / Math.max(position.stopLoss, 0.0001);
      if (stopProgress >= 0.85) {
        return "Near your stop. Don't move it.";
      }
    }
    if (position.takeProfit != null && Number.isFinite(metrics?.profitLoss) && metrics.profitLoss > 0) {
      const targetProgress = metrics.profitLoss / Math.max(position.takeProfit, 0.0001);
      if (targetProgress >= 0.85) {
        return "Near your target. Let it work.";
      }
    }
  } else {
    if (position.stopLoss != null) {
      const stopDistance = Math.abs(position.entryPrice - position.stopLoss);
      const remainingToStop = Math.abs(currentPrice - position.stopLoss);
      if (stopDistance > 0 && remainingToStop / stopDistance <= 0.15) {
        return "Near your stop. Don't move it.";
      }
    }
    if (position.takeProfit != null) {
      const targetDistance = Math.abs(position.takeProfit - position.entryPrice);
      const remainingToTarget = Math.abs(position.takeProfit - currentPrice);
      if (targetDistance > 0 && remainingToTarget / targetDistance <= 0.15) {
        return "Near your target. Let it work.";
      }
    }
  }

  if (Number.isFinite(metrics?.profitLoss) && metrics.profitLoss > 0) {
    return "In profit. Stay patient.";
  }

  return "Trade is open. Stick to the plan.";
}

function getSimulationLeverageMultiplier(leverageValue) {
  const parsed = Number.parseFloat(String(leverageValue || "1x").replace(/x/i, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

const CHART_TIMEFRAME_OPTIONS = [
  { value: "12h", label: "12 hours", provider: "5Min", ms: 12 * 60 * 60 * 1000, lookbackMs: 12 * 60 * 60 * 1000, fetchRange: "1D" },
  { value: "1h", label: "1 hour", provider: "1Min", ms: 60 * 60 * 1000, lookbackMs: 60 * 60 * 1000, fetchRange: "1D" },
  { value: "30m", label: "30 mins", provider: "1Min", ms: 30 * 60 * 1000, lookbackMs: 30 * 60 * 1000, fetchRange: "1D" },
  { value: "15m", label: "15 mins", provider: "1Min", ms: 15 * 60 * 1000, lookbackMs: 15 * 60 * 1000, fetchRange: "1D" },
  { value: "5m", label: "5 mins", provider: "1Min", ms: 5 * 60 * 1000, lookbackMs: 5 * 60 * 1000, fetchRange: "1D" },
  { value: "1m", label: "1 min", provider: "15Sec", ms: 60 * 1000, lookbackMs: 60 * 1000, fetchRange: "1D" },
];

const CHART_RANGE_OPTIONS = [
  { value: "MAX", label: "MAX", provider: null, ms: null, fetchRange: "MAX" },
  { value: "5Y", label: "5Y", provider: null, ms: 5 * 365 * 24 * 60 * 60 * 1000, fetchRange: "5Y" },
  { value: "1Y", label: "1Y", provider: null, ms: 365 * 24 * 60 * 60 * 1000, fetchRange: "1Y" },
  { value: "3M", label: "3M", provider: null, ms: 90 * 24 * 60 * 60 * 1000, fetchRange: "3M" },
  { value: "1M", label: "1M", provider: null, ms: 30 * 24 * 60 * 60 * 1000, fetchRange: "1M" },
  { value: "1W", label: "1W", provider: null, ms: 7 * 24 * 60 * 60 * 1000, fetchRange: "1W" },
  { value: "1D", label: "1D", provider: null, ms: 24 * 60 * 60 * 1000, fetchRange: "1D" },
  ...CHART_TIMEFRAME_OPTIONS.map((option) => ({
    ...option,
  })),
];

const LIVE_WIDGET_INTERVAL_OPTIONS = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "30m", label: "30m" },
  { value: "1h", label: "1h" },
  { value: "1D", label: "1D" },
];

const SCENARIO_CHART_VISIBLE_BAR_COUNT = 72;
const SCENARIO_CHART_RIGHT_OFFSET_BARS = 6;

function getChartSelectionConfig(value) {
  return CHART_RANGE_OPTIONS.find((option) => option.value === value) || CHART_RANGE_OPTIONS.find((option) => option.value === "1D");
}

function getSimulationTimeframeConfig(value) {
  return getChartSelectionConfig(value);
}

function getChartSelectionWindowMs(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  const selection = getChartSelectionConfig(value);
  return selection?.lookbackMs ?? selection?.ms ?? null;
}

function buildIntelSimulationPrompt(signal) {
  if (!signal) {
    return "Notable signal on this asset. Run it in the simulator.";
  }

  const score = Number(signal.score);
  const topDriverKey = signal.topDriverKey || "";
  const topDriverLabel = {
    demand: "demand",
    costMargin: "margin pressure",
    guidance: "guidance",
    narrative: "narrative",
    priceConfirmation: "price confirmation",
    liquidity: "liquidity",
    sentiment: "sentiment",
    momentum: "momentum",
    catalyst: "catalyst flow",
    relativeStrength: "relative strength",
  }[topDriverKey] || "";

  if (score >= 4) {
    return `Strong momentum${topDriverLabel ? ` — ${topDriverLabel} is the driver` : ""}. Worth a rep.`;
  }
  if (score >= 1) {
    return `Leaning long${topDriverLabel ? ` on ${topDriverLabel}` : ""}. Run it in the simulator.`;
  }
  if (score <= -4) {
    return `Clear weakness${topDriverLabel ? ` — ${topDriverLabel} is breaking down` : ""}. Short side has a case.`;
  }
  if (score <= -1) {
    return `Softening${topDriverLabel ? ` on ${topDriverLabel}` : ""}. Check the short setup.`;
  }
  return "Mixed signal here. Harder to have conviction — stay patient.";
}

function buildIntelSimulationRaylaIntro(intelLaunch) {
  const symbol = intelLaunch?.asset?.id || "this asset";
  const launchModeLabel = intelLaunch?.mode === "scenario" ? "Scenario Simulator" : "Live Simulator";
  const directionWord = intelLaunch?.direction === "short" ? "short" : "long";
  const score = Number(intelLaunch?.intelSignal?.score);

  let setupRead = "the Intel read is mixed here";
  if (score >= 1) {
    setupRead = "Intel leans constructive here";
  } else if (score <= -1) {
    setupRead = "Intel leans weak here";
  }

  const watchClause = intelLaunch?.direction === "short"
    ? "whether sellers stay in control or this snaps back"
    : "whether buyers stay in control or this slips back into range";

  return `I loaded ${symbol} ${directionWord} in ${launchModeLabel} — ${setupRead}, so the big watch is ${watchClause}.`;
}

function buildGuidedSimulationWatchLine({ direction, step, simulationMode }) {
  if (step === "trade-closed") {
    return "Trade closed. Review the result, then decide what to repeat.";
  }
  if (step === "position-open") {
    return direction === "short"
      ? "Watch whether sellers stay in control or the move starts snapping back."
      : "Watch whether buyers stay in control or the move starts slipping back into range.";
  }
  if (simulationMode === "scenario") {
    return "Intel is loaded. Let the scenario move first, then react to the structure you get.";
  }
  return "Intel is loaded. Set the risk cleanly, then open only if the read still holds.";
}

function buildIntelSimulationSetupSteps({ assetSymbol, directionLabel }) {
  return [
    {
      title: "Step 1: Amount",
      body: `How much are you risking on this ${assetSymbol} rep?`,
    },
    {
      title: "Step 2: Leverage",
      body: "Leave at 1x unless you want more exposure.",
    },
    {
      title: "Step 3: Stop / Max Loss",
      body: `Define the downside before you open the ${directionLabel}.`,
    },
    {
      title: "Step 4: Profit Target",
      body: "Set the win condition.",
    },
    {
      title: "Step 5: Open Trade",
      body: "Plan is clear? Open the trade.",
    },
  ];
}

function buildScenarioBarFromStep({ previousClose, nextClose, timeMs, seed = 0 }) {
  const open = Number(previousClose);
  const close = Number(nextClose);
  if (!Number.isFinite(open) || !Number.isFinite(close) || !Number.isFinite(timeMs)) return null;

  const bodyHigh = Math.max(open, close);
  const bodyLow = Math.min(open, close);
  const bodySize = Math.abs(close - open);
  const basePrice = Math.max(Math.abs(open || close || 1), 0.000001);
  const randA = (Math.sin(seed * 12.9898) + 1) / 2;
  const randB = (Math.cos(seed * 7.233 + 0.42) + 1) / 2;
  const randC = (Math.sin(seed * 3.173 + 1.91) + 1) / 2;
  const bodyPct = bodySize / basePrice;
  const isIndecision = bodyPct < 0.00065;
  const isMomentum = bodyPct > 0.0045;
  const baseNoise = basePrice * (0.00025 + (randA * 0.00055));
  const upperBias = 0.45 + (randB * 1.4);
  const lowerBias = 0.45 + (randC * 1.35);
  const upperWick = Math.max(
    baseNoise,
    bodySize * (isIndecision ? 1.35 : isMomentum ? 0.26 : 0.58)
  ) * upperBias;
  const lowerWick = Math.max(
    baseNoise,
    bodySize * (isIndecision ? 1.2 : isMomentum ? 0.24 : 0.52)
  ) * lowerBias;
  const high = Math.max(bodyHigh, close, open) + upperWick;
  const low = Math.max(0.000001, Math.min(bodyLow, close, open) - lowerWick);

  return {
    time: new Date(timeMs).toISOString(),
    open,
    high: Math.max(high, open, close),
    low: Math.min(low, open, close),
    close,
    volume: Math.max(1, Math.round((bodySize + upperWick + lowerWick) * (650 + (randA * 900)))),
  };
}

function getScenarioRandom(seed) {
  const value = Math.sin((seed * 12.9898) + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function getScenarioSignedRandom(seed) {
  return (getScenarioRandom(seed) * 2) - 1;
}

function getScenarioDriftProfile(assetId, tick, scenarioType) {
  const seed = hashScenarioSeed(assetId);
  const regimeLength = 5 + ((seed + Math.floor(tick / 3)) % 9);
  const regimeIndex = Math.floor((tick + seed) / regimeLength);
  const localStep = (tick + seed) % regimeLength;
  const localProgress = localStep / Math.max(1, regimeLength - 1);
  const randA = getScenarioSignedRandom((seed * 101) + (regimeIndex * 17) + tick);
  const randB = getScenarioSignedRandom((seed * 79) + (regimeIndex * 31) + (tick * 3));
  const randC = getScenarioSignedRandom((seed * 43) + (regimeIndex * 13) + (tick * 7));

  if (scenarioType === "range") {
    const microRegime = regimeIndex % 4;
    const meanReversionBias = microRegime === 0
      ? 0.00025
      : microRegime === 1
        ? -0.00018
        : microRegime === 2
          ? 0.00008
          : -0.00006;
    return {
      impulse: meanReversionBias + (randA * 0.00055),
      chop: randB * 0.0011,
      pullback: randC * 0.00048,
      spikeChance: getScenarioRandom((seed * 19) + tick) > 0.87 ? (randA > 0 ? 1 : -1) : 0,
      spikeStrength: 0.001 + (Math.abs(randB) * 0.0022),
      indecisionChance: getScenarioRandom((seed * 23) + tick) > 0.76,
    };
  }

  const realisticRegime = regimeIndex % 6;
  const directionalBias = realisticRegime === 0
    ? 0.00115
    : realisticRegime === 1
      ? -0.00072
      : realisticRegime === 2
        ? 0.00018
        : realisticRegime === 3
          ? -0.00105
          : realisticRegime === 4
            ? 0.00092
            : -0.00022;
  return {
    impulse: directionalBias + (randA * 0.00095) + ((localProgress - 0.5) * 0.0008),
    chop: randB * 0.00155,
    pullback: randC * 0.00085,
    spikeChance: getScenarioRandom((seed * 29) + tick) > 0.82 ? (randA > 0 ? 1 : -1) : 0,
    spikeStrength: 0.0016 + (Math.abs(randB) * 0.0038),
    indecisionChance: getScenarioRandom((seed * 37) + tick) > 0.79,
  };
}

function buildScenarioContextBars({ anchorPrice, stepDurationMs, scenarioType = "realistic", barCount = 72, seedBase = 0, endTimeMs = Date.now() }) {
  const resolvedAnchor = Number(anchorPrice);
  const resolvedStepMs = Number(stepDurationMs);
  if (!Number.isFinite(resolvedAnchor) || resolvedAnchor <= 0 || !Number.isFinite(resolvedStepMs) || resolvedStepMs <= 0) {
    return [];
  }

  const normalizedCount = Math.max(24, Math.min(120, Math.floor(barCount) || 72));
  const startTimeMs = endTimeMs - ((normalizedCount - 1) * resolvedStepMs);
  const syntheticAssetId = `scenario-context-${scenarioType}-${seedBase}`;
  const prices = new Array(normalizedCount).fill(resolvedAnchor);
  let contextPrice = resolvedAnchor;

  for (let index = normalizedCount - 2; index >= 0; index -= 1) {
    const mirroredTick = normalizedCount - index + seedBase;
    const forwardPrice = buildNextScenarioPrice({
      assetId: syntheticAssetId,
      currentPrice: contextPrice,
      anchorPrice: resolvedAnchor,
      tick: mirroredTick,
      scenarioType,
    });
    const backStep = contextPrice - (forwardPrice - contextPrice);
    const clampPct = scenarioType === "range" ? 0.055 : scenarioType === "realistic" ? 0.11 : 0.07;
    const minPrice = resolvedAnchor * (1 - clampPct);
    const maxPrice = resolvedAnchor * (1 + clampPct);
    contextPrice = Math.max(minPrice, Math.min(maxPrice, backStep));
    prices[index] = Math.max(0.000001, contextPrice);
  }

  const bars = [];
  let previousClose = prices[0];

  prices.forEach((price, index) => {
    const close = index === 0 ? previousClose : price;
    const nextBar = buildScenarioBarFromStep({
      previousClose,
      nextClose: close,
      timeMs: startTimeMs + (index * resolvedStepMs),
      seed: seedBase + index,
    });
    if (nextBar) {
      bars.push(nextBar);
      previousClose = nextBar.close;
    }
  });

  if (bars.length) {
    const lastBar = bars[bars.length - 1];
    bars[bars.length - 1] = {
      ...lastBar,
      close: resolvedAnchor,
      high: Math.max(Number(lastBar.high ?? resolvedAnchor), resolvedAnchor),
      low: Math.min(Number(lastBar.low ?? resolvedAnchor), resolvedAnchor),
    };
  }

  return bars;
}

function getSimulationPositionQuantity(position) {
  if (!position || !Number.isFinite(Number(position.entryPrice)) || Number(position.entryPrice) <= 0) return null;
  const leverageMultiplier = getSimulationLeverageMultiplier(position.leverage);
  if (position.amountMode === "shares") {
    const quantity = Number(position.amount) * leverageMultiplier;
    return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
  }
  const quantity = (Number(position.amount) * leverageMultiplier) / Number(position.entryPrice);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}

function getLiveQuoteByAssetId(quotes, assetId, type = "", tvSymbol = "") {
  const normalizedId = normalizeAssetId(assetId, type, tvSymbol);
  return quotes[assetId] || quotes[normalizedId] || null;
}

function mergeIncomingQuotes(prevQuotes, incomingQuotes) {
  if (!incomingQuotes || typeof incomingQuotes !== "object") return prevQuotes;

  let didChange = false;
  const nextQuotes = { ...prevQuotes };

  Object.entries(incomingQuotes).forEach(([rawSymbol, rawQuote]) => {
    const price = Number(rawQuote?.price);
    if (!Number.isFinite(price)) return;

    const normalizedSymbol = normalizeAssetId(rawSymbol);
    const currentQuote = nextQuotes[rawSymbol] || nextQuotes[normalizedSymbol] || {};
    const nextQuote = {
      ...currentQuote,
      ...rawQuote,
      price,
      change: Number.isFinite(Number(rawQuote?.change)) ? Number(rawQuote.change) : rawQuote?.change ?? currentQuote?.change ?? null,
      updatedAt: rawQuote?.updatedAt || currentQuote?.updatedAt || new Date().toISOString(),
    };

    const quoteChanged = (
      currentQuote?.price !== nextQuote.price
      || currentQuote?.change !== nextQuote.change
      || currentQuote?.updatedAt !== nextQuote.updatedAt
    );

    if (!quoteChanged) return;

    nextQuotes[rawSymbol] = nextQuote;
    if (normalizedSymbol) nextQuotes[normalizedSymbol] = nextQuote;
    didChange = true;
  });

  return didChange ? nextQuotes : prevQuotes;
}

function buildQuoteSnapshotFromChart(chart) {
  const bars = extractChartBars(chart);
  if (!bars.length) return null;

  const firstBar = bars[0];
  const lastBar = bars[bars.length - 1];
  const price = Number(lastBar?.close);
  const baseline = Number(firstBar?.open ?? firstBar?.close);

  if (!Number.isFinite(price) || price <= 0) return null;

  return {
    price,
    change: Number.isFinite(baseline) && baseline > 0
      ? ((price - baseline) / baseline) * 100
      : null,
    updatedAt: String(lastBar?.time || lastBar?.t || new Date().toISOString()),
  };
}

function formatQuoteUpdatedAt(updatedAt) {
  if (!updatedAt) return "--";
  const timestamp = Date.parse(String(updatedAt));
  if (!Number.isFinite(timestamp)) return "--";
  return new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function isQuoteFresh(quote, maxAgeMs = 60_000) {
  const timestamp = Date.parse(String(quote?.updatedAt || ""));
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp <= maxAgeMs;
}

function getQuoteSpread(quote) {
  const bid = Number(quote?.bid);
  const ask = Number(quote?.ask);
  if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0 || ask < bid) return null;
  return ask - bid;
}

function getKnownStockQuotePrice(symbol, quotes, watchlistItems, cachedQuotes) {
  const upperSymbol = String(symbol || "").trim().toUpperCase();
  const normalizedSymbol = normalizeAssetId(upperSymbol);
  if (!normalizedSymbol) return null;

  const liveQuotePrice = getLiveQuoteByAssetId(quotes, normalizedSymbol)?.price;
  if (Number.isFinite(liveQuotePrice)) return liveQuotePrice;

  const cachedPrice = getLiveQuoteByAssetId(cachedQuotes, normalizedSymbol)?.price;
  if (Number.isFinite(cachedPrice)) return cachedPrice;

  const watchlistPrice = watchlistItems.find((item) => (
    normalizeAssetId(item.id, item.type, item.tvSymbol) === normalizedSymbol
  ))?.priceValue;
  return Number.isFinite(watchlistPrice) ? watchlistPrice : null;
}

function getKnownStockQuoteData(symbol, quotes, watchlistItems, cachedQuotes) {
  const upperSymbol = String(symbol || "").trim().toUpperCase();
  const normalizedSymbol = normalizeAssetId(upperSymbol);
  if (!normalizedSymbol) return null;

  const liveQuote = getLiveQuoteByAssetId(quotes, normalizedSymbol);
  if (liveQuote?.price != null) return liveQuote;

  const cachedQuote = getLiveQuoteByAssetId(cachedQuotes, normalizedSymbol);
  if (cachedQuote?.price != null) return cachedQuote;

  const watchlistItem = watchlistItems.find((item) => (
    normalizeAssetId(item.id, item.type, item.tvSymbol) === normalizedSymbol
  ));
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
    .filter((value) => Number.isFinite(value) && value > 0);
}

function extractChartBars(chart) {
  const barCandidates = Array.isArray(chart?.bars)
    ? chart.bars
    : Array.isArray(chart?.candles)
      ? chart.candles
      : [];
  return barCandidates
    .filter((bar) => bar && Number.isFinite(Number(bar.close)) && Number(bar.close) > 0);
}

function getChartBarTimeMs(bar) {
  const timeMs = Date.parse(String(bar?.time || bar?.t || ""));
  return Number.isFinite(timeMs) ? timeMs : null;
}

function sliceBarsToSelectedWindow(bars, selectionValue) {
  if (!Array.isArray(bars) || bars.length < 2) return Array.isArray(bars) ? bars : [];

  const windowMs = getChartSelectionWindowMs(selectionValue);
  if (!Number.isFinite(windowMs) || windowMs == null) return bars;

  const normalizedBars = bars
    .map((bar) => {
      const timeMs = getChartBarTimeMs(bar);
      return Number.isFinite(timeMs) ? { ...bar, timeMs } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.timeMs - b.timeMs);

  if (normalizedBars.length < 2) {
    return normalizedBars.map(({ timeMs, ...bar }) => bar);
  }

  const endMs = normalizedBars[normalizedBars.length - 1]?.timeMs;
  if (!Number.isFinite(endMs)) {
    return normalizedBars.map(({ timeMs, ...bar }) => bar);
  }

  const startMs = endMs - windowMs;
  const windowBars = normalizedBars.filter((bar) => bar.timeMs >= startMs && bar.timeMs <= endMs);

  if (windowBars.length >= 2) {
    return windowBars.map(({ timeMs, ...bar }) => bar);
  }

  return normalizedBars.slice(-Math.min(2, normalizedBars.length)).map(({ timeMs, ...bar }) => bar);
}

function extractVisibleChartBars(chart, selectionValue) {
  return sliceBarsToSelectedWindow(extractChartBars(chart), selectionValue);
}

const HOME_CHART_VIEW_OPTIONS = [
  { value: "tight", label: "Tight", multiplier: 0.7 },
  { value: "default", label: "Default", multiplier: 1 },
  { value: "wide", label: "Wide", multiplier: 1.8 },
];

function getHomeChartViewMultiplier(viewPreset) {
  return HOME_CHART_VIEW_OPTIONS.find((option) => option.value === viewPreset)?.multiplier ?? 1;
}

function getHomeChartSelectionConfig(value) {
  const baseSelection = getChartSelectionConfig(value);
  if (!baseSelection) return null;
  return baseSelection;
}

function extractVisibleHomeChartBars(chart, selectionValue, viewPreset = "default") {
  const selection = getHomeChartSelectionConfig(selectionValue);
  if (!selection) return extractVisibleChartBars(chart, selectionValue);
  const baseWindowMs = selection.lookbackMs ?? selection.ms ?? null;
  const scaledWindowMs = Number.isFinite(baseWindowMs)
    ? Math.max(selection.ms || 0, Math.round(baseWindowMs * getHomeChartViewMultiplier(viewPreset)))
    : baseWindowMs;
  return sliceBarsToSelectedWindow(extractChartBars(chart), scaledWindowMs);
}

function buildStableScenarioPriceRange({
  bars,
  anchorPrice,
  currentPrice,
  stopPrice,
  targetPrice,
}) {
  const validBars = Array.isArray(bars) ? bars : [];
  const firstBarOpen = Number(validBars[0]?.open ?? validBars[0]?.close);
  const referencePrices = [
    Number(anchorPrice),
    Number(currentPrice),
    Number(stopPrice),
    Number(targetPrice),
    firstBarOpen,
  ].filter((price) => Number.isFinite(price) && price > 0);

  if (!referencePrices.length) return null;

  const anchor = Number.isFinite(Number(anchorPrice)) && Number(anchorPrice) > 0
    ? Number(anchorPrice)
    : referencePrices[0];
  const minRef = Math.min(...referencePrices);
  const maxRef = Math.max(...referencePrices);
  const span = Math.max(maxRef - minRef, anchor * 0.02, 1);
  const minVisibleSpan = Math.max(anchor * 0.08, span);
  const center = (minRef + maxRef) / 2;
  const halfSpan = (minVisibleSpan * 0.5) + Math.max(minVisibleSpan * 0.18, anchor * 0.01);

  return {
    min: Math.max(0.0001, center - halfSpan),
    max: center + halfSpan,
  };
}

function isClosedStock1DChart(chart, assetType, range) {
  return assetType === "stock" && range === "1D" && chart?.rangeMode === "market_closed";
}

function isMarketCurrentlyOpen() {
  const now = new Date();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now).map((p) => [p.type, p.value])
  );
  const day = parts.weekday;
  if (day === "Sat" || day === "Sun") return false;
  const totalMins = parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10);
  return totalMins >= 9 * 60 + 30 && totalMins < 16 * 60;
}

function useRelativeTime(timestamp) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!timestamp) return;
    const id = setInterval(() => setTick((n) => n + 1), 10000);
    return () => clearInterval(id);
  }, [timestamp]);
  if (!timestamp) return null;
  const secs = Math.floor((Date.now() - timestamp.getTime()) / 1000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function MarketClosedBanner({ assetType, updatedLabel = null }) {
  if (String(assetType || "").toLowerCase() === "crypto") return null;
  if (isMarketCurrentlyOpen()) return null;
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "5px 10px",
      marginBottom: 6,
      background: "rgba(251,191,36,0.05)",
      border: "1px solid rgba(251,191,36,0.16)",
      borderRadius: 8,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fbbf24", flexShrink: 0 }} />
      <div>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#fbbf24" }}>Market Closed</span>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>{" – limited price movement"}</span>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, flexShrink: 0 }}>
        {updatedLabel && (
          <span style={{ fontSize: 10, color: "#64748b", whiteSpace: "nowrap" }}>Last updated: {updatedLabel}</span>
        )}
        <span style={{ fontSize: 10, color: "#475569", whiteSpace: "nowrap" }}>Try crypto for live data</span>
      </div>
    </div>
  );
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

function getTradeRangeWindowMs(range) {
  return getChartSelectionWindowMs(range);
}

function formatTradePortfolioTickLabel(timestampMs, range) {
  const date = new Date(timestampMs);
  if (!Number.isFinite(date.getTime())) return "";

  if (range === "15s" || range === "30s") {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  }
  if (range === "1m" || range === "5m") {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (range === "15m" || range === "30m" || range === "1h" || range === "12h") {
    return date.toLocaleDateString([], { month: "short", day: "numeric" })
      + " · "
      + date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (range === "1D") {
    return date.toLocaleDateString([], { month: "short", day: "numeric" })
      + " · "
      + date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (range === "1W") {
    return date.toLocaleDateString([], { weekday: "short" })
      + " "
      + date.toLocaleDateString([], { month: "numeric", day: "numeric" });
  }
  if (range === "1M" || range === "3M") {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  if (range === "1Y") {
    return date.toLocaleDateString([], { month: "short", year: "numeric" });
  }
  if (range === "5Y") {
    return date.toLocaleDateString([], { year: "numeric" });
  }
  return date.toLocaleDateString([], { month: "short", year: "numeric" });
}

function buildTradePortfolioTicks(rangeStartMs, rangeEndMs, range) {
  const tickCount =
    range === "15s" || range === "30s" ? 5 :
    range === "1m" || range === "5m" ? 5 :
    range === "15m" || range === "30m" || range === "1h" || range === "12h" ? 5 :
    range === "1D" ? 4 :
    range === "1W" ? 5 :
    range === "1M" || range === "3M" ? 5 :
    range === "1Y" ? 5 :
    4;
  const span = Math.max(1, rangeEndMs - rangeStartMs);
  const ticks = Array.from({ length: tickCount }, (_, index) => {
    const ratio = tickCount === 1 ? 0 : index / (tickCount - 1);
    const time = rangeStartMs + span * ratio;
    return {
      time,
      label: formatTradePortfolioTickLabel(time, range),
      ratio,
    };
  });

  const deduped = [];
  let previousLabel = "";
  ticks.forEach((tick) => {
    const label = tick.label === previousLabel ? "" : tick.label;
    deduped.push({ ...tick, label });
    if (label) previousLabel = label;
  });
  return deduped;
}

function resolveTradePortfolioEntryTime(position, brokerTradeLog, manualTrades = []) {
  const symbol = String(position?.symbol || "").trim().toUpperCase();
  if (!symbol) return { timeMs: null, source: null };

  const directCandidates = [
    ["openedAt", position?.openedAt],
    ["opened_at", position?.opened_at],
    ["entryTime", position?.entryTime],
    ["entry_time", position?.entry_time],
    ["open_time", position?.open_time],
    ["raw.opened_at", position?.raw?.opened_at],
    ["raw.entry_time", position?.raw?.entry_time],
    ["raw.open_time", position?.raw?.open_time],
    ["raw.filled_at", position?.raw?.filled_at],
  ];
  for (const [source, candidate] of directCandidates) {
    const ms = new Date(candidate || "").getTime();
    if (Number.isFinite(ms)) return { timeMs: ms, source };
  }

  const matchingBrokerFills = (brokerTradeLog || [])
    .filter((trade) => String(trade?.symbol || "").trim().toUpperCase() === symbol)
    .filter((trade) => {
      const status = String(trade?.status || "").toLowerCase();
      return trade?.filled_at && (status === "filled" || status === "partially_filled");
    })
    .map((trade) => ({
      side: String(trade?.side || "").toLowerCase(),
      qty: Math.abs(Number(trade?.filled_qty ?? trade?.qty ?? trade?.quantity ?? 0)) || 0,
      timeMs: new Date(trade.filled_at).getTime(),
    }))
    .filter((trade) => Number.isFinite(trade.timeMs) && trade.qty > 0)
    .sort((a, b) => a.timeMs - b.timeMs);

  if (matchingBrokerFills.length) {
    const openLots = [];
    matchingBrokerFills.forEach((fill) => {
      if (fill.side === "buy") {
        openLots.push({ qty: fill.qty, timeMs: fill.timeMs });
        return;
      }
      if (fill.side === "sell") {
        let remaining = fill.qty;
        while (remaining > 0 && openLots.length) {
          const lot = openLots[0];
          const used = Math.min(lot.qty, remaining);
          lot.qty -= used;
          remaining -= used;
          if (lot.qty <= 0.0000001) openLots.shift();
        }
      }
    });

    const remainingOpenLots = openLots.filter((lot) => lot.qty > 0.0000001);
    if (remainingOpenLots.length) {
      const totalQty = remainingOpenLots.reduce((sum, lot) => sum + lot.qty, 0);
      if (totalQty > 0) {
        const weightedAverageTimeMs = remainingOpenLots.reduce((sum, lot) => sum + (lot.timeMs * lot.qty), 0) / totalQty;
        if (Number.isFinite(weightedAverageTimeMs)) {
          return { timeMs: weightedAverageTimeMs, source: "broker_open_lot_average_fill_time" };
        }
      }

      const earliestRemainingLot = remainingOpenLots[0]?.timeMs || null;
      if (Number.isFinite(earliestRemainingLot)) {
        return { timeMs: earliestRemainingLot, source: "broker_earliest_open_lot_fill_time" };
      }
    }
  }

  const matchingManualEntries = (manualTrades || [])
    .filter((trade) => {
      const tradeSymbol = String(trade?.symbol || trade?.asset || "").trim().toUpperCase();
      return tradeSymbol === symbol;
    })
    .map((trade) => {
      const entryTimeMs = new Date(trade?.entry_time || "").getTime();
      return Number.isFinite(entryTimeMs) ? entryTimeMs : null;
    })
    .filter(Number.isFinite)
    .sort((a, b) => b - a);

  if (matchingManualEntries.length) {
    return { timeMs: matchingManualEntries[0], source: "manual_trade_entry_time" };
  }

  return { timeMs: null, source: null };
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

function buildEdgeSummary(stats) {
  const sampleSize = Number(stats?.totalTrades || 0);
  if (sampleSize < 3) return null;

  const winRate = Number(stats?.winRate || 0);
  const avgR = Number(stats?.avgR || 0);
  const bestSetup = stats?.bestSetup?.name || null;
  const bestAsset = stats?.bestAsset?.name || null;
  const worstSetup = stats?.worstSetup?.name || null;
  const recentLossStreak = Number(stats?.recentLossStreak || 0);
  const confidence = sampleSize < 8 ? "Low" : sampleSize < 20 ? "Medium" : "High";

  const currentEdge = bestSetup && bestAsset
    ? `Your clearest edge right now looks strongest when you stay focused on ${bestSetup} setups in ${bestAsset}.`
    : bestSetup
      ? `Your clearest edge right now looks strongest in your ${bestSetup} setups.`
      : bestAsset
        ? `Your clearest edge right now looks strongest when you focus on ${bestAsset}.`
        : avgR > 0
          ? "Your current edge is positive overall, but it still needs more sample depth to feel proven."
          : "Your edge is still forming, so the main job is finding what is repeatably working.";

  const biggestStrength = bestSetup
    ? `${bestSetup} is your biggest strength so far.`
    : bestAsset
      ? `${bestAsset} is your biggest strength so far.`
      : avgR > 0
        ? "Your overall results are still positive, which is the strongest signal right now."
        : "You have some usable data now, but not enough to call a strong strength yet.";

  const biggestLeak = worstSetup
    ? `${worstSetup} is your biggest leak right now.`
    : recentLossStreak >= 3
      ? `Your recent ${recentLossStreak}-trade loss streak is the biggest leak right now.`
      : avgR < 0
        ? "Your average R is still negative, so consistency is the main leak right now."
        : "The biggest leak is still unclear from the current sample.";

  return {
    currentEdge,
    confidence,
    biggestStrength,
    biggestLeak,
    bestSetup,
    bestAsset,
    worstSetup,
    winRate,
    avgR,
    sampleSize,
  };
}

function buildEdgeFacetsFromTrades(trades) {
  const safeTrades = Array.isArray(trades) ? trades : [];
  const normalizedTrades = safeTrades
    .map((trade) => {
      const manualResultR = parseTradeResult(trade?.result_r);
      const simulationResultR = Number(trade?.rMultiple);
      const resultR = Number.isFinite(manualResultR)
        ? manualResultR
        : Number.isFinite(simulationResultR)
          ? simulationResultR
          : null;

      if (!Number.isFinite(resultR)) return null;

      const asset = String(trade?.asset || "").trim().toUpperCase();
      const setup = normalizeSetupType(trade?.setupType) || String(trade?.setup || "").trim();
      const direction = String(trade?.direction || "").trim().toLowerCase();
      const session = String(trade?.session || trade?.sessionSlot || "").trim();
      const timestamp = trade?.closedAt || trade?.created_at || trade?.entry_time || trade?.exit_time || null;

      return {
        asset: asset || null,
        setup: setup || null,
        direction: direction || null,
        session: session || null,
        resultR,
        win: resultR > 0 ? 1 : 0,
        timestamp,
      };
    })
    .filter(Boolean);

  if (!normalizedTrades.length) return null;

  const summarizeFacet = (items, key, { minCount = 3, maxItems = 6 } = {}) => {
    const grouped = items.reduce((acc, trade) => {
      const rawValue = trade?.[key];
      const value = String(rawValue || "").trim();
      if (!value || ["unknown", "other", "n/a", "na"].includes(value.toLowerCase())) return acc;

      if (!acc[value]) {
        acc[value] = { name: value, count: 0, wins: 0, totalR: 0 };
      }
      acc[value].count += 1;
      acc[value].wins += trade.win;
      acc[value].totalR += trade.resultR;
      return acc;
    }, {});

    return Object.values(grouped)
      .filter((group) => group.count >= minCount)
      .map((group) => ({
        name: group.name,
        count: group.count,
        wins: group.wins,
        winRate: roundMetric((group.wins / group.count) * 100, 1),
        avgR: roundMetric(group.totalR / group.count),
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        if (b.avgR !== a.avgR) return b.avgR - a.avgR;
        return b.winRate - a.winRate;
      })
      .slice(0, maxItems);
  };

  return {
    overallSampleSize: normalizedTrades.length,
    bySetup: summarizeFacet(normalizedTrades, "setup", { minCount: 3 }),
    byAsset: summarizeFacet(normalizedTrades, "asset", { minCount: 3 }),
    byDirection: summarizeFacet(normalizedTrades, "direction", { minCount: 3, maxItems: 2 }),
    bySession: summarizeFacet(normalizedTrades, "session", { minCount: 3 }),
  };
}

function normalizeSetupType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["range", "breakout", "pullback", "trend", "reversal", "other"].includes(normalized)) {
    return normalized;
  }
  return null;
}

function formatSetupTypeLabel(value) {
  const normalized = normalizeSetupType(value);
  if (!normalized) return "None";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatSessionSlotLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  const labels = {
    premarket: "Premarket",
    early: "Early session",
    mid: "Midday",
    late: "Late session",
    afterhours: "After hours",
  };
  return labels[normalized] || normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function splitReflectionSentences(text) {
  return String(text || "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.replace(/^[•\-\s]+/, "").trim())
    .filter(Boolean);
}

function buildSimulationReflectionPreview(closedTrade) {
  if (!closedTrade) return null;

  const grade = closedTrade.executionGrade || "";
  const gradeLabel = String(closedTrade.executionGradeLabel || "").trim();
  const outcomeLabel = String(closedTrade.outcomeLabel || "").trim();
  const coaching = String(closedTrade.coachingInsight || "").trim();
  const feedback = String(closedTrade.feedback || "").trim();
  const rMultiple = Number.isFinite(Number(closedTrade.rMultiple)) ? Number(closedTrade.rMultiple) : null;

  const sentences = [];

  const add = (text) => {
    const t = String(text || "").trim();
    if (!t) return;
    if (sentences.length >= 2) return;
    if (sentences.some((s) => s.toLowerCase() === t.toLowerCase())) return;
    sentences.push(t);
  };

  // Primary: coaching insight is the most specific pre-generated observation
  if (coaching) {
    add(coaching);
  } else if (grade === "D" && gradeLabel) {
    // Poor execution with no coaching note — name the grade directly
    add(`${gradeLabel}.`);
  } else if (outcomeLabel && (outcomeLabel.toLowerCase().includes("cut") || outcomeLabel.toLowerCase().includes("held too"))) {
    // Specific behavioral outcome label worth surfacing
    add(`${outcomeLabel}.`);
  } else if (grade === "A" || grade === "B") {
    // Clean execution, no coaching note — only speak when result is noteworthy
    if (rMultiple !== null && rMultiple <= 0) {
      // Clean execution on a flat or loss — worth noting
      add(rMultiple === 0 ? "Execution held up. The setup didn't deliver." : "Execution was clean. The setup didn't follow through.");
    } else {
      // Clean win with no coaching note — the card says enough, stay silent
      return null;
    }
  }

  // Secondary: execution feedback adds specificity when coaching is already present
  if (sentences.length === 1 && feedback && feedback !== coaching) {
    add(feedback);
  }

  return sentences.length ? sentences : null;
}

function deriveSessionSlot(timestamp) {
  if (timestamp == null) return null;
  const parsed = typeof timestamp === "number" ? timestamp : Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return null;

  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    timeZone: "America/New_York",
  });
  const parts = formatter.formatToParts(new Date(parsed));
  const hour = Number(parts.find((part) => part.type === "hour")?.value || "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value || "0");
  const minutesSinceMidnight = hour * 60 + minute;

  if (minutesSinceMidnight >= 240 && minutesSinceMidnight < 570) return "premarket";
  if (minutesSinceMidnight >= 570 && minutesSinceMidnight < 660) return "early";
  if (minutesSinceMidnight >= 660 && minutesSinceMidnight < 840) return "mid";
  if (minutesSinceMidnight >= 840 && minutesSinceMidnight < 960) return "late";
  return "afterhours";
}

function getTradeContextTimestampMs(trade) {
  const timestamp = trade?.closedAt || trade?.created_at || trade?.exit_time || trade?.entry_time || null;
  if (timestamp == null) return null;
  const parsed = typeof timestamp === "number" ? timestamp : Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTradeSourceType(sourceType) {
  switch (sourceType) {
    case "real_trade":
      return { sourceType: "real_trade", sourceLabel: "Real trade" };
    case "live_sim_trade":
      return { sourceType: "live_sim_trade", sourceLabel: "Live sim trade" };
    case "scenario_sim_trade":
      return { sourceType: "scenario_sim_trade", sourceLabel: "Scenario sim trade" };
    default:
      return { sourceType: "unknown", sourceLabel: "Unknown" };
  }
}

function detectSimulationTradeSourceType(trade) {
  const marketMode = String(trade?.marketMode || "").trim().toLowerCase();
  const scenarioType = String(trade?.scenarioType || "").trim().toLowerCase();
  if (scenarioType) return "scenario_sim_trade";
  if (marketMode === "live") return "live_sim_trade";
  if (marketMode === "scenario") return "scenario_sim_trade";
  return "live_sim_trade";
}

function normalizeTradeForRaylaContext(trade, sourceType) {
  const sourceMeta = normalizeTradeSourceType(sourceType);
  const manualResultR = parseTradeResult(trade?.result_r);
  const simulationResultR = Number(trade?.rMultiple);
  const resultR = Number.isFinite(manualResultR)
    ? roundMetric(manualResultR)
    : Number.isFinite(simulationResultR)
      ? roundMetric(simulationResultR)
      : null;

  const setupType = normalizeSetupType(trade?.setupType);
  const sessionSlot = String(trade?.sessionSlot || deriveSessionSlot(trade?.closedAt || trade?.created_at || trade?.entry_time || trade?.exit_time) || "").trim() || null;
  const profitLoss = Number.isFinite(Number(trade?.profitLoss))
    ? Number(trade.profitLoss)
    : Number.isFinite(Number(trade?.pnl))
      ? Number(trade.pnl)
      : Number.isFinite(Number(trade?.profitLossUsd))
        ? Number(trade.profitLossUsd)
        : Number.isFinite(Number(trade?.realizedPnl))
          ? Number(trade.realizedPnl)
          : Number.isFinite(Number(trade?.resultAmount))
            ? Number(trade.resultAmount)
          : Number.isFinite(Number(trade?.pnl_value))
            ? Number(trade.pnl_value)
            : null;

  return {
    symbol: String(trade?.asset || "").trim().toUpperCase() || null,
    sourceType: sourceMeta.sourceType,
    sourceLabel: sourceMeta.sourceLabel,
    closedAt: trade?.closedAt || trade?.created_at || trade?.exit_time || trade?.entry_time || null,
    resultR,
    profitLoss,
    profitLossUsd: profitLoss,
    pnl: profitLoss,
    realizedPnl: profitLoss,
    resultAmount: profitLoss,
    direction: trade?.direction || "",
    setup: String(trade?.setup || "").trim() || null,
    setupType,
    sessionSlot,
    entryPrice: Number.isFinite(Number(trade?.entry_price)) ? Number(trade.entry_price) : Number.isFinite(Number(trade?.entryPrice)) ? Number(trade.entryPrice) : null,
    exitPrice: Number.isFinite(Number(trade?.exit_price)) ? Number(trade.exit_price) : Number.isFinite(Number(trade?.exitPrice)) ? Number(trade.exitPrice) : null,
    executionGrade: trade?.executionGrade || "",
    executionGradeLabel: trade?.executionGradeLabel || "",
    feedback: String(trade?.feedback || "").trim() || null,
    outcome: String(trade?.outcome || trade?.outcomeLabel || "").trim() || null,
  };
}

function buildTradeSourceSummary({ trades, simulationTradeHistory }) {
  const realTrades = (Array.isArray(trades) ? trades : [])
    .map((trade) => normalizeTradeForRaylaContext(trade, "real_trade"))
    .filter((trade) => trade.symbol);

  const simTrades = (Array.isArray(simulationTradeHistory) ? simulationTradeHistory : [])
    .map((trade) => normalizeTradeForRaylaContext(trade, detectSimulationTradeSourceType(trade)))
    .filter((trade) => trade.symbol);

  const findLatestByType = (items, sourceType) => items
    .filter((trade) => trade.sourceType === sourceType)
    .sort((a, b) => (getTradeContextTimestampMs(b) || 0) - (getTradeContextTimestampMs(a) || 0))[0] || null;

  return {
    lastRealTrade: findLatestByType(realTrades, "real_trade"),
    lastLiveSimTrade: findLatestByType(simTrades, "live_sim_trade"),
    lastScenarioSimTrade: findLatestByType(simTrades, "scenario_sim_trade"),
  };
}

function resolveTradeSourceReferenceFromText(text) {
  const normalized = String(text || "").trim().toLowerCase();
  if (!normalized) return null;
  const simplified = normalized
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = simplified ? simplified.split(" ") : [];
  const hasLast = tokens.includes("last");
  const hasScenario = tokens.some((token) => token === "scenario" || token === "scenrio");
  const hasLive = tokens.includes("live");
  const hasReal = tokens.includes("real");
  const hasSim = tokens.some((token) => token === "sim" || token === "simulation");
  const hasTradeWord = tokens.some((token) => (
    token === "trade"
    || token === "trde"
    || token === "trad"
    || token === "trd"
  ));

  if (hasLast && hasScenario && hasSim && hasTradeWord) return "lastScenarioSimTrade";
  if (hasLast && hasLive && hasSim && hasTradeWord) return "lastLiveSimTrade";
  if (hasLast && hasReal && hasTradeWord) return "lastRealTrade";
  return null;
}

function buildActiveReviewedTrade({ recentConversation, tradeSourceSummary, simulationContext }) {
  const explicitReference = (Array.isArray(recentConversation) ? recentConversation : [])
    .slice()
    .reverse()
    .find((message) => message?.role === "user" && resolveTradeSourceReferenceFromText(message.content));
  const referencedKey = resolveTradeSourceReferenceFromText(explicitReference?.content);

  if (referencedKey && tradeSourceSummary?.[referencedKey]) {
    return tradeSourceSummary[referencedKey];
  }

  const closedTrade = simulationContext?.closedTrade;
  if (!closedTrade) return null;

  const sourceType = simulationContext?.mode === "scenario" ? "scenario_sim_trade" : "live_sim_trade";
  const sourceLabel = sourceType === "scenario_sim_trade" ? "Scenario sim trade" : "Live sim trade";
  const symbol = String(simulationContext?.symbol || simulationContext?.assetName || "").trim().toUpperCase();
  if (!symbol) return null;

  return {
    symbol,
    sourceType,
    sourceLabel,
    closedAt: closedTrade?.closedAt || null,
    resultR: Number.isFinite(Number(closedTrade?.rMultiple)) ? Number(closedTrade.rMultiple) : null,
    profitLoss: Number.isFinite(Number(closedTrade?.profitLoss)) ? Number(closedTrade.profitLoss) : null,
    profitLossUsd: Number.isFinite(Number(closedTrade?.profitLoss)) ? Number(closedTrade.profitLoss) : null,
    pnl: Number.isFinite(Number(closedTrade?.profitLoss)) ? Number(closedTrade.profitLoss) : null,
    realizedPnl: Number.isFinite(Number(closedTrade?.profitLoss)) ? Number(closedTrade.profitLoss) : null,
    resultAmount: Number.isFinite(Number(closedTrade?.profitLoss)) ? Number(closedTrade.profitLoss) : null,
    direction: simulationContext?.direction || "",
    setupType: normalizeSetupType(closedTrade?.setupType),
    sessionSlot: closedTrade?.sessionSlot || null,
    entryPrice: Number.isFinite(Number(simulationContext?.activeTrade?.entryPrice))
      ? Number(simulationContext.activeTrade.entryPrice)
      : null,
    exitPrice: Number.isFinite(Number(closedTrade?.exitPrice)) ? Number(closedTrade.exitPrice) : null,
    executionGrade: closedTrade?.executionGrade || "",
    executionGradeLabel: closedTrade?.executionGradeLabel || "",
    feedback: String(closedTrade?.feedback || closedTrade?.coachingInsight || "").trim() || null,
    outcome: String(closedTrade?.outcome || closedTrade?.outcomeLabel || "").trim() || null,
  };
}

function resolveActiveReviewedTradeForQuestion({ question, tradeSourceSummary, fallbackTrade = null }) {
  const referencedKey = resolveTradeSourceReferenceFromText(question);
  if (referencedKey && tradeSourceSummary?.[referencedKey]) {
    return tradeSourceSummary[referencedKey];
  }
  return fallbackTrade || null;
}

function buildChartExplainContext({ symbol, assetName, assetType, range, bars, currentPrice, positionSummary = null }) {
  const normalizedBars = (Array.isArray(bars) ? bars : [])
    .filter((bar) => bar && Number.isFinite(Number(bar.close)) && Number(bar.close) > 0)
    .slice(-30)
    .map((bar) => ({
      time: bar.time || bar.t || null,
      open: Number(bar.open),
      high: Number(bar.high),
      low: Number(bar.low),
      close: Number(bar.close),
      volume: Number.isFinite(Number(bar.volume)) ? Number(bar.volume) : null,
    }));

  return {
    symbol: String(symbol || "").toUpperCase(),
    assetName: assetName || symbol || "",
    assetType: assetType || "stock",
    timeframe: range || "1D",
    currentPrice: Number.isFinite(Number(currentPrice)) ? Number(currentPrice) : null,
    chartSummary: normalizedBars.length
      ? {
          firstClose: normalizedBars[0]?.close ?? null,
          lastClose: normalizedBars[normalizedBars.length - 1]?.close ?? null,
          barCount: normalizedBars.length,
        }
      : null,
    positionSummary,
    recentBars: normalizedBars,
  };
}

function buildSimulationRaylaContext({
  mode,
  symbol,
  assetName,
  assetType,
  timeframe,
  currentPrice,
  direction,
  amount,
  amountMode,
  stopLoss,
  takeProfit,
  sessionStats,
  intelSignal = null,
  activeTrade = null,
  closedTrade = null,
  isFirstSimTrade = false,
}) {
  return {
    contextType: "simulation",
    mode,
    symbol: String(symbol || "").toUpperCase(),
    assetName: assetName || symbol || "",
    assetType: assetType || "stock",
    timeframe: timeframe || "1D",
    currentPrice: Number.isFinite(Number(currentPrice)) ? Number(currentPrice) : null,
    direction: direction || "long",
    amount: amount || "",
    amountMode: amountMode || "dollars",
    stopLoss: stopLoss || "",
    takeProfit: takeProfit || "",
    sessionStats: sessionStats || null,
    intelSignal,
    activeTrade,
    closedTrade: closedTrade ? {
      exitPrice: closedTrade.exitPrice ?? null,
      exitReason: closedTrade.exitReason || "",
      profitLoss: Number.isFinite(Number(closedTrade.profitLoss)) ? Number(closedTrade.profitLoss) : null,
      rMultiple: Number.isFinite(Number(closedTrade.rMultiple)) ? Number(closedTrade.rMultiple) : null,
      setupType: normalizeSetupType(closedTrade.setupType),
      sessionSlot: closedTrade.sessionSlot || null,
      durationMs: Number.isFinite(Number(closedTrade.durationMs)) ? Number(closedTrade.durationMs) : null,
      executionGrade: closedTrade.executionGrade || "",
      executionGradeLabel: closedTrade.executionGradeLabel || "",
      outcomeLabel: closedTrade.outcomeLabel || "",
      coachingInsight: closedTrade.coachingInsight || "",
      feedback: closedTrade.feedback || "",
      isFirstSimTrade: Boolean(isFirstSimTrade),
    } : null,
  };
}

function buildSimulationActiveTradeContext({ position, currentPrice, metrics, levels, timeInTrade }) {
  if (!position || !Number.isFinite(currentPrice)) return null;

  const distanceEntries = [
    { key: "entry", label: "entry", distance: Math.abs(currentPrice - Number(position.entryPrice)) },
    Number.isFinite(levels?.stopPrice) ? { key: "stop", label: position.exitMode === "pnl" ? "max loss" : "stop", distance: Math.abs(currentPrice - levels.stopPrice) } : null,
    Number.isFinite(levels?.targetPrice) ? { key: "target", label: position.exitMode === "pnl" ? "profit target" : "target", distance: Math.abs(currentPrice - levels.targetPrice) } : null,
  ].filter(Boolean).sort((a, b) => a.distance - b.distance);

  const nearest = distanceEntries[0] || null;
  const isInsidePlan = (
    !Number.isFinite(levels?.stopPrice)
    || !Number.isFinite(levels?.targetPrice)
    || (
      position.direction === "long"
        ? currentPrice >= levels.stopPrice && currentPrice <= levels.targetPrice
        : currentPrice <= levels.stopPrice && currentPrice >= levels.targetPrice
    )
  );

  return {
    asset: position.asset,
    label: position.label || position.asset,
    marketMode: position.marketMode || "live",
    direction: position.direction === "short" ? "short" : "long",
    entryPrice: position.entryPrice,
    currentPrice,
    unrealizedPnL: Number.isFinite(metrics?.profitLoss) ? metrics.profitLoss : 0,
    unrealizedR: Number.isFinite(metrics?.rMultiple) ? metrics.rMultiple : null,
    stopLoss: position.stopLoss,
    takeProfit: position.takeProfit,
    stopPrice: Number.isFinite(levels?.stopPrice) ? levels.stopPrice : null,
    targetPrice: Number.isFinite(levels?.targetPrice) ? levels.targetPrice : null,
    exitMode: position.exitMode || "price",
    plannedRisk: position.plannedRisk ?? null,
    timeInTrade: timeInTrade || "--",
    nearestLevel: nearest?.label || "entry",
    nearestLevelKey: nearest?.key || "entry",
    isInsidePlan,
  };
}

function buildSimulationOpeningMessage(simulationContext, { beginnerMode = false } = {}) {
  const activeTrade = simulationContext?.activeTrade;
  const symbol = simulationContext?.assetName || simulationContext?.symbol || "";
  const mode = simulationContext?.mode || "Live";

  if (!activeTrade) {
    const dir = simulationContext?.direction === "short" ? "short" : "long";
    const price = Number(simulationContext?.currentPrice);
    const priceStr = Number.isFinite(price)
      ? ` at $${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "";
    if (beginnerMode) {
      return `${mode} sim — setting up a ${dir} on ${symbol}${priceStr}. Before you open this, what's the chart doing — is price trending or ranging? And where would this trade be wrong?`;
    }
    return `${mode} sim — setting up a ${dir} on ${symbol}${priceStr}. What do you want to think through before entering?`;
  }

  const { direction, unrealizedR, isInsidePlan, nearestLevelKey } = activeTrade;
  const dirLabel = direction === "short" ? "short" : "long";
  const rVal = Number(unrealizedR);
  const rStr = Number.isFinite(rVal) ? ` at ${rVal > 0 ? "+" : ""}${rVal.toFixed(2)}R` : "";
  const planStr = isInsidePlan
    ? "inside plan"
    : nearestLevelKey === "stop"
      ? "approaching your stop"
      : nearestLevelKey === "target"
        ? "near your target"
        : "outside the plan range";

  return `You're ${dirLabel} ${symbol}${rStr} — ${planStr}. What do you want to work through?`;
}

function buildDirectSimulationRaylaAnswer(question, simulationContext) {
  const normalizedQuestion = String(question || "").trim().toLowerCase();
  const activeTrade = simulationContext?.activeTrade;
  if (!activeTrade) return null;

  const directionLabel = activeTrade.direction === "short" ? "short" : "long";
  const assetLabel = activeTrade.label || activeTrade.asset;
  const stopLabel = activeTrade.exitMode === "pnl" ? "max loss" : "stop";

  const asksForNextStep = [
    "what should i do next",
    "what do i do next",
    "what now",
    "next step",
    "what should i do",
  ].some((phrase) => normalizedQuestion.includes(phrase));

  if (asksForNextStep) {
    const priceDelta = Number(activeTrade.currentPrice) - Number(activeTrade.entryPrice);
    const isAboveEntry = Number.isFinite(priceDelta) && priceDelta > 0;
    const isBelowEntry = Number.isFinite(priceDelta) && priceDelta < 0;
    const entryState = isAboveEntry ? "above entry" : isBelowEntry ? "below entry" : "at entry";
    const nearestLevelText = activeTrade.nearestLevel === "entry"
      ? "between stop and target"
      : `near your ${activeTrade.nearestLevel}`;
    const planLine = activeTrade.isInsidePlan ? "inside plan" : "outside the plan range";
    const stopLine = activeTrade.stopPrice != null
      ? `Keep the ${stopLabel} where it is unless something about the setup has actually changed.`
      : "Define a stop if you haven't — one bad move shouldn't be open-ended.";
    return `${directionLabel} ${assetLabel}, price ${entryState} — ${planLine}, ${nearestLevelText}. Best move is to wait and let it develop. ${stopLine}`;
  }

  const asksAboutStop = [
    "where is my stop",
    "where's my stop",
    "what's my stop",
    "what is my stop",
    "where is the stop",
  ].some((phrase) => normalizedQuestion.includes(phrase));

  if (asksAboutStop) {
    if (activeTrade.stopPrice != null) {
      const aboveOrBelow = Number(activeTrade.currentPrice) > Number(activeTrade.stopPrice) ? "above" : "below";
      return `Your ${stopLabel} is at ${activeTrade.stopPrice}. Current price is ${aboveOrBelow} that — trade is still live.`;
    }
    return "You don't have a stop set on this trade. Define one before the trade gets away from you.";
  }

  const asksAboutStatus = [
    "how am i doing",
    "how is the trade",
    "how is my trade",
    "how's the trade",
    "am i up",
    "am i down",
    "what's my pnl",
    "what is my pnl",
  ].some((phrase) => normalizedQuestion.includes(phrase));

  if (asksAboutStatus) {
    const rVal = Number(activeTrade.unrealizedR);
    const rStr = Number.isFinite(rVal) ? `${rVal > 0 ? "+" : ""}${rVal.toFixed(2)}R` : "unknown R";
    const planStr = activeTrade.isInsidePlan ? "inside your plan" : "outside your plan range";
    const levelCue = activeTrade.nearestLevelKey === "stop"
      ? "Getting closer to your stop — keep watching it."
      : activeTrade.nearestLevelKey === "target"
        ? "Price is near your target. Stay patient and let it work."
        : "Still developing between your levels.";
    return `Trade is at ${rStr}, ${planStr}. ${levelCue}`;
  }

  const asksAboutTarget = [
    "where is my target",
    "where's my target",
    "what's my target",
    "what is my target",
    "where is the target",
  ].some((phrase) => normalizedQuestion.includes(phrase));

  if (asksAboutTarget) {
    if (activeTrade.targetPrice != null) {
      const distStr = Number.isFinite(Number(activeTrade.currentPrice)) && Number.isFinite(Number(activeTrade.targetPrice))
        ? ` — price is ${Math.abs(Number(activeTrade.currentPrice) - Number(activeTrade.targetPrice)).toFixed(2)} away`
        : "";
      return `Your target is at ${activeTrade.targetPrice}${distStr}. Let it get there before you start second-guessing the exit.`;
    }
    return "No take-profit is set. Decide your exit before price forces the decision for you.";
  }

  return null;
}

function normalizeConversationSlice(messages, maxTurns = 6) {
  return (Array.isArray(messages) ? messages : [])
    .filter((m) =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      !m.loading &&
      String(m.content || "").trim().length > 0
    )
    .slice(-maxTurns)
    .map((m) => ({ role: m.role, content: String(m.content) }));
}

function buildAskRaylaContext({ trades, simulationTradeHistory = null, selectedMarketId, adaptiveProfile, chartContext = null, simulationContext = null, selectedAssetContext = null, recentConversation = null, activeReviewedTrade = null, raylaMode = "beginner", marketIntelContext = null, raylaPicksContext = null, behavioralPatternContext = null }) {
  const stats = buildTradeStats(trades);
  const edgeFacetTrades = [
    ...(Array.isArray(trades) ? trades : []),
    ...(Array.isArray(simulationTradeHistory) ? simulationTradeHistory : []),
  ];
  const tradeSourceSummary = buildTradeSourceSummary({ trades, simulationTradeHistory });
  return {
    selectedMarketId,
    adaptiveProfile,
    chartContext,
    simulationContext,
    selectedAssetContext,
    recentConversation: Array.isArray(recentConversation) && recentConversation.length > 0 ? recentConversation : null,
    raylaMode,
    stats,
    edgeSummary: buildEdgeSummary(stats),
    edgeFacets: buildEdgeFacetsFromTrades(edgeFacetTrades),
    tradeSourceSummary,
    activeReviewedTrade: activeReviewedTrade || buildActiveReviewedTrade({
      recentConversation,
      tradeSourceSummary,
      simulationContext,
    }),
    marketIntelContext: marketIntelContext || null,
    raylaPicksContext: raylaPicksContext || null,
    behavioralPatternContext: behavioralPatternContext || null,
    recentTrades: (Array.isArray(trades) ? trades : []).slice(0, 10).map((trade) => ({
      asset: trade?.asset || "",
      setup: trade?.setup || "",
      setupType: normalizeSetupType(trade?.setupType),
      session: trade?.session || "",
      sessionSlot: trade?.sessionSlot || null,
      resultR: roundMetric(parseTradeResult(trade?.result_r)),
      direction: trade?.direction || "",
      createdAt: trade?.created_at || trade?.entry_time || null,
      sourceType: "real_trade",
      sourceLabel: "Real trade",
    })),
  };
}

function buildBehavioralPatternSummary(simTrades) {
  const trades = Array.isArray(simTrades) ? simTrades : [];
  if (trades.length < 5) return null;

  const recent = trades.slice(-15);
  const totalRecent = recent.length;

  const wins = recent.filter((t) => (t.profitLoss || 0) > 0);
  const longs = recent.filter((t) => t.direction === "long");
  const shorts = recent.filter((t) => t.direction === "short");
  const longWins = longs.filter((t) => (t.profitLoss || 0) > 0);
  const shortWins = shorts.filter((t) => (t.profitLoss || 0) > 0);

  let streakCount = 0;
  let streakType = null;
  for (let i = recent.length - 1; i >= 0; i--) {
    const type = (recent[i].profitLoss || 0) > 0 ? "win" : "loss";
    if (streakType === null) { streakType = type; streakCount = 1; }
    else if (type === streakType) streakCount++;
    else break;
  }

  const cutEarlyCount = recent.filter((t) => t.outcomeLabel === "Cut too early").length;
  const heldTooLongCount = recent.filter((t) => t.outcomeLabel === "Held too long").length;
  const strongExecCount = recent.filter((t) => t.executionGrade === "A" || t.executionGrade === "B").length;
  const poorExecCount = recent.filter((t) => t.executionGrade === "D").length;

  return {
    sampleSize: totalRecent,
    patternThresholdMet: totalRecent >= 5,
    winRate: Math.round((wins.length / totalRecent) * 100),
    longWinRate: longs.length >= 4 ? Math.round((longWins.length / longs.length) * 100) : null,
    longTradeCount: longs.length,
    shortWinRate: shorts.length >= 4 ? Math.round((shortWins.length / shorts.length) * 100) : null,
    shortTradeCount: shorts.length,
    currentStreak: streakType ? { type: streakType, count: streakCount } : null,
    cutEarlyCount,
    heldTooLongCount,
    strongExecCount,
    poorExecCount,
  };
}

function buildSelectedAssetChartSummary(chartContext) {
  if (!chartContext) return null;
  const bars = Array.isArray(chartContext?.recentBars) ? chartContext.recentBars : [];
  const firstClose = Number(chartContext?.chartSummary?.firstClose);
  const lastClose = Number(chartContext?.chartSummary?.lastClose);
  const barCount = Number(chartContext?.chartSummary?.barCount);
  const netChange = Number.isFinite(firstClose) && Number.isFinite(lastClose) ? lastClose - firstClose : null;
  const netChangePct = Number.isFinite(firstClose) && firstClose !== 0 && Number.isFinite(lastClose)
    ? ((lastClose - firstClose) / firstClose) * 100
    : null;
  return {
    timeframe: chartContext?.timeframe || "1D",
    barCount: Number.isFinite(barCount) ? barCount : bars.length || 0,
    firstClose: Number.isFinite(firstClose) ? firstClose : null,
    lastClose: Number.isFinite(lastClose) ? lastClose : null,
    netChange: Number.isFinite(netChange) ? roundMetric(netChange) : null,
    netChangePct: Number.isFinite(netChangePct) ? roundMetric(netChangePct) : null,
  };
}

function buildRaylaPicksContext({ trades, simulationTradeHistory }) {
  const realTrades = Array.isArray(trades) ? trades : [];
  const simTrades = Array.isArray(simulationTradeHistory) ? simulationTradeHistory : [];
  const bucketMap = new Map();

  const ensureBucket = (asset, assetType, direction) => {
    const key = `${assetType}:${direction}:${asset}`;
    if (!bucketMap.has(key)) {
      bucketMap.set(key, {
        asset,
        assetType,
        direction,
        totalTrades: 0,
        wins: 0,
        totalR: 0,
        realTrades: 0,
        simTrades: 0,
      });
    }
    return bucketMap.get(key);
  };

  realTrades.forEach((trade) => {
    const asset = String(trade?.asset || "").trim().toUpperCase();
    const direction = String(trade?.direction || "").trim().toLowerCase();
    const resultR = parseTradeResult(trade?.result_r);
    if (!asset || !Number.isFinite(resultR) || !["long", "short"].includes(direction)) return;
    const assetType = CRYPTO_SYMBOL_SET.has(asset) ? "crypto" : "stock";
    const bucket = ensureBucket(asset, assetType, direction);
    bucket.totalTrades += 1;
    bucket.realTrades += 1;
    bucket.totalR += resultR;
    if (resultR > 0) bucket.wins += 1;
  });

  simTrades.forEach((trade) => {
    const asset = String(trade?.asset || "").trim().toUpperCase();
    const direction = String(trade?.direction || "").trim().toLowerCase();
    const resultR = Number(trade?.rMultiple);
    if (!asset || !Number.isFinite(resultR) || !["long", "short"].includes(direction)) return;
    const assetType = CRYPTO_SYMBOL_SET.has(asset) ? "crypto" : "stock";
    const bucket = ensureBucket(asset, assetType, direction);
    bucket.totalTrades += 1;
    bucket.simTrades += 1;
    bucket.totalR += resultR;
    if (resultR > 0) bucket.wins += 1;
  });

  const ranked = Array.from(bucketMap.values())
    .map((bucket) => ({
      ...bucket,
      avgR: bucket.totalTrades ? bucket.totalR / bucket.totalTrades : 0,
      winRate: bucket.totalTrades ? (bucket.wins / bucket.totalTrades) * 100 : 0,
    }))
    .sort((a, b) => {
      if (b.avgR !== a.avgR) return b.avgR - a.avgR;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.totalTrades - a.totalTrades;
    });

  const findBest = (assetType, direction) =>
    ranked.find((entry) => entry.assetType === assetType && entry.direction === direction) || null;

  const toPick = (entry, title) => {
    if (!entry) {
      return {
        title,
        asset: null,
        directionBias: null,
        explanation: "Not enough logged history yet in this category.",
        progress: "Log a few more trades or simulations here to unlock a personalized pick.",
        eligible: false,
      };
    }

    const biasLabel = entry.direction === "short" ? "Short bias" : "Long bias";
    const realLabel = `${entry.realTrades} real trade${entry.realTrades === 1 ? "" : "s"}`;
    const simLabel = `${entry.simTrades} simulation trade${entry.simTrades === 1 ? "" : "s"}`;
    const earlyRead = entry.totalTrades < 3;
    const explanation = earlyRead
      ? `${entry.asset} is the strongest early read in this bucket so far.`
      : `${entry.asset} has the strongest relative edge in your logged history right now.`;
    const progress = `Built from ${realLabel} and ${simLabel} in this direction.`;

    return {
      title,
      asset: entry.asset,
      directionBias: biasLabel,
      explanation,
      progress,
      eligible: true,
      avgR: entry.avgR,
      winRate: entry.winRate,
      totalTrades: entry.totalTrades,
      realTrades: entry.realTrades,
      simTrades: entry.simTrades,
    };
  };

  return {
    stockLong: toPick(findBest("stock", "long"), "Best Stock to Buy"),
    stockShort: toPick(findBest("stock", "short"), "Best Stock to Short"),
    cryptoLong: toPick(findBest("crypto", "long"), "Best Crypto to Buy"),
    cryptoShort: toPick(findBest("crypto", "short"), "Best Crypto to Short"),
  };
}

function buildCoachReport(trades) {
  if (!trades || trades.length === 0) return null;

  const wins = trades.filter(t => getTradeOutcomeValue(t) > 0);
  const losses = trades.filter(t => getTradeOutcomeValue(t) < 0);
  const winRate = trades.length ? (wins.length / trades.length) * 100 : 0;
  const avgR = trades.length ? trades.reduce((s, t) => s + getTradeOutcomeValue(t), 0) / trades.length : 0;
  const avgWin = wins.length ? wins.reduce((s, t) => s + getTradeOutcomeValue(t), 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + getTradeOutcomeValue(t), 0) / losses.length) : 0;
  const totalR = trades.reduce((s, t) => s + getTradeOutcomeValue(t), 0);
  const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : null;

  const setupMap = {};
  trades.forEach(t => {
    if (!t.setup) return;
    if (!setupMap[t.setup]) setupMap[t.setup] = { trades: 0, wins: 0, totalR: 0 };
    setupMap[t.setup].trades++;
    setupMap[t.setup].totalR += getTradeOutcomeValue(t);
    if (getTradeOutcomeValue(t) > 0) setupMap[t.setup].wins++;
  });
  const setupStats = Object.entries(setupMap)
    .map(([setup, s]) => ({ setup, trades: s.trades, winRate: (s.wins / s.trades) * 100, avgR: s.totalR / s.trades, totalR: s.totalR }))
    .sort((a, b) => b.avgR - a.avgR);

  const assetMap = {};
  trades.forEach(t => {
    const asset = (t.asset || "Unknown").toUpperCase();
    if (!assetMap[asset]) assetMap[asset] = { trades: 0, wins: 0, totalR: 0 };
    assetMap[asset].trades++;
    assetMap[asset].totalR += getTradeOutcomeValue(t);
    if (getTradeOutcomeValue(t) > 0) assetMap[asset].wins++;
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
    comboMap[key].totalR += getTradeOutcomeValue(t);
    if (getTradeOutcomeValue(t) > 0) comboMap[key].wins++;
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
  const recentLosses = trades.slice(0, 4).filter(t => getTradeOutcomeValue(t) < 0).length;
  if (recentLosses >= 3) warnings.push("3 or more losses in your last 4 trades — consider taking a break.");

  const actions = [];
  const bestCombo = comboStats[0];
  const worstSetup = setupStats[setupStats.length - 1];
  if (bestCombo) actions.push(`Focus on ${bestCombo.setup} setups on ${bestCombo.asset} — your strongest edge (${bestCombo.avgR.toFixed(2)} avg).`);
  if (worstSetup && setupStats.length > 1 && worstSetup.avgR < 0) actions.push(`Reduce or stop trading ${worstSetup.setup} setups — negative average result (${worstSetup.avgR.toFixed(2)}).`);
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

const PERF_SELECT_STYLE = {
  background: "rgba(18,26,38,0.9)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  padding: "8px 12px",
  color: "#e2e8f0",
  fontSize: 13,
  cursor: "pointer",
};

const MY_TRADES_HELP = {
  buyingPower: {
    title: "Buying Power",
    body: "Cash your broker allows for new positions — includes margin if your account has it.",
  },
  positionSize: {
    title: "Position Size",
    body: "Shares or units in the trade. Bigger size amplifies both gain and loss.",
  },
  orderType: {
    title: "Order Type",
    body: "Market fills immediately at best price. Limit waits for your price or better.",
  },
  exits: {
    title: "Stop Loss / Take Profit",
    body: "Planning fields — not attached to the submitted order yet.",
  },
  leverage: {
    title: "Leverage / Margin",
    body: "Depends on your Alpaca account. Rayla submits standard paper orders only.",
  },
  unrealizedPnL: {
    title: "Unrealized P/L",
    body: "Open position gain/loss. Only becomes real when you close.",
  },
};

function InlineHelpButton({ topic, activeTopic, onToggle, label = "What's this?" }) {
  return (
    <button
      type="button"
      className="ghostButton"
      onClick={() => onToggle(activeTopic === topic ? null : topic)}
      style={{
        padding: "3px 8px",
        fontSize: 10,
        fontWeight: 700,
        borderRadius: 999,
        color: activeTopic === topic ? "#d7efff" : "#7f8ea3",
        borderColor: activeTopic === topic ? "rgba(124,196,255,0.28)" : "rgba(255,255,255,0.08)",
        background: activeTopic === topic ? "rgba(124,196,255,0.08)" : "rgba(255,255,255,0.03)",
      }}
    >
      {label}
    </button>
  );
}

function InlineHelpCard({ topic }) {
  const help = MY_TRADES_HELP[topic];
  if (!help) return null;
  return (
    <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(124,196,255,0.08)", border: "1px solid rgba(124,196,255,0.16)", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.9px", textTransform: "uppercase", color: "#7CC4FF" }}>
        {help.title}
      </div>
      <div style={{ fontSize: 12, color: "#dbeafe", lineHeight: 1.55 }}>
        {help.body}
      </div>
    </div>
  );
}

function PerfBreakdownTable({ title, rows, nameColor = "#94a3b8" }) {
  if (!rows || rows.length === 0) return null;
  const maxAbs = Math.max(...rows.map(r => Math.abs(r.totalR)), 0.01);
  return (
    <div style={{ background: "rgba(18,26,38,0.86)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 11, fontWeight: 600, color: "#7f8ea3", textTransform: "uppercase", letterSpacing: "0.6px" }}>{title}</div>
      <div style={{ padding: "4px 0" }}>
        {rows.map((row, i) => (
          <div key={i} style={{ padding: "9px 16px", borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ minWidth: 88, maxWidth: 120, fontSize: 12, color: nameColor, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</div>
            <div style={{ fontSize: 11, color: "#475569", whiteSpace: "nowrap", flexShrink: 0 }}>{row.trades}t · {row.winRate.toFixed(0)}%</div>
            <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(Math.abs(row.totalR) / maxAbs) * 100}%`, background: row.totalR >= 0 ? "#4ade80" : "#f87171", borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: row.totalR >= 0 ? "#4ade80" : "#f87171", minWidth: 54, textAlign: "right", flexShrink: 0 }}>{row.totalR >= 0 ? "+" : ""}{row.totalR.toFixed(2)}</div>
            <div style={{ fontSize: 11, color: row.avgR >= 0 ? "#4ade80" : "#f87171", minWidth: 42, textAlign: "right", flexShrink: 0 }}>{row.avgR >= 0 ? "+" : ""}{row.avgR.toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PerformanceLiveChartCard({
  alpacaPositions,
  performanceLiveAppliedSelection,
  setPerformanceLiveAppliedSelection,
  tradePortfolioAllSymbols,
  tradeChartSymbol,
  tradeChartCurrentPrice,
  tradeChartQuote,
  tradeChartMatchingPosition,
  tradeChartAsset,
  tradeChartAssetType,
  tradeChartRange,
  setTradeChartRange,
  tradeChartMode,
  setTradeChartMode,
  tradeChartLastUpdated,
  tradeIsComparisonMode,
  tradeIsPortfolioTotalMode,
  tradePortfolioCombinedUnrealizedPl,
  tradePortfolioCombinedMarketValue,
  tradePortfolioDisplayedPositions,
  tradePortfolioChartsLoading,
  tradePortfolioCharts,
  brokerTradeLog,
  trades,
  tradePortfolioRequestedStartMs,
  tradePortfolioNowMs,
  tradeMarketChartLoading,
  tradeMarketChart,
}) {
  const cardBase = { background: "rgba(18,26,38,0.86)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 };
  const [historyRange, setHistoryRange] = useState("MAX");
  const closedTrades = useMemo(
    () => trades
      .map((trade) => ({
        ...trade,
        symbol: String(trade?.asset || "").trim().toUpperCase(),
        timeMs: parseTradeTimeMs(trade),
        pnl: calculateTradeDollarPnl(trade),
      }))
      .filter((trade) => trade.symbol && Number.isFinite(trade.timeMs) && Number.isFinite(trade.pnl)),
    [trades]
  );
  const closedTradeSymbols = useMemo(
    () => Array.from(new Set(closedTrades.map((trade) => trade.symbol))).sort(),
    [closedTrades]
  );
  const rangeWindowMs = getChartSelectionWindowMs(historyRange);
  const nowMs = Date.now();
  const rangeStartMs = rangeWindowMs ? nowMs - rangeWindowMs : null;
  const rangeLabel = (CHART_RANGE_OPTIONS.find((option) => option.value === historyRange)?.label) || historyRange;
  const historyRangeOptions = useMemo(
    () => CHART_RANGE_OPTIONS.filter((option) => ["1D", "1W", "1M", "3M", "1Y", "5Y", "MAX"].includes(option.value)),
    []
  );
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const normalizeSelection = (selection) => {
    const validSymbols = Array.from(new Set((selection?.symbols || []).filter((symbol) => closedTradeSymbols.includes(symbol))));
    const includePortfolio = Boolean(selection?.includePortfolio);
    if (!includePortfolio && validSymbols.length === 0) {
      return { includePortfolio: true, symbols: [] };
    }
    return { includePortfolio, symbols: validSymbols };
  };
  const buildSelectionKey = (selection) => {
    const normalized = normalizeSelection(selection);
    return `${normalized.includePortfolio ? "portfolio" : "assets"}:${normalized.symbols.join(",")}`;
  };
  const [appliedSelection, setAppliedSelection] = useState(() => normalizeSelection({ includePortfolio: true, symbols: [] }));
  const appliedSelectionKey = useMemo(() => buildSelectionKey(appliedSelection), [appliedSelection]);
  const [pendingSelection, setPendingSelection] = useState(appliedSelection);
  useEffect(() => {
    setAppliedSelection((prev) => normalizeSelection(prev));
    setPendingSelection((prev) => normalizeSelection(prev));
  }, [closedTradeSymbols.join(",")]);
  const isAppliedPortfolioMode = appliedSelection.includePortfolio;
  const selectedTargets = pendingSelection.includePortfolio
    ? ["PORTFOLIO", ...pendingSelection.symbols]
    : pendingSelection.symbols;
  const isTargetSelected = (target) => selectedTargets.includes(target);
  const selectionDirty = buildSelectionKey(pendingSelection) !== buildSelectionKey(appliedSelection);
  const togglePendingPortfolio = () => {
    setPendingSelection((prev) => {
      if (prev.includePortfolio && prev.symbols.length === 0) return prev;
      return normalizeSelection({ ...prev, includePortfolio: !prev.includePortfolio });
    });
  };
  const togglePendingSymbol = (symbol) => {
    setPendingSelection((prev) => {
      const current = new Set(prev.symbols);
      if (current.has(symbol)) current.delete(symbol);
      else current.add(symbol);
      return normalizeSelection({ ...prev, symbols: Array.from(current) });
    });
  };
  const applyPendingSelection = () => {
    setAppliedSelection(normalizeSelection(pendingSelection));
  };
  const ASSET_PALETTE = ["#60a5fa", "#34d399", "#f59e0b", "#f87171", "#a78bfa", "#fb923c"];
  const assetColorMap = {};
  closedTradeSymbols.forEach((symbol, index) => {
    assetColorMap[symbol] = ASSET_PALETTE[index % ASSET_PALETTE.length];
  });
  const filteredAssetChoices = useMemo(() => {
    const normalizedQuery = assetSearchQuery.trim().toUpperCase();
    if (!normalizedQuery) return closedTradeSymbols;
    return closedTradeSymbols.filter((symbol) => symbol.includes(normalizedQuery));
  }, [assetSearchQuery, closedTradeSymbols]);
  const buildClosedTradeSeries = (tradeRows) => {
    const sortedTrades = [...tradeRows].sort((a, b) => a.timeMs - b.timeMs);
    if (!sortedTrades.length) return [];
    const baselineTimeMs = rangeStartMs ?? Math.max(0, sortedTrades[0].timeMs - 1);
    let runningValue = 0;
    const points = [{ timeMs: baselineTimeMs, value: 0 }];
    sortedTrades.forEach((trade) => {
      runningValue += Number(trade.pnl) || 0;
      points.push({ timeMs: trade.timeMs, value: runningValue });
    });
    return points;
  };
  const visibleClosedTrades = useMemo(
    () => closedTrades.filter((trade) => rangeStartMs == null || trade.timeMs >= rangeStartMs),
    [closedTrades, rangeStartMs]
  );
  const portfolioSeries = useMemo(
    () => buildClosedTradeSeries(visibleClosedTrades),
    [visibleClosedTrades, rangeStartMs]
  );
  const assetSeries = useMemo(
    () => appliedSelection.symbols.map((symbol) => ({
      symbol,
      color: assetColorMap[symbol] || "#60a5fa",
      points: buildClosedTradeSeries(visibleClosedTrades.filter((trade) => trade.symbol === symbol)),
    })),
    [appliedSelection.symbols, assetColorMap, visibleClosedTrades, rangeStartMs]
  );
  const displayedLines = useMemo(() => {
    const nextLines = [];
    if (appliedSelection.includePortfolio) {
      nextLines.push({ symbol: "Portfolio", color: "#7CC4FF", points: portfolioSeries });
    }
    assetSeries.forEach((line) => {
      if (line.points.length) nextLines.push(line);
    });
    return nextLines;
  }, [appliedSelection.includePortfolio, portfolioSeries, assetSeries]);
  const allVisibleValues = displayedLines.flatMap((line) => line.points.map((point) => point.value)).filter(Number.isFinite);
  const xRangeStartMs = rangeStartMs ?? Math.min(...displayedLines.flatMap((line) => line.points.map((point) => point.timeMs)).filter(Number.isFinite));
  const xRangeEndMs = Math.max(nowMs, ...displayedLines.flatMap((line) => line.points.map((point) => point.timeMs)).filter(Number.isFinite));
  const selectedClosedTrades = useMemo(
    () => visibleClosedTrades.filter((trade) => appliedSelection.includePortfolio || appliedSelection.symbols.includes(trade.symbol)),
    [visibleClosedTrades, appliedSelection]
  );
  const selectedRealizedPnl = selectedClosedTrades.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0);
  const chartStatsLabel = appliedSelection.includePortfolio
    ? "Portfolio + selected assets"
    : "Selected assets only";

  return (
    <div style={{ ...cardBase, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "#7f8ea3", marginBottom: 6 }}>
            Closed Trade History
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#e2e8f0" }}>
            {appliedSelection.includePortfolio ? "Portfolio Realized P/L" : appliedSelection.symbols.length ? appliedSelection.symbols.join(", ") : "Select an asset"}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            Closed trades only. Open positions are excluded from this chart and any asset overlays.
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 0.34fr) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: "#7f8ea3", letterSpacing: "0.4px", textTransform: "uppercase" }}>
            Select assets to overlay
          </div>
          <button
            type="button"
            disabled={!selectionDirty}
            onClick={applyPendingSelection}
            style={{
              padding: "13px 16px",
              borderRadius: 12,
              border: `1px solid ${selectionDirty ? "rgba(124,196,255,0.36)" : "rgba(255,255,255,0.08)"}`,
              background: selectionDirty ? "rgba(124,196,255,0.12)" : "rgba(255,255,255,0.03)",
              boxShadow: selectionDirty ? "0 0 0 1px rgba(124,196,255,0.14), 0 0 20px rgba(124,196,255,0.08)" : "none",
              color: selectionDirty ? "#d7efff" : "#7f8ea3",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.2px",
              cursor: selectionDirty ? "pointer" : "default",
              width: "100%",
              textAlign: "center",
              transition: "border-color 160ms ease, background 160ms ease, box-shadow 160ms ease, color 160ms ease",
            }}
          >
            View in chart
          </button>
          <input
            value={assetSearchQuery}
            onChange={(event) => setAssetSearchQuery(event.target.value)}
            placeholder="Search traded assets"
            style={{
              width: "100%",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              color: "#e2e8f0",
              fontSize: 13,
              padding: "11px 12px",
              outline: "none",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="button"
              onClick={togglePendingPortfolio}
              style={{
                padding: 12,
                borderRadius: 12,
                background: isTargetSelected("PORTFOLIO") ? "rgba(124,196,255,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${isTargetSelected("PORTFOLIO") ? "rgba(124,196,255,0.45)" : "rgba(255,255,255,0.06)"}`,
                boxShadow: isTargetSelected("PORTFOLIO") ? "0 0 0 1px rgba(124,196,255,0.15), 0 0 18px rgba(124,196,255,0.08)" : "none",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                transition: "border-color 160ms ease, background 160ms ease, box-shadow 160ms ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>Portfolio</div>
                <div style={{ fontSize: 12, color: selectedRealizedPnl >= 0 ? "#4ade80" : "#f87171", fontWeight: 700 }}>
                  {`${selectedRealizedPnl >= 0 ? "+" : ""}${formatCurrency(selectedRealizedPnl)}`}
                </div>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                Realized P/L across the selected range. Closed trades only.
              </div>
            </button>
            {filteredAssetChoices.map((symbol) => {
              const visible = pendingSelection.symbols.includes(symbol);
              const lineColor = assetColorMap[symbol] || "#60a5fa";
              const appliedVisible = appliedSelection.symbols.includes(symbol);
              const symbolTrades = visibleClosedTrades.filter((trade) => trade.symbol === symbol);
              const symbolPnl = symbolTrades.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0);
              const highlighted = visible;
              return (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => togglePendingSymbol(symbol)}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    background: highlighted ? "rgba(124,196,255,0.08)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${highlighted ? "rgba(124,196,255,0.45)" : "rgba(255,255,255,0.06)"}`,
                    boxShadow: highlighted ? "0 0 0 1px rgba(124,196,255,0.15), 0 0 18px rgba(124,196,255,0.08)" : "none",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                    opacity: !visible ? 0.45 : 1,
                    transition: "border-color 160ms ease, background 160ms ease, box-shadow 160ms ease, opacity 160ms ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: visible ? lineColor : "rgba(255,255,255,0.18)", flexShrink: 0 }} />
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{symbol}</div>
                      {isAppliedPortfolioMode && appliedVisible ? (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#d7efff", border: "1px solid rgba(124,196,255,0.2)", borderRadius: 999, padding: "2px 7px", background: "rgba(124,196,255,0.05)" }}>
                          Visible
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 12, color: symbolPnl >= 0 ? "#4ade80" : "#f87171", fontWeight: 700 }}>
                      {`${symbolPnl >= 0 ? "+" : ""}${formatCurrency(symbolPnl)}`}
                    </div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                    {symbolTrades.length} closed trade{symbolTrades.length === 1 ? "" : "s"} in range
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
              <ChartTimeframeDropdown
                value={historyRange}
                onChange={setHistoryRange}
                options={historyRangeOptions}
                width={88}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: selectedRealizedPnl >= 0 ? "#4ade80" : "#f87171" }}>
                {`${selectedRealizedPnl >= 0 ? "+" : ""}${formatCurrency(selectedRealizedPnl)}`}
              </div>
              <div style={{ fontSize: 10, color: "#7f8ea3", textAlign: "right" }}>
                {rangeLabel} · Closed trades only
              </div>
            </div>
          </div>

          {allVisibleValues.length >= 1 ? (() => {
            const xL = 8;
            const xR = 286;
            const yT = 12;
            const yB = 192;
            const chartW = xR - xL;
            const chartH = yB - yT;
            const yMin = Math.min(...allVisibleValues);
            const yMax = Math.max(...allVisibleValues);
            const yPad = (yMax - yMin) * 0.16 || 25;
            const yLo = yMin - yPad;
            const yHi = yMax + yPad;
            const valueToY = (value) => yB - ((value - yLo) / (yHi - yLo || 1)) * chartH;
            const ySteps = Array.from({ length: 5 }, (_, index) => {
              const ratio = index / 4;
              return { y: yT + chartH * ratio, value: yHi - ((yHi - yLo) * ratio) };
            });
            const zeroY = valueToY(0);
            const xTicks = buildTradePortfolioTicks(xRangeStartMs, xRangeEndMs, historyRange);
            const lineMeta = displayedLines.map((line) => ({
              ...line,
              lastValue: line.points[line.points.length - 1]?.value,
              pointsSvg: line.points.map((point) => {
                const ratio = (point.timeMs - xRangeStartMs) / Math.max(1, xRangeEndMs - xRangeStartMs);
                return `${xL + (Math.max(0, Math.min(1, ratio)) * chartW)},${valueToY(point.value)}`;
              }).join(" "),
            }));
            return (
              <div style={{ borderRadius: 12, overflow: "hidden", background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", position: "relative" }}>
                <div style={{ position: "absolute", top: 10, left: 10, zIndex: 2, display: "flex", flexWrap: "wrap", gap: "4px 10px", pointerEvents: "none", maxWidth: "calc(100% - 24px)" }}>
                  {lineMeta.map((line) => (
                    <div key={line.symbol} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 14, height: 2, background: line.color, borderRadius: 1, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0", letterSpacing: "0.01em" }}>
                        {line.symbol}
                      </span>
                      {Number.isFinite(line.lastValue) ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: line.lastValue >= 0 ? "#4ade80" : "#f87171" }}>
                          {line.lastValue >= 0 ? "+" : ""}{formatCurrency(line.lastValue)}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
                <svg viewBox="0 0 300 215" style={{ width: "100%", height: "auto", display: "block" }}>
                  {ySteps.map((step, index) => (
                    <g key={`y-${index}`}>
                      <line x1={xL} y1={step.y} x2={xR} y2={step.y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" />
                      <text x={xR + 3} y={step.y + 2} textAnchor="start" fontSize="5.5" fill="#7f8ea3" fontFamily="system-ui,sans-serif">
                        {step.value >= 0 ? "+" : ""}{formatCurrency(step.value)}
                      </text>
                    </g>
                  ))}
                  {Number.isFinite(zeroY) && zeroY >= yT && zeroY <= yB ? (
                    <line x1={xL} y1={zeroY} x2={xR} y2={zeroY} stroke="rgba(255,255,255,0.14)" strokeWidth="0.4" strokeDasharray="3 2" />
                  ) : null}
                  <line x1={xR} y1={yT} x2={xR} y2={yB} stroke="rgba(255,255,255,0.08)" strokeWidth="0.3" />
                  <line x1={xL} y1={yB} x2={xR} y2={yB} stroke="rgba(255,255,255,0.08)" strokeWidth="0.3" />
                  {xTicks.map((tick, index) => (
                    <g key={`tick-${index}`}>
                      <line x1={xL + tick.ratio * chartW} y1={yT} x2={xL + tick.ratio * chartW} y2={yB} stroke="rgba(255,255,255,0.025)" strokeWidth="0.3" />
                      {tick.label ? (
                        <text x={xL + tick.ratio * chartW} y={yB + 9} textAnchor="middle" fontSize="5.5" fill="#7f8ea3" fontFamily="system-ui,sans-serif">
                          {tick.label}
                        </text>
                      ) : null}
                    </g>
                  ))}
                  {lineMeta.map((line) => (
                    line.pointsSvg ? (
                      <polyline
                        key={line.symbol}
                        points={line.pointsSvg}
                        fill="none"
                        stroke={line.color}
                        strokeWidth={line.symbol === "Portfolio" ? "1" : "0.8"}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        opacity={line.symbol === "Portfolio" ? "1" : "0.88"}
                      />
                    ) : null
                  ))}
                </svg>
              </div>
            );
          })() : (
            <div style={{ height: 360, borderRadius: 12, background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "0 24px" }}>
              No closed trades match this range yet. Open positions are intentionally excluded from the Performance chart.
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Assets Selected</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{appliedSelection.symbols.length + (isAppliedPortfolioMode ? 1 : 0)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>View</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
            {chartStatsLabel}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Closed Trades</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
            {selectedClosedTrades.length}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Realized P/L</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: selectedRealizedPnl >= 0 ? "#4ade80" : "#f87171" }}>
            {`${selectedRealizedPnl >= 0 ? "+" : ""}${formatCurrency(selectedRealizedPnl)}`}
          </div>
        </div>
      </div>
    </div>
  );
}

function PerformanceDashboard({
  trades,
  equityPoints,
  sourceLabel,
  chartRange,
  setChartRange,
  benchmarkSymbol,
  benchmarkLabel,
  onSelectBenchmark,
  benchmarkOptions,
  benchmarkPoints,
  benchmarkLoading,
  alpacaConnected,
  coachSummary,
  showNoNewTrades,
  onRunAnalysis,
  onOpenRaylaPopup,
  alpacaPositions,
  performanceLiveAppliedSelection,
  setPerformanceLiveAppliedSelection,
  tradeAppliedSelection,
  applyTradeSelection,
  tradePortfolioAllSymbols,
  tradeChartSymbol,
  tradeChartCurrentPrice,
  tradeChartQuote,
  tradeChartMatchingPosition,
  tradeChartAsset,
  tradeChartAssetType,
  tradeChartRange,
  setTradeChartRange,
  tradeChartMode,
  setTradeChartMode,
  tradeChartLastUpdated,
  tradeIsComparisonMode,
  tradeIsPortfolioTotalMode,
  tradePortfolioCombinedUnrealizedPl,
  tradePortfolioCombinedMarketValue,
  tradePortfolioDisplayedPositions,
  tradePortfolioChartsLoading,
  tradePortfolioCharts,
  brokerTradeLog,
  tradePortfolioRequestedStartMs,
  tradePortfolioNowMs,
  tradeMarketChartLoading,
  tradeMarketChart,
}) {
  const [fAsset, setFAsset] = useState("all");
  const [fSetup, setFSetup] = useState("all");
  const [fSession, setFSession] = useState("all");
  const [fDir, setFDir] = useState("all");
  const [fResult, setFResult] = useState("all");
  const [tooltip, setTooltip] = useState(null);

  const allAssets = useMemo(() => [...new Set(trades.map(t => (t.asset || "").toUpperCase()).filter(Boolean))].sort(), [trades]);
  const allSetups = useMemo(() => [...new Set(trades.map(t => t.setup).filter(Boolean))].sort(), [trades]);
  const allSessions = useMemo(() => [...new Set(trades.map(t => t.session).filter(Boolean))].sort(), [trades]);

  const ft = useMemo(() => trades
    .filter(t => fAsset === "all" || (t.asset || "").toUpperCase() === fAsset)
    .filter(t => fSetup === "all" || t.setup === fSetup)
    .filter(t => fSession === "all" || t.session === fSession)
    .filter(t => fDir === "all" || (t.direction || "").toLowerCase() === fDir)
    .filter(t => {
      if (fResult === "all") return true;
      const r = getTradeOutcomeValue(t);
      return fResult === "win" ? r > 0 : fResult === "loss" ? r < 0 : r === 0;
    }), [trades, fAsset, fSetup, fSession, fDir, fResult]);

  const report = useMemo(() => buildCoachReport(ft), [ft]);
  const hasFilters = fAsset !== "all" || fSetup !== "all" || fSession !== "all" || fDir !== "all" || fResult !== "all";

  const sessionStats = useMemo(() => {
    const map = {};
    ft.forEach(t => {
      const k = t.session || "Untagged";
      if (!map[k]) map[k] = { trades: 0, wins: 0, totalR: 0 };
      map[k].trades++;
      map[k].totalR += getTradeOutcomeValue(t);
      if (getTradeOutcomeValue(t) > 0) map[k].wins++;
    });
    return Object.entries(map)
      .map(([session, s]) => ({ session, trades: s.trades, winRate: s.trades > 0 ? (s.wins / s.trades) * 100 : 0, avgR: s.trades > 0 ? s.totalR / s.trades : 0, totalR: s.totalR }))
      .sort((a, b) => b.totalR - a.totalR);
  }, [ft]);

  const recent5 = useMemo(() => [...trades]
    .sort((a, b) => (b.entry_time ? new Date(b.entry_time).getTime() : 0) - (a.entry_time ? new Date(a.entry_time).getTime() : 0))
    .slice(0, 5), [trades]);

  const lossStreak = useMemo(() => {
    const sorted = [...trades].sort((a, b) => (b.entry_time ? new Date(b.entry_time).getTime() : 0) - (a.entry_time ? new Date(a.entry_time).getTime() : 0));
    let streak = 0;
    for (const t of sorted) {
      if (getTradeOutcomeValue(t) < 0) streak++;
      else break;
    }
    return streak;
  }, [trades]);

  const rStdDev = useMemo(() => {
    if (ft.length < 3) return null;
    const rs = ft.map(t => getTradeOutcomeValue(t));
    const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
    const variance = rs.reduce((a, r) => a + (r - mean) ** 2, 0) / rs.length;
    return Math.sqrt(variance);
  }, [ft]);

  const TOOLTIP_CONTENT = {
    winrate: { title: "Win Rate", body: "Win rate is the percentage of your trades that finished as winners. Higher isn't always better — what matters is win rate in combination with how much you make vs. lose per trade." },
    avgr: { title: "Avg Result / Trade", body: "Average result shows what your typical completed trade earns or loses across the trades currently included in analysis." },
    totalr: { title: "Total Result", body: "Total result is the cumulative profit and loss across the trades currently included in analysis." },
    pf: { title: "Profit Factor", body: "Profit Factor = total gross wins ÷ total gross losses. Above 1.0 means the system is net profitable. Below 1.0 means losses are outpacing wins in dollar terms." },
  };

  const cardBase = { background: "rgba(18,26,38,0.86)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 };
  const diagnosisStrongestEdge = coachSummary?.strongestEdge
    || (report?.bestCombo
      ? `${report.bestCombo.setup} on ${report.bestCombo.asset} — ${report.bestCombo.avgR.toFixed(2)} avg across ${report.bestCombo.trades} trade${report.bestCombo.trades === 1 ? "" : "s"} · ${report.bestCombo.winRate.toFixed(0)}% win rate.${report.bestCombo.trades < 3 ? " Early signal — build sample size here before scaling." : ""}`
      : null);
  const diagnosisConsistencyNote = rStdDev != null
    ? `Result std deviation: ${rStdDev.toFixed(2)}. ${rStdDev < 1.2
      ? "Your outcomes are fairly consistent."
      : rStdDev < 2.5
        ? "Moderate variance in outcomes. Review whether sizing and execution are staying consistent."
        : "High variance in outcomes. Risk sizing or execution inconsistency is likely distorting results."}`
    : null;
  const weakestSetup = report?.setupStats?.length > 1 ? report.setupStats[report.setupStats.length - 1] : null;
  const diagnosisWarning = coachSummary?.warning
    || report?.warnings?.[0]
    || (weakestSetup && weakestSetup.avgR < 0
      ? `${weakestSetup.setup} is your weakest setup right now at ${weakestSetup.avgR.toFixed(2)} average per trade.`
      : null);
  const diagnosisNextAction = coachSummary?.nextAction || report?.actions?.[0] || null;

  if (trades.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: "#f3f7fc", marginBottom: 8 }}>No trades to analyze yet</div>
        <div style={{ fontSize: 14, color: "#64748b", maxWidth: 380, margin: "0 auto", lineHeight: 1.6 }}>
          Head to <strong style={{ color: "#7CC4FF" }}>My Trades</strong> and log your first trade. Your full analytics dashboard will unlock here.
        </div>
      </div>
    );
  }

  const winCount = report?.wins || 0;
  const lossCount = report?.losses || 0;
  const beCount = ft.filter(t => getTradeOutcomeValue(t) === 0).length;
  const totalCount = ft.length;

  function clearFilters() {
    setFAsset("all"); setFSetup("all"); setFSession("all"); setFDir("all"); setFResult("all");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <RaylaLaunchButton
          label="Ask Rayla"
          onClick={() => onOpenRaylaPopup?.("Ask Rayla")}
        />
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {allAssets.length > 1 && (
          <select value={fAsset} onChange={e => setFAsset(e.target.value)} style={PERF_SELECT_STYLE}>
            <option value="all">All Assets</option>
            {allAssets.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        {allSetups.length > 0 && (
          <select value={fSetup} onChange={e => setFSetup(e.target.value)} style={PERF_SELECT_STYLE}>
            <option value="all">All Setups</option>
            {allSetups.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {allSessions.length > 0 && (
          <select value={fSession} onChange={e => setFSession(e.target.value)} style={PERF_SELECT_STYLE}>
            <option value="all">All Sessions</option>
            {allSessions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <select value={fDir} onChange={e => setFDir(e.target.value)} style={PERF_SELECT_STYLE}>
          <option value="all">All Directions</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
        <select value={fResult} onChange={e => setFResult(e.target.value)} style={PERF_SELECT_STYLE}>
          <option value="all">All Results</option>
          <option value="win">Winners</option>
          <option value="loss">Losers</option>
          <option value="be">Breakeven</option>
        </select>
        {hasFilters && (
          <button type="button" onClick={clearFilters}
            style={{ background: "transparent", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, padding: "8px 12px", color: "#f87171", fontSize: 12, cursor: "pointer" }}>
            Clear
          </button>
        )}
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#475569" }}>{ft.length} of {trades.length} trades</div>
      </div>

      {/* Stats grid */}
      {report ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
          {[
            { label: "Trades", value: report.trades, sub: `${winCount}W · ${lossCount}L`, color: "#f3f7fc" },
            { label: "Win Rate", value: `${report.winRate.toFixed(1)}%`, sub: "% of winners", color: report.winRate >= 50 ? "#4ade80" : "#f87171", tip: "winrate" },
            { label: "Total Result", value: `${report.totalR >= 0 ? "+" : ""}${report.totalR.toFixed(2)}`, sub: "net result", color: report.totalR >= 0 ? "#4ade80" : "#f87171", tip: "totalr" },
            { label: "Avg Result / Trade", value: `${report.avgR >= 0 ? "+" : ""}${report.avgR.toFixed(2)}`, sub: "per trade", color: report.avgR >= 0 ? "#4ade80" : "#f87171", tip: "avgr" },
            { label: "Avg Win", value: report.avgWin > 0 ? `+${report.avgWin.toFixed(2)}` : "—", sub: "avg winner", color: "#4ade80" },
            { label: "Avg Loss", value: report.avgLoss > 0 ? `-${report.avgLoss.toFixed(2)}` : "—", sub: "avg loser", color: "#f87171" },
            ...(report.profitFactor !== null ? [{ label: "Profit Factor", value: report.profitFactor.toFixed(2), sub: ">1.0 profitable", color: report.profitFactor >= 1 ? "#4ade80" : "#f87171", tip: "pf" }] : []),
            ...(report.setupStats.length > 0 ? [{ label: "Best Setup", value: report.setupStats[0].setup, sub: `${report.setupStats[0].avgR >= 0 ? "+" : ""}${report.setupStats[0].avgR.toFixed(2)} avg`, color: "#7CC4FF" }] : []),
            ...(report.setupStats.length > 1 ? [{ label: "Weakest Setup", value: report.setupStats[report.setupStats.length - 1].setup, sub: `${report.setupStats[report.setupStats.length - 1].avgR >= 0 ? "+" : ""}${report.setupStats[report.setupStats.length - 1].avgR.toFixed(2)} avg`, color: "#f87171" }] : []),
          ].map(item => (
            <div key={item.label}
              onClick={item.tip ? () => setTooltip(item.tip) : undefined}
              style={{ ...cardBase, padding: "14px 16px", cursor: item.tip ? "pointer" : "default" }}>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                {item.label}
                {item.tip && <span style={{ fontSize: 10, color: "#334155" }}>ⓘ</span>}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: item.color, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.value}</div>
              <div style={{ fontSize: 11, color: "#475569" }}>{item.sub}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...cardBase, padding: "28px", textAlign: "center", color: "#64748b", fontSize: 14 }}>
          No trades match the current filters.{" "}
          <button type="button" onClick={clearFilters}
            style={{ background: "transparent", border: "none", color: "#7CC4FF", fontSize: 14, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
            Clear filters
          </button>
        </div>
      )}

      {/* Tooltip modal */}
      {tooltip && TOOLTIP_CONTENT[tooltip] && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
          onClick={() => setTooltip(null)}>
          <div className="card" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="cardHeader"><h2>{TOOLTIP_CONTENT[tooltip].title}</h2></div>
            <div className="cardBody" style={{ lineHeight: 1.7 }}>{TOOLTIP_CONTENT[tooltip].body}</div>
            <button className="ghostButton" onClick={() => setTooltip(null)} style={{ marginTop: 10 }}>Got it</button>
          </div>
        </div>
      )}

      {/* Equity curve */}
      <EquityCurveCard
        equityPoints={equityPoints}
        sourceLabel={sourceLabel}
        chartRange={chartRange}
        setChartRange={setChartRange}
        benchmarkSymbol={benchmarkSymbol}
        benchmarkLabel={benchmarkLabel}
        onSelectBenchmark={onSelectBenchmark}
        benchmarkOptions={benchmarkOptions}
        benchmarkPoints={benchmarkPoints}
        benchmarkLoading={benchmarkLoading}
        alpacaConnected={alpacaConnected}
      />

      {trades.length > 0 ? (
        <PerformanceLiveChartCard
          alpacaPositions={alpacaPositions}
          performanceLiveAppliedSelection={performanceLiveAppliedSelection}
          setPerformanceLiveAppliedSelection={setPerformanceLiveAppliedSelection}
          tradePortfolioAllSymbols={tradePortfolioAllSymbols}
          tradeChartSymbol={tradeChartSymbol}
          tradeChartCurrentPrice={tradeChartCurrentPrice}
          tradeChartQuote={tradeChartQuote}
          tradeChartMatchingPosition={tradeChartMatchingPosition}
          tradeChartAsset={tradeChartAsset}
          tradeChartAssetType={tradeChartAssetType}
          tradeChartRange={tradeChartRange}
          setTradeChartRange={setTradeChartRange}
          tradeChartMode={tradeChartMode}
          setTradeChartMode={setTradeChartMode}
          tradeChartLastUpdated={tradeChartLastUpdated}
          tradeIsComparisonMode={tradeIsComparisonMode}
          tradeIsPortfolioTotalMode={tradeIsPortfolioTotalMode}
          tradePortfolioCombinedUnrealizedPl={tradePortfolioCombinedUnrealizedPl}
          tradePortfolioCombinedMarketValue={tradePortfolioCombinedMarketValue}
          tradePortfolioDisplayedPositions={tradePortfolioDisplayedPositions}
          tradePortfolioChartsLoading={tradePortfolioChartsLoading}
          tradePortfolioCharts={tradePortfolioCharts}
          brokerTradeLog={brokerTradeLog}
          trades={trades}
          tradePortfolioRequestedStartMs={tradePortfolioRequestedStartMs}
          tradePortfolioNowMs={tradePortfolioNowMs}
          tradeMarketChartLoading={tradeMarketChartLoading}
          tradeMarketChart={tradeMarketChart}
        />
      ) : null}

      {/* Trade outcome overview */}
      {report && totalCount > 0 && (
        <div style={{ ...cardBase, padding: "16px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#7f8ea3", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 14 }}>Trade Outcomes</div>
          <div style={{ display: "flex", height: 7, borderRadius: 4, overflow: "hidden", marginBottom: 14, gap: 2 }}>
            {winCount > 0 && <div style={{ flex: winCount, background: "#4ade80", borderRadius: 2 }} />}
            {lossCount > 0 && <div style={{ flex: lossCount, background: "#f87171", borderRadius: 2 }} />}
            {beCount > 0 && <div style={{ flex: beCount, background: "#64748b", borderRadius: 2 }} />}
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {[
              { label: "Winners", count: winCount, color: "#4ade80", detail: report.avgWin > 0 ? `+${report.avgWin.toFixed(2)} avg` : "" },
              { label: "Losers", count: lossCount, color: "#f87171", detail: report.avgLoss > 0 ? `-${report.avgLoss.toFixed(2)} avg` : "" },
              ...(beCount > 0 ? [{ label: "Breakeven", count: beCount, color: "#64748b", detail: "" }] : []),
            ].map(item => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: item.color }}>{item.count}</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>{item.label} · {totalCount ? (item.count / totalCount * 100).toFixed(0) : 0}%</span>
                {item.detail && <span style={{ fontSize: 12, color: "#475569" }}>· {item.detail}</span>}
              </div>
            ))}
          </div>
          {recent5.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.4px" }}>Recent form</span>
              <div style={{ display: "flex", gap: 5 }}>
                {recent5.map((t, i) => {
                  const r = getTradeOutcomeValue(t);
                  return (
                    <div key={i}
                      title={`${(t.asset || "").toUpperCase()} · ${r >= 0 ? "+" : ""}${r.toFixed(2)}`}
                      style={{ width: 11, height: 11, borderRadius: "50%", background: r > 0 ? "#4ade80" : r < 0 ? "#f87171" : "#64748b" }} />
                  );
                })}
              </div>
              {lossStreak >= 3 && (
                <span style={{ fontSize: 11, color: "#fbbf24", background: "rgba(251,191,36,0.09)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 6, padding: "1px 8px" }}>
                  {lossStreak} consecutive losses
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Breakdown tables: Setup | Asset | Session */}
      {report && (report.setupStats.length > 0 || report.assetStats.length > 0 || sessionStats.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          <PerfBreakdownTable
            title="By Setup"
            rows={report.setupStats.map(s => ({ name: s.setup, trades: s.trades, winRate: s.winRate, avgR: s.avgR, totalR: s.totalR }))}
            nameColor="#7CC4FF"
          />
          <PerfBreakdownTable
            title="By Asset"
            rows={report.assetStats.map(a => ({ name: a.asset, trades: a.trades, winRate: a.winRate, avgR: a.avgR, totalR: a.totalR }))}
            nameColor="#e2e8f0"
          />
          {sessionStats.length > 0 && (
            <PerfBreakdownTable
              title="By Session"
              rows={sessionStats.map(s => ({ name: s.session, trades: s.trades, winRate: s.winRate, avgR: s.avgR, totalR: s.totalR }))}
              nameColor="#94a3b8"
            />
          )}
        </div>
      )}

      {/* Strongest patterns (Asset + Setup combos) */}
      {report && report.comboStats.length > 0 && (
        <div style={cardBase}>
          <div style={{ padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 11, fontWeight: 600, color: "#7f8ea3", textTransform: "uppercase", letterSpacing: "0.6px" }}>
            Strongest Patterns — Asset + Setup
          </div>
          <div style={{ padding: "4px 0" }}>
            {report.comboStats.slice(0, 5).map((c, i) => (
              <div key={i} style={{ padding: "10px 16px", borderBottom: i < Math.min(report.comboStats.length, 5) - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 160px" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#f3f7fc" }}>{c.asset}</span>
                  <span style={{ fontSize: 12, color: "#475569" }}> · </span>
                  <span style={{ fontSize: 12, color: "#7CC4FF" }}>{c.setup}</span>
                </div>
                <span style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>{c.trades} trades · {c.winRate.toFixed(0)}% win</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: c.avgR >= 0 ? "#4ade80" : "#f87171", whiteSpace: "nowrap" }}>{c.avgR >= 0 ? "+" : ""}{c.avgR.toFixed(2)} avg</span>
                <span style={{ fontSize: 12, color: c.totalR >= 0 ? "#4ade80" : "#f87171", whiteSpace: "nowrap" }}>{c.totalR >= 0 ? "+" : ""}{c.totalR.toFixed(2)} total</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rayla Diagnosis */}
      {report && (
        <div style={cardBase}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#7CC4FF" }}>Rayla's Diagnosis</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {showNoNewTrades && <span style={{ fontSize: 11, color: "#334155" }}>No new trades since last run</span>}
              <button type="button" onClick={onRunAnalysis}
                style={{ background: "rgba(124,196,255,0.1)", border: "1px solid rgba(124,196,255,0.25)", borderRadius: 8, padding: "6px 14px", color: "#7CC4FF", fontSize: 12, cursor: "pointer" }}>
                Run AI Analysis
              </button>
            </div>
          </div>
          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            {ft.length < 20 && (
              <div style={{ padding: "11px 14px", borderRadius: 10, background: "rgba(124,196,255,0.06)", border: "1px solid rgba(124,196,255,0.15)", fontSize: 13, color: "#7CC4FF", lineHeight: 1.6 }}>
                {ft.length < 5
                  ? `Only ${ft.length} trade${ft.length === 1 ? "" : "s"} logged — keep logging every trade to unlock meaningful patterns.`
                  : `${ft.length} trades logged — patterns are forming. Aim for 30+ trades before drawing firm conclusions from setup stats.`}
              </div>
            )}
            {diagnosisStrongestEdge && (
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.15)" }}>
                <div style={{ fontSize: 11, color: "#4ade80", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5, fontWeight: 600 }}>Strongest Edge</div>
                <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.6 }}>
                  {diagnosisStrongestEdge}
                </div>
              </div>
            )}
            {diagnosisConsistencyNote && (
              <div style={{ padding: "11px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", fontSize: 13, color: "#e2e8f0", lineHeight: 1.6 }}>
                <span style={{ color: "#7f8ea3", fontWeight: 600 }}>Consistency · </span>
                {diagnosisConsistencyNote}
              </div>
            )}
            {diagnosisWarning && (
              <div style={{ padding: "11px 14px", borderRadius: 10, background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.18)", fontSize: 13, color: "#fbbf24", lineHeight: 1.6 }}>
                ⚠ {diagnosisWarning}
              </div>
            )}
            {diagnosisNextAction && (
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(124,196,255,0.06)", border: "1px solid rgba(124,196,255,0.15)" }}>
                <div style={{ fontSize: 11, color: "#7CC4FF", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, fontWeight: 600 }}>Next Action</div>
                <div style={{ display: "flex", gap: 8, fontSize: 13, color: "#e2e8f0", lineHeight: 1.5 }}>
                  <span style={{ color: "#7CC4FF", fontWeight: 700, flexShrink: 0 }}>1.</span>
                  <span>{diagnosisNextAction}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

function AICoachTab({ trades, onRunAnalysis, showNoNewTrades, coachSummary, hideOverall = false }) {
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
            {`Win Rate: ${report.winRate.toFixed(1)}% · Avg Result: ${report.avgR >= 0 ? "+" : ""}${report.avgR.toFixed(2)} · Trades: ${report.trades}`}
          </div>
          {report.bestCombo && (
            <div style={{ marginTop: 10, fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
              {`Your strongest edge is ${report.bestCombo.setup} on ${report.bestCombo.asset} — ${report.bestCombo.avgR.toFixed(2)} avg · ${report.bestCombo.winRate.toFixed(0)}% win rate across ${report.bestCombo.trades} trades.${report.bestCombo.trades < 3 ? " (early edge forming — low sample size)" : ""}`}
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

      {!hideOverall && (
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
      )}

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

function formatCompactCurrencyAxis(value, span = 0) {
  if (!Number.isFinite(Number(value))) return "--";
  const numericValue = Number(value);
  const absolute = Math.abs(numericValue);
  if (span <= 25) return formatCurrency(numericValue);
  if (span <= 250) return `${numericValue < 0 ? "-" : ""}$${Math.round(absolute).toLocaleString()}`;
  if (absolute >= 1_000_000) return `${numericValue < 0 ? "-" : ""}$${(absolute / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${numericValue < 0 ? "-" : ""}$${(absolute / 1_000).toFixed(1)}k`;
  return `${numericValue < 0 ? "-" : ""}$${Math.round(absolute).toLocaleString()}`;
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

function buildSvgStepLinePoints(
  data,
  zoomLevel = "normal",
  slotCount = data.length,
  xStart = 14,
  xEnd = 100,
  xRatios = null
) {
  if (!Array.isArray(data) || data.length === 0) return "";
  if (data.length === 1) {
    const point = buildSvgPointCoords(data, 0, zoomLevel, slotCount, xStart, xEnd, xRatios);
    return `${point.x},${point.y}`;
  }

  const points = [];
  for (let index = 0; index < data.length; index += 1) {
    const current = buildSvgPointCoords(data, index, zoomLevel, slotCount, xStart, xEnd, xRatios);
    if (index === 0) {
      points.push(`${current.x},${current.y}`);
      continue;
    }
    const previous = buildSvgPointCoords(data, index - 1, zoomLevel, slotCount, xStart, xEnd, xRatios);
    points.push(`${current.x},${previous.y}`);
    points.push(`${current.x},${current.y}`);
  }

  return points.join(" ");
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
    return { y, label: formatCompactCurrencyAxis(value, range) };
  });
}

function parseTradeTimeMs(trade) {
  const candidates = [
    trade?.exit_time,
    trade?.closed_at,
    trade?.filled_at,
    trade?.entry_time,
  ];
  for (const candidate of candidates) {
    const value = Date.parse(String(candidate || ""));
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function resolveEquityTradeTimestamp(trade) {
  const candidates = [
    ["exit_time", trade?.exit_time],
    ["closed_at", trade?.closed_at],
    ["filled_at", trade?.filled_at],
    ["entry_time", trade?.entry_time],
  ];

  for (const [field, candidate] of candidates) {
    const value = Date.parse(String(candidate || ""));
    if (Number.isFinite(value)) {
      return { timeMs: value, field };
    }
  }

  return { timeMs: null, field: null };
}

function parseTradeEntryTimeMs(trade) {
  const candidates = [
    trade?.entry_time,
    trade?.created_at,
    trade?.updated_at,
  ];
  for (const candidate of candidates) {
    const value = Date.parse(String(candidate || ""));
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function calculateTradeDollarPnl(trade) {
  const explicitPnl = Number(trade?.pnl_value);
  if (Number.isFinite(explicitPnl)) return explicitPnl;

  const entryPrice = Number(trade?.entry_price);
  const exitPrice = Number(trade?.exit_price);
  const entrySize = Number(trade?.entry_size);
  const direction = String(trade?.direction || "long").trim().toLowerCase();

  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return null;
  if (!Number.isFinite(exitPrice) || exitPrice <= 0) return null;
  if (!Number.isFinite(entrySize) || entrySize <= 0) return null;

  const pctMove = direction === "short"
    ? (entryPrice - exitPrice) / entryPrice
    : (exitPrice - entryPrice) / entryPrice;

  if (!Number.isFinite(pctMove)) return null;
  return entrySize * pctMove;
}

function buildUsableClosedTradesForEquity(trades) {
  return [...(Array.isArray(trades) ? trades : [])]
    .map((trade, originalIndex) => {
      const timestamp = resolveEquityTradeTimestamp(trade);
      const entryTimeMs = parseTradeEntryTimeMs(trade);
      const pnl = calculateTradeDollarPnl(trade);
      if (!Number.isFinite(timestamp.timeMs) || !Number.isFinite(pnl)) return null;
      return {
        trade,
        timeMs: timestamp.timeMs,
        timestampField: timestamp.field,
        entryTimeMs,
        pnl,
        originalIndex,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
      const safeEntryA = Number.isFinite(a.entryTimeMs) ? a.entryTimeMs : a.timeMs;
      const safeEntryB = Number.isFinite(b.entryTimeMs) ? b.entryTimeMs : b.timeMs;
      if (safeEntryA !== safeEntryB) return safeEntryA - safeEntryB;
      return a.originalIndex - b.originalIndex;
    });
}

function buildLoggedEquityCurvePoints(trades, startingEquity = 10000) {
  const sortedTrades = buildUsableClosedTradesForEquity(trades);

  if (!sortedTrades.length) return [];

  let equity = Number(startingEquity);
  const groupedTrades = [];
  sortedTrades.forEach((item) => {
    const currentGroup = groupedTrades[groupedTrades.length - 1];
    if (currentGroup && currentGroup.timeMs === item.timeMs) {
      currentGroup.pnl += item.pnl;
      currentGroup.trades.push(item);
      return;
    }
    groupedTrades.push({
      timeMs: item.timeMs,
      timestampField: item.timestampField,
      pnl: item.pnl,
      trades: [item],
    });
  });

  return groupedTrades.map((group) => {
    equity += group.pnl;
    const sources = [...new Set(group.trades.map((item) => item.trade?.source || (item.trade?.isBrokerTrade ? "broker" : "manual")))];
    return {
      time: new Date(group.timeMs).toISOString(),
      timeMs: group.timeMs,
      value: equity,
      equity,
      changeFromStart: equity - Number(startingEquity),
      tradeId: group.trades[0]?.trade?.id || null,
      tradeIds: group.trades.map((item) => item.trade?.id).filter(Boolean),
      source: sources.length === 1 ? sources[0] : "mixed",
      pnl: group.pnl,
      timestampField: group.timestampField,
      tradeCount: group.trades.length,
      trade: group.trades[group.trades.length - 1]?.trade || null,
    };
  });
}

function inferBenchmarkRangeFromEquityPoints(points) {
  if (!Array.isArray(points) || points.length < 2) return "1M";
  const first = points[0]?.timeMs || 0;
  const last = points[points.length - 1]?.timeMs || first;
  const spanMs = Math.max(0, last - first);
  const dayMs = 24 * 60 * 60 * 1000;
  if (spanMs <= dayMs) return "1D";
  if (spanMs <= 7 * dayMs) return "1W";
  if (spanMs <= 30 * dayMs) return "1M";
  if (spanMs <= 90 * dayMs) return "3M";
  if (spanMs <= 365 * dayMs) return "1Y";
  if (spanMs <= 5 * 365 * dayMs) return "5Y";
  return "MAX";
}

function normalizeBenchmarkSeries(chart, startingEquity = 10000) {
  const bars = extractChartBars(chart);
  if (bars.length < 2) return [];

  const normalizedPoints = bars.map((bar, index) => {
    const close = Number(bar?.close);
    const timeMs = Date.parse(String(bar?.time || ""));
    if (!Number.isFinite(close) || close <= 0 || !Number.isFinite(timeMs)) return null;
    return {
      id: `benchmark-${index}`,
      time: new Date(timeMs).toISOString(),
      timeMs,
      close,
    };
  }).filter(Boolean);

  if (normalizedPoints.length < 2) return [];

  const firstClose = Number(normalizedPoints[0]?.close);
  if (!Number.isFinite(firstClose) || firstClose <= 0) return [];

  const valuePoints = normalizedPoints.map((point) => {
    const value = Number(startingEquity) * (point.close / firstClose);
    return {
      ...point,
      value,
      equity: value,
    };
  });

  const firstValue = Number(valuePoints[0]?.value);
  if (!Number.isFinite(firstValue) || firstValue <= 0) return [];

  return valuePoints.map((point) => {
    const pctChange = ((point.value - firstValue) / firstValue) * 100;
    return {
      ...point,
      time: point.time,
      value: point.value,
      pctChange,
      changeFromStart: point.value - firstValue,
      pnl: point.value - firstValue,
    };
  });
}

function readBenchmarkPointValue(point) {
  const value = Number(point?.equity ?? point?.value);
  return Number.isFinite(value) ? value : null;
}

function readBenchmarkPointPctChange(point, baselineValue = null) {
  const pctChange = Number(point?.pctChange);
  if (Number.isFinite(pctChange)) return pctChange;

  const value = readBenchmarkPointValue(point);
  if (!Number.isFinite(value) || !Number.isFinite(baselineValue) || baselineValue <= 0) {
    return null;
  }

  return ((value / baselineValue) - 1) * 100;
}

function sliceBenchmarkBarsToVisibleWindow(chart, visibleStart, visibleEnd) {
  const bars = extractChartBars(chart);
  if (!bars.length) return [];

  const normalizedBars = bars
    .map((bar) => {
      const timeMs = Date.parse(String(bar?.time || ""));
      return Number.isFinite(timeMs) ? { ...bar, timeMs } : null;
    })
    .filter(Boolean);

  const withinWindow = normalizedBars.filter((bar) => bar.timeMs >= visibleStart && bar.timeMs <= visibleEnd);
  const priorBar = [...normalizedBars].reverse().find((bar) => bar.timeMs <= visibleStart) || null;

  const result = [];
  if (priorBar) result.push(priorBar);
  withinWindow.forEach((bar) => {
    if (!result.some((existing) => existing.timeMs === bar.timeMs)) {
      result.push(bar);
    }
  });

  if (result.length >= 2) return result.map(({ timeMs, ...bar }) => bar);

  const nearestBars = normalizedBars
    .map((bar) => ({
      ...bar,
      distance: Math.min(Math.abs(bar.timeMs - visibleStart), Math.abs(bar.timeMs - visibleEnd)),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 12)
    .sort((a, b) => a.timeMs - b.timeMs);

  return nearestBars.map(({ timeMs, distance, ...bar }) => bar);
}

function buildPortfolioBenchmarkChart(positionCharts, positions, visibleStart, visibleEnd) {
  const normalizedPositions = Array.isArray(positions) ? positions : [];
  const chartEntries = normalizedPositions.map((position) => {
    const symbol = String(position?.symbol || "").trim().toUpperCase();
    const chart = positionCharts?.[symbol] || null;
    const bars = Array.isArray(chart?.bars) ? chart.bars : [];
    const qty = Math.abs(Number(position?.qty) || 0);
    const entryTimeMs = Number(chart?.entryTimeMs);
    const clippedStartMs = Math.max(
      Number.isFinite(visibleStart) ? visibleStart : 0,
      Number.isFinite(entryTimeMs) ? entryTimeMs : Number.isFinite(visibleStart) ? visibleStart : 0
    );
    const filteredBars = bars
      .map((bar) => {
        const timeMs = Date.parse(String(bar?.time || bar?.t || ""));
        const close = Number(bar?.close);
        return Number.isFinite(timeMs) && Number.isFinite(close) && close > 0
          ? { timeMs, close }
          : null;
      })
      .filter(Boolean)
      .filter((bar) => bar.timeMs >= clippedStartMs);
    return {
      symbol,
      qty,
      bars: filteredBars,
    };
  }).filter((entry) => entry.qty > 0 && entry.bars.length);

  if (!chartEntries.length) return null;

  const timeMap = new Map();
  chartEntries.forEach((entry) => {
    entry.bars.forEach((bar) => {
      const existing = timeMap.get(bar.timeMs) || {};
      existing[entry.symbol] = bar.close;
      timeMap.set(bar.timeMs, existing);
    });
  });

  const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);
  if (sortedTimes.length < 2) return null;

  const latestCloseBySymbol = {};
  const bars = [];
  sortedTimes.forEach((timeMs) => {
    const updates = timeMap.get(timeMs) || {};
    Object.entries(updates).forEach(([symbol, close]) => {
      latestCloseBySymbol[symbol] = close;
    });
    let totalCloseValue = 0;
    let contributing = 0;
    chartEntries.forEach((entry) => {
      const close = latestCloseBySymbol[entry.symbol];
      if (!Number.isFinite(close)) return;
      totalCloseValue += close * entry.qty;
      contributing += 1;
    });
    if (contributing > 0 && Number.isFinite(totalCloseValue) && totalCloseValue > 0) {
      bars.push({
        time: new Date(timeMs).toISOString(),
        close: totalCloseValue,
      });
    }
  });

  if (bars.length < 2) return null;

  return {
    symbol: "Portfolio",
    rangeMode: "portfolio_benchmark",
    bars,
  };
}

function calculateSeriesDrawdown(points) {
  let peak = null;
  let maxDrawdown = 0;
  (Array.isArray(points) ? points : []).forEach((point) => {
    const value = Number(point?.equity ?? point?.value);
    if (!Number.isFinite(value)) return;
    if (peak == null || value > peak) peak = value;
    if (peak > 0) {
      const drawdown = ((value - peak) / peak) * 100;
      if (drawdown < maxDrawdown) maxDrawdown = drawdown;
    }
  });
  return maxDrawdown;
}

const EQUITY_BENCHMARKS = {
  SPY: { symbol: "SPY", type: "stock" },
  QQQ: { symbol: "QQQ", type: "stock" },
  BTC: { symbol: "BTC", type: "crypto" },
  ETH: { symbol: "ETH", type: "crypto" },
};

function buildPercentScale(values, steps = 4) {
  if (!Array.isArray(values) || values.length < 2) return [];
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const paddedMax = max + range * 0.18;
  const paddedMin = min - range * 0.18;

  return Array.from({ length: steps }, (_, index) => {
    const ratio = index / (steps - 1 || 1);
    const y = 14 + (72 * ratio);
    const value = paddedMax - ((paddedMax - paddedMin) * ratio);
    return {
      y,
      label: `${value >= 0 ? "+" : ""}${value.toFixed(0)}%`,
    };
  });
}

function findNearestPointByTime(points, targetTimeMs) {
  if (!Array.isArray(points) || !points.length || !Number.isFinite(targetTimeMs)) return null;
  let nearest = points[0];
  let nearestDistance = Math.abs((nearest?.timeMs || 0) - targetTimeMs);
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    const distance = Math.abs((point?.timeMs || 0) - targetTimeMs);
    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function filterEquityCurvePointsByRange(points, range) {
  if (!Array.isArray(points) || !points.length || range === "ALL") return points;
  const endMs = points[points.length - 1]?.timeMs || Date.now();
  const windowMs = (
    range === "1D" ? 24 * 60 * 60 * 1000
    : range === "1W" ? 7 * 24 * 60 * 60 * 1000
    : range === "1M" ? 30 * 24 * 60 * 60 * 1000
    : 90 * 24 * 60 * 60 * 1000
  );
  const startMs = endMs - windowMs;
  const filtered = points.filter((point) => point.timeMs >= startMs);
  return filtered.length ? filtered : points.slice(-1);
}

function buildEquityTimeScale(points, range) {
  if (!Array.isArray(points) || !points.length) return [];
  const firstTime = points[0]?.timeMs || 0;
  const lastTime = points[points.length - 1]?.timeMs || firstTime;
  const spanMs = Math.max(0, lastTime - firstTime);
  const count = Math.min(points.length, range === "1D" ? 4 : range === "1W" ? 5 : 6);
  const lastIndex = points.length - 1;
  const labels = [];
  const seen = new Set();

  for (let i = 0; i < count; i += 1) {
    const index = Math.round((lastIndex * i) / Math.max(1, count - 1));
    const point = points[index];
    if (!point) continue;
    const label = new Date(point.timeMs).toLocaleDateString([], (
      spanMs <= 24 * 60 * 60 * 1000
        ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
        : spanMs <= 7 * 24 * 60 * 60 * 1000
          ? { month: "short", day: "numeric", hour: "numeric" }
          : spanMs <= 120 * 24 * 60 * 60 * 1000
            ? { month: "short", day: "numeric" }
            : { month: "short", year: "numeric" }
    ));
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push({
      label,
      ratio: lastIndex === 0 ? 0 : index / lastIndex,
    });
  }

  return labels;
}

function hashScenarioSeed(symbol) {
  return String(symbol || "").split("").reduce((total, char) => total + char.charCodeAt(0), 0);
}

function buildNextScenarioPrice({ assetId, currentPrice, anchorPrice, tick, scenarioType }) {
  const seed = hashScenarioSeed(assetId);
  const safeAnchor = Number.isFinite(anchorPrice) && anchorPrice > 0 ? anchorPrice : currentPrice;
  const safePrice = Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : safeAnchor;
  const phaseLength = 5 + (seed % 8);
  const phaseIndex = Math.floor((tick + seed) / phaseLength) % 4;
  const phaseStep = (tick + seed) % phaseLength;
  const phaseProgress = phaseStep / (phaseLength - 1 || 1);
  const directionalNudge = (phaseProgress - 0.5) * 0.0009;
  const phaseName = phaseIndex === 0 ? "push" : phaseIndex === 1 ? "pause" : phaseIndex === 2 ? "pullback" : "consolidation";
  const driftProfile = getScenarioDriftProfile(assetId, tick, scenarioType);
  const distanceFromAnchor = (safeAnchor - safePrice) / safeAnchor;
  const microJitter = getScenarioSignedRandom((seed * 17) + tick) * 0.00042;
  const secondaryJitter = getScenarioSignedRandom((seed * 29) + (tick * 5)) * 0.00031;
  let movePct = microJitter + secondaryJitter;

  if (scenarioType === "uptrend") {
    if (phaseName === "push") movePct += 0.0027 + (driftProfile.impulse * 0.4) + directionalNudge;
    else if (phaseName === "pullback") movePct += -0.00115 + (driftProfile.pullback * 0.45);
    else if (phaseName === "pause") movePct += 0.00012 + (driftProfile.chop * 0.3);
    else movePct += 0.00032 + (driftProfile.chop * 0.38);
  } else if (scenarioType === "downtrend") {
    if (phaseName === "push") movePct += -0.0027 - (driftProfile.impulse * 0.4) - directionalNudge;
    else if (phaseName === "pullback") movePct += 0.00115 - (driftProfile.pullback * 0.45);
    else if (phaseName === "pause") movePct += -0.00012 - (driftProfile.chop * 0.3);
    else movePct += -0.00032 - (driftProfile.chop * 0.38);
  } else if (scenarioType === "realistic") {
    const recoveryBias = distanceFromAnchor * 0.12;
    if (phaseName === "push") {
      movePct += driftProfile.impulse + recoveryBias;
    } else if (phaseName === "pullback") {
      movePct += (driftProfile.pullback * 0.95) - (recoveryBias * 0.3);
    } else if (phaseName === "pause") {
      movePct += (driftProfile.chop * 0.72) + (recoveryBias * 0.18);
    } else {
      movePct += (distanceFromAnchor * 0.18) + (driftProfile.chop * 0.94);
    }
    if (driftProfile.indecisionChance) {
      movePct *= 0.42;
    }
    if (driftProfile.spikeChance !== 0) {
      movePct += driftProfile.spikeChance * driftProfile.spikeStrength;
    }
  } else {
    const meanReversionBias = distanceFromAnchor * 0.34;
    if (phaseName === "push") movePct += driftProfile.impulse + (driftProfile.chop * 0.4);
    else if (phaseName === "pullback") movePct += meanReversionBias + (driftProfile.pullback * 0.72);
    else if (phaseName === "pause") movePct += (driftProfile.chop * 0.55) + (meanReversionBias * 0.22);
    else movePct += meanReversionBias + (driftProfile.chop * 0.92);
    if (driftProfile.indecisionChance) {
      movePct *= 0.35;
    }
    if (driftProfile.spikeChance !== 0) {
      movePct += driftProfile.spikeChance * driftProfile.spikeStrength;
    }
  }
  const boundedMovePct = Math.max(-0.014, Math.min(0.014, movePct));
  const nextPrice = Math.max(0.01, safePrice * (1 + boundedMovePct));
  const maxDriftPct = scenarioType === "range" ? 0.06 : scenarioType === "realistic" ? 0.14 : 0.18;
  const minPrice = safeAnchor * (1 - maxDriftPct);
  const maxPrice = safeAnchor * (1 + maxDriftPct);
  return Math.max(0.01, Math.min(maxPrice, Math.max(minPrice, nextPrice)));
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

function formatScenarioElapsedLabel(ms, totalMs) {
  if (!Number.isFinite(ms) || ms <= 0) return "Now";
  return `+${formatScenarioAxisLabel(ms, totalMs)}`;
}

function chartTimeToMs(time) {
  if (typeof time === "number") return time * 1000;
  if (typeof time === "string") return new Date(time).getTime();
  if (time && typeof time === "object" && "year" in time) {
    return Date.UTC(time.year, time.month - 1, time.day);
  }
  return NaN;
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

function EquityCurveCard({
  equityPoints,
  sourceLabel,
  chartRange,
  setChartRange,
  benchmarkSymbol,
  benchmarkLabel,
  onSelectBenchmark,
  benchmarkOptions,
  benchmarkPoints,
  benchmarkLoading,
  alpacaConnected,
}) {
  const [benchmarkSelectorOpen, setBenchmarkSelectorOpen] = useState(false);
  const [benchmarkQuery, setBenchmarkQuery] = useState("");
  const [benchmarkSearchResults, setBenchmarkSearchResults] = useState([]);
  const values = equityPoints.map((point) => point.equity);
  const startValue = values[0];
  const currentValue = values[values.length - 1];
  const netValue = currentValue - startValue;
  const yourReturnPct = startValue > 0 ? ((netValue / startValue) * 100) : 0;
  const lastBenchmarkPoint = benchmarkPoints[benchmarkPoints.length - 1];
  const rawBenchmarkReturnPct = benchmarkPoints.length > 1
    ? Number(lastBenchmarkPoint?.pctChange)
    : null;
  const benchmarkReturnPct = Number.isFinite(rawBenchmarkReturnPct) ? rawBenchmarkReturnPct : null;
  const benchmarkDifference = benchmarkReturnPct != null ? yourReturnPct - benchmarkReturnPct : null;
  const maxDrawdown = calculateSeriesDrawdown(equityPoints);
  const resolvedBenchmarkLabel = benchmarkLabel || benchmarkSymbol;

  useEffect(() => {
    if (!import.meta.env.DEV || benchmarkSymbol !== "Portfolio") return;
    console.log("FINAL BENCHMARK (CARD):", benchmarkPoints?.slice(-1)[0]);
  }, [benchmarkPoints, benchmarkSymbol]);

  const filteredBenchmarkOptions = useMemo(() => {
    const query = benchmarkQuery.trim().toLowerCase();
    const localOptions = benchmarkOptions.filter((option) => (
      !query
      || option.symbol.toLowerCase().includes(query)
      || option.label.toLowerCase().includes(query)
      || option.group.toLowerCase().includes(query)
    ));
    const seen = new Set(localOptions.map((option) => option.symbol));
    const remoteOptions = benchmarkSearchResults.filter((option) => !seen.has(option.symbol));
    return [...localOptions, ...remoteOptions];
  }, [benchmarkOptions, benchmarkQuery, benchmarkSearchResults]);

  useEffect(() => {
    if (!benchmarkSelectorOpen) {
      setBenchmarkSearchResults([]);
      return;
    }

    const query = benchmarkQuery.trim();
    if (!query) {
      setBenchmarkSearchResults([]);
      return;
    }

    let isCancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const results = await searchRaylaSupportedAssets(query, alpacaConnected);
        if (isCancelled) return;
        setBenchmarkSearchResults(
          results.slice(0, 8).map((item) => ({
            symbol: item.symbol,
            type: item.type || "stock",
            label: item.description || item.name || "Search result",
            group: "Search results",
          }))
        );
      } catch {
        if (!isCancelled) setBenchmarkSearchResults([]);
      }
    }, 160);

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [benchmarkSelectorOpen, benchmarkQuery, alpacaConnected]);

  useEffect(() => {
    if (!benchmarkSelectorOpen) return;
    function handleClickOutside(event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("[data-benchmark-selector='true']")) return;
      setBenchmarkSelectorOpen(false);
    }

    window.addEventListener("pointerdown", handleClickOutside);
    return () => window.removeEventListener("pointerdown", handleClickOutside);
  }, [benchmarkSelectorOpen]);
  const statCardStyle = {
    background: "rgba(18,26,38,0.86)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12,
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  };

  const controlRow = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
      <div className="chartTabs" style={{ marginBottom: 0 }}>
        {["1D","1W","1M","3M","ALL"].map((range) => (
          <button key={range} className={`chartTab ${chartRange === range ? "active" : ""}`} onClick={() => setChartRange(range)} type="button">{range}</button>
        ))}
      </div>
      <div style={{ position: "relative", minWidth: 220 }} data-benchmark-selector="true">
        <button
          type="button"
          onClick={() => setBenchmarkSelectorOpen((value) => !value)}
          style={{
            width: "100%",
            background: "rgba(18,26,38,0.9)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            padding: "8px 12px",
            color: "#e2e8f0",
            fontSize: 13,
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>{`Benchmark: ${resolvedBenchmarkLabel}`}</span>
          <span style={{ color: "#7f8ea3", fontSize: 11 }}>{benchmarkSelectorOpen ? "▲" : "▼"}</span>
        </button>
        {benchmarkSelectorOpen ? (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              width: "min(320px, 86vw)",
              background: "rgba(12,18,28,0.98)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              padding: 12,
              boxShadow: "0 18px 36px rgba(2,6,23,0.36)",
              zIndex: 6,
            }}
          >
            <input
              type="text"
              value={benchmarkQuery}
              onChange={(event) => setBenchmarkQuery(event.target.value)}
              placeholder="Search benchmark symbol"
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                padding: "9px 11px",
                color: "#e2e8f0",
                fontSize: 13,
                outline: "none",
                marginBottom: 10,
              }}
            />
            <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {filteredBenchmarkOptions.map((option) => (
                <button
                  key={`${option.symbol}-${option.group}`}
                  type="button"
                  onClick={() => {
                    onSelectBenchmark(option);
                    setBenchmarkSelectorOpen(false);
                    setBenchmarkQuery("");
                  }}
                  style={{
                    background: option.symbol === benchmarkSymbol ? "rgba(124,196,255,0.12)" : "transparent",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 10,
                    padding: "9px 10px",
                    color: "#e2e8f0",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{option.symbol}</span>
                    <span style={{ fontSize: 11, color: "#7f8ea3" }}>{option.group}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{option.label}</span>
                </button>
              ))}
              {!filteredBenchmarkOptions.length ? (
                <div style={{ padding: "10px 4px", fontSize: 12, color: "#7f8ea3" }}>
                  No benchmark matches your search yet.
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (equityPoints.length < 2) {
    return (
      <Card title="Equity Curve" className="equityCard">
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
          Your account value over time based on logged trades
        </div>
        {controlRow}
        <div style={{ minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
          Log trades to build your equity curve.
        </div>
        <div className="equityFooter"><div className="equityFooterLabel">{sourceLabel}</div></div>
      </Card>
    );
  }

  return (
    <Card title="Equity Curve" className="equityCard">
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
        Your account value over time based on logged trades
      </div>
      {controlRow}
      <div className="equityMeta">
        <div><span>Start</span><strong>{formatCurrency(startValue)}</strong></div>
        <div><span>Current</span><strong>{formatCurrency(currentValue)}</strong></div>
        <div><span>Net</span><strong>{`${netValue >= 0 ? "+" : ""}${formatCurrency(netValue)}`}</strong></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
        <div style={statCardStyle}>
          <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Your Return %</span>
          <strong style={{ fontSize: 16, color: yourReturnPct >= 0 ? "#4ade80" : "#f87171" }}>{`${yourReturnPct >= 0 ? "+" : ""}${yourReturnPct.toFixed(2)}%`}</strong>
        </div>
        <div style={statCardStyle}>
          <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>{`${resolvedBenchmarkLabel} Return %`}</span>
          <strong style={{ fontSize: 16, color: benchmarkReturnPct != null && benchmarkReturnPct >= 0 ? "#4ade80" : "#f87171" }}>
            {benchmarkReturnPct == null ? "—" : `${benchmarkReturnPct >= 0 ? "+" : ""}${benchmarkReturnPct.toFixed(2)}%`}
          </strong>
        </div>
        <div style={statCardStyle}>
          <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Difference</span>
          <strong style={{ fontSize: 16, color: benchmarkDifference != null && benchmarkDifference >= 0 ? "#4ade80" : "#f87171" }}>
            {benchmarkDifference == null ? "—" : `${benchmarkDifference >= 0 ? "+" : ""}${benchmarkDifference.toFixed(2)}%`}
          </strong>
        </div>
        <div style={statCardStyle}>
          <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Max Drawdown</span>
          <strong style={{ fontSize: 16, color: maxDrawdown >= 0 ? "#e2e8f0" : "#f87171" }}>{`${maxDrawdown.toFixed(2)}%`}</strong>
        </div>
      </div>
      <div className="equityChart">
        <EquityComparisonChart
          equityPoints={equityPoints}
          benchmarkPoints={benchmarkPoints}
          benchmarkSymbol={benchmarkSymbol}
          benchmarkLabel={resolvedBenchmarkLabel}
          chartRange={chartRange}
          benchmarkLoading={benchmarkLoading}
        />
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
              <div className={`tradeResult ${getTradeOutcomeValue(trade) < 0 ? "negative" : getTradeOutcomeValue(trade) > 0 ? "positive" : "neutral"}`}>
                {Number.isFinite(getTradeOutcomeValue(trade)) ? `${getTradeOutcomeValue(trade) > 0 ? "+" : ""}${Number(getTradeOutcomeValue(trade)).toFixed(1)}${trade.isBrokerTrade ? "$" : "R"}` : "-"}
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

function getBrokerCapabilityBadges(asset) {
  if (!asset) return [];

  const badges = [];
  if (asset.tradable) badges.push({ label: "Tradable", tone: "blue" });
  if (asset.marginable) badges.push({ label: "Marginable", tone: "green" });
  if (asset.shortable) badges.push({ label: "Shortable", tone: "amber" });
  if (asset.easyToBorrow) badges.push({ label: "Easy To Borrow", tone: "green" });
  if (asset.assetClass === "crypto") badges.push({ label: "24/7", tone: "violet" });
  return badges;
}

function getCapabilityBadgeStyle(tone = "blue") {
  if (tone === "green") {
    return {
      color: "#86efac",
      background: "rgba(34,197,94,0.1)",
      border: "1px solid rgba(34,197,94,0.2)",
    };
  }
  if (tone === "amber") {
    return {
      color: "#fcd34d",
      background: "rgba(245,158,11,0.1)",
      border: "1px solid rgba(245,158,11,0.2)",
    };
  }
  if (tone === "violet") {
    return {
      color: "#c4b5fd",
      background: "rgba(139,92,246,0.1)",
      border: "1px solid rgba(139,92,246,0.2)",
    };
  }
  return {
    color: "#d7efff",
    background: "rgba(124,196,255,0.1)",
    border: "1px solid rgba(124,196,255,0.22)",
  };
}

function calculateBrokerDayPnL(positions) {
  return (positions || []).reduce((total, position) => {
    const marketValue = Number(position?.marketValue ?? 0);
    const changeToday = Number(position?.changeToday ?? 0);
    if (!Number.isFinite(marketValue) || !Number.isFinite(changeToday) || changeToday <= -1) return total;
    const previousValue = marketValue / (1 + changeToday);
    if (!Number.isFinite(previousValue)) return total;
    return total + (marketValue - previousValue);
  }, 0);
}

function BrokerTradeLogCard({ trades, isLoading, onRefresh }) {
  return (
    <Card title="Synced Orders">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <div className="listSubtext">{trades.length} broker trade{trades.length === 1 ? "" : "s"} synced</div>
        <button type="button" className="ghostButton" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh Broker Trades"}
        </button>
      </div>
      <div className="list">
        {!trades.length ? (
          <div className="listSubtext">No broker trades synced yet. Place a Rayla paper order or refresh broker trades.</div>
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
                    {trade.order_type} {trade.limit_price ? `· Limit ${formatCurrency(trade.limit_price)}` : ""} · {trade.source === "rayla" ? "Placed in Rayla" : "Broker import (Alpaca)"}
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

function MarketCard({ items, selectedId, onSelect, onRemove, newSymbol, setNewSymbol, onAddSymbol, fullPage = false, alpacaConnected = false, onAskChart = null }) {
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
  const marketChartUpdatedLabel = useRelativeTime(marketChartLastUpdated);
  const marketSearchTimeoutRef = useRef(null);
  const homeMarketCarouselRef = useRef(null);
  const homeMarketCarouselDirectionRef = useRef(1);
  const homeMarketCarouselPointerStateRef = useRef(null);
  const homeMarketCarouselSuppressClickRef = useRef(false);
  const [homeMarketCarouselPaused, setHomeMarketCarouselPaused] = useState(false);
  const [homeMarketCarouselCardWidth, setHomeMarketCarouselCardWidth] = useState(null);
  const [homeMarketCarouselCanScroll, setHomeMarketCarouselCanScroll] = useState(false);
  const [homeMarketCarouselSpeed, setHomeMarketCarouselSpeed] = useState(0.45);
  const symbolsKey = items.map((item) => item.id).sort().join("|");
  const selectedItem = items.find((item) => item.id === selectedId) || items[0];
  const selectedItemExplicitlyUnsupported = selectedItem?.alpacaSupported === false || selectedItem?.tradable === false;
  const marketChartSelection = getChartSelectionConfig(marketChartRange);
  const selectedChartBars = extractVisibleChartBars(marketChart, marketChartRange);
  const selectedQuotePrice = selectedItem ? quotes[selectedItem.id]?.price : null;

  function handleExplainChartClick() {
    const context = buildChartExplainContext({
      symbol: selectedItem?.id,
      assetName: selectedItem?.description || selectedItem?.name || selectedItem?.id,
      assetType: selectedItem?.type || "stock",
      range: marketChartRange,
      bars: selectedChartBars,
      currentPrice: selectedQuotePrice,
    });

    if (!selectedItem || typeof onAskChart !== "function") return;
    onAskChart({
      question: "Explain this chart",
      chartContext: context,
    });
  }

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
  if (selectedItemExplicitlyUnsupported) {
    setMarketChart(null);
    setMarketChartLoading(false);
    return;
  }

  let isCancelled = false;
  setMarketChart(null);
  setMarketChartLoading(true);

  async function fetchMarketChart() {
    try {
      const { data, error } = await supabase.functions.invoke("market-data", {
        body: {
          chartSymbol: selectedItem.id,
          chartType: selectedItem.type || "stock",
          chartRange: marketChartSelection.fetchRange,
          chartTimeframe: marketChartSelection.provider || null,
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
          range: marketChartSelection.fetchRange,
          bars: [],
          rangeMode: nextChart?.rangeMode || null,
      });
    } catch {
      // Keep the current market view stable if chart fetch fails.
    } finally {
      if (!isCancelled) setMarketChartLoading(false);
    }
  }

  fetchMarketChart();
  const isCryptoItem = (selectedItem.type || "stock") === "crypto";
  const interval = (marketChartSelection.provider || marketChartSelection.fetchRange === "1D")
    ? setInterval(fetchMarketChart, (isCryptoItem || isMarketCurrentlyOpen()) ? 10000 : 30000)
    : null;

  return () => {
    isCancelled = true;
    if (interval) clearInterval(interval);
  };
}, [selectedItem?.id, selectedItem?.type, marketChartRange, selectedItemExplicitlyUnsupported]);

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
      setHomeMarketCarouselSpeed(0.45);
      return;
    }

    const visibleSlots = Math.max(1, Math.floor((containerWidth + gap) / (minCardWidth + gap)));
    const wantsAutoScroll = sortedItems.length >= 5;
    const shouldScroll = wantsAutoScroll;
    setHomeMarketCarouselCanScroll(shouldScroll);
    setHomeMarketCarouselSpeed(0.45);

    if (shouldScroll) {
      setHomeMarketCarouselCardWidth(Math.max(minCardWidth, Math.floor(containerWidth / 4.5)));
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
  homeMarketCarouselDirectionRef.current = 1;

  const tick = () => {
    const maxScroll = Math.max(0, wrapper.scrollWidth - wrapper.clientWidth);
    if (maxScroll <= 0) {
      frameId = window.requestAnimationFrame(tick);
      return;
    }

    const nextScrollLeft = wrapper.scrollLeft + (homeMarketCarouselSpeed * homeMarketCarouselDirectionRef.current);

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
        className={`marketWatchlistCarouselWrap ${homeMarketCarouselCanScroll ? "scrollable" : ""} ${homeMarketCarouselPaused ? "paused" : ""}`}
        ref={homeMarketCarouselRef}
        onWheel={(event) => {
          if (!homeMarketCarouselCanScroll || !homeMarketCarouselRef.current) return;
          const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
          if (!delta) return;
          event.preventDefault();
          homeMarketCarouselRef.current.scrollLeft += delta;
        }}
        onPointerDown={(event) => {
          if (!homeMarketCarouselCanScroll || !homeMarketCarouselRef.current) return;
          homeMarketCarouselSuppressClickRef.current = false;
          homeMarketCarouselPointerStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startScrollLeft: homeMarketCarouselRef.current.scrollLeft,
            dragged: false,
            captured: false,
          };
        }}
        onPointerMove={(event) => {
          const state = homeMarketCarouselPointerStateRef.current;
          if (!state || !homeMarketCarouselRef.current || state.pointerId !== event.pointerId) return;
          const deltaX = event.clientX - state.startX;
          if (!state.dragged && Math.abs(deltaX) >= 4) {
            state.dragged = true;
            homeMarketCarouselSuppressClickRef.current = true;
            if (!state.captured) {
              try {
                homeMarketCarouselRef.current.setPointerCapture(event.pointerId);
                state.captured = true;
              } catch (_) {}
            }
          }
          if (!state.dragged) return;
          homeMarketCarouselRef.current.scrollLeft = state.startScrollLeft - deltaX;
        }}
        onPointerUp={(event) => {
          const state = homeMarketCarouselPointerStateRef.current;
          if (!state || !homeMarketCarouselRef.current || state.pointerId !== event.pointerId) return;
          if (state.captured) {
            try {
              homeMarketCarouselRef.current.releasePointerCapture(event.pointerId);
            } catch (_) {}
          }
          homeMarketCarouselPointerStateRef.current = null;
          if (state.dragged) {
            window.setTimeout(() => {
              homeMarketCarouselSuppressClickRef.current = false;
            }, 0);
          } else {
            homeMarketCarouselSuppressClickRef.current = false;
          }
        }}
        onPointerCancel={(event) => {
          if (homeMarketCarouselPointerStateRef.current?.pointerId !== event.pointerId) return;
          homeMarketCarouselPointerStateRef.current = null;
          homeMarketCarouselSuppressClickRef.current = false;
        }}
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
              onClick={(event) => {
                console.log("HOME CAROUSEL CLICK", item);
                if (homeMarketCarouselSuppressClickRef.current) {
                  event.preventDefault();
                  event.stopPropagation();
                  homeMarketCarouselSuppressClickRef.current = false;
                  return;
                }
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
                  <div style={{ fontSize: 11, color: "#7f8ea3", fontWeight: 600 }}>
                    TradingView live chart handles its own interval and chart controls.
                  </div>
                </div>
                {marketChartUpdatedLabel && (isMarketCurrentlyOpen() || String(selectedItem?.type || "").toLowerCase() === "crypto") && (
                  <div style={{ fontSize: 10, color: "#7f8ea3" }}>
                    Last updated: {marketChartUpdatedLabel}
                  </div>
                )}
              </div>
            {selectedItem && (
              <div style={{ display: "flex", justifyContent: "flex-start", padding: "8px 12px 0 12px" }}>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleExplainChartClick();
                  }}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(124,196,255,0.28)",
                    background: "rgba(124,196,255,0.08)",
                    color: "#d7efff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Ask Rayla → Explain this chart
                </button>
              </div>
            )}
            {selectedItem && <MarketClosedBanner assetType={selectedItem.type} updatedLabel={marketChartUpdatedLabel} />}
            <div style={{ width: "100%", height: "100%", minHeight: 320, background: "#0d1117", paddingTop: 10 }}>
              {selectedItem && selectedItemExplicitlyUnsupported ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 6, alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "0 24px" }}>
                  <div>Live chart unavailable</div>
                  <div>Alpaca does not currently support trading this asset.</div>
                </div>
              ) : selectedItem && (marketChartLoading && selectedChartBars.length < 2) ? (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8" }}>
                  Loading chart...
                </div>
              ) : selectedItem && selectedChartBars.length < 2 ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 6, alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "0 24px" }}>
                  <div>Chart unavailable</div>
                  <div>
                    {isClosedStock1DChart(marketChart, selectedItem.type || "stock", marketChartSelection.fetchRange)
                      ? "Market is currently closed. Switch to 1W to see the most recent trading data."
                      : "Unable to load chart data for this timeframe right now."}
                  </div>
                </div>
              ) : selectedItem ? (
                <KLineTradeChart
                  bars={selectedChartBars}
                  mode={marketChartMode}
                  latestPrice={quotes[selectedItem.id]?.price}
                  assetSymbol={selectedItem.id}
                  assetName={selectedItem.description || selectedItem.name || selectedItem.id}
                  chartRange={marketChartRange}
                  timeZone="America/Denver"
                  resetViewKey={`${selectedItem.id}:${marketChartRange}:${marketChartMode}:inline`}
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
                  <div style={{ fontSize: 11, color: "#7f8ea3", fontWeight: 600 }}>
                    TradingView live chart handles its own interval and chart controls.
                  </div>
                </div>
                {marketChartUpdatedLabel && (
                  <div style={{ fontSize: 10, color: "#7f8ea3" }}>
                    Last updated: {marketChartUpdatedLabel}
                  </div>
                )}
              </div>
            {selectedItem && (
              <div style={{ display: "flex", justifyContent: "flex-start", padding: "8px 12px 0 12px" }}>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleExplainChartClick();
                  }}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(124,196,255,0.28)",
                    background: "rgba(124,196,255,0.08)",
                    color: "#d7efff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Ask Rayla → Explain this chart
                </button>
              </div>
            )}
            <div style={{ width: "100%", height: "100%", minHeight: 420, background: "#0d1117", paddingTop: 10 }}>
              {selectedItem && selectedItemExplicitlyUnsupported ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 6, alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "0 24px" }}>
                  <div>Live chart unavailable</div>
                  <div>Alpaca does not currently support trading this asset.</div>
                </div>
              ) : selectedItem && (marketChartLoading && selectedChartBars.length < 2) ? (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8" }}>
                  Loading chart...
                </div>
              ) : selectedItem && selectedChartBars.length < 2 ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 6, alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "0 24px" }}>
                  <div>Chart unavailable</div>
                  <div>Market is currently closed. Switch to 1W to see the most recent trading data.</div>
                </div>
              ) : selectedItem ? (
                <KLineTradeChart
                  bars={selectedChartBars}
                  mode={marketChartMode}
                  latestPrice={quotes[selectedItem.id]?.price}
                  assetSymbol={selectedItem.id}
                  assetName={selectedItem.description || selectedItem.name || selectedItem.id}
                  chartRange={marketChartRange}
                  timeZone="America/Denver"
                  resetViewKey={`${selectedItem.id}:${marketChartRange}:${marketChartMode}:full`}
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

function IntelAssetCard({ item, onTrySimulation = null, onAskRayla = null, quoteOverride = null }) {
  if (!item) return null;
  const { label, cls } = getScoreLabel(item.score);
  const liveChangeValue = Number(quoteOverride?.change);
  const displayChange = Number.isFinite(liveChangeValue) ? formatPctChange(liveChangeValue) : item.change;
  const changePos = !String(displayChange || "").startsWith("-");
  const article = (item.rawArticles || [])[0];
  const drivers = item.breakdown
    ? Object.entries(item.breakdown).filter(([k]) => k !== "total").sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 2)
    : [];
  const summaryText = String(item.summary || "").trim();
  const pillColors = {
    "hot": { bg: "rgba(239,68,68,0.15)", color: "#f87171" },
    "leaning-hot": { bg: "rgba(239,68,68,0.08)", color: "#fca5a5" },
    "cold": { bg: "rgba(124,196,255,0.15)", color: "#7CC4FF" },
    "leaning-cold": { bg: "rgba(124,196,255,0.08)", color: "#93c5fd" },
    "neutral": { bg: "rgba(255,255,255,0.08)", color: "#7f8ea3" },
  };
  const pill = pillColors[cls];
  const driverLabels = { demand: "Demand", costMargin: "Margin", guidance: "Guidance", narrative: "Narrative", priceConfirmation: "Price", liquidity: "Liquidity", sentiment: "Sentiment", momentum: "Momentum", catalyst: "Catalyst", relativeStrength: "Rel. Strength" };
  const driverText = drivers.length
    ? drivers
      .map(([key, val]) => `${driverLabels[key] || key} ${val > 0 ? "positive" : val < 0 ? "negative" : "mixed"}`)
      .join(" • ")
    : "";
  const articleSnippet = String(article?.description || "").trim();

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
          <div style={{ fontSize: 15, fontWeight: 700, color: changePos ? "#4ade80" : "#f87171" }}>{displayChange}</div>
          <div style={{ fontSize: 11, color: "#7f8ea3", marginTop: 2 }}>Score: {item.score}</div>
        </div>
      </div>
      {drivers.length > 0 && (
        <div className="intelDriverTags" style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {drivers.map(([key, val]) => (
            <div key={key} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: val > 0 ? "rgba(74,222,128,0.1)" : val < 0 ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.06)", color: val > 0 ? "#4ade80" : val < 0 ? "#f87171" : "#7f8ea3", fontWeight: 600 }}>
              {driverLabels[key] || key} {val > 0 ? "↑" : val < 0 ? "↓" : "—"}
            </div>
          ))}
        </div>
      )}
      {summaryText && (
        <div style={{ marginBottom: 8, fontSize: 12, color: "#dbe7f3", lineHeight: 1.55 }}>
          {summaryText}
        </div>
      )}
      {driverText && (
        <div style={{ marginBottom: 8, padding: "9px 10px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#7f8ea3", marginBottom: 4 }}>
            What Is Driving It
          </div>
          <div style={{ fontSize: 11, color: "#aebfd3", lineHeight: 1.5 }}>
            {driverText}
          </div>
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
            {articleSnippet && <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.45, marginTop: 4 }}>{articleSnippet.slice(0, 160)}{articleSnippet.length > 160 ? "..." : ""}</div>}
          </div>
        </a>
      )}
      {(onTrySimulation || onAskRayla) && (
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {onTrySimulation && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTrySimulation(item);
              }}
              style={{
                border: "1px solid rgba(124,196,255,0.34)",
                background: "linear-gradient(180deg, rgba(124,196,255,0.94), rgba(82,169,255,0.9))",
                color: "#08111b",
                borderRadius: 999,
                padding: "10px 14px",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 8px 20px rgba(20,116,214,0.22)",
              }}
            >
              Simulate this trade
            </button>
          )}
          {onAskRayla && (
            <button
              type="button"
              className="ghostButton"
              onClick={(e) => {
                e.stopPropagation();
                onAskRayla(item);
              }}
              style={{ fontSize: 12, opacity: 0.85 }}
            >
              Ask Rayla why →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RaylaPickCard({ pick }) {
  if (!pick) return null;
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "#7f8ea3" }}>
        {pick.title}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#f8fbff" }}>
        {pick.asset || "Not enough data yet"}
      </div>
      {pick.directionBias && (
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7CC4FF", textTransform: "uppercase", letterSpacing: "0.8px" }}>
          {pick.directionBias}
        </div>
      )}
      <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.55 }}>
        {pick.explanation}
      </div>
      {pick.eligible && Number.isFinite(pick.winRate) && Number.isFinite(pick.totalTrades) ? (
        <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
          Win rate {pick.winRate.toFixed(0)}% · Avg {pick.avgR >= 0 ? "+" : ""}{pick.avgR.toFixed(2)}R · {pick.totalTrades} trade{pick.totalTrades === 1 ? "" : "s"}
        </div>
      ) : null}
      <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
        {pick.progress}
      </div>
    </div>
  );
}

function RaylaLaunchButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "#7CC4FF",
        color: "#0b1017",
        border: "none",
        borderRadius: 12,
        padding: "11px 16px",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        boxShadow: "0 10px 24px rgba(124,196,255,0.22)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function ChartTimeframeDropdown({ value, onChange, width = 110, options = CHART_RANGE_OPTIONS }) {
  return (
    <select
      className="authInput"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={{ width, minWidth: width, paddingTop: 6, paddingBottom: 6 }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
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

function JournalTradeTable({ trades, rCol, tradeDuration }) {
  return (
    <div style={{ background: "rgba(18,26,38,0.86)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
        <thead>
          <tr style={{ fontSize: 11, color: "#475569", background: "rgba(255,255,255,0.02)" }}>
            {["Asset", "Dir", "Setup", "Session", "Source", "Entry", "Exit", "Size", "Held", "Result", "Date"].map(h => (
              <th key={h} style={{ padding: "10px 14px", textAlign: h === "Result" ? "right" : "left", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map((trade, idx) => {
            const r = getTradeOutcomeValue(trade);
            const duration = tradeDuration(trade.entry_time, trade.exit_time);
            return (
              <tr key={trade.id || idx} style={{ borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 12 }}>
                <td style={{ padding: "9px 14px", color: "#f3f7fc", fontWeight: 700 }}>{(trade.asset || "—").toUpperCase()}</td>
                <td style={{ padding: "9px 14px", color: trade.direction?.toLowerCase() === "long" ? "#4ade80" : trade.direction ? "#f87171" : "#64748b", textTransform: "capitalize" }}>{trade.direction || "—"}</td>
                <td style={{ padding: "9px 14px", color: "#7CC4FF" }}>{trade.setup || "—"}</td>
                <td style={{ padding: "9px 14px", color: "#94a3b8" }}>{trade.session || "—"}</td>
                <td style={{ padding: "9px 14px", color: "#94a3b8" }}>{trade.source_label || (trade.isBrokerTrade ? "Broker" : "Manual")}</td>
                <td style={{ padding: "9px 14px", color: "#94a3b8" }}>{trade.entry_price != null ? `$${Number(trade.entry_price).toFixed(2)}` : "—"}</td>
                <td style={{ padding: "9px 14px", color: "#94a3b8" }}>{trade.exit_price != null ? `$${Number(trade.exit_price).toFixed(2)}` : "—"}</td>
                <td style={{ padding: "9px 14px", color: "#94a3b8" }}>{trade.entry_size != null ? `$${Number(trade.entry_size).toLocaleString()}` : "—"}</td>
                <td style={{ padding: "9px 14px", color: "#64748b" }}>{duration || "—"}</td>
                <td style={{ padding: "9px 14px", textAlign: "right", color: rCol(r), fontWeight: 700 }}>{r >= 0 ? "+" : ""}{r.toFixed(2)}{trade.isBrokerTrade ? "$" : "R"}</td>
                <td style={{ padding: "9px 14px", color: "#475569", whiteSpace: "nowrap" }}>{trade.entry_time ? new Date(trade.entry_time).toLocaleDateString([], { month: "short", day: "numeric", year: "2-digit" }) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const JOURNAL_MISTAKE_TAGS = ["FOMO", "Oversized", "Rule break", "Chased entry", "Early exit", "Missed target", "Emotional"];

function JournalTab({ trades, onOpenRaylaPopup }) {
  const [search, setSearch] = useState("");
  const [filterDir, setFilterDir] = useState("all");
  const [filterSetup, setFilterSetup] = useState("all");
  const [filterResult, setFilterResult] = useState("all");
  const [sortNewest, setSortNewest] = useState(true);
  const [viewMode, setViewMode] = useState("cards");
  const [expanded, setExpanded] = useState(new Set());
  const [reflections, setReflections] = useState({});

  const allSetups = useMemo(() => [...new Set(trades.map(t => t.setup).filter(Boolean))], [trades]);

  const filtered = useMemo(() => trades
    .filter(t => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (t.asset || "").toLowerCase().includes(q) ||
        (t.setup || "").toLowerCase().includes(q) ||
        (t.session || "").toLowerCase().includes(q)
      );
    })
    .filter(t => filterDir === "all" || (t.direction || "").toLowerCase() === filterDir)
    .filter(t => filterSetup === "all" || t.setup === filterSetup)
    .filter(t => {
      if (filterResult === "all") return true;
      const r = getTradeOutcomeValue(t);
      if (filterResult === "win") return r > 0;
      if (filterResult === "loss") return r < 0;
      if (filterResult === "be") return r === 0;
      return true;
    })
    .sort((a, b) => {
      const ta = a.entry_time ? new Date(a.entry_time).getTime() : 0;
      const tb = b.entry_time ? new Date(b.entry_time).getTime() : 0;
      return sortNewest ? tb - ta : ta - tb;
    }), [trades, search, filterDir, filterSetup, filterResult, sortNewest]);

  const totalRVal = useMemo(() => trades.reduce((s, t) => s + getTradeOutcomeValue(t), 0), [trades]);
  const wins = useMemo(() => trades.filter(t => getTradeOutcomeValue(t) > 0), [trades]);
  const losses = useMemo(() => trades.filter(t => getTradeOutcomeValue(t) < 0), [trades]);
  const wr = trades.length ? (wins.length / trades.length) * 100 : 0;
  const avgRVal = trades.length ? totalRVal / trades.length : 0;
  const avgWin = wins.length ? wins.reduce((s, t) => s + getTradeOutcomeValue(t), 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + getTradeOutcomeValue(t), 0) / losses.length) : 0;
  const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : null;
  const bestTrade = trades.length ? trades.reduce((b, t) => getTradeOutcomeValue(t) > getTradeOutcomeValue(b) ? t : b) : null;
  const worstTrade = trades.length ? trades.reduce((b, t) => getTradeOutcomeValue(t) < getTradeOutcomeValue(b) ? t : b) : null;

  const setupBreakdown = useMemo(() => {
    const map = {};
    trades.forEach(t => {
      if (!t.setup) return;
      if (!map[t.setup]) map[t.setup] = { trades: 0, wins: 0, totalR: 0 };
      map[t.setup].trades++;
      map[t.setup].totalR += getTradeOutcomeValue(t);
      if (getTradeOutcomeValue(t) > 0) map[t.setup].wins++;
    });
    return Object.entries(map)
      .map(([setup, s]) => ({ setup, trades: s.trades, winRate: (s.wins / s.trades) * 100, avgR: s.totalR / s.trades, totalR: s.totalR }))
      .sort((a, b) => b.totalR - a.totalR);
  }, [trades]);

  const sessionBreakdown = useMemo(() => {
    const map = {};
    trades.forEach(t => {
      const key = t.session || "Untagged";
      if (!map[key]) map[key] = { trades: 0, wins: 0, totalR: 0 };
      map[key].trades++;
      map[key].totalR += getTradeOutcomeValue(t);
      if (getTradeOutcomeValue(t) > 0) map[key].wins++;
    });
    return Object.entries(map)
      .map(([session, s]) => ({ session, trades: s.trades, winRate: (s.wins / s.trades) * 100, avgR: s.totalR / s.trades, totalR: s.totalR }))
      .sort((a, b) => b.totalR - a.totalR);
  }, [trades]);

  function rCol(v) {
    const n = parseFloat(v);
    return n > 0 ? "#4ade80" : n < 0 ? "#f87171" : "#94a3b8";
  }

  function tradeDuration(entry_time, exit_time) {
    if (!entry_time || !exit_time) return null;
    const ms = new Date(exit_time) - new Date(entry_time);
    if (ms <= 0) return null;
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hrs < 24) return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  }

  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function setReflection(tradeId, field, value) {
    setReflections(prev => ({ ...prev, [tradeId]: { ...(prev[tradeId] || {}), [field]: value } }));
  }

  function toggleMistake(tradeId, tag) {
    const current = reflections[tradeId]?.mistakes || [];
    const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
    setReflection(tradeId, "mistakes", next);
  }

  const hasFilters = search || filterDir !== "all" || filterSetup !== "all" || filterResult !== "all";

  const breakdownTableStyle = {
    background: "rgba(18,26,38,0.86)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    overflow: "hidden",
  };
  const breakdownHeaderStyle = {
    padding: "12px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    fontSize: 12,
    fontWeight: 600,
    color: "#7f8ea3",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };

  if (trades.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: "#f3f7fc", marginBottom: 8 }}>No trades logged yet</div>
        <div style={{ fontSize: 14, color: "#64748b", maxWidth: 380, margin: "0 auto", lineHeight: 1.6 }}>
          Head to <strong style={{ color: "#7CC4FF" }}>My Trades</strong> and log your first trade. Every trade you log will appear here with full analytics and reflection tools.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <RaylaLaunchButton
          label="Ask Rayla"
          onClick={() => onOpenRaylaPopup?.("Ask Rayla")}
        />
      </div>

      {/* Summary stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
        {[
          { label: "Total Trades", value: trades.length, sub: `${wins.length}W · ${losses.length}L`, color: "#f3f7fc" },
          { label: "Win Rate", value: `${wr.toFixed(1)}%`, sub: `${wins.length} winners`, color: wr >= 50 ? "#4ade80" : "#f87171" },
          { label: "Total Result", value: `${totalRVal >= 0 ? "+" : ""}${totalRVal.toFixed(2)}`, sub: "net result", color: totalRVal >= 0 ? "#4ade80" : "#f87171" },
          { label: "Avg Result / Trade", value: `${avgRVal >= 0 ? "+" : ""}${avgRVal.toFixed(2)}`, sub: "per trade", color: avgRVal >= 0 ? "#4ade80" : "#f87171" },
          { label: "Avg Win", value: avgWin > 0 ? `+${avgWin.toFixed(2)}` : "—", sub: "avg winner", color: "#4ade80" },
          { label: "Avg Loss", value: avgLoss > 0 ? `-${avgLoss.toFixed(2)}` : "—", sub: "avg loser", color: "#f87171" },
          ...(profitFactor !== null ? [{ label: "Profit Factor", value: profitFactor.toFixed(2), sub: ">1.0 profitable", color: profitFactor >= 1 ? "#4ade80" : "#f87171" }] : []),
          ...(bestTrade ? [{ label: "Best Trade", value: `${getTradeOutcomeValue(bestTrade) >= 0 ? "+" : ""}${getTradeOutcomeValue(bestTrade).toFixed(2)}`, sub: (bestTrade.asset || "").toUpperCase(), color: "#4ade80" }] : []),
          ...(worstTrade ? [{ label: "Worst Trade", value: `${getTradeOutcomeValue(worstTrade) >= 0 ? "+" : ""}${getTradeOutcomeValue(worstTrade).toFixed(2)}`, sub: (worstTrade.asset || "").toUpperCase(), color: "#f87171" }] : []),
        ].map(item => (
          <div key={item.label} style={{ background: "rgba(18,26,38,0.86)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{item.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: item.color, marginBottom: 2 }}>{item.value}</div>
            <div style={{ fontSize: 11, color: "#475569" }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Breakdown tables */}
      {(setupBreakdown.length > 0 || sessionBreakdown.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {setupBreakdown.length > 0 && (
            <div style={breakdownTableStyle}>
              <div style={breakdownHeaderStyle}>By Setup</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ fontSize: 11, color: "#475569" }}>
                    {["Setup", "Trades", "Win%", "Avg", "Total"].map(h => (
                      <th key={h} style={{ padding: "6px 14px", textAlign: h === "Setup" ? "left" : "right", fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {setupBreakdown.map(row => (
                    <tr key={row.setup} style={{ borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 12 }}>
                      <td style={{ padding: "8px 14px", color: "#7CC4FF" }}>{row.setup}</td>
                      <td style={{ padding: "8px 14px", textAlign: "right", color: "#94a3b8" }}>{row.trades}</td>
                      <td style={{ padding: "8px 14px", textAlign: "right", color: row.winRate >= 50 ? "#4ade80" : "#f87171" }}>{row.winRate.toFixed(0)}%</td>
                      <td style={{ padding: "8px 14px", textAlign: "right", color: rCol(row.avgR) }}>{row.avgR >= 0 ? "+" : ""}{row.avgR.toFixed(2)}</td>
                      <td style={{ padding: "8px 14px", textAlign: "right", color: rCol(row.totalR) }}>{row.totalR >= 0 ? "+" : ""}{row.totalR.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {sessionBreakdown.length > 0 && (
            <div style={breakdownTableStyle}>
              <div style={breakdownHeaderStyle}>By Session</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ fontSize: 11, color: "#475569" }}>
                    {["Session", "Trades", "Win%", "Avg", "Total"].map(h => (
                      <th key={h} style={{ padding: "6px 14px", textAlign: h === "Session" ? "left" : "right", fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessionBreakdown.map(row => (
                    <tr key={row.session} style={{ borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 12 }}>
                      <td style={{ padding: "8px 14px", color: "#94a3b8" }}>{row.session}</td>
                      <td style={{ padding: "8px 14px", textAlign: "right", color: "#94a3b8" }}>{row.trades}</td>
                      <td style={{ padding: "8px 14px", textAlign: "right", color: row.winRate >= 50 ? "#4ade80" : "#f87171" }}>{row.winRate.toFixed(0)}%</td>
                      <td style={{ padding: "8px 14px", textAlign: "right", color: rCol(row.avgR) }}>{row.avgR >= 0 ? "+" : ""}{row.avgR.toFixed(2)}</td>
                      <td style={{ padding: "8px 14px", textAlign: "right", color: rCol(row.totalR) }}>{row.totalR >= 0 ? "+" : ""}{row.totalR.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search asset, setup, session…"
          style={{ flex: "1 1 180px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px", color: "#e2e8f0", fontSize: 13, outline: "none" }}
        />
        <select value={filterResult} onChange={e => setFilterResult(e.target.value)}
          style={{ background: "rgba(18,26,38,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px", color: "#e2e8f0", fontSize: 13, cursor: "pointer" }}>
          <option value="all">All Results</option>
          <option value="win">Winners</option>
          <option value="loss">Losers</option>
          <option value="be">Breakeven</option>
        </select>
        <select value={filterDir} onChange={e => setFilterDir(e.target.value)}
          style={{ background: "rgba(18,26,38,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px", color: "#e2e8f0", fontSize: 13, cursor: "pointer" }}>
          <option value="all">All Directions</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
        {allSetups.length > 0 && (
          <select value={filterSetup} onChange={e => setFilterSetup(e.target.value)}
            style={{ background: "rgba(18,26,38,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px", color: "#e2e8f0", fontSize: 13, cursor: "pointer" }}>
            <option value="all">All Setups</option>
            {allSetups.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <button type="button" onClick={() => setSortNewest(v => !v)}
          style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px", color: "#94a3b8", fontSize: 12, cursor: "pointer" }}>
          {sortNewest ? "↓ Newest" : "↑ Oldest"}
        </button>
        <div style={{ display: "flex", gap: 0, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, overflow: "hidden" }}>
          {[["cards", "⬜"], ["table", "≡"]].map(([m, icon]) => (
            <button key={m} type="button" onClick={() => setViewMode(m)}
              style={{ background: viewMode === m ? "rgba(124,196,255,0.12)" : "transparent", border: "none", borderRight: m === "cards" ? "1px solid rgba(255,255,255,0.1)" : "none", padding: "8px 14px", color: viewMode === m ? "#7CC4FF" : "#64748b", fontSize: 12, cursor: "pointer" }}>
              {icon} {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        {hasFilters && (
          <button type="button" onClick={() => { setSearch(""); setFilterDir("all"); setFilterSetup("all"); setFilterResult("all"); }}
            style={{ background: "transparent", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, padding: "8px 12px", color: "#f87171", fontSize: 12, cursor: "pointer" }}>
            Clear
          </button>
        )}
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#475569" }}>
          {filtered.length} of {trades.length} trades
        </div>
      </div>

      {/* Trade list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", background: "rgba(18,26,38,0.86)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 }}>
          <div style={{ fontSize: 14, color: "#64748b", marginBottom: 10 }}>No trades match your current filters.</div>
          <button type="button" onClick={() => { setSearch(""); setFilterDir("all"); setFilterSetup("all"); setFilterResult("all"); }}
            style={{ background: "transparent", border: "1px solid rgba(124,196,255,0.3)", borderRadius: 8, padding: "6px 14px", color: "#7CC4FF", fontSize: 12, cursor: "pointer" }}>
            Clear filters
          </button>
        </div>
      ) : viewMode === "table" ? (
        <JournalTradeTable trades={filtered} rCol={rCol} tradeDuration={tradeDuration} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((trade, idx) => {
            const tradeId = trade.id || idx;
            const r = getTradeOutcomeValue(trade);
            const isWin = r > 0;
            const isLoss = r < 0;
            const isExpanded = expanded.has(tradeId);
            const ref = reflections[tradeId] || {};
            const duration = tradeDuration(trade.entry_time, trade.exit_time);
            const dateStr = trade.entry_time
              ? new Date(trade.entry_time).toLocaleDateString([], { month: "short", day: "numeric", year: "2-digit" })
              : "—";
            const timeStr = trade.entry_time
              ? new Date(trade.entry_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "";
            const rBarPct = Math.min(Math.abs(r) / 5 * 100, 100);

            return (
              <div key={tradeId} style={{
                background: "rgba(18,26,38,0.86)",
                border: `1px solid ${isWin ? "rgba(74,222,128,0.12)" : isLoss ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.07)"}`,
                borderLeft: `3px solid ${isWin ? "#4ade80" : isLoss ? "#f87171" : "rgba(255,255,255,0.12)"}`,
                borderRadius: 14,
                overflow: "hidden",
              }}>
                {/* Card summary row — always visible, click to expand */}
                <div onClick={() => toggleExpand(tradeId)}
                  style={{ padding: "14px 18px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 9 }}>
                  {/* Top row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#f3f7fc" }}>{(trade.asset || "—").toUpperCase()}</span>
                      {trade.direction && (
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: trade.direction.toLowerCase() === "long" ? "#4ade80" : "#f87171", background: trade.direction.toLowerCase() === "long" ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", borderRadius: 6, padding: "2px 8px" }}>
                          {trade.direction}
                        </span>
                      )}
                      {trade.setup && (
                        <span style={{ fontSize: 11, color: "#7CC4FF", background: "rgba(124,196,255,0.08)", borderRadius: 6, padding: "2px 8px", border: "1px solid rgba(124,196,255,0.15)" }}>
                          {trade.setup}
                        </span>
                      )}
                      {trade.session && (
                        <span style={{ fontSize: 11, color: "#94a3b8", background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "2px 8px", border: "1px solid rgba(255,255,255,0.08)" }}>
                          {trade.session}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 12, color: "#475569" }}>{dateStr}{timeStr ? ` · ${timeStr}` : ""}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8", background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "2px 8px", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {trade.source_label || (trade.isBrokerTrade ? "Broker" : "Manual")}
                    </span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: rCol(r), minWidth: 56, textAlign: "right" }}>{r >= 0 ? "+" : ""}{r.toFixed(2)}{trade.isBrokerTrade ? "$" : "R"}</span>
                      <span style={{ fontSize: 12, color: "#334155" }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  {/* Details row */}
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "#64748b" }}>
                    {trade.entry_price != null && <span><span style={{ color: "#7f8ea3" }}>Entry </span>${Number(trade.entry_price).toFixed(2)}</span>}
                    {trade.exit_price != null && <span><span style={{ color: "#7f8ea3" }}>Exit </span>${Number(trade.exit_price).toFixed(2)}</span>}
                    {trade.entry_size != null && <span><span style={{ color: "#7f8ea3" }}>Size </span>${Number(trade.entry_size).toLocaleString()}</span>}
                    {duration && <span><span style={{ color: "#7f8ea3" }}>Held </span>{duration}</span>}
                  </div>
                  {/* R magnitude bar */}
                  <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${rBarPct}%`, background: isWin ? "#4ade80" : isLoss ? "#f87171" : "#64748b", borderRadius: 2 }} />
                  </div>
                  {/* Active mistake tags preview */}
                  {ref.mistakes?.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {ref.mistakes.map(tag => (
                        <span key={tag} style={{ fontSize: 11, color: "#fb923c", background: "rgba(251,146,60,0.08)", borderRadius: 20, padding: "2px 8px", border: "1px solid rgba(251,146,60,0.18)" }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Expanded reflection section */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Notes */}
                    <div>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.4px", display: "flex", alignItems: "center", gap: 8 }}>
                        Reflection notes
                        <span style={{ fontSize: 10, color: "#334155", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>session only · not saved to account</span>
                      </div>
                      <textarea
                        value={ref.notes || ""}
                        onChange={e => setReflection(tradeId, "notes", e.target.value)}
                        placeholder="What went well? What would you do differently? Any emotional or execution notes?"
                        rows={3}
                        onClick={e => e.stopPropagation()}
                        style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px", color: "#e2e8f0", fontSize: 13, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                      />
                    </div>

                    {/* Mistake tags */}
                    <div>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.4px" }}>Mistake tags</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {JOURNAL_MISTAKE_TAGS.map(tag => {
                          const active = ref.mistakes?.includes(tag);
                          return (
                            <button key={tag} type="button"
                              onClick={e => { e.stopPropagation(); toggleMistake(tradeId, tag); }}
                              style={{ background: active ? "rgba(251,146,60,0.13)" : "rgba(255,255,255,0.03)", border: `1px solid ${active ? "rgba(251,146,60,0.38)" : "rgba(255,255,255,0.09)"}`, borderRadius: 20, padding: "4px 13px", color: active ? "#fb923c" : "#64748b", fontSize: 12, cursor: "pointer", transition: "all 0.15s" }}>
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Confidence + screenshot */}
                    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.4px" }}>Confidence</span>
                        <div style={{ display: "flex", gap: 5 }}>
                          {[1,2,3,4,5].map(n => (
                            <div key={n}
                              onClick={e => { e.stopPropagation(); setReflection(tradeId, "confidence", n === ref.confidence ? 0 : n); }}
                              style={{ width: 13, height: 13, borderRadius: "50%", background: n <= (ref.confidence || 0) ? "#7CC4FF" : "rgba(255,255,255,0.06)", border: `1.5px solid ${n <= (ref.confidence || 0) ? "rgba(124,196,255,0.55)" : "rgba(255,255,255,0.12)"}`, cursor: "pointer", transition: "all 0.15s" }} />
                          ))}
                        </div>
                        {ref.confidence > 0 && <span style={{ fontSize: 11, color: "#7CC4FF" }}>{ref.confidence}/5</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.07)", borderRadius: 8, padding: "6px 12px", opacity: 0.45 }}>
                        <span style={{ fontSize: 12, color: "#475569" }}>📎 Screenshot — coming soon</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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

  const [homeMarketQuotes, setHomeMarketQuotes] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("rayla-market-quotes") || "{}"); }
    catch { return {}; }
  });
  const [homeMarketSearchResults, setHomeMarketSearchResults] = useState([]);
  const [homeMarketActiveAsset, setHomeMarketActiveAsset] = useState(null);
  const [homeMarketChart, setHomeMarketChart] = useState(null);
  const [homeMarketChartLoading, setHomeMarketChartLoading] = useState(false);
  const [homeMarketChartMode, setHomeMarketChartMode] = useState("candlestick");
  const [homeMarketChartRange, setHomeMarketChartRange] = useState("1D");
  const [homeMarketChartViewPreset, setHomeMarketChartViewPreset] = useState("default");
  const [isHomeLiveChartFullscreen, setIsHomeLiveChartFullscreen] = useState(false);
  const [homeMobileTab, setHomeMobileTab] = useState(0);
  const [simMobileTab, setSimMobileTab] = useState(0);
  const [homeMarketChartLastUpdated, setHomeMarketChartLastUpdated] = useState(null);
  const homeMarketSearchTimeoutRef = useRef(null);

  const [intelLoading, setIntelLoading] = useState(false);
  const [hotColdReport, setHotColdReport] = useState(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem("rayla-intel-report") || "null");
      return isPopulatedIntelReport(cached) ? cached : null;
    } catch {
      return null;
    }
  });
  const [intelLiveQuotes, setIntelLiveQuotes] = useState({});
  const [isRaylaLoading, setIsRaylaLoading] = useState(false);
  const [raylaResponse, setRaylaResponse] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [raylaChatMessages, setRaylaChatMessages] = useState([]);
  const [raylaActiveReviewedTrade, setRaylaActiveReviewedTrade] = useState(null);
  const [chartExplainPopupOpen, setChartExplainPopupOpen] = useState(false);
  const [chartExplainPopupContext, setChartExplainPopupContext] = useState(null);
  const [chartExplainPopupMessages, setChartExplainPopupMessages] = useState([]);
  const [chartExplainPopupInput, setChartExplainPopupInput] = useState("");
  const [chartExplainPopupLoading, setChartExplainPopupLoading] = useState(false);
  const [chartExplainPopupTitle, setChartExplainPopupTitle] = useState("Ask Rayla");
  const [chartExplainPopupPosition, setChartExplainPopupPosition] = useState({ x: 24, y: 96 });
  const [chartExplainPopupIsMobile, setChartExplainPopupIsMobile] = useState(() => window.innerWidth < 768);
  const [isMobileView, setIsMobileView] = useState(() => window.innerWidth <= 600);
  const [simulationRaylaGuidanceStateByTrade, setSimulationRaylaGuidanceStateByTrade] = useState({});
  const [simulationRaylaPromptTradeId, setSimulationRaylaPromptTradeId] = useState(null);
  const [pendingIntelSimulationLaunch, setPendingIntelSimulationLaunch] = useState(null);
  const [intelPracticeModeChoice, setIntelPracticeModeChoice] = useState(null);
  const [intelSimulationSetupPrompt, setIntelSimulationSetupPrompt] = useState(null);
  const [intelSimulationSetupChecklist, setIntelSimulationSetupChecklist] = useState(null);
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
  const [alpacaSelectedAssetMeta, setAlpacaSelectedAssetMeta] = useState(null);
  const [alpacaAssetQuotes, setAlpacaAssetQuotes] = useState({});
  const [tradeMarketChart, setTradeMarketChart] = useState(null);
  const [tradeMarketChartLoading, setTradeMarketChartLoading] = useState(false);
  const [tradePortfolioCharts, setTradePortfolioCharts] = useState({});
  const [tradePortfolioChartsLoading, setTradePortfolioChartsLoading] = useState(false);
  const [tradeChartMode, setTradeChartMode] = useState("candlestick");
  const [tradeChartRange, setTradeChartRange] = useState("1D");
  const [tradeChartLastUpdated, setTradeChartLastUpdated] = useState(null);
  const [tradeChartRefreshTick, setTradeChartRefreshTick] = useState(0);
  const [tradeViewMode, setTradeViewMode] = useState("asset");
  const [tradePortfolioChartView, setTradePortfolioChartView] = useState("portfolio");
  const [tradePortfolioSelectedSymbols, setTradePortfolioSelectedSymbols] = useState([]);
  const tradeChartSelection = getChartSelectionConfig(tradeChartRange);
  const [performanceLiveAppliedSelection, setPerformanceLiveAppliedSelection] = useState({ includePortfolio: true, symbols: [] });
  const [tradePendingSelection, setTradePendingSelection] = useState({ mode: "asset", symbols: [] });
  const [tradeAppliedSelection, setTradeAppliedSelection] = useState({ mode: "asset", symbols: [] });
  const [simulationLiveChart, setSimulationLiveChart] = useState(null);
  const [simulationLiveChartLoading, setSimulationLiveChartLoading] = useState(false);
  const [simulationLiveChartRefreshTick, setSimulationLiveChartRefreshTick] = useState(0);
  const [simulationLiveChartMode, setSimulationLiveChartMode] = useState("candlestick");
  const [simulationLivePaused, setSimulationLivePaused] = useState(false);
  const [simulationLivePauseSnapshot, setSimulationLivePauseSnapshot] = useState({});
  const [chartDrawings, setChartDrawings] = useState({});
  const [simulationScenarioChartMode, setSimulationScenarioChartMode] = useState("candlestick");
  const [simulationScenarioDrawingMode, setSimulationScenarioDrawingMode] = useState("none");
  const [simulationChartTimeframe, setSimulationChartTimeframe] = useState("5m");
  const [simulationLiveChartRange, setSimulationLiveChartRange] = useState("1D");
  const simulationLiveChartSelection = getChartSelectionConfig(simulationLiveChartRange);
  const [simulationLiveChartLastUpdated, setSimulationLiveChartLastUpdated] = useState(null);
  const homeMarketChartUpdatedLabel = useRelativeTime(homeMarketChartLastUpdated);
  const tradeChartUpdatedLabel = useRelativeTime(tradeChartLastUpdated);
  const tradeVisibleBars = useMemo(
    () => extractVisibleChartBars(tradeMarketChart, tradeChartRange),
    [tradeMarketChart, tradeChartRange]
  );
  const simulationLiveChartUpdatedLabel = useRelativeTime(simulationLiveChartLastUpdated);
  const [alpacaOrderForm, setAlpacaOrderForm] = useState({
    symbol: "",
    side: "buy",
    qty: "",
    notional: "",
    type: "market",
    limitPrice: "",
    timeInForce: "gtc",
    stopPrice: "",
    takeProfit: "",
    maxLoss: "",
    buyingPowerPercent: "",
    leverage: "1x",
  });
  const [tradeHelpTopic, setTradeHelpTopic] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
    const [newSymbol, setNewSymbol] = useState("");
  const [user, setUser] = useState(null);
  const [chartRange, setChartRange] = useState("ALL");
  const [equityBenchmarkSymbol, setEquityBenchmarkSymbol] = useState("SPY");
  const [equityBenchmarkType, setEquityBenchmarkType] = useState("stock");
  const [equityBenchmarkLabel, setEquityBenchmarkLabel] = useState("SPY");
  const [equityBenchmarkChart, setEquityBenchmarkChart] = useState(null);
  const [equityBenchmarkLoading, setEquityBenchmarkLoading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [userLevel, setUserLevel] = useState("beginner");
  const [raylaMode, setRaylaMode] = useState(() => {
    try {
      return localStorage.getItem(RAYLA_MODE_STORAGE_KEY) || "beginner";
    } catch {
      return "beginner";
    }
  });
  const [raylaAdaptiveState, setRaylaAdaptiveState] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RAYLA_ADAPTIVE_STORAGE_KEY) || "null");
      return stored ? { ...createDefaultRaylaAdaptiveState(), ...stored } : createDefaultRaylaAdaptiveState();
    } catch {
      return createDefaultRaylaAdaptiveState();
    }
  });
  useEffect(() => {
    localStorage.setItem(RAYLA_ADAPTIVE_STORAGE_KEY, JSON.stringify(raylaAdaptiveState));
  }, [raylaAdaptiveState]);
  useEffect(() => {
    try {
      localStorage.setItem(RAYLA_MODE_STORAGE_KEY, raylaMode);
    } catch {
      // ignore localStorage write errors for mode preference
    }
  }, [raylaMode]);
    const [showBeginnerTutorial, setShowBeginnerTutorial] = useState(false);
  const [beginnerTutorialView, setBeginnerTutorialView] = useState("menu");
    const [beginnerTutorialStep, setBeginnerTutorialStep] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [lastAnalyzedCount, setLastAnalyzedCount] = useState(-1);
  const [showNoNewTrades, setShowNoNewTrades] = useState(false);
  const [coachSummary, setCoachSummary] = useState(null);
  const [equitySourceLabel, setEquitySourceLabel] = useState("Built from manual and broker-imported trades with enough execution detail.");
  const [trades, setTrades] = useState([]);
  const [simulationQuotes, setSimulationQuotes] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("rayla-market-quotes") || "{}");
    } catch {
      return {};
    }
  });
  function syncSharedQuoteCaches(incomingQuotes, { includeAlpacaQuotes = false } = {}) {
    if (!incomingQuotes || typeof incomingQuotes !== "object") return;

    setHomeMarketQuotes((prev) => {
      const next = mergeIncomingQuotes(prev, incomingQuotes);
      sessionStorage.setItem("rayla-market-quotes", JSON.stringify(next));
      return next;
    });
    setSimulationQuotes((prev) => {
      const next = mergeIncomingQuotes(prev, incomingQuotes);
      sessionStorage.setItem("rayla-market-quotes", JSON.stringify(next));
      return next;
    });

    if (includeAlpacaQuotes) {
      setAlpacaAssetQuotes((prev) => mergeIncomingQuotes(prev, incomingQuotes));
    }
  }

  function syncQuoteFromChart(asset, chart, options = {}) {
    const symbol = normalizeAssetId(asset?.id, asset?.type, asset?.tvSymbol);
    const snapshot = buildQuoteSnapshotFromChart(chart);
    if (!symbol || !snapshot) return;
    syncSharedQuoteCaches({ [symbol]: snapshot }, options);
  }

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
  const tradePanelAsset = useMemo(() => {
    if (!tradePanelSymbol) return null;
    return watchlist.find((item) => item.id === tradePanelSymbol)
      || buildMarketAsset({
        symbol: tradePanelSymbol,
        description: tradePanelMatchingPosition?.symbol || tradePanelSymbol,
        exchange: tradePanelMatchingPosition?.exchange || "",
        type: "stock",
      });
  }, [tradePanelSymbol, watchlist, tradePanelMatchingPosition?.symbol, tradePanelMatchingPosition?.exchange]);
  const tradePanelAssetType = tradePanelAsset?.type || "stock";
  const tradeSelectedBrokerAsset = alpacaAssetSearchResults.find((asset) => asset.symbol === tradePanelSymbol)
    || (alpacaSelectedAssetMeta?.symbol === tradePanelSymbol ? alpacaSelectedAssetMeta : null);
  const tradeSelectedLeverageOptions = getAvailableLeverageOptions(alpacaAccount?.raw?.multiplier);
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
  const tradePortfolioAllSymbols = useMemo(
    () => alpacaPositions.map((position) => position.symbol).filter(Boolean),
    [alpacaPositions]
  );
  const normalizePerformanceLiveSelection = (selection) => {
    const validSymbols = Array.from(new Set((selection?.symbols || []).filter((symbol) => tradePortfolioAllSymbols.includes(symbol))));
    const includePortfolio = Boolean(selection?.includePortfolio);
    if (!includePortfolio && validSymbols.length === 0) {
      return { includePortfolio: true, symbols: [] };
    }
    return { includePortfolio, symbols: validSymbols };
  };
  const performanceLiveLegacySelection = useMemo(() => {
    const normalized = normalizePerformanceLiveSelection(performanceLiveAppliedSelection);
    if (normalized.includePortfolio) {
      return { mode: "portfolio", symbols: tradePortfolioAllSymbols };
    }
    if (normalized.symbols.length > 1) {
      return { mode: "multi", symbols: normalized.symbols };
    }
    return {
      mode: "asset",
      symbols: normalized.symbols.length ? [normalized.symbols[0]] : [tradePortfolioAllSymbols[0]].filter(Boolean),
    };
  }, [performanceLiveAppliedSelection, tradePortfolioAllSymbols]);
  const activeTradeChartSelection = activeTab === "ai" ? performanceLiveLegacySelection : tradeAppliedSelection;
  const tradeChartSymbol = activeTradeChartSelection.mode === "asset"
    ? (activeTradeChartSelection.symbols[0] || tradePanelSymbol || alpacaPositions[0]?.symbol || "")
    : "";
  const tradeChartMatchingPosition = tradeChartSymbol
    ? alpacaPositions.find((position) => position.symbol === tradeChartSymbol) || null
    : null;
  const tradeChartQuote = tradeChartSymbol
    ? getKnownStockQuoteData(tradeChartSymbol, simulationQuotes, marketItems, alpacaAssetQuotes)
    : null;
  const tradeChartCurrentPrice = Number.isFinite(tradeChartQuote?.price)
    ? Number(tradeChartQuote.price)
    : Number.isFinite(tradeChartMatchingPosition?.currentPrice)
      ? Number(tradeChartMatchingPosition.currentPrice)
      : null;
  const tradeChartAsset = useMemo(() => {
    if (!tradeChartSymbol) return null;
    return watchlist.find((item) => item.id === tradeChartSymbol)
      || buildMarketAsset({
        symbol: tradeChartSymbol,
        description: tradeChartMatchingPosition?.symbol || tradeChartSymbol,
        exchange: tradeChartMatchingPosition?.exchange || "",
        type: "stock",
      });
  }, [tradeChartSymbol, watchlist, tradeChartMatchingPosition?.symbol, tradeChartMatchingPosition?.exchange]);
  const tradeChartAssetExplicitlyUnsupported = tradeChartAsset?.alpacaSupported === false || tradeChartAsset?.tradable === false;
  const tradeChartAssetType = tradeChartAsset?.type || "stock";
  const tradePortfolioDisplayedSymbols = useMemo(() => {
    if (activeTradeChartSelection.mode === "multi") {
      const validApplied = (activeTradeChartSelection.symbols || []).filter((symbol) => tradePortfolioAllSymbols.includes(symbol));
      return validApplied.length ? validApplied : tradePortfolioAllSymbols;
    }
    if (activeTradeChartSelection.mode === "portfolio" && tradePortfolioChartView === "breakdown") {
      const validSelected = tradePortfolioSelectedSymbols.filter((symbol) => tradePortfolioAllSymbols.includes(symbol));
      return validSelected.length ? validSelected : tradePortfolioAllSymbols;
    }
    return tradePortfolioAllSymbols;
  }, [activeTradeChartSelection, tradePortfolioAllSymbols, tradePortfolioChartView, tradePortfolioSelectedSymbols]);
  const tradePortfolioDisplayedPositions = useMemo(
    () => alpacaPositions.filter((position) => tradePortfolioDisplayedSymbols.includes(position.symbol)),
    [alpacaPositions, tradePortfolioDisplayedSymbols]
  );
  const tradePortfolioCombinedUnrealizedPl = useMemo(
    () => tradePortfolioDisplayedPositions.reduce((sum, position) => sum + (Number(position?.unrealizedPl) || 0), 0),
    [tradePortfolioDisplayedPositions]
  );
  const tradePortfolioCombinedMarketValue = useMemo(
    () => tradePortfolioDisplayedPositions.reduce((sum, position) => sum + (Number(position?.marketValue) || 0), 0),
    [tradePortfolioDisplayedPositions]
  );
  const tradePortfolioRangeWindowMs = getTradeRangeWindowMs(tradeChartRange);
  const tradePortfolioNowMs = Date.now();
  const tradePortfolioRequestedStartMs = tradePortfolioRangeWindowMs
    ? tradePortfolioNowMs - tradePortfolioRangeWindowMs
    : null;
  const buildTradeSelectionKey = (selection) => {
    const symbols = Array.from(new Set(selection?.symbols || [])).filter(Boolean).sort();
    return `${selection?.mode || "asset"}:${symbols.join(",")}`;
  };
  const normalizeTradeSelection = (selection) => {
    const validSymbols = Array.from(new Set((selection?.symbols || []).filter((symbol) => tradePortfolioAllSymbols.includes(symbol))));
    if (selection?.mode === "portfolio") {
      return { mode: "portfolio", symbols: tradePortfolioAllSymbols };
    }
    if (validSymbols.length) {
      return { mode: "asset", symbols: [validSymbols[0]] };
    }
    return tradePortfolioAllSymbols.length
      ? { mode: "portfolio", symbols: tradePortfolioAllSymbols }
      : { mode: "asset", symbols: [] };
  };
  const applyTradeSelection = (selection) => {
    const nextSelection = normalizeTradeSelection(selection);
    setTradePendingSelection(nextSelection);
    setTradeAppliedSelection(nextSelection);
  };
  const tradePendingSelectionKey = buildTradeSelectionKey(tradePendingSelection);
  const tradeAppliedSelectionKey = buildTradeSelectionKey(tradeAppliedSelection);
  const tradeViewSelectionDirty = tradePendingSelectionKey !== tradeAppliedSelectionKey;
  const tradeIsComparisonMode = activeTradeChartSelection.mode === "portfolio" || activeTradeChartSelection.mode === "multi";
  const tradeIsPortfolioTotalMode = activeTradeChartSelection.mode === "portfolio" && tradePortfolioChartView === "portfolio";
  const tradeIsPortfolioBreakdownMode = activeTradeChartSelection.mode === "multi"
    || (activeTradeChartSelection.mode === "portfolio" && tradePortfolioChartView === "breakdown");
  const [simulationAsset, setSimulationAsset] = useState(() => {
    const storedPosition = readSimulationStorage(
      SIMULATION_STORAGE_KEYS.openPosition,
      [],
      (value) => value === null || Array.isArray(value) || (typeof value === "object" && !Array.isArray(value))
    );
    const normalizedPositions = Array.isArray(storedPosition)
      ? storedPosition
      : storedPosition && typeof storedPosition === "object"
        ? [storedPosition]
        : [];
    const latestStoredPosition = [...normalizedPositions]
      .sort((a, b) => Number(b?.openedAt || 0) - Number(a?.openedAt || 0))[0];
    if (latestStoredPosition?.asset) {
      return buildSimulationAssetFromPosition(latestStoredPosition);
    }

    const storedGuidedDraft = readSimulationStorage(
      SIMULATION_STORAGE_KEYS.guidedDraft,
      null,
      (value) => value === null || (typeof value === "object" && !Array.isArray(value))
    );
    if (storedGuidedDraft?.asset) {
      return buildMarketAsset({
        symbol: storedGuidedDraft.asset,
        description: storedGuidedDraft.label || storedGuidedDraft.asset,
        tvSymbol: storedGuidedDraft.tvSymbol,
      });
    }

    return buildMarketAsset("BTC");
  });
  const [simulationMode, setSimulationMode] = useState("live");
  const [scenarioTapHintDismissed, setScenarioTapHintDismissed] = useState(false);
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
  const [simulationSetupType, setSimulationSetupType] = useState("");
  const [simulationAmount, setSimulationAmount] = useState("");
  const [simulationAmountMode, setSimulationAmountMode] = useState("dollars");
  const [simulationLeverage, setSimulationLeverage] = useState("1x");
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
  const [simulationScenarioBarsByAsset, setSimulationScenarioBarsByAsset] = useState({});
  const [simulationScenarioAnchors, setSimulationScenarioAnchors] = useState({});
  const [simulationScenarioTick, setSimulationScenarioTick] = useState(0);
  const simulationScenarioBarTimeAnchorRef = useRef({});
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
  const [selectedSimulationPositionId, setSelectedSimulationPositionId] = useState(() => {
    const stored = readSimulationStorage(
      SIMULATION_STORAGE_KEYS.openPosition,
      [],
      (value) => value === null || Array.isArray(value) || (typeof value === "object" && !Array.isArray(value))
    );
    const normalized = Array.isArray(stored)
      ? stored
      : stored && typeof stored === "object"
        ? [stored]
        : [];
    const latest = [...normalized].sort((a, b) => Number(b?.openedAt || 0) - Number(a?.openedAt || 0))[0];
    return latest?.id || null;
  });
  const [simulationPendingScenarioDecision, setSimulationPendingScenarioDecision] = useState(null);
  const [simulationPendingLiveDecision, setSimulationPendingLiveDecision] = useState(null);
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
  const raylaPicksContext = useMemo(
    () => buildRaylaPicksContext({ trades, simulationTradeHistory }),
    [trades, simulationTradeHistory]
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
  const chartTapCooldownRef = useRef(0);
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
  const askRaylaHasMessages = raylaChatMessages.length > 0;
  const raylaAdaptiveOnboardingStep = raylaAdaptiveState.onboardingCompleted
    ? -1
    : RAYLA_ADAPTIVE_ONBOARDING_QUESTIONS.findIndex((question) => !raylaAdaptiveState.onboardingAnswers?.[question.key]);
  const activeRaylaAdaptiveQuestion = raylaAdaptiveOnboardingStep >= 0
    ? RAYLA_ADAPTIVE_ONBOARDING_QUESTIONS[raylaAdaptiveOnboardingStep]
    : null;
  const raylaAdaptiveProfile = useMemo(() => buildRaylaAdaptiveProfile({
    adaptiveState: raylaAdaptiveState,
    currentQuestion: aiInput,
    trades,
    simulationTradeHistory,
    selectedMarketId,
  }), [raylaAdaptiveState, aiInput, trades, simulationTradeHistory, selectedMarketId]);
  const simulationSymbolsKey = [...new Set(simulationTrackedAssets.map((item) => item.id))].sort().join("|");
  const hasActiveLiveSimulationTrade = simulationPositions.some((position) => (position.marketMode || "live") === "live");
  const [raylaUserCount, setRaylaUserCount] = useState(0);
  const [toast, setToast] = useState(null);
  const askRaylaThreadRef = useRef(null);
  const chartExplainPopupThreadRef = useRef(null);
  const chartExplainPopupWindowRef = useRef(null);
  const chartExplainPopupDragStateRef = useRef(null);
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

  const normalizedBrokerTrades = useMemo(
    () => buildNormalizedBrokerTrades(brokerTradeLog),
    [brokerTradeLog]
  );

  const combinedTrades = useMemo(() => {
    const normalizedManualTrades = (trades || []).map((trade) => ({
      ...trade,
      source: trade.source || "manual",
      source_label: trade.source_label || "Manual Trade",
      isBrokerTrade: false,
    }));

    return [...normalizedManualTrades, ...normalizedBrokerTrades].sort((a, b) => {
      const aTime = parseTradeTimeMs(a) || 0;
      const bTime = parseTradeTimeMs(b) || 0;
      return bTime - aTime;
    });
  }, [trades, normalizedBrokerTrades]);

  const usableClosedTradesForEquity = useMemo(() => {
    return [...combinedTrades]
      .map((trade, originalIndex) => {
        const timeMs = parseTradeTimeMs(trade);
        const entryTimeMs = parseTradeEntryTimeMs(trade);
        const pnl = calculateTradeDollarPnl(trade);
        if (!Number.isFinite(timeMs) || !Number.isFinite(pnl)) return null;
        return {
          trade,
          timeMs,
          entryTimeMs,
          pnl,
          originalIndex,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
        const safeEntryA = Number.isFinite(a.entryTimeMs) ? a.entryTimeMs : a.timeMs;
        const safeEntryB = Number.isFinite(b.entryTimeMs) ? b.entryTimeMs : b.timeMs;
        if (safeEntryA !== safeEntryB) return safeEntryA - safeEntryB;
        return a.originalIndex - b.originalIndex;
      });
  }, [combinedTrades]);

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
        syncSharedQuoteCaches(data.quotes || {});
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
    const nextBarsByAsset = {};
    const nextBarTimeAnchors = {};
    const contextStepDurationMs = getSimulationTimeframeConfig(simulationChartTimeframe).ms;

    simulationTrackedAssets.forEach((asset, assetIndex) => {
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
      const contextEndTimeMs = Date.now();
      const contextBars = buildScenarioContextBars({
        anchorPrice: basePrice,
        stepDurationMs: contextStepDurationMs,
        scenarioType: simulationScenarioType,
        barCount: SCENARIO_CHART_VISIBLE_BAR_COUNT,
        seedBase: ((assetIndex + 1) * 10_000) + asset.id.length,
        endTimeMs: contextEndTimeMs,
      });
      nextBarsByAsset[asset.id] = contextBars;
      if (contextBars.length) {
        nextBarTimeAnchors[asset.id] = Date.parse(String(contextBars[0].time));
      }
    });

    setSimulationScenarioAnchors(nextAnchors);
    setSimulationScenarioQuotes(nextQuotes);
    setSimulationScenarioSeries(nextSeries);
    setSimulationScenarioBarsByAsset(nextBarsByAsset);
    simulationScenarioBarTimeAnchorRef.current = nextBarTimeAnchors;
    setSimulationScenarioTick(0);
    scenarioPlaybackStartedAtRef.current = null;
    scenarioPlaybackElapsedMsRef.current = 0;
    setSimulationScenarioIsPlaying(false);
    setSimulationPendingScenarioDecision(null);
    setGuidedScenarioActive(false);
    setGuidedScenarioMessage("");
    setGuidedScenarioMessageStep(0);
  }, [simulationMode, simulationScenarioType, simulationSymbolsKey, simulationChartTimeframe]);

  useEffect(() => {
    setScenarioTapHintDismissed(false);
  }, [simulationAsset?.id]);

  function resetScenarioPlayback() {
    if (!simulationTrackedAssets.length) return;
    const scenarioPositionIds = new Set(
      simulationPositions
        .filter((position) => (position.marketMode || "live") === "scenario")
        .map((position) => position.id)
    );

    const nextAnchors = {};
    const nextQuotes = {};
    const nextSeries = {};
    const nextBarsByAsset = {};
    const nextBarTimeAnchors = {};
    const contextStepDurationMs = getSimulationTimeframeConfig(simulationChartTimeframe).ms;

    simulationTrackedAssets.forEach((asset, assetIndex) => {
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
      const contextEndTimeMs = Date.now();
      const contextBars = buildScenarioContextBars({
        anchorPrice: basePrice,
        stepDurationMs: contextStepDurationMs,
        scenarioType: simulationScenarioType,
        barCount: SCENARIO_CHART_VISIBLE_BAR_COUNT,
        seedBase: ((assetIndex + 1) * 10_000) + asset.id.length,
        endTimeMs: contextEndTimeMs,
      });
      nextBarsByAsset[asset.id] = contextBars;
      if (contextBars.length) {
        nextBarTimeAnchors[asset.id] = Date.parse(String(contextBars[0].time));
      }
    });

    setSimulationScenarioAnchors(nextAnchors);
    setSimulationScenarioQuotes(nextQuotes);
    setSimulationScenarioSeries(nextSeries);
    setSimulationScenarioBarsByAsset(nextBarsByAsset);
    simulationScenarioBarTimeAnchorRef.current = nextBarTimeAnchors;
    setSimulationScenarioTick(0);
    pendingScenarioCompletionRef.current = null;
    scenarioPlaybackStartedAtRef.current = null;
    scenarioPlaybackElapsedMsRef.current = 0;
    setSimulationScenarioIsPlaying(false);
    setSimulationPositions((prev) => prev.filter((position) => (position.marketMode || "live") !== "scenario"));
    setSimulationPendingScenarioDecision(null);
    setSimulationClosedTrade((prev) => prev?.marketMode === "scenario" ? null : prev);
    setSimulationRaylaGuidanceStateByTrade((prev) => {
      if (!scenarioPositionIds.size) return prev;
      const next = { ...prev };
      scenarioPositionIds.forEach((positionId) => {
        delete next[positionId];
      });
      return next;
    });
    setSimulationRaylaPromptTradeId((prev) => (prev && scenarioPositionIds.has(prev) ? null : prev));
    setGuidedScenarioActive(false);
    setGuidedScenarioMessage("");
    setGuidedScenarioMessageStep(0);
    setPendingGuidedScenarioLaunch(null);
    setSimulationScenarioDrawingMode("none");
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

  function pauseLiveSimulation() {
    const nextSnapshot = {};
    simulationTrackedAssets.forEach((asset) => {
      const normalizedAssetId = normalizeAssetId(asset.id, asset.type, asset.tvSymbol);
      const livePrice = getLiveQuoteByAssetId(simulationQuotes, normalizedAssetId, asset.type, asset.tvSymbol)?.price;
      const fallbackPrice = marketItems.find((item) => normalizeAssetId(item.id, item.type, item.tvSymbol) === normalizedAssetId)?.priceValue;
      const snapshotPrice = Number.isFinite(livePrice)
        ? Number(livePrice)
        : Number.isFinite(fallbackPrice)
          ? Number(fallbackPrice)
          : null;
      if (Number.isFinite(snapshotPrice)) {
        nextSnapshot[asset.id] = { price: snapshotPrice };
        nextSnapshot[normalizedAssetId] = { price: snapshotPrice };
      }
    });
    setSimulationLivePauseSnapshot(nextSnapshot);
    setSimulationLivePaused(true);
  }

  function resumeLiveSimulation() {
    setSimulationLivePaused(false);
    setSimulationLivePauseSnapshot({});
  }

  const scenarioIntervalMs = simulationScenarioNoLimit
    ? getScenarioSpeedInterval(simulationScenarioSpeed)
    : 1000;
  const simulationChartTimeframeConfig = getSimulationTimeframeConfig(simulationChartTimeframe);
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
    const appendedScenarioPointsByAsset = {};

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
          appendedScenarioPointsByAsset[asset.id] = [nextPrice];
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
        appendedScenarioPointsByAsset[asset.id] = bridge.points;
      });
      return nextSeries;
    });

    setSimulationScenarioBarsByAsset((prevBarsByAsset) => {
      const nextBarsByAsset = { ...prevBarsByAsset };
      const stepDurationMs = simulationChartTimeframeConfig.ms;

      simulationTrackedAssets.forEach((asset, assetIndex) => {
        const appendedPrices = appendedScenarioPointsByAsset[asset.id] || [];
        if (!appendedPrices.length) return;

        const existingBars = prevBarsByAsset[asset.id] || [];
        const anchorPrice = simulationScenarioAnchors[asset.id]
          ?? simulationScenarioQuotes[asset.id]?.price
          ?? simulationQuotes[asset.id]?.price
          ?? 100;
        const baseTimeMs = simulationScenarioBarTimeAnchorRef.current[asset.id] ?? Date.now();
        simulationScenarioBarTimeAnchorRef.current[asset.id] = baseTimeMs;

        let previousClose = Number(existingBars[existingBars.length - 1]?.close);
        if (!Number.isFinite(previousClose)) {
          previousClose = Number(simulationScenarioSeries[asset.id]?.[0] ?? anchorPrice);
        }

        const newBars = [];
        appendedPrices.forEach((nextPrice, pointIndex) => {
          const barIndex = existingBars.length + newBars.length;
          const nextBar = buildScenarioBarFromStep({
            previousClose,
            nextClose: nextPrice,
            timeMs: baseTimeMs + (barIndex * stepDurationMs),
            seed: ((assetIndex + 1) * 100000) + nextTick + pointIndex + barIndex,
          });
          if (nextBar) {
            newBars.push(nextBar);
            previousClose = nextBar.close;
          }
        });

        if (newBars.length) {
          nextBarsByAsset[asset.id] = [...existingBars, ...newBars];
        }
      });

      return nextBarsByAsset;
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

  }, [simulationMode, simulationScenarioType, simulationScenarioSpeed, simulationScenarioPlaybackDuration, simulationChartTimeframe, simulationSymbolsKey, simulationTrackedAssets, simulationScenarioAnchors, simulationScenarioQuotes, simulationScenarioSeries, simulationPositions, simulationScenarioIsPlaying, simulationScenarioNoLimit, scenarioDurationPointCount, scenarioPlaybackDurationMs, scenarioPlaybackIntervalMs]);

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

  function getAlpacaOrderValidationState() {
    const symbol = String(alpacaOrderForm.symbol || "").trim().toUpperCase();
    const action = String(alpacaOrderForm.side || "buy");
    const payloadSide = getAlpacaOrderPayloadSide(action);
    const qty = Number(alpacaOrderForm.qty);
    const type = String(alpacaOrderForm.type || "market");
    const timeInForce = String(alpacaOrderForm.timeInForce || "gtc").toLowerCase();
    const limitPrice = type === "limit" || type === "stop_limit" ? Number(alpacaOrderForm.limitPrice) : null;
    const stopPrice = type === "stop" || type === "stop_limit" ? Number(alpacaOrderForm.stopPrice) : null;
    const matchingPosition = alpacaPositions.find((position) => position.symbol === symbol) || null;
    const selectedBrokerAsset = alpacaAssetSearchResults.find((asset) => asset.symbol === symbol)
      || (alpacaSelectedAssetMeta?.symbol === symbol ? alpacaSelectedAssetMeta : null)
      || (tradeSelectedBrokerAsset?.symbol === symbol ? tradeSelectedBrokerAsset : null);
    const sourceQuote = getKnownStockQuoteData(symbol, simulationQuotes, marketItems, alpacaAssetQuotes);
    const quoteIsFresh = Boolean(sourceQuote?.price) && isQuoteFresh(sourceQuote);
    const estimatedPrice = getOrderEstimatePrice(symbol, limitPrice, matchingPosition);
    const estimatedValue = Number.isFinite(estimatedPrice) && Number.isFinite(qty) ? estimatedPrice * qty : null;
    const accountMultiplier = Math.max(1, Number(alpacaAccount?.raw?.multiplier ?? 1) || 1);
    const selectedLeverage = getLeverageMultiplierValue(alpacaOrderForm.leverage);
    const assetIsMarginable = Boolean(selectedBrokerAsset?.marginable);
    const leverageAvailable = accountMultiplier > 1 && assetIsMarginable;
    const effectiveLeverage = leverageAvailable ? Math.min(selectedLeverage, accountMultiplier) : 1;
    const totalBuyingPower = Number(alpacaAccount?.buyingPower ?? 0);
    const baseBuyingPower = leverageAvailable && accountMultiplier > 0 ? totalBuyingPower / accountMultiplier : totalBuyingPower;
    const buyingPowerLimit = leverageAvailable
      ? Math.min(totalBuyingPower, baseBuyingPower * effectiveLeverage)
      : totalBuyingPower;
    const currentQty = Math.abs(Number(matchingPosition?.qty ?? 0));
    const hasShortPosition = matchingPosition?.side === "short" && currentQty > 0;
    const hasLongPosition = matchingPosition?.side === "long" && currentQty > 0;
    const requiresBuyingPowerCheck = action !== "sell";
    const orderValueExceedsBuyingPower = Number.isFinite(estimatedValue) && Number.isFinite(buyingPowerLimit) && buyingPowerLimit > 0
      ? estimatedValue > buyingPowerLimit + 0.0001
      : false;

    let error = "";

    if (!symbol) {
      error = "Symbol is required.";
    } else if (!Number.isFinite(qty) || qty <= 0) {
      error = "Quantity must be greater than 0.";
    } else if (!["market", "limit", "stop", "stop_limit"].includes(type)) {
      error = "Choose a valid order type.";
    } else if (!["gtc", "ioc", "fok"].includes(timeInForce)) {
      error = "Choose a valid time in force.";
    } else if (type === "limit" && (!Number.isFinite(limitPrice) || limitPrice <= 0)) {
      error = "Enter a valid limit price.";
    } else if (type === "stop" && (!Number.isFinite(stopPrice) || stopPrice <= 0)) {
      error = "Enter a valid stop price.";
    } else if (type === "stop_limit" && (!Number.isFinite(stopPrice) || stopPrice <= 0 || !Number.isFinite(limitPrice) || limitPrice <= 0)) {
      error = "Stop limit orders require both a stop price and a limit price.";
    } else if (selectedBrokerAsset && selectedBrokerAsset.tradable === false) {
      error = "Alpaca does not currently support trading this asset.";
    } else if (action === "short_sell" && !selectedBrokerAsset?.shortable) {
      error = "Shorting is not available for this Alpaca asset.";
    } else if (action === "short_sell" && hasLongPosition) {
      error = `Use Sell to reduce your current long ${symbol} position before opening a short.`;
    } else if (action === "buy_to_cover" && !hasShortPosition) {
      error = `You need an open short position in ${symbol} before using Buy to Cover.`;
    } else if (action === "sell" && !hasLongPosition) {
      error = `You need shares of ${symbol} before using Sell. Use Short Sell to open a short position.`;
    } else if (action === "buy_to_cover" && qty > currentQty) {
      error = `Buy to Cover cannot exceed your current short position of ${currentQty} share(s).`;
    } else if (action === "sell" && qty > currentQty) {
      error = `Sell cannot exceed your current long position of ${currentQty} share(s).`;
    } else if (!quoteIsFresh) {
      error = "Waiting for fresh Alpaca market data before placing order.";
    } else if (requiresBuyingPowerCheck && Number.isFinite(buyingPowerLimit) && buyingPowerLimit > 0 && orderValueExceedsBuyingPower) {
      error = `This order is larger than your available buying power at ${effectiveLeverage}x.`;
    } else if (requiresBuyingPowerCheck && Number.isFinite(totalBuyingPower) && totalBuyingPower <= 0) {
      error = "Buying power is unavailable right now.";
    }

    return {
      symbol,
      action,
      payloadSide,
      qty,
      type,
      timeInForce,
      limitPrice: Number.isFinite(limitPrice) ? limitPrice : null,
      stopPrice: Number.isFinite(stopPrice) ? stopPrice : null,
      matchingPosition,
      selectedBrokerAsset,
      sourceQuote,
      quoteIsFresh,
      estimatedPrice,
      estimatedValue,
      totalBuyingPower,
      buyingPowerLimit,
      leverageAvailable,
      effectiveLeverage,
      accountMultiplier,
      hasShortPosition,
      hasLongPosition,
      error,
    };
  }

  const alpacaOrderValidation = getAlpacaOrderValidationState();

  async function handleSubmitAlpacaOrder(e) {
    e.preventDefault();

    const validation = getAlpacaOrderValidationState();
    const {
      symbol,
      action,
      payloadSide,
      qty,
      type,
      timeInForce,
      limitPrice,
      stopPrice,
      matchingPosition,
      estimatedPrice,
      estimatedValue,
      totalBuyingPower,
      effectiveLeverage,
      error,
    } = validation;

    if (error) {
      showToast(error, "warning");
      return;
    }

    const currentQty = Number(matchingPosition?.qty ?? 0);
    let insight = `This trade changes your ${symbol} exposure.`;

    if (matchingPosition) {
      if (action === "buy" || action === "buy_to_cover") {
        insight = matchingPosition.side === "short"
          ? `This trade may reduce or close your current ${symbol} position.`
          : `This trade increases your exposure to ${symbol}.`;
      } else {
        insight = qty >= currentQty && currentQty > 0
          ? `This may close your current ${symbol} position.`
          : `This trade reduces your exposure to ${symbol}.`;
      }
    } else if (action === "buy") {
      insight = `This trade increases your exposure to ${symbol}.`;
    } else {
      insight = `This trade may open a new ${symbol} short position.`;
    }

    setPendingAlpacaOrderConfirmation({
      symbol,
      action,
      side: payloadSide,
      qty,
      type,
      limitPrice: Number.isFinite(limitPrice) ? limitPrice : null,
      stopPrice: Number.isFinite(stopPrice) ? stopPrice : null,
      timeInForce,
      leverage: `${effectiveLeverage}x`,
      estimatedPrice,
      estimatedValue,
      insight,
      realityCheck: buildOrderRealityCheck({
        symbol,
        side: payloadSide,
        qty,
        estimatedValue,
        buyingPower: totalBuyingPower,
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
        time_in_force: pendingAlpacaOrderConfirmation.timeInForce,
        ...(pendingAlpacaOrderConfirmation.type === "limit" || pendingAlpacaOrderConfirmation.type === "stop_limit"
          ? { limit_price: pendingAlpacaOrderConfirmation.limitPrice }
          : {}),
        ...(pendingAlpacaOrderConfirmation.type === "stop" || pendingAlpacaOrderConfirmation.type === "stop_limit"
          ? { stop_price: pendingAlpacaOrderConfirmation.stopPrice }
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
        syncSharedQuoteCaches(data.quotes || {}, { includeAlpacaQuotes: true });
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
    if ((activeTab !== "trades" && activeTab !== "ai") || tradeIsComparisonMode || !alpacaAccount || !tradeChartSymbol || !tradeChartAsset || tradeChartAssetExplicitlyUnsupported) {
      if (DEBUG_CHARTS) {
        console.log("TRADING CHART FETCH RESET", {
          selectedChartSymbol: tradeChartSymbol || null,
          selectedChartType: tradeChartAssetType,
          chartRange: tradeChartRange,
          loading: false,
          errorState: tradeIsComparisonMode ? "comparison_mode" : "inactive_or_missing_dependencies",
        });
      }
      setTradeMarketChart(null);
      setTradeMarketChartLoading(false);
      return;
    }

    let isCancelled = false;
    setTradeMarketChart(null);
    setTradeMarketChartLoading(true);
    if (DEBUG_CHARTS) {
      console.log("TRADING CHART FETCH START", {
        selectedChartSymbol: tradeChartSymbol,
        selectedChartType: tradeChartAssetType,
        chartRange: tradeChartRange,
        loading: true,
      });
    }

    async function fetchTradeMarketChart() {
      try {
        const { data, error } = await supabase.functions.invoke("market-data", {
          body: {
            chartSymbol: tradeChartSymbol,
            chartType: tradeChartAssetType,
            chartRange: tradeChartSelection.fetchRange,
            chartTimeframe: tradeChartSelection.provider || null,
          },
        });

        if (isCancelled) return;
        if (error || !data?.ok) {
          if (DEBUG_CHARTS) {
            console.log("TRADING CHART FETCH ERROR", {
              selectedChartSymbol: tradeChartSymbol,
              selectedChartType: tradeChartAssetType,
              chartRange: tradeChartRange,
              loading: false,
              errorState: error?.message || data?.error || "market_data_error",
            });
          }
          return;
        }

        const nextChart = data.chart || null;
        const nextSeries = extractChartCloseSeries(nextChart);
        const nextBars = extractChartBars(nextChart);
        if (DEBUG_CHARTS) {
          const firstBarTime = nextBars[0]?.time || nextBars[0]?.t || null;
          const lastBarTime = nextBars[nextBars.length - 1]?.time || nextBars[nextBars.length - 1]?.t || null;
          console.log("TRADING CHART FETCH RESULT", {
            selectedChartSymbol: tradeChartSymbol,
            selectedChartType: tradeChartAssetType,
            chartRange: tradeChartRange,
            loading: false,
            barsCount: nextBars.length,
            seriesCount: nextSeries.length,
            firstBar: firstBarTime,
            lastBar: lastBarTime,
            errorState: null,
          });
        }
        if (nextChart && nextSeries.length >= 2) {
          syncQuoteFromChart(tradeChartAsset, nextChart, { includeAlpacaQuotes: true });
          setTradeMarketChart({
            ...nextChart,
            symbol: nextChart.symbol || tradeChartSymbol,
          });
          setTradeChartLastUpdated(new Date());
          return;
        }

        setTradeMarketChart({
          symbol: tradeChartSymbol,
          range: tradeChartSelection.fetchRange,
          bars: [],
          rangeMode: nextChart?.rangeMode || null,
        });
      } catch {
        if (DEBUG_CHARTS) {
          console.log("TRADING CHART FETCH EXCEPTION", {
            selectedChartSymbol: tradeChartSymbol,
            selectedChartType: tradeChartAssetType,
            chartRange: tradeChartRange,
            loading: false,
            errorState: "exception",
          });
        }
        // Keep the last valid real chart for this symbol if we already have one.
      } finally {
        if (!isCancelled) {
          setTradeMarketChartLoading(false);
          if (DEBUG_CHARTS) {
            console.log("TRADING CHART LOADING END", {
              selectedChartSymbol: tradeChartSymbol,
              selectedChartType: tradeChartAssetType,
              chartRange: tradeChartRange,
              loading: false,
            });
          }
        }
      }
    }

    fetchTradeMarketChart();

    return () => {
      isCancelled = true;
    };
  }, [activeTab, tradeIsComparisonMode, alpacaAccount, tradeChartSymbol, tradeChartAssetType, tradeChartRange, tradeChartRefreshTick, tradeChartAssetExplicitlyUnsupported]);

  useEffect(() => {
    if ((activeTab !== "trades" && activeTab !== "ai") || (!tradeChartSelection.provider && tradeChartSelection.fetchRange !== "1D")) return;
    const isCryptoTradeAsset = tradeChartAssetType === "crypto";
    const interval = setInterval(
      () => setTradeChartRefreshTick((prev) => prev + 1),
      (isCryptoTradeAsset || isMarketCurrentlyOpen()) ? 10000 : 30000
    );
    return () => clearInterval(interval);
  }, [activeTab, tradeChartRange, tradeChartAssetType]);

  useEffect(() => {
    const symbols = alpacaPositions.map((position) => position.symbol).filter(Boolean);
    if (!symbols.length) {
      setTradePendingSelection({ mode: "asset", symbols: [] });
      setTradeAppliedSelection({ mode: "asset", symbols: [] });
      setPerformanceLiveAppliedSelection({ includePortfolio: true, symbols: [] });
      return;
    }
    setTradePendingSelection((prev) => {
      if (prev.mode === "portfolio") return { mode: "portfolio", symbols };
      const valid = prev.symbols.filter((symbol) => symbols.includes(symbol));
      return valid.length ? { mode: valid.length === 1 ? "asset" : "multi", symbols: valid } : { mode: "asset", symbols: [symbols[0]] };
    });
    setTradeAppliedSelection((prev) => {
      if (prev.mode === "portfolio") return { mode: "portfolio", symbols };
      const valid = prev.symbols.filter((symbol) => symbols.includes(symbol));
      return valid.length ? { mode: valid.length === 1 ? "asset" : "multi", symbols: valid } : { mode: "asset", symbols: [symbols[0]] };
    });
    setPerformanceLiveAppliedSelection((prev) => normalizePerformanceLiveSelection(prev));
  }, [alpacaPositions]);

  useEffect(() => {
    setTradePortfolioSelectedSymbols((prev) => {
      const valid = prev.filter((symbol) => tradePortfolioAllSymbols.includes(symbol));
      return valid.length ? valid : tradePortfolioAllSymbols;
    });
  }, [tradePortfolioAllSymbols]);

  useEffect(() => {
    const normalizedPending = normalizeTradeSelection(tradePendingSelection);
    if (buildTradeSelectionKey(normalizedPending) !== buildTradeSelectionKey(tradePendingSelection)) {
      setTradePendingSelection(normalizedPending);
    }

    const normalizedApplied = normalizeTradeSelection(tradeAppliedSelection);
    if (buildTradeSelectionKey(normalizedApplied) !== buildTradeSelectionKey(tradeAppliedSelection)) {
      setTradeAppliedSelection(normalizedApplied);
    }
  }, [tradeAppliedSelection, tradePendingSelection, tradePortfolioAllSymbols]);

  useEffect(() => {
    if (tradeAppliedSelection.mode === "portfolio") {
      setTradeViewMode("portfolio");
      setTradeChartMode("line");
      setTradePortfolioChartView("portfolio");
      setTradePortfolioSelectedSymbols(tradePortfolioAllSymbols);
      return;
    }
    if (tradeAppliedSelection.mode === "asset") {
      setTradeViewMode("asset");
      const selectedSymbol = tradeAppliedSelection.symbols[0];
      if (selectedSymbol) {
        setAlpacaOrderForm((prev) => ({ ...prev, symbol: selectedSymbol }));
      }
    }
  }, [tradeAppliedSelection, tradePortfolioAllSymbols]);

  useEffect(() => {
    if ((activeTab !== "trades" && activeTab !== "ai") || !alpacaAccount || activeTradeChartSelection.mode !== "portfolio" || !tradePortfolioDisplayedSymbols.length) {
      setTradePortfolioCharts({});
      setTradePortfolioChartsLoading(false);
      return;
    }

    let isCancelled = false;
    setTradePortfolioChartsLoading(true);

    async function fetchTradePortfolioCharts() {
      try {
        const chartResults = await Promise.all(
          tradePortfolioDisplayedSymbols.map(async (symbol) => {
            const position = alpacaPositions.find((item) => item.symbol === symbol) || null;
            const assetType = position?.assetClass === "crypto" ? "crypto" : "stock";
            const entryResolution = resolveTradePortfolioEntryTime(position, brokerTradeLog, trades);
            const { data, error } = await supabase.functions.invoke("market-data", {
              body: {
                chartSymbol: symbol,
                chartType: assetType,
                chartRange: tradeChartSelection.fetchRange,
                chartTimeframe: tradeChartSelection.provider || null,
              },
            });
            return {
              symbol,
              assetType,
              entryTimeMs: entryResolution.timeMs,
              entryTimeSource: entryResolution.source,
              data,
              error,
            };
          })
        );

        if (isCancelled) return;

        const nextCharts = {};
        chartResults.forEach(({ symbol, assetType, entryTimeMs, entryTimeSource, data, error }) => {
          const nextChart = error || !data?.ok ? null : data.chart || null;
          const bars = extractChartBars(nextChart);
          nextCharts[symbol] = {
            symbol,
            assetType,
            entryTimeMs,
            entryTimeSource,
            bars,
            rangeMode: nextChart?.rangeMode || null,
            error: error?.message || data?.error || null,
          };
          if (DEBUG_CHARTS) {
            console.log("TRADING PORTFOLIO CHART DATA", {
              selectedPortfolioAssets: tradePortfolioDisplayedSymbols,
              portfolioRange: tradeChartRange,
              symbol,
              entryOpenTimestamp: entryTimeMs ? new Date(entryTimeMs).toISOString() : null,
              entryOpenSource: entryTimeSource,
              selectedRangeStart: tradePortfolioRequestedStartMs ? new Date(tradePortfolioRequestedStartMs).toISOString() : null,
              chartPointCount: bars.length,
              firstBar: bars[0]?.time || bars[0]?.t || null,
              lastBar: bars[bars.length - 1]?.time || bars[bars.length - 1]?.t || null,
              errorState: error?.message || data?.error || null,
              combinedSelectedPortfolioPl: tradePortfolioCombinedUnrealizedPl,
            });
          }
        });

        setTradePortfolioCharts(nextCharts);
      } catch (error) {
        if (!isCancelled) {
          setTradePortfolioCharts({});
          if (DEBUG_CHARTS) {
            console.log("TRADING PORTFOLIO CHART FETCH ERROR", {
              selectedPortfolioAssets: tradePortfolioDisplayedSymbols,
              portfolioRange: tradeChartRange,
              errorState: error?.message || "portfolio_fetch_exception",
              combinedSelectedPortfolioPl: tradePortfolioCombinedUnrealizedPl,
            });
          }
        }
      } finally {
        if (!isCancelled) setTradePortfolioChartsLoading(false);
      }
    }

    fetchTradePortfolioCharts();

    return () => {
      isCancelled = true;
    };
  }, [activeTab, activeTradeChartSelection.mode, alpacaAccount, tradePortfolioDisplayedSymbols, alpacaPositions, brokerTradeLog, trades, tradeChartRange, tradeChartRefreshTick, tradePortfolioCombinedUnrealizedPl]);

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
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error || `daily-intel failed with status ${response.status}`);
        }
        return data;
      })
      .then(data => {
        const report = { stockHot: data.stockHot || [], stockCold: data.stockCold || [], cryptoHot: data.cryptoHot || null, cryptoCold: data.cryptoCold || null };
        if (!isPopulatedIntelReport(report)) {
          throw new Error("daily-intel returned an empty report");
        }
        sessionStorage.setItem("rayla-intel-report", JSON.stringify(report));
        setHotColdReport(report);
        setIntelLoading(false);
      })
      .catch((error) => {
        console.error("daily-intel fetch failed", {
          url: DAILY_INTEL_URL,
          error: error instanceof Error ? error.message : error,
        });
        sessionStorage.removeItem("rayla-intel-report");
        setHotColdReport({ stockHot: [], stockCold: [], cryptoHot: null, cryptoCold: null });
        setIntelLoading(false);
      });
  }, []);

  useEffect(() => {
    const intelItems = [
      ...(hotColdReport?.stockHot || []),
      ...(hotColdReport?.stockCold || []),
      hotColdReport?.cryptoHot,
      hotColdReport?.cryptoCold,
    ].filter(Boolean);

    if (!intelItems.length) {
      setIntelLiveQuotes({});
      return;
    }

    const uniqueSymbols = [];
    const seen = new Set();
    intelItems.forEach((item) => {
      const symbol = String(item?.symbol || "").trim().toUpperCase();
      if (!symbol || seen.has(symbol)) return;
      seen.add(symbol);
      uniqueSymbols.push({
        symbol,
        type: CRYPTO_SYMBOL_SET.has(symbol) ? "crypto" : "stock",
      });
    });

    let isCancelled = false;

    async function fetchIntelQuotes() {
      try {
        const { data, error } = await supabase.functions.invoke("market-data", {
          body: { symbols: uniqueSymbols },
        });
        if (isCancelled || error || !data?.ok) return;
        const nextQuotes = {};
        Object.entries(data.quotes || {}).forEach(([symbol, quote]) => {
          if (quote?.price != null) nextQuotes[symbol] = quote;
        });
        if (!isCancelled) setIntelLiveQuotes(nextQuotes);
      } catch {
        // Keep Intel usable even if live quote refresh fails.
      }
    }

    fetchIntelQuotes();

    return () => {
      isCancelled = true;
    };
  }, [hotColdReport]);

useEffect(() => {
  if (user) setDisplayName(user.user_metadata?.display_name || user.email?.split("@")[0] || "");
}, [user]);

  useEffect(() => {
    if (!askRaylaHasMessages || !askRaylaThreadRef.current) return;
    askRaylaThreadRef.current.scrollTop = askRaylaThreadRef.current.scrollHeight;
  }, [askRaylaHasMessages, raylaChatMessages, capitalGuideResult, activeCapitalGuideQuestion]);

  const homeMarketSelectedItem = homeMarketActiveAsset || marketItems.find(item => item.id === selectedMarketId) || marketItems[0] || null;
  const homeMarketAssetExplicitlyUnsupported = homeMarketSelectedItem?.alpacaSupported === false || homeMarketSelectedItem?.tradable === false;
  const homeMarketSelectedDisplayPrice = homeMarketSelectedItem
    ? (getLiveQuoteByAssetId(homeMarketQuotes, homeMarketSelectedItem.id, homeMarketSelectedItem.type, homeMarketSelectedItem.tvSymbol)?.price ?? homeMarketSelectedItem.priceValue ?? null)
    : null;
  const homeSymbolsKey = marketItems.map(item => item.id).sort().join("|");
  const homeMarketChartSelection = getHomeChartSelectionConfig(homeMarketChartRange);
  const homeMarketChartMatchesSelection = Boolean(
    homeMarketChart
    && homeMarketSelectedItem
    && homeMarketChart.symbol === homeMarketSelectedItem.id
    && homeMarketChart.selectionValue === homeMarketChartRange
  );
  const homeMarketVisibleBars = useMemo(
    () => (homeMarketChartMatchesSelection
      ? extractVisibleHomeChartBars(homeMarketChart, homeMarketChartRange, homeMarketChartViewPreset)
      : []),
    [homeMarketChart, homeMarketChartRange, homeMarketChartMatchesSelection, homeMarketChartViewPreset]
  );
  useEffect(() => {
    if (!marketItems.length) return;
    async function fetchHomeQuotes() {
      try {
        const { data, error } = await supabase.functions.invoke("market-data", {
          body: { symbols: marketItems.map(item => ({ symbol: item.id, type: item.type || "stock" })) },
        });
        if (error || !data?.ok) return;
        syncSharedQuoteCaches(data.quotes || {});
      } catch {}
    }
    fetchHomeQuotes();
    const interval = setInterval(fetchHomeQuotes, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeSymbolsKey]);

  useEffect(() => {
    if (!homeMarketSelectedItem) {
      setHomeMarketChart(null);
      setHomeMarketChartLoading(false);
      return;
    }
    if (homeMarketAssetExplicitlyUnsupported) {
      setHomeMarketChart(null);
      setHomeMarketChartLoading(false);
      return;
    }
    let isCancelled = false;
    setHomeMarketChartLoading(true);
    async function fetchHomeChart() {
      try {
        const { data, error } = await supabase.functions.invoke("market-data", {
          body: {
            chartSymbol: homeMarketSelectedItem.id,
            chartType: homeMarketSelectedItem.type || "stock",
            chartRange: homeMarketChartSelection.fetchRange,
            chartTimeframe: homeMarketChartSelection.provider || null,
          },
        });
        if (isCancelled || error || !data?.ok) return;
        const nextChart = data.chart || null;
        const nextBars = extractChartBars(nextChart);
        if (nextChart && nextBars.length >= 2) {
          syncQuoteFromChart(homeMarketSelectedItem, nextChart);
          setHomeMarketChart({
            ...nextChart,
            symbol: nextChart.symbol || homeMarketSelectedItem.id,
            selectionValue: homeMarketChartRange,
          });
          setHomeMarketChartLastUpdated(new Date());
          return;
        }
        setHomeMarketChart({
          symbol: homeMarketSelectedItem.id,
          range: homeMarketChartSelection.fetchRange,
          selectionValue: homeMarketChartRange,
          bars: [],
          rangeMode: nextChart?.rangeMode || null,
        });
      } catch {}
      finally { if (!isCancelled) setHomeMarketChartLoading(false); }
    }
    fetchHomeChart();
    const isCryptoHomeAsset = (homeMarketSelectedItem.type || "stock") === "crypto";
    const interval = (homeMarketChartSelection.provider || homeMarketChartSelection.fetchRange === "1D")
      ? setInterval(fetchHomeChart, (isCryptoHomeAsset || isMarketCurrentlyOpen()) ? 10000 : 30000)
      : null;
    return () => { isCancelled = true; if (interval) clearInterval(interval); };
  }, [homeMarketSelectedItem?.id, homeMarketSelectedItem?.type, homeMarketChartRange, homeMarketAssetExplicitlyUnsupported]);

  useEffect(() => {
    if (!chartExplainPopupOpen || !chartExplainPopupThreadRef.current) return;
    chartExplainPopupThreadRef.current.scrollTop = chartExplainPopupThreadRef.current.scrollHeight;
  }, [chartExplainPopupOpen, chartExplainPopupMessages]);

  useEffect(() => {
    function handleResize() {
      setChartExplainPopupIsMobile(window.innerWidth < 768);
      setIsMobileView(window.innerWidth <= 600);
      if (!chartExplainPopupWindowRef.current) return;
      const rect = chartExplainPopupWindowRef.current.getBoundingClientRect();
      const maxX = Math.max(12, window.innerWidth - rect.width - 12);
      const maxY = Math.max(12, window.innerHeight - rect.height - 12);
      setChartExplainPopupPosition((prev) => ({
        x: Math.min(Math.max(12, prev.x), maxX),
        y: Math.min(Math.max(12, prev.y), maxY),
      }));
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!chartExplainPopupOpen || chartExplainPopupIsMobile || !chartExplainPopupWindowRef.current) return;
    const rect = chartExplainPopupWindowRef.current.getBoundingClientRect();
    const maxX = Math.max(12, window.innerWidth - rect.width - 12);
    const maxY = Math.max(12, window.innerHeight - rect.height - 12);
    setChartExplainPopupPosition((prev) => ({
      x: Math.min(Math.max(12, prev.x), maxX),
      y: Math.min(Math.max(12, prev.y), maxY),
    }));
  }, [chartExplainPopupOpen, chartExplainPopupIsMobile]);

  useEffect(() => {
    function handlePointerMove(event) {
      const dragState = chartExplainPopupDragStateRef.current;
      if (!dragState || chartExplainPopupIsMobile || !chartExplainPopupWindowRef.current) return;
      const rect = chartExplainPopupWindowRef.current.getBoundingClientRect();
      const nextX = event.clientX - dragState.offsetX;
      const nextY = event.clientY - dragState.offsetY;
      const maxX = Math.max(12, window.innerWidth - rect.width - 12);
      const maxY = Math.max(12, window.innerHeight - rect.height - 12);
      setChartExplainPopupPosition({
        x: Math.min(Math.max(12, nextX), maxX),
        y: Math.min(Math.max(12, nextY), maxY),
      });
    }

    function handlePointerUp() {
      chartExplainPopupDragStateRef.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [chartExplainPopupIsMobile]);



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
      setEquitySourceLabel("Built from manual and broker-imported trades with enough execution detail.");
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

  const perfReport = useMemo(() => buildCoachReport(trades), [trades]);

  const equityPoints = useMemo(
    () => buildLoggedEquityCurvePoints(combinedTrades),
    [combinedTrades]
  );
  const filteredEquityPoints = useMemo(
    () => filterEquityCurvePointsByRange(equityPoints, chartRange),
    [equityPoints, chartRange]
  );
  const normalizedBenchmarkPoints = useMemo(
    () => normalizeBenchmarkSeries(equityBenchmarkChart, filteredEquityPoints[0]?.equity || 10000),
    [equityBenchmarkChart, filteredEquityPoints]
  );
  const equityBenchmarkVisibleStart = filteredEquityPoints[0]?.timeMs || 0;
  const equityBenchmarkVisibleEnd = filteredEquityPoints[filteredEquityPoints.length - 1]?.timeMs || equityBenchmarkVisibleStart;
  const equityBenchmarkOptions = useMemo(() => {
    const tradedSymbols = [];
    const seen = new Set();

    seen.add("PORTFOLIO");

    combinedTrades.forEach((trade) => {
      const symbol = String(trade?.asset || "").trim().toUpperCase();
      if (!symbol || seen.has(symbol)) return;
      seen.add(symbol);
      tradedSymbols.push({
        symbol,
        type: CRYPTO_SYMBOL_SET.has(symbol) ? "crypto" : "stock",
        label: CRYPTO_SYMBOL_SET.has(symbol) ? "Crypto" : "Equity",
        group: "Your traded symbols",
      });
    });

    const defaultOptions = Object.values(EQUITY_BENCHMARKS)
      .filter((option) => !seen.has(option.symbol))
      .map((option) => ({
        symbol: option.symbol,
        type: option.type,
        label: option.type === "crypto" ? "Crypto" : "Benchmark",
        group: "Common benchmarks",
      }));

    return [
      {
        symbol: "Portfolio",
        type: "portfolio",
        label: "Portfolio Benchmark",
        group: "Your benchmarks",
      },
      ...tradedSymbols,
      ...defaultOptions,
    ];
  }, [combinedTrades]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const duplicateTimestampCount = Math.max(0, usableClosedTradesForEquity.length - new Set(usableClosedTradesForEquity.map((item) => item.timeMs)).size);
    const uniqueTimestampCount = new Set(usableClosedTradesForEquity.map((item) => item.timeMs)).size;
    const groupedTimestampCount = usableClosedTradesForEquity.reduce((acc, item, index, array) => {
      const previous = array[index - 1];
      if (!previous || previous.timeMs !== item.timeMs) return acc;
      return acc + 1;
    }, 0);
    const summarizeTrade = (item) => ({
      tradeId: item.trade?.id || null,
      timestamp: new Date(item.timeMs).toISOString(),
      timestampField: item.timestampField,
      source: item.trade?.source || (item.trade?.isBrokerTrade ? "broker" : "manual"),
      pnl: item.pnl,
      asset: item.trade?.asset || null,
    });
    console.log("RAYLA TRADE PIPELINE DEBUG", {
      manualTradesCount: trades.length,
      brokerTradesCount: normalizedBrokerTrades.length,
      combinedTradesCount: combinedTrades.length,
      usableClosedTradesCount: usableClosedTradesForEquity.length,
      selectedTimeframe: chartRange,
      sortedFirst5Trades: usableClosedTradesForEquity.slice(0, 5).map(summarizeTrade),
      sortedLast5Trades: usableClosedTradesForEquity.slice(-5).map(summarizeTrade),
      uniqueTimestampCount,
      duplicateTimestampCount,
      groupedTimestampCount,
      tradeSourcesPresent: [...new Set(combinedTrades.map((trade) => trade.source || "unknown"))],
      performanceInputTradesCount: combinedTrades.length,
      equityCurvePointCount: equityPoints.length,
      firstEquityPoint: equityPoints[0] || null,
      lastEquityPoint: equityPoints[equityPoints.length - 1] || null,
      benchmarkDataPointsCount: normalizedBenchmarkPoints.length,
      benchmarkFirstTimestamp: normalizedBenchmarkPoints[0]?.time || null,
      benchmarkLastTimestamp: normalizedBenchmarkPoints[normalizedBenchmarkPoints.length - 1]?.time || null,
    });
  }, [trades, normalizedBrokerTrades, combinedTrades, usableClosedTradesForEquity, chartRange, equityPoints, normalizedBenchmarkPoints]);

  useEffect(() => {
    if (!import.meta.env.DEV || equityBenchmarkSymbol !== "Portfolio") return;
    console.log("Portfolio Benchmark Sample:", normalizedBenchmarkPoints.slice(0, 3));
  }, [equityBenchmarkSymbol, normalizedBenchmarkPoints]);

  useEffect(() => {
    if (filteredEquityPoints.length < 2) {
      setEquityBenchmarkChart(null);
      setEquityBenchmarkLoading(false);
      return;
    }

    const benchmarkConfig = equityBenchmarkOptions.find((option) => option.symbol === equityBenchmarkSymbol)
      || { symbol: equityBenchmarkSymbol, type: equityBenchmarkType }
      || EQUITY_BENCHMARKS[equityBenchmarkSymbol]
      || EQUITY_BENCHMARKS.SPY;
    const inferredRange = chartRange === "ALL"
      ? inferBenchmarkRangeFromEquityPoints(filteredEquityPoints)
      : chartRange;
    const benchmarkRange = benchmarkConfig.type === "stock" && inferredRange === "1D"
      ? "1W"
      : inferredRange;

    let isCancelled = false;
    setEquityBenchmarkLoading(true);

    async function fetchEquityBenchmark() {
      if (benchmarkConfig.type === "portfolio") {
        try {
          const chartResults = await Promise.all(
            alpacaPositions.map(async (position) => {
              const symbol = String(position?.symbol || "").trim().toUpperCase();
              const assetType = position?.assetClass === "crypto" ? "crypto" : "stock";
              const requestedRange = assetType === "stock" && benchmarkRange === "1D"
                ? "1W"
                : benchmarkRange;
              const entryResolution = resolveTradePortfolioEntryTime(position, brokerTradeLog, trades);
              const { data, error } = await supabase.functions.invoke("market-data", {
                body: {
                  chartSymbol: symbol,
                  chartType: assetType,
                  chartRange: requestedRange,
                },
              });
              return {
                symbol,
                position,
                entryTimeMs: entryResolution.timeMs,
                entryTimeSource: entryResolution.source,
                chart: error || !data?.ok ? null : data.chart || null,
              };
            })
          );

          if (isCancelled) return;

          const chartsBySymbol = {};
          chartResults.forEach(({ symbol, entryTimeMs, entryTimeSource, chart }) => {
            chartsBySymbol[symbol] = {
              ...(chart || {}),
              entryTimeMs,
              entryTimeSource,
              bars: extractChartBars(chart),
            };
          });

          const portfolioBenchmarkChart = buildPortfolioBenchmarkChart(
            chartsBySymbol,
            alpacaPositions,
            equityBenchmarkVisibleStart,
            equityBenchmarkVisibleEnd
          );

          setEquityBenchmarkChart(portfolioBenchmarkChart);
        } finally {
          if (!isCancelled) setEquityBenchmarkLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("market-data", {
          body: {
            chartSymbol: benchmarkConfig.symbol,
            chartType: benchmarkConfig.type,
            chartRange: benchmarkRange,
          },
        });

        if (isCancelled || error || !data?.ok) {
          return;
        }

        const nextChart = data.chart || null;
        const visibleStart = filteredEquityPoints[0]?.timeMs || 0;
        const visibleEnd = filteredEquityPoints[filteredEquityPoints.length - 1]?.timeMs || visibleStart;
        const nextBars = sliceBenchmarkBarsToVisibleWindow(nextChart, visibleStart, visibleEnd);

        setEquityBenchmarkChart({
          ...(nextChart || {}),
          symbol: benchmarkConfig.symbol,
          range: benchmarkRange,
          bars: nextBars,
        });
      } catch {
        // Keep the equity chart usable even if benchmark data fails.
      } finally {
        if (!isCancelled) setEquityBenchmarkLoading(false);
      }
    }

    fetchEquityBenchmark();

    return () => {
      isCancelled = true;
    };
  }, [chartRange, equityBenchmarkSymbol, equityBenchmarkType, equityBenchmarkOptions, filteredEquityPoints, alpacaPositions, brokerTradeLog, trades, equityBenchmarkVisibleStart, equityBenchmarkVisibleEnd]);

  async function handleAddTrade(e) {
    e.preventDefault();
    if (!user) { showToast("No user loaded.", "error"); return; }
    if (!tradeForm.asset || !tradeForm.entryPrice || !tradeForm.size || !tradeForm.entryTime || !tradeForm.result) { showToast("Fill out required fields.", "warning"); return; }
    const newTrade = {
      user_id: user.id, asset: resolveTickerAlias(tradeForm.asset.trim()).toUpperCase(), entry_price: Number(tradeForm.entryPrice),
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

  function handleRaylaAdaptiveOnboardingAnswer(questionKey, answer) {
    setRaylaAdaptiveState((prev) => {
      const nextAnswers = {
        ...(prev?.onboardingAnswers || {}),
        [questionKey]: answer,
      };
      return {
        ...(prev || createDefaultRaylaAdaptiveState()),
        onboardingCompleted: RAYLA_ADAPTIVE_ONBOARDING_QUESTIONS.every((question) => nextAnswers[question.key]),
        onboardingAnswers: nextAnswers,
      };
    });
  }

  async function requestRaylaAnswer(question, extraContext = null) {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return "Question is required.";
    const nextAdaptiveState = buildNextRaylaAdaptiveState(raylaAdaptiveState, trimmedQuestion);
    const adaptiveProfile = buildRaylaAdaptiveProfile({
      adaptiveState: nextAdaptiveState,
      currentQuestion: trimmedQuestion,
      trades,
      simulationTradeHistory,
      selectedMarketId,
    });

    function formatSelectedAssetDrivers(breakdown) {
      if (!breakdown || typeof breakdown !== "object") return [];
      const driverLabels = {
        demand: "demand",
        costMargin: "margin pressure",
        guidance: "guidance",
        narrative: "narrative",
        priceConfirmation: "price confirmation",
        liquidity: "liquidity",
        sentiment: "sentiment",
        momentum: "momentum",
        catalyst: "catalyst",
        relativeStrength: "relative strength",
      };
      return Object.entries(breakdown)
        .filter(([key, value]) => key !== "total" && Number.isFinite(Number(value)) && Number(value) !== 0)
        .sort((a, b) => Math.abs(Number(b[1]) || 0) - Math.abs(Number(a[1]) || 0))
        .slice(0, 2)
        .map(([key, value]) => `${Number(value) > 0 ? "positive" : "negative"} ${driverLabels[key] || key}`);
    }

    function findMatchingIntelAsset(symbol) {
      if (!symbol || !hotColdReport) return null;
      const normalizedSymbol = String(symbol).trim().toUpperCase();
      const groups = [
        { bucket: "stockHot", label: "hot stock", items: Array.isArray(hotColdReport.stockHot) ? hotColdReport.stockHot : [] },
        { bucket: "stockCold", label: "cold stock", items: Array.isArray(hotColdReport.stockCold) ? hotColdReport.stockCold : [] },
        { bucket: "cryptoHot", label: "hot crypto", items: hotColdReport.cryptoHot ? [hotColdReport.cryptoHot] : [] },
        { bucket: "cryptoCold", label: "cold crypto", items: hotColdReport.cryptoCold ? [hotColdReport.cryptoCold] : [] },
      ];
      for (const group of groups) {
        const index = group.items.findIndex((item) => String(item?.symbol || "").trim().toUpperCase() === normalizedSymbol);
        if (index >= 0) {
          return {
            bucket: group.bucket,
            bucketLabel: group.label,
            rank: index + 1,
            item: group.items[index],
          };
        }
      }
      return null;
    }

    function findMatchingRaylaPick(symbol) {
      if (!symbol || !raylaPicksContext) return null;
      const normalizedSymbol = String(symbol).trim().toUpperCase();
      const entries = Object.entries(raylaPicksContext);
      for (const [bucket, pick] of entries) {
        if (String(pick?.asset || "").trim().toUpperCase() === normalizedSymbol) {
          return { bucket, pick };
        }
      }
      return null;
    }

    function buildSelectedAssetContext({ chartContext = null, simulationContext = null } = {}) {
      const chartSymbol = String(chartContext?.symbol || "").trim().toUpperCase();
      const simulationSymbol = String(simulationContext?.symbol || "").trim().toUpperCase();
      const simulationAssetActive = Boolean(simulationContext && selectedSimulationItem);

      const baseAsset = simulationAssetActive
        ? selectedSimulationItem
        : chartSymbol
          ? (
            marketItems.find((item) => item.id === chartSymbol)
            || (homeMarketSelectedItem?.id === chartSymbol ? homeMarketSelectedItem : null)
          )
          : homeMarketSelectedItem;

      const symbol = simulationAssetActive
        ? String(selectedSimulationItem?.id || simulationSymbol).trim().toUpperCase()
        : chartSymbol || String(baseAsset?.id || selectedMarketId || "").trim().toUpperCase();
      if (!symbol) return null;

      const intelMatch = findMatchingIntelAsset(symbol);
      const pickMatch = findMatchingRaylaPick(symbol);
      const homeQuote = getLiveQuoteByAssetId(homeMarketQuotes, symbol, baseAsset?.type, baseAsset?.tvSymbol);
      const intelQuote = getLiveQuoteByAssetId(intelLiveQuotes, symbol, intelMatch?.item?.type, intelMatch?.item?.tvSymbol);
      const quote = homeQuote || intelQuote || null;
      const article = intelMatch?.item?.article || null;
      const compactChartSummary = chartSymbol === symbol
        ? buildSelectedAssetChartSummary(chartContext)
        : homeMarketSelectedItem?.id === symbol && homeMarketChartMatchesSelection
          ? buildSelectedAssetChartSummary(buildChartExplainContext({
              symbol: homeMarketSelectedItem.id,
              assetName: homeMarketSelectedItem.description || homeMarketSelectedItem.name || homeMarketSelectedItem.id,
              assetType: homeMarketSelectedItem.type || "stock",
              range: homeMarketChartRange,
              bars: homeMarketVisibleBars,
              currentPrice: getLiveQuoteByAssetId(homeMarketQuotes, homeMarketSelectedItem.id, homeMarketSelectedItem.type, homeMarketSelectedItem.tvSymbol)?.price,
            }))
          : null;

      return {
        symbol,
        assetName: simulationAssetActive
          ? (simulationContext?.assetName || selectedSimulationItem?.label || selectedSimulationItem?.description || symbol)
          : (chartContext?.assetName || baseAsset?.description || baseAsset?.name || intelMatch?.item?.name || symbol),
        assetType: simulationAssetActive
          ? (simulationContext?.assetType || selectedSimulationItem?.type || "stock")
          : (chartContext?.assetType || baseAsset?.type || (CRYPTO_SYMBOL_SET.has(symbol) ? "crypto" : "stock")),
        currentPrice: Number.isFinite(Number(simulationContext?.currentPrice))
          ? Number(simulationContext.currentPrice)
          : Number.isFinite(Number(chartContext?.currentPrice))
            ? Number(chartContext.currentPrice)
            : Number.isFinite(Number(quote?.price))
              ? Number(quote.price)
              : Number.isFinite(Number(baseAsset?.priceValue))
                ? Number(baseAsset.priceValue)
                : null,
        change: Number.isFinite(Number(quote?.change))
          ? Number(quote.change)
          : Number.isFinite(Number(baseAsset?.changeValue))
            ? Number(baseAsset.changeValue)
            : null,
        tvSymbol: simulationAssetActive
          ? (selectedSimulationItem?.tvSymbol || null)
          : (baseAsset?.tvSymbol || null),
        intelScore: Number.isFinite(Number(intelMatch?.item?.score)) ? Number(intelMatch.item.score) : null,
        intelSummary: String(intelMatch?.item?.summary || "").trim() || null,
        topBreakdownDrivers: formatSelectedAssetDrivers(intelMatch?.item?.breakdown),
        hotColdBucket: intelMatch?.bucketLabel
          ? `${intelMatch.bucketLabel}${Number.isFinite(intelMatch.rank) ? ` #${intelMatch.rank}` : ""}`
          : null,
        raylaPickBucket: pickMatch?.bucket || null,
        articleTitle: String(article?.title || "").trim() || null,
        articleSource: String(article?.source?.name || "").trim() || null,
        articleSummary: String(article?.description || "").trim() || null,
        chartSummary: compactChartSummary,
      };
    }

    const directSimulationAnswer = buildDirectSimulationRaylaAnswer(
      trimmedQuestion,
      extraContext?.simulationContext || null
    );
    if (directSimulationAnswer) {
      setRaylaAdaptiveState(nextAdaptiveState);
      return directSimulationAnswer;
    }

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
      }

      if (adaptiveProfile.explanationDepth === "simple") {
        notes.push("Right now I am leaning toward clearer, simpler explanations because your recent questions suggest that is the better fit.");
      } else if (adaptiveProfile.explanationDepth === "advanced") {
        notes.push("Your recent questions suggest you already understand the basics, so I am leaning a bit more advanced.");
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
        setRaylaAdaptiveState(nextAdaptiveState);
      } else if (!parsedAnswer) {
        setRaylaAdaptiveState(nextAdaptiveState);
        return `${currentStep.prompt} Options: ${currentStep.options.join(", ")}.`;
      } else {
        const nextAnswers = {
          ...capitalGuideState.answers,
          [currentStep.key]: parsedAnswer,
        };
        const nextStepIndex = capitalGuideState.stepIndex + 1;

        if (nextStepIndex >= capitalGuideQuestions.length) {
          setCapitalGuideState({ active: false, stepIndex: 0, answers: {} });
          setRaylaAdaptiveState(nextAdaptiveState);
          return buildCapitalGuideResponse(nextAnswers);
        }

        setCapitalGuideState({
          active: true,
          stepIndex: nextStepIndex,
          answers: nextAnswers,
        });
        setRaylaAdaptiveState(nextAdaptiveState);
        return capitalGuideQuestions[nextStepIndex].prompt;
      }
    }

    if (isCapitalGuideIntent(trimmedQuestion)) {
      setCapitalGuideResult(null);
      setCapitalGuideState({ active: true, stepIndex: 0, answers: {} });
      setRaylaAdaptiveState(nextAdaptiveState);
      return capitalGuideQuestions[0].prompt;
    }

    setCapitalGuideResult(null);

    const askRaylaRequestPayload = {
      question: trimmedQuestion,
      context: buildAskRaylaContext({
        trades,
        simulationTradeHistory,
        selectedMarketId,
        adaptiveProfile,
        chartContext: extraContext?.chartContext || null,
        simulationContext: extraContext?.simulationContext || null,
        selectedAssetContext: buildSelectedAssetContext({
          chartContext: extraContext?.chartContext || null,
          simulationContext: extraContext?.simulationContext || null,
        }),
        recentConversation: extraContext?.recentConversation || null,
        activeReviewedTrade: extraContext?.activeReviewedTrade || null,
        raylaMode,
        marketIntelContext: hotColdReport || null,
        raylaPicksContext: raylaPicksContext || null,
        behavioralPatternContext: buildBehavioralPatternSummary(simulationTradeHistory),
      }),
    };

    const response = await fetchWithTimeout(
      ASK_RAYLA_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(askRaylaRequestPayload),
      },
      40000
    );

    const data = await response.json();

    if (!response.ok && !data?.answer) {
      throw new Error(data?.error || `Request failed with status ${response.status}`);
    }

    setRaylaAdaptiveState(nextAdaptiveState);
    return data?.answer || data?.error || "No response.";
  }

  async function handleAskRaylaQuestion(question, { clearInput = false, useChat = false, extraContext = null } = {}) {
    if (!question.trim()) return;

    const trimmedQuestion = question.trim();
    const pendingMessageId = useChat ? crypto.randomUUID() : null;
    const tradeSourceSummary = buildTradeSourceSummary({ trades, simulationTradeHistory });
    const nextActiveReviewedTrade = resolveActiveReviewedTradeForQuestion({
      question: trimmedQuestion,
      tradeSourceSummary,
      fallbackTrade: extraContext?.activeReviewedTrade || raylaActiveReviewedTrade,
    });

    if (useChat) {
      setRaylaChatMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: trimmedQuestion,
        },
        {
          id: pendingMessageId,
          role: "assistant",
          content: "",
          loading: true,
        },
      ]);
    }

    setIsRaylaLoading(true);
    setRaylaResponse("");

    try {
      const answer = await requestRaylaAnswer(trimmedQuestion, {
        ...extraContext,
        activeReviewedTrade: nextActiveReviewedTrade,
        recentConversation: normalizeConversationSlice(raylaChatMessages),
      });
      setRaylaResponse(answer);
      setRaylaActiveReviewedTrade(nextActiveReviewedTrade);
      if (useChat) {
        setRaylaChatMessages((prev) => prev.map((message) => (
          message.id === pendingMessageId
            ? { ...message, content: answer, loading: false }
            : message
        )));
      }
      if (clearInput) setAiInput("");
      return answer;
    } catch (error) {
      const message = `API error: ${error?.message || "unknown error"}`;
      setRaylaResponse(message);
      if (useChat) {
        setRaylaChatMessages((prev) => prev.map((item) => (
          item.id === pendingMessageId
            ? { ...item, content: message, loading: false }
            : item
        )));
      }
      throw error;
    } finally {
      setIsRaylaLoading(false);
    }
  }

  async function handleChartExplainPopupQuestion(question, chartContext, { resetThread = false } = {}) {
    const trimmedQuestion = String(question || "").trim();
    if (!trimmedQuestion) return;

    if (intelSimulationSetupPrompt) {
      const normalized = trimmedQuestion.toLowerCase();
      if (["yes", "yes please", "y", "yeah", "sure", "ok", "okay"].includes(normalized)) {
        handleAcceptIntelSimulationSetupPrompt();
        return;
      }
      if (["no", "no thanks", "n", "i'm good", "im good", "no i'm good", "no im good"].includes(normalized)) {
        handleDismissIntelSimulationSetupPrompt();
        return;
      }
    }

    const nextContext = chartContext || chartExplainPopupContext;

    const pendingMessageId = crypto.randomUUID();
    const nextUserMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedQuestion,
    };
    const loadingMessage = {
      id: pendingMessageId,
      role: "assistant",
      content: "",
      loading: true,
    };

    setChartExplainPopupOpen(true);
    setChartExplainPopupContext(nextContext);
    setChartExplainPopupLoading(true);
    setChartExplainPopupInput("");
    setChartExplainPopupMessages((prev) => resetThread ? [nextUserMessage, loadingMessage] : [...prev, nextUserMessage, loadingMessage]);

    try {
      const answer = await requestRaylaAnswer(
        trimmedQuestion,
        {
          ...(nextContext
            ? nextContext.contextType === "simulation"
              ? { simulationContext: nextContext }
              : { chartContext: nextContext }
            : {}),
          recentConversation: resetThread ? [] : normalizeConversationSlice(chartExplainPopupMessages),
        }
      );
      setChartExplainPopupMessages((prev) => prev.map((message) => (
        message.id === pendingMessageId
          ? { ...message, content: answer, loading: false }
          : message
      )));
      return answer;
    } catch (error) {
      const message = `API error: ${error?.message || "unknown error"}`;
      setChartExplainPopupMessages((prev) => prev.map((entry) => (
        entry.id === pendingMessageId
          ? { ...entry, content: message, loading: false, error: true }
          : entry
      )));
      return message;
    } finally {
      setChartExplainPopupLoading(false);
    }
  }

  function handleChartTapCoachingQuestion(tapInfo, bars, chartCtx) {
    if (!tapInfo?.time || !tapInfo?.price) return;
    setScenarioTapHintDismissed(true);
    const numericBars = (Array.isArray(bars) ? bars : [])
      .filter((b) => Number.isFinite(Number(b?.close)) && Number(b.close) > 0);
    const nearestBar = numericBars.reduce((best, b) => {
      if (!best) return b;
      return Math.abs(Number(b.time) - tapInfo.time) < Math.abs(Number(best.time) - tapInfo.time) ? b : best;
    }, null);
    if (!nearestBar) return;
    const barDir = Number(nearestBar.close) >= Number(nearestBar.open) ? "up" : "down";
    const allHighs = numericBars.map((b) => Number(b.high));
    const allLows = numericBars.map((b) => Number(b.low));
    const rangeHigh = Math.max(...allHighs);
    const rangeLow = Math.min(...allLows);
    const rangeSpan = rangeHigh - rangeLow;
    const relativePos = rangeSpan > 0
      ? tapInfo.price > rangeHigh - rangeSpan * 0.15 ? "near the top of the visible range"
        : tapInfo.price < rangeLow + rangeSpan * 0.15 ? "near the bottom of the visible range"
        : "mid-range"
      : "mid-range";
    const enrichedContext = {
      ...chartCtx,
      tappedBar: {
        price: tapInfo.price,
        time: tapInfo.time,
        open: Number(nearestBar.open),
        high: Number(nearestBar.high),
        low: Number(nearestBar.low),
        close: Number(nearestBar.close),
        direction: barDir,
        relativePosition: relativePos,
      },
    };
    if (chartExplainPopupOpen) {
      handleChartExplainPopupQuestion("What about this price level?", enrichedContext);
      return;
    }
    if (Date.now() - chartTapCooldownRef.current < 700) return;
    openChartExplainPopup(enrichedContext, "What's happening at this price level?");
  }

  function openChartExplainPopup(chartContext, initialQuestion = "Explain this chart") {
    setIntelSimulationSetupPrompt(null);
    setIntelSimulationSetupChecklist(null);
    setChartExplainPopupContext(chartContext);
    setChartExplainPopupMessages([]);
    setChartExplainPopupInput("");
    setChartExplainPopupTitle(initialQuestion || "Ask Rayla");
    setChartExplainPopupOpen(true);
    if (initialQuestion) {
      handleChartExplainPopupQuestion(initialQuestion, chartContext, { resetThread: true });
    }
  }

  function openGlobalRaylaPopup(title = "Ask Rayla", context = null) {
    setIntelSimulationSetupPrompt(null);
    setIntelSimulationSetupChecklist(null);
    setChartExplainPopupContext(context || null);
    setChartExplainPopupMessages([]);
    setChartExplainPopupInput("");
    setChartExplainPopupTitle(title || "Ask Rayla");
    setChartExplainPopupOpen(true);
  }

  function buildSimulationRaylaPopupContext(position) {
    if (!position) return simulationRaylaContext;

    const marketMode = position.marketMode || "live";
    const currentPrice = getSimulationPrice(position.asset, marketMode);
    const metrics = Number.isFinite(currentPrice) ? calculateSimulationPnL(position, currentPrice) : { profitLoss: 0, rMultiple: null };
    const levels = getSimulationPriceLevels(position);
    const activeTrade = buildSimulationActiveTradeContext({
      position,
      currentPrice,
      metrics,
      levels,
      timeInTrade: formatTimeInTrade(position),
    });

    return buildSimulationRaylaContext({
      mode: marketMode === "scenario" ? "Scenario" : "Live",
      symbol: position.asset,
      assetName: position.label || position.asset,
      assetType: position.type || "stock",
      timeframe: marketMode === "live"
        ? simulationLiveChartRange
        : simulationChartTimeframeConfig.label,
      currentPrice,
      direction: position.direction,
      amount: position.amount,
      amountMode: position.amountMode,
      stopLoss: position.stopLoss != null ? String(position.stopLoss) : "",
      takeProfit: position.takeProfit != null ? String(position.takeProfit) : "",
      activeTrade,
      sessionStats: {
        totalPnL: simulationStatsTotalPnL,
        closedTrades: simulationStatsTradeHistory.length,
        avgProfitLoss: simulationStatsProfile.avgProfitLoss,
        totalTrades: simulationStatsProfile.totalTrades,
        winRate: simulationStatsProfile.winRate,
        avgRMultiple: simulationStatsProfile.avgRMultiple,
      },
    });
  }

  function openSimulationRaylaHelper(position) {
    if (!position) return;

    const helperContext = buildSimulationRaylaPopupContext(position);

    setIntelSimulationSetupPrompt(null);
    setIntelSimulationSetupChecklist(null);
    setChartExplainPopupContext(helperContext);
    setChartExplainPopupMessages([
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: buildSimulationOpeningMessage(helperContext, {
          beginnerMode: raylaAdaptiveProfile?.explanationDepth === "simple" || simulationTradeHistory.length < 3,
        }),
      },
    ]);
    setChartExplainPopupInput("");
    setChartExplainPopupLoading(false);
    setChartExplainPopupTitle(position.marketMode === "scenario" ? "Rayla Scenario Help" : "Rayla Live Help");
    setChartExplainPopupOpen(true);
    setSimulationRaylaGuidanceStateByTrade((prev) => (
      prev[position.id]
        ? prev
        : { ...prev, [position.id]: "pending" }
    ));
    setSimulationRaylaPromptTradeId(position.id);
  }

  function openPostTradeRaylaReview(closedTrade) {
    if (!closedTrade?.asset) return;
    const directionLabel = closedTrade.direction === "short" ? "Short" : "Long";
    const symbol = String(closedTrade.asset).toUpperCase();
    const question = `Walk me through my ${directionLabel} ${symbol} trade — what happened, was the execution disciplined, and how does this connect to how I'm developing as a trader?`;
    const reviewContext = buildSimulationRaylaContext({
      mode: closedTrade.marketMode === "scenario" ? "Scenario" : "Live",
      symbol: closedTrade.asset,
      assetName: closedTrade.label || closedTrade.asset,
      assetType: closedTrade.type || "stock",
      timeframe: closedTrade.marketMode === "scenario"
        ? simulationChartTimeframeConfig.label
        : getChartSelectionConfig(simulationLiveChartRange).label,
      currentPrice: closedTrade.exitPrice ?? null,
      direction: closedTrade.direction,
      amount: closedTrade.amount,
      amountMode: closedTrade.amountMode,
      stopLoss: closedTrade.stopLoss != null ? String(closedTrade.stopLoss) : "",
      takeProfit: closedTrade.takeProfit != null ? String(closedTrade.takeProfit) : "",
      closedTrade,
      isFirstSimTrade: simulationTradeHistory.length === 0,
      sessionStats: {
        totalPnL: simulationStatsTotalPnL,
        closedTrades: simulationStatsTradeHistory.length,
        avgProfitLoss: simulationStatsProfile.avgProfitLoss,
        totalTrades: simulationStatsProfile.totalTrades,
        winRate: simulationStatsProfile.winRate,
        avgRMultiple: simulationStatsProfile.avgRMultiple,
      },
    });
    setIntelSimulationSetupPrompt(null);
    setIntelSimulationSetupChecklist(null);
    setChartExplainPopupContext(reviewContext);
    setChartExplainPopupMessages([]);
    setChartExplainPopupInput("");
    setChartExplainPopupTitle("Trade Review");
    setChartExplainPopupOpen(true);
    handleChartExplainPopupQuestion(question, reviewContext, { resetThread: true });
  }

  function openIntelSimulationRaylaPopup(intelLaunch) {
    if (!intelLaunch) return;

    const launchMode = intelLaunch.mode === "scenario" ? "scenario" : "live";

    const nextContext = buildSimulationRaylaContext({
      mode: launchMode === "scenario" ? "Scenario" : "Live",
      symbol: intelLaunch.asset.id,
      assetName: intelLaunch.asset.label || intelLaunch.asset.id,
      assetType: intelLaunch.asset.type || "stock",
      timeframe: launchMode === "scenario"
        ? simulationChartTimeframeConfig.label
        : getChartSelectionConfig(simulationLiveChartRange).label,
      currentPrice: getSimulationPrice(intelLaunch.asset.id, launchMode),
      direction: intelLaunch.direction,
      amount: simulationAmount,
      amountMode: simulationAmountMode,
      stopLoss: simulationStopLoss,
      takeProfit: simulationTakeProfit,
      intelSignal: intelLaunch.intelSignal,
      sessionStats: {
        totalPnL: simulationStatsTotalPnL,
        closedTrades: simulationStatsTradeHistory.length,
        avgProfitLoss: simulationStatsProfile.avgProfitLoss,
        totalTrades: simulationStatsProfile.totalTrades,
        winRate: simulationStatsProfile.winRate,
        avgRMultiple: simulationStatsProfile.avgRMultiple,
      },
    });

    setChartExplainPopupContext(nextContext);
    setChartExplainPopupMessages([
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: buildIntelSimulationRaylaIntro({
          ...intelLaunch,
          mode: launchMode,
        }),
      },
    ]);
    setChartExplainPopupInput("");
    setChartExplainPopupLoading(false);
    setChartExplainPopupTitle(launchMode === "scenario" ? "Rayla Scenario Setup" : "Rayla Live Setup");
    setChartExplainPopupOpen(true);
    setIntelSimulationSetupChecklist(null);
    setIntelSimulationSetupPrompt(null);
  }

  function handleAcceptIntelSimulationSetupPrompt() {
    if (!intelSimulationSetupPrompt) return;
    const steps = buildIntelSimulationSetupSteps(intelSimulationSetupPrompt);
    if (!steps.length) return;

    setIntelSimulationSetupPrompt(null);
    setIntelSimulationSetupChecklist({
      assetSymbol: intelSimulationSetupPrompt.assetSymbol,
      directionLabel: intelSimulationSetupPrompt.directionLabel,
      mode: intelSimulationSetupPrompt.mode,
      launch: intelSimulationSetupPrompt.launch || null,
      draft: intelSimulationSetupPrompt.draft || null,
      steps,
      currentStep: 0,
    });
    setChartExplainPopupMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "One field at a time.",
      },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `${steps[0].title}\n${steps[0].body}`,
      },
    ]);
  }

  function handleAdvanceIntelSimulationSetupChecklist() {
    setIntelSimulationSetupChecklist((prev) => {
      if (!prev) return prev;
      const nextStepIndex = prev.currentStep + 1;
      if (nextStepIndex >= prev.steps.length) {
        setChartExplainPopupMessages((messages) => [
          ...messages,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Setup complete. Opening the simulator with this exact Intel setup.",
          },
        ]);
        launchIntelPracticeMode(prev.mode, prev.launch && prev.draft ? {
          launch: prev.launch,
          draft: prev.draft,
        } : null);
        return null;
      }

      const nextStep = prev.steps[nextStepIndex];
      setChartExplainPopupMessages((messages) => [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `${nextStep.title}\n${nextStep.body}`,
        },
      ]);

      return {
        ...prev,
        currentStep: nextStepIndex,
      };
    });
  }

  function handleDismissIntelSimulationSetupPrompt() {
    setIntelSimulationSetupPrompt(null);
    setIntelSimulationSetupChecklist(null);
    setChartExplainPopupOpen(false);
    setChartExplainPopupLoading(false);
  }

  function handleCancelIntelPracticeModeChoice() {
    setIntelPracticeModeChoice(null);
  }

  function updateIntelPracticeModeChoice(patch) {
    setIntelPracticeModeChoice((prev) => (prev ? { ...prev, ...patch, error: "" } : prev));
  }

  function parseLooseNumericValue(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\$/g, "")
      .replace(/,/g, "")
      .replace(/\s+/g, "");
    if (!normalized) return null;
    const multiplier = normalized.endsWith("k") ? 1000 : 1;
    const raw = multiplier === 1000 ? normalized.slice(0, -1) : normalized;
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return null;
    return parsed * multiplier;
  }

  function normalizeIntelWizardPlValue(value, kind) {
    const parsed = parseLooseNumericValue(value);
    if (!Number.isFinite(parsed)) return null;
    if (kind === "stopLoss") return -Math.abs(parsed);
    if (kind === "takeProfit") return Math.abs(parsed);
    return parsed;
  }

  function handleIntelPracticeUseCurrentPrice() {
    const currentPrice = intelPracticeModeChoice?.launch?.asset?.id
      ? getSimulationPrice(intelPracticeModeChoice.launch.asset.id, intelPracticeModeChoice.mode || "live")
      : null;
    if (!Number.isFinite(currentPrice)) return;
    updateIntelPracticeModeChoice({
      entry: String(currentPrice),
      entryValue: currentPrice,
      entryInputType: "price",
    });
  }

  function handleIntelPracticeWizardBack() {
    setIntelPracticeModeChoice((prev) => (
      prev
        ? { ...prev, wizardStep: Math.max(0, (prev.wizardStep || 0) - 1), error: "" }
        : prev
    ));
  }

  function handleIntelPracticeWizardNext() {
    setIntelPracticeModeChoice((prev) => {
      if (!prev) return prev;
      const currentStep = prev.wizardStep || 0;

      if (currentStep === 0) {
        if (!prev.mode) return { ...prev, error: "Choose Live or Scenario first." };
        return { ...prev, wizardStep: 1, error: "" };
      }

      if (currentStep === 1) {
        if (!prev.direction) return { ...prev, error: "Choose Long or Short first." };
        return { ...prev, wizardStep: 2, error: "" };
      }

      if (currentStep === 2) {
        const plannedRiskValue = parseLooseNumericValue(prev.plannedRisk);
        if (!Number.isFinite(plannedRiskValue) || plannedRiskValue <= 0) {
          return { ...prev, error: "Enter a dollar risk like 50 or $50." };
        }
        return { ...prev, plannedRiskValue, wizardStep: 3, error: "" };
      }

      if (currentStep === 3) {
        const entryValue = parseLooseNumericValue(prev.entry);
        if (!Number.isFinite(entryValue)) {
          return { ...prev, error: "Enter an entry price like 183.40." };
        }
        return { ...prev, entryValue, wizardStep: 4, error: "" };
      }

      if (currentStep === 4) {
        const stopLossValue = (prev.stopLossInputType || "price") === "pnl"
          ? normalizeIntelWizardPlValue(prev.stopLoss, "stopLoss")
          : parseLooseNumericValue(prev.stopLoss);
        if (!Number.isFinite(stopLossValue)) {
          return { ...prev, error: "Enter a stop loss value like 183.40 or 15." };
        }
        return { ...prev, stopLossValue, wizardStep: 5, error: "" };
      }

      if (currentStep === 5) {
        const takeProfitValue = (prev.takeProfitInputType || "price") === "pnl"
          ? normalizeIntelWizardPlValue(prev.takeProfit, "takeProfit")
          : parseLooseNumericValue(prev.takeProfit);
        if (!Number.isFinite(takeProfitValue)) {
          return { ...prev, error: "Enter a take profit value like 183.40 or 25." };
        }
        return { ...prev, takeProfitValue, wizardStep: 6, error: "" };
      }

      return prev;
    });
  }

  function handleConfirmIntelPracticeModeChoice() {
    setIntelPracticeModeChoice((prev) => {
      if (!prev?.launch?.asset || !prev?.draft) return prev;

      const plannedRiskValue = Number.isFinite(prev.plannedRiskValue)
        ? prev.plannedRiskValue
        : parseLooseNumericValue(prev.plannedRisk);
      const entryValue = Number.isFinite(prev.entryValue)
        ? prev.entryValue
        : parseLooseNumericValue(prev.entry);
      const stopLossValue = Number.isFinite(prev.stopLossValue)
        ? prev.stopLossValue
        : ((prev.stopLossInputType || "price") === "pnl"
          ? normalizeIntelWizardPlValue(prev.stopLoss, "stopLoss")
          : parseLooseNumericValue(prev.stopLoss));
      const takeProfitValue = Number.isFinite(prev.takeProfitValue)
        ? prev.takeProfitValue
        : ((prev.takeProfitInputType || "price") === "pnl"
          ? normalizeIntelWizardPlValue(prev.takeProfit, "takeProfit")
          : parseLooseNumericValue(prev.takeProfit));

      if (!prev.mode || !prev.direction || !Number.isFinite(plannedRiskValue) || !Number.isFinite(entryValue) || !Number.isFinite(stopLossValue) || !Number.isFinite(takeProfitValue)) {
        return { ...prev, error: "Finish the setup fields before opening the simulator." };
      }

      const nextAsset = prev.launch.asset;
      if (nextAsset) {
        setSimulationAsset(nextAsset);
      }
      setSimulationSearchQuery(prev.draft.asset || "");
      setSimulationSearchResults([]);
      setSimulationDirection(prev.direction);
      setSimulationSetupType(normalizeSetupType(prev.draft?.setupType) || "");
      setSimulationMode(prev.mode === "scenario" ? "scenario" : "live");
      setSimulationAmount(String(plannedRiskValue));
      setSimulationAmountMode("dollars");
      setSimulationExitMode((prev.stopLossInputType || "price") === "pnl" || (prev.takeProfitInputType || "price") === "pnl" ? "pnl" : "price");
      setSimulationStopLoss(String(stopLossValue));
      setSimulationTakeProfit(String(takeProfitValue));
      setSelectedSimulationPositionId(null);

      const createdPosition = handleOpenSimulationTrade({
        assetOverride: nextAsset,
        modeOverride: prev.mode === "scenario" ? "scenario" : "live",
        directionOverride: prev.direction,
        amountOverride: plannedRiskValue,
        amountModeOverride: "dollars",
        exitModeOverride: (prev.stopLossInputType || "price") === "pnl" || (prev.takeProfitInputType || "price") === "pnl" ? "pnl" : "price",
        stopLossOverride: stopLossValue,
        takeProfitOverride: takeProfitValue,
        entryPriceOverride: entryValue,
        skipCoachPopup: true,
        guidedOverride: false,
      });

      if (!createdPosition) {
        return {
          ...prev,
          plannedRiskValue,
          entryValue,
          stopLossValue,
          takeProfitValue,
          error: "I couldn’t open that simulation yet. Check the values and try again.",
        };
      }

      setSelectedSimulationPositionId(createdPosition.id || null);
      setActiveTab("simulation");
      return null;
    });
  }

  function launchIntelPracticeMode(mode, choiceOverride = null) {
    const choice = choiceOverride || intelPracticeModeChoice;
    if (!choice?.launch || !choice?.draft) return;
    const nextMode = mode === "scenario" ? "scenario" : "live";
    const { launch, draft } = choice;
    const nextAsset = launch.asset;

    if (nextAsset) {
      setSelectedSimulationPositionId(null);
      setSimulationAsset(nextAsset);
    }
    setSimulationSearchQuery(draft.asset || "");
    setSimulationSearchResults([]);
    setSimulationDirection(draft.direction);
    setSimulationSetupType(normalizeSetupType(draft.setupType) || "");
    setSelectedSimulationInfoKey(null);
    setIsSimulationTutorialOpen(false);
    setActiveTab("simulation");
    setGuidedSimulationDraft(draft);
    setIntelPracticeModeChoice(null);

    if (nextMode === "scenario") {
      setSimulationMode("scenario");
      setSimulationScenarioType("realistic");
      setSimulationScenarioTick(0);
      setSimulationUseStopTarget(true);
      setSimulationUseExitPrice(false);
      setSimulationExitMode("price");
      setSimulationStopLoss("");
      setSimulationTakeProfit("");
      setPendingGuidedScenarioLaunch({
        handoffId: launch.handoffId,
        asset: launch.asset,
        direction: launch.direction,
        intelSignal: launch.intelSignal,
        message: launch.message,
      });
      if (!launch.skipRaylaPopup) {
        setPendingIntelSimulationLaunch({ ...launch, mode: "scenario" });
      }
      return;
    }

    setSimulationMode("live");
    if (!launch.skipRaylaPopup) {
      setPendingIntelSimulationLaunch({ ...launch, mode: "live" });
    }
  }

  function handleStartIntelLiveSimulation() {
    updateIntelPracticeModeChoice({ mode: "live" });
  }

  function handleStartIntelScenarioSimulation() {
    updateIntelPracticeModeChoice({ mode: "scenario" });
  }

  function handleEnableSimulationRaylaGuidance(positionId) {
    if (!positionId) return;

    const position = simulationPositions.find((item) => item.id === positionId);
    const marketMode = position?.marketMode || "live";
    const currentPrice = position ? getSimulationPrice(position.asset, marketMode) : null;
    const metrics = position && Number.isFinite(currentPrice)
      ? calculateSimulationPnL(position, currentPrice)
      : null;
    const coachNote = getSimulationCoachMessage(position, currentPrice, metrics);

    setSimulationRaylaGuidanceStateByTrade((prev) => ({ ...prev, [positionId]: "guided" }));
    setSimulationRaylaPromptTradeId((prev) => (prev === positionId ? null : prev));
    setChartExplainPopupMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I'm watching. What do you want to know?",
      },
      ...(coachNote
        ? [{
            id: crypto.randomUUID(),
            role: "assistant",
            content: coachNote,
          }]
        : []),
    ]);
  }

  function handleDismissSimulationRaylaGuidance(positionId) {
    if (!positionId) return;

    setSimulationRaylaGuidanceStateByTrade((prev) => ({ ...prev, [positionId]: "dismissed" }));
    setSimulationRaylaPromptTradeId((prev) => (prev === positionId ? null : prev));
    setChartExplainPopupOpen(false);
    setChartExplainPopupLoading(false);
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
    if (preferredMode !== "scenario" && simulationLivePaused) {
      const pausedPrice = simulationLivePauseSnapshot[assetId]?.price ?? simulationLivePauseSnapshot[normalizedAssetId]?.price;
      if (pausedPrice != null) return pausedPrice;
    }
    const livePrice = simulationQuotes[assetId]?.price ?? simulationQuotes[normalizedAssetId]?.price;
    if (livePrice != null) return livePrice;
    const item = marketItems.find((marketItem) => normalizeAssetId(marketItem.id, marketItem.type, marketItem.tvSymbol) === normalizedAssetId);
    return Number.isFinite(item?.priceValue) ? item.priceValue : null;
  }

  function calculateSimulationPnL(position, currentPrice) {
    if (!position || !Number.isFinite(currentPrice)) return { profitLoss: 0, rMultiple: null };
    const quantity = getSimulationPositionQuantity(position);
    if (!Number.isFinite(quantity) || quantity <= 0) return { profitLoss: 0, rMultiple: null };
    const priceMove = position.direction === "long"
      ? currentPrice - position.entryPrice
      : position.entryPrice - currentPrice;
    const profitLoss = quantity * priceMove;
    const rMultiple = position.plannedRisk > 0 ? profitLoss / position.plannedRisk : null;
    return { profitLoss, rMultiple };
  }

  function getSimulationPriceLevels(position) {
    if (!position || !Number.isFinite(position.entryPrice) || position.entryPrice <= 0) {
      return { entryPrice: null, stopPrice: null, targetPrice: null, quantity: null };
    }

    const quantity = getSimulationPositionQuantity(position);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return {
        entryPrice: position.entryPrice,
        stopPrice: position.exitMode === "price" ? position.stopLoss : null,
        targetPrice: position.exitMode === "price" ? position.takeProfit : null,
        quantity: null,
      };
    }

    if (position.exitMode !== "pnl") {
      return {
        entryPrice: position.entryPrice,
        stopPrice: position.stopLoss,
        targetPrice: position.takeProfit,
        quantity,
      };
    }

    const stopOffset = position.stopLoss != null ? Math.abs(Number(position.stopLoss)) / quantity : null;
    const targetOffset = position.takeProfit != null ? Math.abs(Number(position.takeProfit)) / quantity : null;
    const isLong = position.direction === "long";

    return {
      entryPrice: position.entryPrice,
      stopPrice: Number.isFinite(stopOffset)
        ? (isLong ? position.entryPrice - stopOffset : position.entryPrice + stopOffset)
        : null,
      targetPrice: Number.isFinite(targetOffset)
        ? (isLong ? position.entryPrice + targetOffset : position.entryPrice - targetOffset)
        : null,
      quantity,
    };
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
        coachingInsight: `Patient hold, full move. That's the standard.`,
      };
    }

    if (tinyWinner) {
      return {
        outcomeLabel: "Cut too early",
        coachingInsight: `Green, but you left money on the table. Let winners breathe next time.`,
      };
    }

    if (heldTooLongLoss) {
      return {
        outcomeLabel: "Held too long",
        coachingInsight: `Held past where the setup broke. Cut faster when price stops improving.`,
      };
    }

    if (isLoss) {
      return {
        outcomeLabel: "Controlled loss",
        coachingInsight: `Loss contained. That's the job. Line up the next rep.`,
      };
    }

    return {
      outcomeLabel: "Managed trade",
      coachingInsight: `Clean process. Focus on repeating it, not the outcome.`,
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
      return "Repeat the process. The grade will follow.";
    }

    if (outcomeLabel === "Cut too early" || (isWin && hasRiskPlan && rMultiple < 0.5)) {
      return "Next time, trail it — don't exit early into strength.";
    }

    if (executionGrade === "D" || outcomeLabel === "Held too long") {
      return "Honor the stop earlier. Weak trades don't fix themselves.";
    }

    if (isLoss && exitReason === "Stopped Out") {
      return "Risk was defined. Loss was clean. Next rep.";
    }

    if (isLoss && durationMinutes >= 5) {
      return "Tighten your exit when the setup weakens.";
    }

    return "Same discipline next rep.";
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

    if (
      position.marketMode === "scenario" &&
      [
        "P/L Stop Hit",
        "P/L Target Hit",
        "Stopped Out",
        "Target Hit",
      ].includes(exitReason)
    ) {
      pauseScenarioPlayback();
    }

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
      setupType: normalizeSetupType(position.setupType),
      sessionSlot: position.sessionSlot || deriveSessionSlot(position.openedAt || closedAt),
      session: position.session || position.sessionSlot || deriveSessionSlot(position.openedAt || closedAt),
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
    setSelectedSimulationPositionId((prev) => (prev === positionId ? null : prev));
    setSimulationPendingScenarioDecision((prev) => prev?.positionId === positionId ? null : prev);
    setSimulationPendingLiveDecision((prev) => prev?.positionId === positionId ? null : prev);
  }

  function handleOpenSimulationTrade(options = null) {
    const effectiveAsset = options?.assetOverride || selectedSimulationItem;
    const effectiveMode = options?.modeOverride || simulationMode;
    const effectiveDirection = options?.directionOverride || simulationDirection;
    const effectiveAmountMode = options?.amountModeOverride || simulationAmountMode;
    const effectiveExitMode = options?.exitModeOverride || simulationExitMode;
    const effectiveLeverage = options?.leverageOverride || simulationLeverage;
    const amount = Number.parseFloat(options?.amountOverride ?? simulationAmount);
    const entryPrice = Number.isFinite(options?.entryPriceOverride)
      ? Number(options.entryPriceOverride)
      : effectiveAsset
        ? getSimulationPrice(effectiveAsset.id, effectiveMode)
        : null;
    const parsedStopLoss = Number.parseFloat(options?.stopLossOverride ?? simulationStopLoss);
    const parsedTakeProfit = Number.parseFloat(options?.takeProfitOverride ?? simulationTakeProfit);
    const stopLoss = Number.isFinite(parsedStopLoss) ? parsedStopLoss : null;
    const takeProfit = Number.isFinite(parsedTakeProfit) ? parsedTakeProfit : null;
    const leverageMultiplier = getSimulationLeverageMultiplier(effectiveLeverage);

    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid amount to simulate.", "warning");
      return false;
    }

    if (!effectiveAsset) {
      showToast("Choose an asset before opening the trade.", "warning");
      return false;
    }

    if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
      showToast("Live price is not available for this asset yet.", "warning");
      return false;
    }

    if (simulationPositions.some((position) =>
      (position.marketMode || "live") === effectiveMode
      && normalizeAssetId(position.asset, position.type, position.tvSymbol) === normalizeAssetId(effectiveAsset.id, effectiveAsset.type, effectiveAsset.tvSymbol)
    )) {
      showToast("You already have an open trade on this asset.", "warning");
      return false;
    }

    if (effectiveExitMode === "price") {
      if (stopLoss != null) {
        const stopLossValid = effectiveDirection === "long" ? stopLoss < entryPrice : stopLoss > entryPrice;
        if (!stopLossValid) {
          showToast("For longs: stop below entry. For shorts: stop above entry.", "warning");
          return false;
        }
      }

      if (takeProfit != null) {
        const takeProfitValid = effectiveDirection === "long" ? takeProfit > entryPrice : takeProfit < entryPrice;
        if (!takeProfitValid) {
          showToast("For longs: target above entry. For shorts: target below entry.", "warning");
          return false;
        }
      }
    } else {
      if (stopLoss != null && stopLoss >= 0) {
        showToast("Enter a negative stop loss in dollars, like -50.", "warning");
        return false;
      }
      if (takeProfit != null && takeProfit <= 0) {
        showToast("Enter a positive profit target in dollars, like 50.", "warning");
        return false;
      }
    }

    const riskPerUnit = effectiveExitMode !== "price" || stopLoss == null
      ? null
      : effectiveDirection === "long"
        ? entryPrice - stopLoss
        : stopLoss - entryPrice;
    const leveragedQuantity = effectiveAmountMode === "shares"
      ? amount * leverageMultiplier
      : (amount * leverageMultiplier) / entryPrice;
    const plannedRisk = effectiveExitMode === "pnl"
      ? stopLoss
      : riskPerUnit == null
        ? null
        : leveragedQuantity * riskPerUnit;

    const openedAt = Date.now();
    const setupType = normalizeSetupType(
      options?.setupTypeOverride
      ?? simulationSetupType
      ?? activeGuidedSimulation?.setupType
      ?? guidedSimulationDraft?.setupType
      ?? null
    );
    const sessionSlot = deriveSessionSlot(openedAt);
    const newPosition = {
      id: crypto.randomUUID(),
      asset: effectiveAsset.id,
      label: effectiveAsset.label,
      tvSymbol: effectiveAsset.tvSymbol,
      type: effectiveAsset.type,
      marketMode: effectiveMode,
      scenarioType: effectiveMode === "scenario" ? simulationScenarioType : null,
      scenarioSpeed: effectiveMode === "scenario" ? simulationScenarioSpeed : null,
      openedScenarioTick: effectiveMode === "scenario" ? simulationScenarioTick : null,
      openedScenarioSeriesIndex: effectiveMode === "scenario"
        ? Math.max(0, (simulationScenarioSeries[effectiveAsset.id] || []).length - 1)
        : null,
      guided: options?.guidedOverride != null ? !!options.guidedOverride : !!activeGuidedSimulation,
      guidedId: options?.guidedIdOverride != null ? options.guidedIdOverride : (activeGuidedSimulation?.id || null),
      direction: effectiveDirection,
      amount,
      amountMode: effectiveAmountMode,
      leverage: effectiveLeverage,
      exitMode: effectiveExitMode,
      entryPrice,
      stopLoss,
      takeProfit,
      scenarioNoLimit: effectiveMode === "scenario" ? simulationScenarioNoLimit : null,
      scenarioDurationMs: effectiveMode === "scenario" && !simulationScenarioNoLimit ? scenarioDurationMs : null,
      scenarioDurationPointCount: effectiveMode === "scenario" && !simulationScenarioNoLimit ? scenarioDurationPointCount : null,
      riskPerUnit,
      plannedRisk,
      openedAt,
      setupType,
      sessionSlot,
      session: sessionSlot,
    };

    setSimulationClosedTrade(null);
    if (effectiveMode === "scenario") {
      setSimulationPendingScenarioDecision(null);
    } else {
      setSimulationPendingLiveDecision(null);
    }
    setSimulationPositions((prev) => [...prev, newPosition]);
    setSelectedSimulationPositionId(newPosition.id);
    if (!options?.skipCoachPopup) {
      openSimulationRaylaHelper(newPosition);
    }
    if ((options?.guidedOverride != null ? options.guidedOverride : activeGuidedSimulation)) {
      setActiveGuidedSimulation((prev) => (prev ? { ...prev, step: "position-open" } : prev));
    }
    return newPosition;
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

  function handleQuitAndSaveScenarioTrade(positionId) {
    const pendingDecision = simulationPendingScenarioDecision;
    if (!pendingDecision || pendingDecision.positionId !== positionId) return;
    finalizeSimulationTrade(positionId, pendingDecision.exitPrice, pendingDecision.exitReason);
  }

  function handleQuitAndSaveLiveTrade(positionId) {
    const pendingDecision = simulationPendingLiveDecision;
    if (!pendingDecision || pendingDecision.positionId !== positionId) return;
    finalizeSimulationTrade(positionId, pendingDecision.exitPrice, pendingDecision.exitReason);
  }

  function handleReopenAndContinueScenarioTrade(positionId) {
    setSimulationPositions((prev) => prev.map((position) => {
      if (position.id !== positionId) return position;
      if (selectedSimulationOpenPosition?.id !== positionId) return position;

      const parsedStopLoss = Number.parseFloat(simulationStopLoss);
      const parsedTakeProfit = Number.parseFloat(simulationTakeProfit);
      const nextStopLoss = simulationUseStopTarget && Number.isFinite(parsedStopLoss) ? parsedStopLoss : null;
      const nextTakeProfit = simulationUseStopTarget && simulationUseExitPrice && Number.isFinite(parsedTakeProfit) ? parsedTakeProfit : null;
      const riskPerUnit = simulationExitMode !== "price" || nextStopLoss == null
        ? null
        : position.direction === "long"
          ? position.entryPrice - nextStopLoss
          : nextStopLoss - position.entryPrice;
      const leverageMultiplier = getSimulationLeverageMultiplier(position.leverage);
      const leveragedQuantity = position.amountMode === "shares"
        ? position.amount * leverageMultiplier
        : (position.amount * leverageMultiplier) / position.entryPrice;
      const plannedRisk = simulationExitMode === "pnl"
        ? nextStopLoss
        : riskPerUnit == null
          ? null
          : leveragedQuantity * riskPerUnit;

      return {
        ...position,
        exitMode: simulationUseStopTarget ? simulationExitMode : position.exitMode,
        stopLoss: nextStopLoss,
        takeProfit: nextTakeProfit,
        riskPerUnit,
        plannedRisk,
      };
    }));
    setSimulationPendingScenarioDecision((prev) => prev?.positionId === positionId ? null : prev);
  }

  function handleReopenAndContinueLiveTrade(positionId) {
    setSimulationPositions((prev) => prev.map((position) => {
      if (position.id !== positionId) return position;
      if (selectedSimulationOpenPosition?.id !== positionId) return position;

      const parsedStopLoss = Number.parseFloat(simulationStopLoss);
      const parsedTakeProfit = Number.parseFloat(simulationTakeProfit);
      const nextStopLoss = simulationUseStopTarget && Number.isFinite(parsedStopLoss) ? parsedStopLoss : null;
      const nextTakeProfit = simulationUseStopTarget && simulationUseExitPrice && Number.isFinite(parsedTakeProfit) ? parsedTakeProfit : null;
      const riskPerUnit = simulationExitMode !== "price" || nextStopLoss == null
        ? null
        : position.direction === "long"
          ? position.entryPrice - nextStopLoss
          : nextStopLoss - position.entryPrice;
      const leverageMultiplier = getSimulationLeverageMultiplier(position.leverage);
      const leveragedQuantity = position.amountMode === "shares"
        ? position.amount * leverageMultiplier
        : (position.amount * leverageMultiplier) / position.entryPrice;
      const plannedRisk = simulationExitMode === "pnl"
        ? nextStopLoss
        : riskPerUnit == null
          ? null
          : leveragedQuantity * riskPerUnit;

      return {
        ...position,
        exitMode: simulationUseStopTarget ? simulationExitMode : position.exitMode,
        stopLoss: nextStopLoss,
        takeProfit: nextTakeProfit,
        riskPerUnit,
        plannedRisk,
      };
    }));
    setSimulationPendingLiveDecision((prev) => prev?.positionId === positionId ? null : prev);
  }

  function runAIAnalysis() {
  if (trades.length === 0) { showToast("No trades logged yet.", "warning"); return; }
  if (trades.length === lastAnalyzedCount) { showToast("No new trades since last analysis.", "warning"); return; }
  const r = buildCoachReport(trades);
  if (!r) return;
  setCoachSummary({
    strongestEdge: r.bestCombo ? `${r.bestCombo.setup} on ${r.bestCombo.asset} — ${r.bestCombo.avgR.toFixed(2)} avg, ${r.bestCombo.winRate.toFixed(0)}% win rate (${r.bestCombo.trades} trades)` : null,
    weakestPattern: r.comboStats.length > 1 ? (() => { const w = r.comboStats[r.comboStats.length - 1]; return `${w.setup} on ${w.asset} — ${w.avgR.toFixed(2)} avg, ${w.winRate.toFixed(0)}% win rate`; })() : null,
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
  const rawStr = (typeof rawOrResult === "string" ? rawOrResult : rawOrResult?.symbol || "").trim();
  // Apply alias resolution for direct string inputs; search result objects already carry the correct symbol
  const raw = typeof rawOrResult === "string" ? resolveTickerAlias(rawStr) : rawStr;
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
    tradable: typeof rawOrResult === "object" && typeof rawOrResult?.tradable === "boolean"
      ? Boolean(rawOrResult.tradable)
      : undefined,
    marginable: typeof rawOrResult === "object" && typeof rawOrResult?.marginable === "boolean"
      ? Boolean(rawOrResult.marginable)
      : undefined,
    shortable: typeof rawOrResult === "object" && typeof rawOrResult?.shortable === "boolean"
      ? Boolean(rawOrResult.shortable)
      : undefined,
    easyToBorrow: typeof rawOrResult === "object" && typeof rawOrResult?.easyToBorrow === "boolean"
      ? Boolean(rawOrResult.easyToBorrow)
      : undefined,
    assetClass: typeof rawOrResult === "object" ? rawOrResult?.assetClass || rawOrResult?.type || (isCrypto ? "crypto" : "stock") : (isCrypto ? "crypto" : "stock"),
    alpacaSupported: typeof rawOrResult === "object"
      ? (typeof rawOrResult?.alpacaSupported === "boolean"
        ? rawOrResult.alpacaSupported
        : typeof rawOrResult?.tradable === "boolean"
          ? Boolean(rawOrResult.tradable)
          : (isCrypto ? true : undefined))
      : (isCrypto ? true : undefined),
  };
}

function buildSimulationAssetFromPosition(position) {
  if (!position?.asset) return null;
  return buildMarketAsset({
    symbol: position.asset,
    description: position.label || position.asset,
    tvSymbol: position.tvSymbol,
    type: position.type || "stock",
  });
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

  function handleSelectHomeAsset(item) {
    const nextAsset = buildMarketAsset(item);
    if (!nextAsset) return;
    setHomeMarketActiveAsset(nextAsset);
    setHomeMarketSearchResults([]);
    setNewSymbol("");
  }

  function handleRemoveSymbol(id) {
    const remaining = watchlist.filter((item) => item.id !== id);
    setWatchlist(remaining);
    if (selectedMarketId === id) setSelectedMarketId(remaining[0]?.id || "");
  }

  async function handleSimulationSearchChange(value) {
    setSimulationSearchQuery(value);
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
    setSelectedSimulationPositionId(null);
    setSimulationAsset(nextAsset);
    setSimulationSearchQuery(nextAsset.id);
    setSimulationSearchResults([]);
  }

  function handleSelectSimulationTradeAsset(position) {
    if (!position) return;
    const nextAsset = buildSimulationAssetFromPosition(position);
    if (!nextAsset) return;
    setSelectedSimulationPositionId(position.id || null);
    setSimulationMode(position.marketMode || "live");
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

  function handleBeginnerIntelExplain(item) {
    if (!item?.symbol) return;
    const symbol = String(item.symbol).toUpperCase();
    const question = `Why is ${symbol} on the radar right now, and what kind of setup does this suggest for a beginner trader?`;
    const intelContext = {
      contextType: "chart",
      symbol,
      assetName: item.name || symbol,
      assetType: CRYPTO_SYMBOL_SET.has(symbol) ? "crypto" : "stock",
    };
    openChartExplainPopup(intelContext, question);
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
    const topDriverEntry = item.breakdown
      ? Object.entries(item.breakdown)
        .filter(([key]) => key !== "total")
        .sort((a, b) => Math.abs(Number(b[1]) || 0) - Math.abs(Number(a[1]) || 0))[0]
      : null;
    const intelSignal = {
      symbol: upperSymbol,
      score: Number(item.score) || 0,
      summary: item.summary || "",
      sentimentLabel: getScoreLabel(Number(item.score) || 0).label,
      topDriverKey: topDriverEntry?.[0] || "",
      topDriverValue: Number(topDriverEntry?.[1]) || 0,
    };
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
    const launch = {
      handoffId: crypto.randomUUID(),
      asset: nextAsset,
      direction: draft.direction,
      intelSignal,
      message: buildIntelSimulationPrompt(intelSignal),
      requestedAt: Date.now(),
      skipRaylaPopup: false,
    };

    if (simulationPositions.some((position) =>
      (position.marketMode || "live") === "live"
      && normalizeAssetId(position.asset, position.type, position.tvSymbol) === normalizeAssetId(upperSymbol)
    )) {
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

    launchIntelPracticeMode("live", {
      launch,
      draft,
    });
  }

  useEffect(() => {
    if (!guidedSimulationDraft) return;

    const nextAsset = buildMarketAsset({
      symbol: guidedSimulationDraft.asset,
      description: guidedSimulationDraft.label || guidedSimulationDraft.asset,
      tvSymbol: guidedSimulationDraft.tvSymbol,
    });

    if (nextAsset) {
      setSelectedSimulationPositionId(null);
      setSimulationAsset(nextAsset);
    }
    setSimulationSearchQuery(guidedSimulationDraft.asset || "");
    setSimulationDirection(guidedSimulationDraft.direction || "long");
    setSimulationSetupType(normalizeSetupType(guidedSimulationDraft.setupType) || "");
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

  const visibleSimulationPositions = useMemo(
    () => simulationPositions.filter((position) => (position.marketMode || "live") === simulationMode),
    [simulationPositions, simulationMode]
  );
  const selectedSimulationPositionAsset = useMemo(() => {
    const exactSelection = selectedSimulationPositionId
      ? visibleSimulationPositions.find((position) => position.id === selectedSimulationPositionId) || null
      : null;
    const newestVisiblePosition = [...visibleSimulationPositions]
      .sort((a, b) => Number(b?.openedAt || 0) - Number(a?.openedAt || 0))[0] || null;
    const assetMatchPosition = simulationAsset
      ? visibleSimulationPositions.find((position) => (
        normalizeAssetId(position.asset, position.type, position.tvSymbol)
          === normalizeAssetId(simulationAsset.id, simulationAsset.type, simulationAsset.tvSymbol)
      )) || null
      : null;
    return buildSimulationAssetFromPosition(exactSelection || assetMatchPosition || newestVisiblePosition);
  }, [visibleSimulationPositions, selectedSimulationPositionId, simulationAsset]);
  const selectedSimulationItem = selectedSimulationPositionAsset || simulationAsset || marketItems.find((item) => item.id === selectedMarketId) || marketItems[0];
  const selectedSimulationAssetExplicitlyUnsupported = selectedSimulationItem?.alpacaSupported === false || selectedSimulationItem?.tradable === false;
  const previousSelectedSimulationAssetIdRef = useRef(simulationAsset?.id || null);
  const selectedSimulationPrice = selectedSimulationItem ? getSimulationPrice(selectedSimulationItem.id) : null;
  const simulationLiveChartBars = extractVisibleChartBars(simulationLiveChart, simulationLiveChartRange);
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
    setSimulationLiveChart(null);
    setSimulationLiveChartLoading(true);

    async function fetchSimulationLiveChart() {
      try {
        const { data, error } = await supabase.functions.invoke("market-data", {
          body: {
            chartSymbol: selectedSimulationItem.id,
            chartType: selectedSimulationItem.type || "stock",
            chartRange: simulationLiveChartSelection.fetchRange,
            chartTimeframe: simulationLiveChartSelection.provider || null,
          },
        });

        if (isCancelled || error || !data?.ok) return;

        const nextChart = data.chart || null;
        const nextBars = extractChartBars(nextChart);
        if (nextChart && nextBars.length >= 2) {
          syncQuoteFromChart(selectedSimulationItem, nextChart);
          setSimulationLiveChart({
            ...nextChart,
            symbol: nextChart.symbol || selectedSimulationItem.id,
          });
          setSimulationLiveChartLastUpdated(new Date());
          return;
        }

        setSimulationLiveChart({
          symbol: selectedSimulationItem.id,
          range: simulationLiveChartSelection.fetchRange,
          bars: [],
          rangeMode: nextChart?.rangeMode || null,
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
    if (simulationMode !== "live" || !selectedSimulationItem || (!simulationLiveChartSelection.provider && simulationLiveChartSelection.fetchRange !== "1D")) return;
    const isCryptoSimAsset = (selectedSimulationItem.type || "stock") === "crypto";
    const interval = setInterval(
      () => setSimulationLiveChartRefreshTick((prev) => prev + 1),
      (isCryptoSimAsset || isMarketCurrentlyOpen()) ? 10000 : 30000
    );
    return () => clearInterval(interval);
  }, [simulationMode, selectedSimulationItem?.id, selectedSimulationItem?.type, simulationLiveChartRange]);

  useEffect(() => {
    if (simulationMode !== "live" && simulationLivePaused) {
      setSimulationLivePaused(false);
      setSimulationLivePauseSnapshot({});
    }
  }, [simulationMode, simulationLivePaused]);

  const visibleScenarioChartSeries = selectedScenarioSeries;
  const visibleNoLimitScenarioDurationMs = simulationScenarioNoLimit
    ? Math.max(0, visibleScenarioChartSeries.length - 1) * scenarioIntervalMs * getScenarioSpeedMultiplier(simulationScenarioSpeed)
    : 0;
  const scenarioDisplayedDurationMs = simulationScenarioNoLimit
    ? visibleNoLimitScenarioDurationMs
    : scenarioDurationMs;
  const selectedSimulationOpenPosition = useMemo(() => {
    const explicitSelection = selectedSimulationPositionId
      ? visibleSimulationPositions.find((position) => position.id === selectedSimulationPositionId) || null
      : null;
    if (explicitSelection) return explicitSelection;

    if (selectedSimulationItem) {
      const assetMatch = visibleSimulationPositions.find((position) => (
        normalizeAssetId(position.asset, position.type, position.tvSymbol)
          === normalizeAssetId(selectedSimulationItem.id, selectedSimulationItem.type, selectedSimulationItem.tvSymbol)
      )) || null;
      if (assetMatch) return assetMatch;
    }

    return [...visibleSimulationPositions]
      .sort((a, b) => Number(b?.openedAt || 0) - Number(a?.openedAt || 0))[0] || null;
  }, [visibleSimulationPositions, selectedSimulationPositionId, selectedSimulationItem]);
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
  const simulationCoachLevels = simulationCoachPosition
    ? getSimulationPriceLevels(simulationCoachPosition)
    : { entryPrice: null, stopPrice: null, targetPrice: null, quantity: null };
  const simulationActiveTradeContext = simulationCoachPosition
    ? buildSimulationActiveTradeContext({
        position: simulationCoachPosition,
        currentPrice: simulationCoachPrice,
        metrics: simulationCoachMetrics,
        levels: simulationCoachLevels,
        timeInTrade: formatTimeInTrade(simulationCoachPosition),
      })
    : null;
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

  // Post-trade review opens via "Ask Rayla" in the inline reflection section, not automatically

  const selectedSimulationOpenPositionLevels = selectedSimulationOpenPosition
    ? getSimulationPriceLevels(selectedSimulationOpenPosition)
    : { entryPrice: null, stopPrice: null, targetPrice: null, quantity: null };
  const scenarioChartBars = useMemo(() => {
    if (simulationMode !== "scenario") return [];
    return simulationScenarioBarsByAsset[selectedSimulationItem?.id] || [];
  }, [simulationMode, simulationScenarioBarsByAsset, selectedSimulationItem?.id]);
  const scenarioTickMarkFormatter = useMemo(() => {
    if (scenarioChartBars.length < 2) return null;
    const startMs = chartTimeToMs(scenarioChartBars[0].time);
    const endMs = chartTimeToMs(scenarioChartBars[scenarioChartBars.length - 1].time);
    const totalSpanMs = Math.max(0, endMs - startMs);

    return (time) => {
      const valueMs = chartTimeToMs(time);
      if (!Number.isFinite(valueMs)) return "";
      const elapsedMs = Math.max(0, valueMs - startMs);

      if (totalSpanMs <= 60 * 60 * 1000) {
        return formatScenarioAxisLabel(elapsedMs, Math.max(totalSpanMs, 1000));
      }

      if (totalSpanMs <= 24 * 60 * 60 * 1000) {
        return new Date(valueMs).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      }

      return new Date(valueMs).toLocaleDateString([], {
        month: "short",
        day: "numeric",
        hour: totalSpanMs <= 7 * 24 * 60 * 60 * 1000 ? "numeric" : undefined,
      });
    };
  }, [scenarioChartBars]);
  const scenarioUsesSecondLabels = scenarioDisplayedDurationMs > 0 && scenarioDisplayedDurationMs <= 60 * 60 * 1000;
  const scenarioPriceScaleAnchor = selectedSimulationOpenPositionLevels.entryPrice
    ?? Number(scenarioChartBars[0]?.open ?? scenarioChartBars[0]?.close ?? selectedSimulationPrice);
  const scenarioStablePriceRange = useMemo(
    () => buildStableScenarioPriceRange({
      bars: scenarioChartBars,
      anchorPrice: scenarioPriceScaleAnchor,
      currentPrice: selectedSimulationPrice,
      stopPrice: selectedSimulationOpenPositionLevels.stopPrice,
      targetPrice: selectedSimulationOpenPositionLevels.targetPrice,
    }),
    [
      scenarioChartBars,
      scenarioPriceScaleAnchor,
      selectedSimulationPrice,
      selectedSimulationOpenPositionLevels.stopPrice,
      selectedSimulationOpenPositionLevels.targetPrice,
    ]
  );
  const scenarioDrawingStorageKey = selectedSimulationItem?.id
    ? buildChartDrawingsStorageKey(selectedSimulationItem.id, "simulation_scenario")
    : null;
  useEffect(() => {
    if (!scenarioDrawingStorageKey) return;
    setChartDrawings((prev) => (
      Object.prototype.hasOwnProperty.call(prev, scenarioDrawingStorageKey)
        ? prev
        : { ...prev, [scenarioDrawingStorageKey]: readChartDrawingsFromStorage(scenarioDrawingStorageKey) }
    ));
  }, [scenarioDrawingStorageKey]);
  useEffect(() => {
    if (scenarioDrawingStorageKey && Array.isArray(chartDrawings[scenarioDrawingStorageKey])) {
      writeChartDrawingsToStorage(scenarioDrawingStorageKey, chartDrawings[scenarioDrawingStorageKey]);
    }
  }, [scenarioDrawingStorageKey, chartDrawings]);
  const scenarioVisibleDrawings = useMemo(
    () => (scenarioDrawingStorageKey ? (chartDrawings[scenarioDrawingStorageKey] || []) : []),
    [chartDrawings, scenarioDrawingStorageKey]
  );
  const scenarioDrawingStatus = simulationScenarioDrawingMode === "horizontal"
    ? "Click the scenario chart to place a labeled line."
    : simulationScenarioDrawingMode === "profit"
      ? "Click the scenario chart to place a green profit line."
      : simulationScenarioDrawingMode === "loss"
        ? "Click the scenario chart to place a red loss line."
        : "";
  function updateStoredChartDrawings(storageKey, updater) {
    if (!storageKey) return;
    setChartDrawings((prev) => {
      const current = Array.isArray(prev[storageKey]) ? prev[storageKey] : [];
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [storageKey]: Array.isArray(next) ? next.map(normalizeStoredChartDrawing).filter(Boolean) : [] };
    });
  }

  function undoStoredChartDrawing(storageKey) {
    updateStoredChartDrawings(storageKey, (current) => current.slice(0, -1));
  }

  function clearStoredChartDrawings(storageKey) {
    updateStoredChartDrawings(storageKey, []);
    if (storageKey && typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // Ignore localStorage clear failures.
      }
    }
  }

  function buildUserHorizontalDrawing(mode, point, promptMessage) {
    if (!point) return null;
    let label = mode === "profit" ? "Profit Target" : mode === "loss" ? "Max Loss" : "";
    const color = mode === "profit"
      ? "rgba(74,222,128,0.92)"
      : mode === "loss"
        ? "rgba(248,113,113,0.92)"
        : "rgba(226,232,240,0.82)";
    if (mode === "horizontal") {
      const customLabel = window.prompt(promptMessage || "Label this line:");
      if (!customLabel || !customLabel.trim()) return null;
      label = customLabel.trim().slice(0, 48);
    }
    return {
      id: crypto.randomUUID(),
      type: "horizontal",
      points: [{ time: Number(point.time), price: Number(point.price) }],
      label,
      text: label,
      color,
    };
  }

  function handleScenarioChartAnnotationClick(point) {
    if (simulationMode !== "scenario" || !selectedSimulationItem || !point) return;
    if (simulationScenarioDrawingMode !== "none") {
      const drawing = buildUserHorizontalDrawing(simulationScenarioDrawingMode, point, "Label this line:");
      if (!drawing) return;
      updateStoredChartDrawings(scenarioDrawingStorageKey, (prev) => [...prev, drawing]);
      setSimulationScenarioDrawingMode("none");
      return;
    }
    const chartCtx = buildChartExplainContext({
      symbol: selectedSimulationItem.id,
      assetName: selectedSimulationItem.description || selectedSimulationItem.name || selectedSimulationItem.id,
      assetType: selectedSimulationItem.type || "stock",
      range: simulationChartTimeframeConfig.label,
      bars: scenarioChartBars,
      currentPrice: getSimulationPrice(selectedSimulationItem.id, "scenario"),
    });
    handleChartTapCoachingQuestion(point, scenarioChartBars, chartCtx);
  }

  function clearScenarioDrawings() {
    clearStoredChartDrawings(scenarioDrawingStorageKey);
  }

  function returnLiveSimulationToCurrentMarket() {
    setSimulationLivePauseSnapshot({});
    setSimulationLivePaused(false);
    setSimulationLiveChartRefreshTick((prev) => prev + 1);
  }
  const simulationModeLabel = simulationMode === "scenario" ? "Scenario" : "Live";
  const simulationHowToTitle = simulationMode === "scenario" ? "How to use Scenario Training" : "How to use Live Simulation";
  const simulationHowToSteps = simulationMode === "scenario"
    ? [
        "1. Search the asset you want to train on",
        "2. Choose Scenario type: Uptrend, Downtrend, Range, or Realistic",
        "3. No Limit runs until you close. Bounded ends after the full duration.",
        "4. Set direction, size, and exit plan before pressing Play",
        "5. Chart projects forward from the Now anchor — make decisions as it unfolds",
        "6. Use the open-trade panel to track entry, price, and P/L",
        "7. Review the summary after close. AI coaching available in Realistic mode.",
        "8. Repeat with a new condition. Consistent reps build the edge.",
      ]
    : [
        "1. Search the asset you want to practice",
        "2. Choose Long or Short. Set size in dollars or shares.",
        "3. Define your exit plan: stop and optional target",
        "4. Open the trade. Market updates the rep in real time.",
        "5. Compare price behavior against your plan on the chart",
        "6. Close manually or let the simulator hit your stop or target",
        "7. Review execution grade and session stats after close",
        "8. Repeat reps to sharpen execution, patience, and discipline",
      ];
  const simulationAmountPlaceholder = simulationAmountMode === "shares" ? "Shares / units" : "Amount ($)";
  const simulationStopPlaceholder = simulationExitMode === "pnl" ? "Max loss ($)" : "Stop loss price";
  const simulationTargetPlaceholder = simulationExitMode === "pnl" ? "Profit target ($)" : "Take profit price";
  const beginnerSimulationSteps = [
    {
      title: "1. Pick your asset",
      text: simulationMode === "scenario"
        ? "Search the asset you want to train on. The chart will generate a forward-projection rep."
        : "Search the asset. The live chart updates immediately so you can read current behavior.",
    },
    {
      title: "2. Choose your trade size",
      text: simulationAmountMode === "dollars"
        ? "Dollars = total cash in the rep. Shares = number of units."
        : "Shares = number of units. Dollars = total cash committed.",
    },
    {
      title: "3. Define your risk plan",
      text: simulationExitMode === "price"
        ? "Stop = where you're wrong. Target = where you get paid."
        : "Max loss closes the trade at that dollar loss. Profit target closes it when you hit that gain.",
    },
    {
      title: simulationMode === "scenario" ? "4. Start the rep" : "4. Read the live rep",
      text: simulationMode === "scenario"
        ? "Press Play. No Limit keeps running until you close. Bounded mode ends after the full duration."
        : "Watch the chart and open-trade panel together. Is price still earning the right to stay open?",
    },
    {
      title: "5. Review after close",
      text: simulationMode === "scenario"
        ? "Realistic mode unlocks AI coaching after close. Use it."
        : "Check execution grade and session stats. Win/loss isn't the only signal.",
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
  const simulationRaylaContext = buildSimulationRaylaContext({
    mode: simulationModeLabel,
    symbol: selectedSimulationItem?.id || "",
    assetName: selectedSimulationItem?.description || selectedSimulationItem?.name || selectedSimulationItem?.id || "",
    assetType: selectedSimulationItem?.type || "stock",
    timeframe: simulationMode === "live"
      ? getChartSelectionConfig(simulationLiveChartRange).label
      : simulationChartTimeframeConfig.label,
    currentPrice: selectedSimulationPrice,
    direction: simulationDirection,
    amount: simulationAmount,
    amountMode: simulationAmountMode,
    stopLoss: simulationStopLoss,
    takeProfit: simulationTakeProfit,
    intelSignal: pendingIntelSimulationLaunch?.intelSignal || null,
    activeTrade: simulationActiveTradeContext,
    sessionStats: {
      totalPnL: simulationStatsTotalPnL,
      closedTrades: simulationStatsTradeHistory.length,
      avgProfitLoss: simulationStatsProfile.avgProfitLoss,
      totalTrades: simulationStatsProfile.totalTrades,
      winRate: simulationStatsProfile.winRate,
      avgRMultiple: simulationStatsProfile.avgRMultiple,
    },
  });


  useEffect(() => {
    const currentAssetId = simulationAsset?.id || null;
    if (previousSelectedSimulationAssetIdRef.current !== currentAssetId) {
      setSimulationStopLoss("");
      setSimulationTakeProfit("");
    }
    previousSelectedSimulationAssetIdRef.current = currentAssetId;
  }, [simulationAsset?.id]);

  useEffect(() => {
    if (activeTab !== "simulation" || !selectedSimulationOpenPosition) return;
    const nextAsset = buildSimulationAssetFromPosition(selectedSimulationOpenPosition);
    if (!nextAsset) return;
    if (simulationAsset?.id !== nextAsset.id) {
      setSimulationAsset(nextAsset);
    }
    if (!simulationSearchQuery || simulationSearchQuery === simulationAsset?.id) {
      setSimulationSearchQuery(nextAsset.id);
    }
  }, [activeTab, selectedSimulationOpenPosition, simulationAsset?.id, simulationSearchQuery]);

  useEffect(() => {
    if (!simulationPendingScenarioDecision || selectedSimulationOpenPosition?.id !== simulationPendingScenarioDecision.positionId) return;
    setSimulationExitMode(selectedSimulationOpenPosition.exitMode || "price");
    setSimulationStopLoss(selectedSimulationOpenPosition.stopLoss != null ? String(selectedSimulationOpenPosition.stopLoss) : "");
    setSimulationTakeProfit(selectedSimulationOpenPosition.takeProfit != null ? String(selectedSimulationOpenPosition.takeProfit) : "");
  }, [simulationPendingScenarioDecision, selectedSimulationOpenPosition]);

  useEffect(() => {
    if (!simulationPendingLiveDecision || selectedSimulationOpenPosition?.id !== simulationPendingLiveDecision.positionId) return;
    setSimulationExitMode(selectedSimulationOpenPosition.exitMode || "price");
    setSimulationStopLoss(selectedSimulationOpenPosition.stopLoss != null ? String(selectedSimulationOpenPosition.stopLoss) : "");
    setSimulationTakeProfit(selectedSimulationOpenPosition.takeProfit != null ? String(selectedSimulationOpenPosition.takeProfit) : "");
  }, [simulationPendingLiveDecision, selectedSimulationOpenPosition]);

  useEffect(() => {
    if (!pendingIntelSimulationLaunch) return;
    if (activeTab !== "simulation" || simulationMode !== (pendingIntelSimulationLaunch.mode || "live")) return;
    if (!simulationAsset || simulationAsset.id !== pendingIntelSimulationLaunch.asset?.id) return;

    const chartNode = simulationSectionRefs.current.chart;
    if (!chartNode) return;

    const frameId = window.requestAnimationFrame(() => {
      chartNode.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
      openIntelSimulationRaylaPopup(pendingIntelSimulationLaunch);
      setPendingIntelSimulationLaunch(null);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [pendingIntelSimulationLaunch, activeTab, simulationMode, simulationAsset]);

  useEffect(() => {
    if (!simulationRaylaPromptTradeId) return;
    if (simulationPositions.some((position) => position.id === simulationRaylaPromptTradeId)) return;
    setSimulationRaylaPromptTradeId(null);
  }, [simulationRaylaPromptTradeId, simulationPositions]);

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
      if (
        (position.marketMode === "scenario" && simulationPendingScenarioDecision?.positionId === position.id)
        || (position.marketMode !== "scenario" && simulationPendingLiveDecision?.positionId === position.id)
      ) {
        continue;
      }
      const metrics = calculateSimulationPnL(position, currentPrice);
      const { stopPrice, targetPrice } = getSimulationPriceLevels(position);

      if (position.exitMode === "pnl") {
        if (position.marketMode === "scenario" && position.stopLoss != null && metrics.profitLoss <= -Math.abs(position.stopLoss)) {
          if (position.marketMode === "scenario") {
            pauseScenarioPlayback();
            setSimulationPendingScenarioDecision({ positionId: position.id, exitPrice: currentPrice, exitReason: "P/L Stop Hit" });
          }
          return;
        }
        if (position.marketMode === "scenario" && position.takeProfit != null && metrics.profitLoss >= position.takeProfit) {
          if (position.marketMode === "scenario") {
            pauseScenarioPlayback();
            setSimulationPendingScenarioDecision({ positionId: position.id, exitPrice: currentPrice, exitReason: "P/L Target Hit" });
          }
          return;
        }
      }

      if (position.direction === "long") {
        if (stopPrice != null && currentPrice <= stopPrice) {
          if (position.marketMode === "scenario") {
            pauseScenarioPlayback();
            setSimulationPendingScenarioDecision({ positionId: position.id, exitPrice: stopPrice, exitReason: "Stop Hit" });
          } else {
            setSimulationPendingLiveDecision({ positionId: position.id, exitPrice: stopPrice, exitReason: "Stop Hit" });
          }
          return;
        }
        if (targetPrice != null && currentPrice >= targetPrice) {
          if (position.marketMode === "scenario") {
            pauseScenarioPlayback();
            setSimulationPendingScenarioDecision({ positionId: position.id, exitPrice: targetPrice, exitReason: "Target Hit" });
          } else {
            setSimulationPendingLiveDecision({ positionId: position.id, exitPrice: targetPrice, exitReason: "Target Hit" });
          }
          return;
        }
        continue;
      }

      if (stopPrice != null && currentPrice >= stopPrice) {
        if (position.marketMode === "scenario") {
          pauseScenarioPlayback();
          setSimulationPendingScenarioDecision({ positionId: position.id, exitPrice: stopPrice, exitReason: "Stop Hit" });
        } else {
          setSimulationPendingLiveDecision({ positionId: position.id, exitPrice: stopPrice, exitReason: "Stop Hit" });
        }
        return;
      }
      if (targetPrice != null && currentPrice <= targetPrice) {
        if (position.marketMode === "scenario") {
          pauseScenarioPlayback();
          setSimulationPendingScenarioDecision({ positionId: position.id, exitPrice: targetPrice, exitReason: "Target Hit" });
        } else {
          setSimulationPendingLiveDecision({ positionId: position.id, exitPrice: targetPrice, exitReason: "Target Hit" });
        }
        return;
      }
    }
  }, [simulationPositions, simulationQuotes, simulationScenarioQuotes, simulationMode, marketItems, simulationPendingScenarioDecision, simulationPendingLiveDecision]);

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
          As you get more comfortable, Rayla will automatically adjust and give you more depth when your questions and behavior show you are ready for it.
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
        <img src="/rayla-logo.png" alt="Rayla" style={{ height: '20px', width: 'auto', objectFit: 'contain', display: 'block' }} />
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
        {activeTab !== "home" && (
          <div className="topbar">
            <div>
              <p className="eyebrow">Rayla</p>
              <p className="subheading">Trading clarity, practice, and performance in one place.</p>
            </div>
          </div>
        )}

        {activeTab === "home" && (
          <>
            <style>{`
              @keyframes badgerPulse {
                0%, 100% { opacity: 0.85; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.08); }
              }
              .homeLayout {
                display: flex;
                flex-direction: row;
                height: 100vh;
                overflow: hidden;
                margin: -24px;
                background: #050d1f;
              }
              .homeLeft {
                flex: 1;
                min-width: 0;
                background: #060f1e;
                display: flex;
                flex-direction: column;
                height: 100%;
                overflow: hidden;
              }
              .homeRight {
                flex: 1.2;
                min-width: 0;
                background: #0a1628;
                border-left: 1px solid rgba(122,168,216,0.12);
                display: flex;
                flex-direction: column;
                height: 100%;
                overflow-y: auto;
                overflow-x: hidden;
              }
              .homeRightFullscreen {
                flex: 1 1 100%;
                width: 100%;
                border-left: none;
              }
              @media (max-width: 767px) {
                .homeLayout { flex-direction: column; height: auto; overflow: visible; }
                .homeLeft { min-height: 420px; overflow: visible; }
                .homeRight { height: auto; }
                .homeRightFullscreen { height: 100vh; }
              }
            `}</style>
            <div className="homeLayout">
              {/* Mobile segmented control — hidden on desktop via inline conditional */}
              {isMobileView && (
                <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 5, margin: "12px 16px 10px", gap: 2, flexShrink: 0 }}>
                  {[{ label: "Ask Rayla", index: 0 }, { label: "Live Market", index: 1 }].map(({ label, index }) => (
                    <button key={label} type="button" onClick={() => setHomeMobileTab(index)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: homeMobileTab === index ? "rgba(124,196,255,0.14)" : "transparent", color: homeMobileTab === index ? "#7CC4FF" : "#64748b", fontWeight: homeMobileTab === index ? 600 : 400, fontSize: 13, cursor: "pointer", transition: "color 0.15s ease, background 0.15s ease", whiteSpace: "nowrap", overflow: "hidden" }}>{label}</button>
                  ))}
                </div>
              )}
              {/* LEFT: Ask Rayla */}
              {!isHomeLiveChartFullscreen && (!isMobileView || homeMobileTab === 0) && (
              <div className="homeLeft">
                {/* Header */}
                <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(122,168,216,0.12)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <img src="/badger.png" alt="" style={{ width: 32, height: 32, objectFit: "contain", animation: "badgerPulse 3s ease-in-out infinite" }} />
                  <span style={{ color: "#7aa8d8", fontSize: 16, fontWeight: 600 }}>Ask Rayla</span>
                </div>
                {/* Scrollable middle */}
                <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  {!askRaylaHasMessages ? (
                    <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0 }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ color: "#7aa8d8", fontSize: 22, fontWeight: 300, letterSpacing: "0.08em", textTransform: "uppercase" }}>ASK RAYLA ANYTHING</div>
                        <div style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>Understand trades, charts, risk, and strategy in seconds.</div>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 24 }}>
                        {ASK_RAYLA_SUGGESTIONS.map((suggestion) => (
                          <button key={suggestion} type="button" disabled={isRaylaLoading}
                            onClick={async () => { try { await handleAskRaylaQuestion(suggestion, { clearInput: true, useChat: true }); } catch (err) { console.error("ASK RAYLA SUGGESTION ERROR:", err); } }}
                            style={{ background: "rgba(122,168,216,0.08)", border: "1px solid rgba(122,168,216,0.2)", color: "#7aa8d8", borderRadius: 20, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}
                          >{suggestion}</button>
                        ))}
                      </div>
                      {!raylaAdaptiveState.onboardingCompleted && activeRaylaAdaptiveQuestion ? (
                        <div style={{ width: "100%", maxWidth: 480, marginTop: 24, padding: 12, borderRadius: 14, background: "rgba(124,196,255,0.05)", border: "1px solid rgba(124,196,255,0.12)", display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
                          <div style={{ fontSize: 11, color: "#7CC4FF", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 700 }}>Rayla onboarding</div>
                          <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>{activeRaylaAdaptiveQuestion.prompt}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {activeRaylaAdaptiveQuestion.options.map((option) => (
                              <button key={`${activeRaylaAdaptiveQuestion.key}-${option}`} type="button" className="ghostButton"
                                onClick={() => handleRaylaAdaptiveOnboardingAnswer(activeRaylaAdaptiveQuestion.key, option)}
                                style={{ padding: "8px 12px", fontSize: 12, color: "#e2e8f0", borderColor: "rgba(124,196,255,0.16)", background: "rgba(124,196,255,0.06)" }}
                              >{option}</button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ color: "#64748b", fontSize: 11, textAlign: "center", marginTop: 24 }}>
                          Rayla adapts over time using your questions, simulation behavior, and prior interactions.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div ref={askRaylaThreadRef} style={{ flex: 1, overflowY: "auto", padding: "18px 18px 24px", display: "flex", flexDirection: "column", gap: 14, background: "linear-gradient(180deg, rgba(10,14,20,0.76), rgba(11,16,23,0.94))" }}>
                      {raylaChatMessages.map((message) => (
                        <div key={message.id} style={{ display: "flex", justifyContent: message.role === "user" ? "flex-end" : "flex-start" }}>
                          <div style={{ maxWidth: "78%", padding: "14px 16px", borderRadius: message.role === "user" ? "18px 18px 6px 18px" : "18px 18px 18px 6px", background: message.role === "user" ? "rgba(124,196,255,0.16)" : "rgba(255,255,255,0.04)", border: message.role === "user" ? "1px solid rgba(124,196,255,0.24)" : "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0", boxShadow: "0 12px 28px rgba(0,0,0,0.16)", display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={{ fontSize: 11, color: message.role === "user" ? "#93c5fd" : "#94a3b8", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase" }}>
                              {message.role === "user" ? "You" : "Rayla"}
                            </div>
                            {message.loading ? (
                              <div style={{ fontSize: 14, color: "#94a3b8" }}>Rayla is thinking...</div>
                            ) : (
                              <div style={{ fontSize: 14, color: "#e2e8f0", display: "flex", flexDirection: "column", gap: 12 }}>
                                {renderRaylaMessageContent(message.content)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {capitalGuideState.active && (
                        <div style={{ fontSize: 12, color: "#7CC4FF", lineHeight: 1.5 }}>Capital Guide is active. Answer the current question to keep going.</div>
                      )}
                      {activeCapitalGuideQuestion && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>Choose the best fit for this step:</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {activeCapitalGuideQuestion.options.map((option) => (
                              <button key={`${activeCapitalGuideQuestion.key}-${option}`} type="button" className="ghostButton" disabled={isRaylaLoading}
                                onClick={async () => { try { await handleAskRaylaQuestion(option, { clearInput: true, useChat: true }); } catch (err) { console.error("CAPITAL GUIDE OPTION ERROR:", err); } }}
                                style={{ padding: "8px 12px", fontSize: 12, color: "#e2e8f0", borderColor: "rgba(124,196,255,0.2)", background: "rgba(124,196,255,0.08)" }}
                              >{option}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {capitalGuideResult?.directions?.length ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {capitalGuideResult.directions.map((direction) => (
                            <div key={direction.id} style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 8 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{direction.title}</div>
                              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>{direction.body}</div>
                              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{direction.fit}</div>
                              <div><button type="button" className="ghostButton" onClick={() => handleTryCapitalGuideInScenario(direction)}>Try in Scenario</button></div>
                            </div>
                          ))}
                          {capitalGuideResult.confidenceLine && <div style={{ fontSize: 12, color: "#7f8ea3", lineHeight: 1.6 }}>{capitalGuideResult.confidenceLine}</div>}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
                {/* Bottom input — always visible */}
                <div style={{ flexShrink: 0, padding: "16px 20px", borderTop: "1px solid rgba(122,168,216,0.12)", background: "#060f1e" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (!aiInput.trim() || isRaylaLoading) return;
                          try { await handleAskRaylaQuestion(aiInput, { clearInput: true, useChat: true }); }
                          catch (err) { console.error("ASK RAYLA FETCH ERROR:", err); }
                        }
                      }}
                      placeholder="Ask anything"
                      style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(122,168,216,0.15)", borderRadius: 12, padding: "10px 14px", color: "#e2e8f0", fontSize: 14, outline: "none" }}
                    />
                    <button type="button" disabled={!aiInput.trim() || isRaylaLoading}
                      onClick={async () => { try { await handleAskRaylaQuestion(aiInput, { clearInput: true, useChat: true }); } catch (err) { console.error("ASK RAYLA FETCH ERROR:", err); } }}
                      style={{ background: "#7aa8d8", color: "#050d1f", borderRadius: 10, padding: "10px 14px", fontWeight: 700, fontSize: 14, border: "none", cursor: aiInput.trim() && !isRaylaLoading ? "pointer" : "default" }}
                    >↑</button>
                  </div>
                </div>
              </div>
              )}
              {/* RIGHT: Live Market */}
              {(!isMobileView || homeMobileTab === 1) && (
              <div className={`homeRight ${isHomeLiveChartFullscreen ? "homeRightFullscreen" : ""}`}>
                {/* Label */}
                <div style={{ padding: "16px 20px 8px", fontSize: 10, letterSpacing: 2, color: "#64748b", fontWeight: 600, textTransform: "uppercase", flexShrink: 0 }}>
                  Live Market
                </div>
                {/* Search bar */}
                <div style={{ position: "relative", padding: "0 20px 12px", flexShrink: 0 }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input
                      type="text"
                      value={newSymbol}
                      onChange={async (e) => {
                        const val = e.target.value;
                        setNewSymbol(val);
                        if (homeMarketSearchTimeoutRef.current) clearTimeout(homeMarketSearchTimeoutRef.current);
                        if (val.length < 1) { setHomeMarketSearchResults([]); return; }
                        homeMarketSearchTimeoutRef.current = setTimeout(async () => {
                          try {
                            const results = await searchRaylaSupportedAssets(val, Boolean(alpacaAccount));
                            setHomeMarketSearchResults(results);
                          } catch { setHomeMarketSearchResults([]); }
                        }, 120);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const resolved = resolveTickerAlias(newSymbol.trim());
                          const best = homeMarketSearchResults.find(r => r.symbol === resolved)
                            || homeMarketSearchResults.find(r => r.symbol === newSymbol.trim().toUpperCase())
                            || (homeMarketSearchResults.length === 1 ? homeMarketSearchResults[0] : null);
                          if (best || CRYPTO_SYMBOL_SET.has(resolved)) handleSelectHomeAsset(best || resolved);
                        }
                      }}
                      placeholder="Search symbol (AAPL, BTC, NVDA…)"
                      className="authInput"
                    />
                    <button type="button" onClick={() => {
                      const resolved = resolveTickerAlias(newSymbol.trim());
                      const best = homeMarketSearchResults.find(r => r.symbol === resolved)
                        || homeMarketSearchResults.find(r => r.symbol === newSymbol.trim().toUpperCase())
                        || (homeMarketSearchResults.length === 1 ? homeMarketSearchResults[0] : null);
                      if (!best && !CRYPTO_SYMBOL_SET.has(resolved)) {
                        showToast("Asset not found. Try a ticker like AAPL, TSLA, or BTC.", "warning");
                        return;
                      }
                      handleSelectHomeAsset(best || resolved);
                    }} className="ghostButton">Select</button>
                  </div>
                  {homeMarketSearchResults.length > 0 && (
                    <div style={{ position: "absolute", zIndex: 999, background: "#111827", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, left: 20, right: 20, maxHeight: 220, overflowY: "auto", marginTop: 4 }}>
                      {homeMarketSearchResults.map((r) => (
                        <div key={r.symbol} onClick={() => handleSelectHomeAsset(r)}
                          style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 700, color: "#fff", fontSize: 13 }}>{r.symbol}</span>
                          <span style={{ color: "#7f8ea3", fontSize: 12, marginLeft: 8 }}>{r.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Asset carousel */}
                <div style={{ padding: "0 20px 12px", flexShrink: 0 }}>
                  <AssetCarousel
                    assets={[...marketItems].sort((a, b) => a.id.localeCompare(b.id)).map((item) => ({
                      id: item.id,
                      symbol: item.id,
                      name: item.description || item.name || item.id,
                      type: item.type || "stock",
                      price: getLiveQuoteByAssetId(homeMarketQuotes, item.id, item.type, item.tvSymbol)?.price ?? item.priceValue,
                      change: getLiveQuoteByAssetId(homeMarketQuotes, item.id, item.type, item.tvSymbol)?.change ?? item.changeValue,
                    }))}
                    selectedId={selectedMarketId}
                    onSelect={(asset) => { setSelectedMarketId(asset.id); setHomeMarketActiveAsset(null); }}
                  />
                </div>
                {/* Range + Mode toggles */}
                <div style={{ padding: "0 20px 8px", flexShrink: 0, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <ChartTimeframeDropdown
                    value={homeMarketChartRange}
                    onChange={setHomeMarketChartRange}
                    options={LIVE_WIDGET_INTERVAL_OPTIONS}
                    width={88}
                  />
                  <button
                    type="button"
                    className="ghostButton"
                    onClick={() => setIsHomeLiveChartFullscreen((value) => !value)}
                    style={{ padding: "6px 12px", fontSize: 12, fontWeight: 700 }}
                  >
                    {isHomeLiveChartFullscreen ? "Back to normal" : "Full page"}
                  </button>
                  {homeMarketChartUpdatedLabel && (isMarketCurrentlyOpen() || String(homeMarketSelectedItem?.type || "").toLowerCase() === "crypto") && (
                    <div style={{ fontSize: 10, color: "#7f8ea3", marginLeft: "auto" }}>
                      Last updated: {homeMarketChartUpdatedLabel}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minHeight: isHomeLiveChartFullscreen ? "calc(100vh - 220px)" : 300, padding: "0 20px 20px", display: "flex", flexDirection: "column", position: "relative" }}>
                  {homeMarketSelectedItem && <MarketClosedBanner assetType={homeMarketSelectedItem.type} updatedLabel={homeMarketChartUpdatedLabel} />}
                  {homeMarketSelectedItem && homeMarketAssetExplicitlyUnsupported ? (
                    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 6, alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "0 24px" }}>
                      <div>Live chart unavailable</div>
                      <div>Alpaca does not currently support trading this asset.</div>
                    </div>
                  ) : homeMarketSelectedItem ? (
                    <TradingViewLiveChart
                      asset={homeMarketSelectedItem}
                      height="100%"
                      interval={homeMarketChartRange}
                      chartType="home_live"
                    />
                  ) : null}
                </div>
                {/* Ask Rayla → Explain chart */}
                {homeMarketSelectedItem && (
                  <div style={{ padding: "0 20px 16px", flexShrink: 0 }}>
                    <button type="button"
                      onClick={() => {
                        const context = buildChartExplainContext({
                          symbol: homeMarketSelectedItem.id,
                          assetName: homeMarketSelectedItem.description || homeMarketSelectedItem.name || homeMarketSelectedItem.id,
                          assetType: homeMarketSelectedItem.type || "stock",
                          range: homeMarketChartRange,
                          bars: homeMarketVisibleBars,
                          currentPrice: getLiveQuoteByAssetId(homeMarketQuotes, homeMarketSelectedItem.id, homeMarketSelectedItem.type, homeMarketSelectedItem.tvSymbol)?.price,
                        });
                        openChartExplainPopup(context, "Explain this chart");
                      }}
                      style={{ padding: "7px 12px", borderRadius: 999, border: "1px solid rgba(124,196,255,0.28)", background: "rgba(124,196,255,0.08)", color: "#d7efff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >Ask Rayla → Explain this chart</button>
                  </div>
                )}
              </div>
              )}
            </div>
          </>
        )}

        {activeTab === "trades" && (
          <div className="mainGrid" style={{ overflow: "visible" }}>
            <div className="span12">
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                <RaylaLaunchButton
                  label="Ask Rayla"
                  onClick={() => openGlobalRaylaPopup("Ask Rayla")}
                />
              </div>
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
                            {getAlpacaOrderActionLabel(pendingAlpacaOrderConfirmation.action)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Quantity</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{pendingAlpacaOrderConfirmation.qty}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Order Type</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
                            {getAlpacaOrderTypeLabel(pendingAlpacaOrderConfirmation.type)}
                          </div>
                        </div>
                        {(pendingAlpacaOrderConfirmation.type === "limit" || pendingAlpacaOrderConfirmation.type === "stop_limit") && (
                          <div>
                            <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Limit Price</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
                              {formatCurrency(pendingAlpacaOrderConfirmation.limitPrice)}
                            </div>
                          </div>
                        )}
                        {(pendingAlpacaOrderConfirmation.type === "stop" || pendingAlpacaOrderConfirmation.type === "stop_limit") && (
                          <div>
                            <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Stop Price</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
                              {formatCurrency(pendingAlpacaOrderConfirmation.stopPrice)}
                            </div>
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Time In Force</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
                            {getAlpacaTimeInForceLabel(pendingAlpacaOrderConfirmation.timeInForce)}
                          </div>
                        </div>
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
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Leverage Plan</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
                            {pendingAlpacaOrderConfirmation.leverage || "1x"}
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
                <div className="cardHeader"><h2>Rayla Trading Workspace</h2></div>
                <div className="cardBody" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                    Rayla keeps your connected broker account, live market context, and paper execution flow in one focused trading workspace.
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1.1fr) minmax(420px, 2fr)", gap: 14 }}>
                    <div style={{ padding: 14, borderRadius: 14, background: "linear-gradient(180deg, rgba(124,196,255,0.08), rgba(255,255,255,0.03))", border: "1px solid rgba(124,196,255,0.16)", display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "#7f8ea3" }}>
                        Broker Connection
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: alpacaAccount ? "#4ade80" : "#e2e8f0" }}>
                        {alpacaAccount ? "Connected Broker · Paper Trading" : "Broker not connected"}
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                        Rayla submits paper orders only after your confirmation. Live broker data stays synced to your workspace.
                      </div>
                      {alpacaAccount?.accountNumber ? (
                        <div style={{ fontSize: 11, color: "#7f8ea3" }}>
                          Broker detail: Alpaca Paper · Account {alpacaAccount.accountNumber}
                        </div>
                      ) : null}
                      {!alpacaAccount ? (
                        <button type="button" className="ghostButton" onClick={handleConnectAlpaca}>
                          Connect Broker
                        </button>
                      ) : (
                        <button type="button" className="ghostButton" onClick={() => fetchAlpacaBrokerData()}>
                          Refresh Broker Data
                        </button>
                      )}
                    </div>

                    <div style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "#7f8ea3" }}>
                        Account Snapshot
                      </div>
                      {alpacaAccount ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                          {[
                            { label: "Status", value: alpacaAccount.status || "--" },
                            { label: "Buying Power", value: formatCurrency(alpacaAccount.buyingPower), helpTopic: "buyingPower" },
                            { label: "Cash", value: formatCurrency(alpacaAccount.cash) },
                            { label: "Portfolio", value: formatCurrency(alpacaAccount.portfolioValue) },
                            { label: "Equity", value: formatCurrency(alpacaAccount.equity) },
                            {
                              label: "Day P/L",
                              value: (() => {
                                const dayPnL = calculateBrokerDayPnL(alpacaPositions);
                                return Number.isFinite(dayPnL) ? `${dayPnL >= 0 ? "+" : ""}${formatCurrency(dayPnL)}` : "--";
                              })(),
                              color: calculateBrokerDayPnL(alpacaPositions) >= 0 ? "#4ade80" : "#f87171",
                            },
                            {
                              label: "Margin",
                              value: Number(alpacaAccount.raw?.multiplier ?? 1) > 1
                                ? `${alpacaAccount.raw?.multiplier}x buying power`
                                : "Margin info unavailable",
                              helpTopic: "leverage",
                            },
                          ].map((item) => (
                            <div key={item.label}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                                <div style={{ fontSize: 12, color: "#7f8ea3" }}>{item.label}</div>
                                {item.helpTopic ? (
                                  <InlineHelpButton topic={item.helpTopic} activeTopic={tradeHelpTopic} onToggle={setTradeHelpTopic} />
                                ) : null}
                              </div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: item.color || "#e2e8f0" }}>{item.value}</div>
                              {item.helpTopic && tradeHelpTopic === item.helpTopic ? (
                                <InlineHelpCard topic={item.helpTopic} />
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                          Connect your paper broker to load status, buying power, cash, portfolio value, equity, and live trading context.
                        </div>
                      )}
                    </div>
                  </div>

                  {alpacaConnectionLoading && (
                    <div style={{ fontSize: 13, color: "#94a3b8" }}>
                      Loading broker data...
                    </div>
                  )}

                  {alpacaAccount && (
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(560px, 1.75fr) minmax(305px, 0.95fr) minmax(245px, 0.85fr)", gap: 14, alignItems: "stretch" }}>
                      <div style={{ order: 3, padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "#7f8ea3" }}>
                          Positions & Holdings
                        </div>
                        {alpacaPositions.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ fontSize: 10, color: "#7f8ea3", letterSpacing: "0.4px" }}>Select the portfolio or one asset to view</div>
                          </div>
                        )}
                        {alpacaPositions.length ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", minHeight: 0 }}>
                            {(() => {
                              const isPortfolioPending = tradeAppliedSelection.mode === "portfolio";
                              const portfolioMarketValue = alpacaPositions.reduce((sum, position) => sum + (Number(position?.marketValue) || 0), 0);
                              const portfolioUnrealizedPl = alpacaPositions.reduce((sum, position) => sum + (Number(position?.unrealizedPl) || 0), 0);
                              return (
                                <button
                                  type="button"
                                  onClick={() => applyTradeSelection({ mode: "portfolio", symbols: tradePortfolioAllSymbols })}
                                  style={{
                                    padding: 12,
                                    borderRadius: 12,
                                    background: isPortfolioPending ? "rgba(124,196,255,0.08)" : "rgba(255,255,255,0.03)",
                                    border: `1px solid ${isPortfolioPending ? "rgba(124,196,255,0.45)" : "rgba(255,255,255,0.06)"}`,
                                    boxShadow: isPortfolioPending ? "0 0 0 1px rgba(124,196,255,0.15), 0 0 18px rgba(124,196,255,0.08)" : "none",
                                    cursor: "pointer",
                                    textAlign: "left",
                                    width: "100%",
                                    transition: "border-color 160ms ease, background 160ms ease, box-shadow 160ms ease",
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>Portfolio</div>
                                    <div style={{ fontSize: 12, color: portfolioUnrealizedPl >= 0 ? "#4ade80" : "#f87171", fontWeight: 700 }}>
                                      {`${portfolioUnrealizedPl >= 0 ? "+" : ""}${formatCurrency(portfolioUnrealizedPl)}`}
                                    </div>
                                  </div>
                                  <div style={{ marginTop: 6, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                                    {alpacaPositions.length} assets selected · Combined value {formatCurrency(portfolioMarketValue)}
                                  </div>
                                </button>
                              );
                            })()}
                            {alpacaPositions.map((position) => (
                              <button
                                key={position.symbol}
                                type="button"
                                onClick={() => applyTradeSelection({ mode: "asset", symbols: [position.symbol] })}
                                style={{
                                  padding: 12,
                                  borderRadius: 12,
                                  background: tradeAppliedSelection.symbols.includes(position.symbol) && tradeAppliedSelection.mode === "asset" ? "rgba(124,196,255,0.08)" : "rgba(255,255,255,0.03)",
                                  border: `1px solid ${tradeAppliedSelection.symbols.includes(position.symbol) && tradeAppliedSelection.mode === "asset" ? "rgba(124,196,255,0.45)" : "rgba(255,255,255,0.06)"}`,
                                  boxShadow: tradeAppliedSelection.symbols.includes(position.symbol) && tradeAppliedSelection.mode === "asset" ? "0 0 0 1px rgba(124,196,255,0.15), 0 0 18px rgba(124,196,255,0.08)" : "none",
                                  cursor: "pointer",
                                  textAlign: "left",
                                  width: "100%",
                                  transition: "border-color 160ms ease, background 160ms ease, box-shadow 160ms ease",
                                }}
                                onMouseEnter={(e) => {
                                  if (!tradeAppliedSelection.symbols.includes(position.symbol) || tradeAppliedSelection.mode !== "asset") {
                                    e.currentTarget.style.borderColor = "rgba(124,196,255,0.18)";
                                    e.currentTarget.style.background = "rgba(124,196,255,0.05)";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!tradeAppliedSelection.symbols.includes(position.symbol) || tradeAppliedSelection.mode !== "asset") {
                                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                                    e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                                  }
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
                            No connected broker positions yet.
                          </div>
                        )}
                      </div>

                      {(() => {
                        return (
                          <div style={{ order: 1, padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "#7f8ea3" }}>
                              Live Market
                            </div>
                            {(!tradeIsComparisonMode && !tradeChartSymbol) ? (
                              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                                Select an asset or click a position to view live market context.
                              </div>
                            ) : (
                              <>
                                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                  <div>
                                    <div style={{ fontSize: 17, fontWeight: 700, color: "#e2e8f0" }}>
                                      {tradeAppliedSelection.mode === "portfolio"
                                        ? "Portfolio Performance"
                                        : tradeChartSymbol}
                                    </div>
                                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                                      {tradeAppliedSelection.mode === "portfolio"
                                        ? "Combined portfolio performance over time"
                                        : `${Number.isFinite(tradeChartCurrentPrice) ? formatCurrency(tradeChartCurrentPrice) : "--"}${tradeChartQuote?.change != null ? ` · ${tradeChartQuote.change >= 0 ? "+" : ""}${tradeChartQuote.change.toFixed(2)}%` : ""} · Live price chart`}
                                    </div>
                                  </div>
                                  {(tradeIsComparisonMode || tradeChartMatchingPosition) ? (
                                    <div style={{ fontSize: 12, fontWeight: 700, color: (tradeIsComparisonMode ? tradePortfolioCombinedUnrealizedPl : tradeChartMatchingPosition.unrealizedPl) >= 0 ? "#4ade80" : "#f87171" }}>
                                      {tradeIsComparisonMode
                                        ? `${tradePortfolioCombinedUnrealizedPl >= 0 ? "+" : ""}${formatCurrency(tradePortfolioCombinedUnrealizedPl)}`
                                        : `${tradeChartMatchingPosition.unrealizedPl >= 0 ? "+" : ""}${formatCurrency(tradeChartMatchingPosition.unrealizedPl)}`}
                                    </div>
                                  ) : null}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                      <ChartTimeframeDropdown
                                        value={tradeChartRange}
                                        onChange={setTradeChartRange}
                                        options={LIVE_WIDGET_INTERVAL_OPTIONS}
                                        width={88}
                                      />
                                    </div>
                                    {tradeIsComparisonMode ? (
                                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                        {[["line", "Line"]].map(([mode, label]) => (
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
                                    ) : null}
                                  </div>
                                {tradeChartUpdatedLabel && (
                                  <div style={{ fontSize: 10, color: "#7f8ea3" }}>
                                    Last updated: {tradeChartUpdatedLabel}
                                  </div>
                                )}
                              </div>
                              {tradeChartSymbol && !tradeIsComparisonMode && (
                                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const chartContext = buildChartExplainContext({
                                        symbol: tradeChartSymbol,
                                        assetName: tradeChartAsset?.description || tradeChartAsset?.name || tradeChartSymbol,
                                        assetType: tradeChartAsset?.type || "stock",
                                        range: tradeChartRange,
                                        bars: tradeVisibleBars,
                                        currentPrice: tradeChartCurrentPrice,
                                        positionSummary: tradeChartMatchingPosition
                                          ? {
                                              qty: tradeChartMatchingPosition.qty,
                                              avgEntryPrice: tradeChartMatchingPosition.avgEntryPrice,
                                              marketValue: tradeChartMatchingPosition.marketValue,
                                              unrealizedPl: tradeChartMatchingPosition.unrealizedPl,
                                              unrealizedPlpc: tradeChartMatchingPosition.unrealizedPlpc,
                                            }
                                          : null,
                                      });
                                      openChartExplainPopup(chartContext, "Explain this chart");
                                    }}
                                    style={{
                                      padding: "7px 12px",
                                      borderRadius: 999,
                                      border: "1px solid rgba(124,196,255,0.28)",
                                      background: "rgba(124,196,255,0.08)",
                                      color: "#d7efff",
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Ask Rayla → Explain this chart
                                  </button>
                                </div>
                              )}
                              {tradeIsComparisonMode ? (() => {
                                const palette = ["#60a5fa", "#34d399", "#f59e0b", "#f87171", "#a78bfa", "#fb923c"];
                                const xL = 20, xR = 194, yT = 8, yB = 100;
                                const chartW = xR - xL;
                                const chartH = yB - yT;
                                const lineInputs = tradePortfolioDisplayedPositions.map((pos, pi) => {
                                  const chart = tradePortfolioCharts[pos.symbol];
                                  const rawBars = Array.isArray(chart?.bars) ? chart.bars : [];
                                  const fallbackEntryResolution = resolveTradePortfolioEntryTime(pos, brokerTradeLog, trades);
                                  const entryTimeMs = chart?.entryTimeMs ?? fallbackEntryResolution.timeMs;
                                  const entryTimeSource = chart?.entryTimeSource ?? fallbackEntryResolution.source;
                                  const safeStartMs = Math.max(
                                    tradePortfolioRequestedStartMs ?? (rawBars[0]?.time ? new Date(rawBars[0].time).getTime() : tradePortfolioNowMs),
                                    Number.isFinite(entryTimeMs) ? entryTimeMs : tradePortfolioRequestedStartMs ?? 0
                                  );
                                  const filteredBars = rawBars
                                    .map((bar) => {
                                      const barTime = new Date(bar.time || bar.t || 0).getTime();
                                      return Number.isFinite(barTime) ? { ...bar, barTime } : null;
                                    })
                                    .filter(Boolean)
                                    .filter((bar) => bar.barTime >= safeStartMs);
                                  const baseline = Number(filteredBars[0]?.close);
                                  const points = Number.isFinite(baseline) && baseline > 0
                                    ? filteredBars.map((bar) => ({
                                        timeMs: bar.barTime,
                                        value: ((Number(bar.close) - baseline) / baseline) * 100,
                                      }))
                                    : [];
                                  if (DEBUG_CHARTS) {
                                    console.log("TRADING PORTFOLIO ENTRY CLIP", {
                                      symbol: pos.symbol,
                                      resolvedEntryOpenTimestamp: entryTimeMs ? new Date(entryTimeMs).toISOString() : null,
                                      sourceFieldUsed: entryTimeSource || null,
                                      selectedRangeStart: tradePortfolioRequestedStartMs ? new Date(tradePortfolioRequestedStartMs).toISOString() : null,
                                      firstChartPointAfterClipping: filteredBars[0]?.barTime ? new Date(filteredBars[0].barTime).toISOString() : null,
                                      chartPointCount: points.length,
                                    });
                                  }
                                  return {
                                    symbol: pos.symbol,
                                    color: palette[pi % palette.length],
                                    qty: Number(pos?.qty) || 0,
                                    rawBars: filteredBars,
                                    points,
                                    entryTimeMs,
                                  };
                                });
                                const portfolioLines = lineInputs
                                  .map((line) => ({
                                    ...line,
                                    series: line.points.map((point) => point.value),
                                    xRatios: line.points.map((point) => {
                                      const startMs = tradePortfolioRequestedStartMs ?? point.timeMs;
                                      const endMs = tradePortfolioNowMs;
                                      const denom = Math.max(1, endMs - startMs);
                                      return (point.timeMs - startMs) / denom;
                                    }),
                                  }))
                                  .filter((line) => line.series.length >= 2);
                                const totalPortfolioPoints = (() => {
                                  if (!tradeIsPortfolioTotalMode) return [];
                                  const timeMap = new Map();
                                  lineInputs.forEach((line) => {
                                    line.points.forEach((point) => {
                                      const existing = timeMap.get(point.timeMs) || {};
                                      existing[line.symbol] = point;
                                      timeMap.set(point.timeMs, existing);
                                    });
                                  });
                                  const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);
                                  const latestBySymbol = {};
                                  const totals = [];
                                  sortedTimes.forEach((timeMs) => {
                                    const updates = timeMap.get(timeMs) || {};
                                    Object.entries(updates).forEach(([symbol, point]) => {
                                      latestBySymbol[symbol] = point;
                                    });
                                    let totalValue = 0;
                                    let contributing = 0;
                                    lineInputs.forEach((line) => {
                                      const latest = latestBySymbol[line.symbol];
                                      if (!latest) return;
                                      let matchingRawBar = null;
                                      for (let index = 0; index < line.rawBars.length; index += 1) {
                                        const rawBar = line.rawBars[index];
                                        if (rawBar.barTime <= timeMs) {
                                          matchingRawBar = rawBar;
                                        } else {
                                          break;
                                        }
                                      }
                                      const closeValue = Number(matchingRawBar?.close);
                                      if (!Number.isFinite(closeValue)) return;
                                      totalValue += closeValue * line.qty;
                                      contributing += 1;
                                    });
                                    if (contributing > 0 && Number.isFinite(totalValue)) {
                                      totals.push({ timeMs, value: totalValue });
                                    }
                                  });
                                  const baseline = Number(totals[0]?.value);
                                  if (!Number.isFinite(baseline) || baseline <= 0) return [];
                                  return totals.map((point) => ({
                                    timeMs: point.timeMs,
                                    value: ((point.value - baseline) / baseline) * 100,
                                    rawValue: point.value,
                                  }));
                                })();
                                const displayedLines = tradeIsPortfolioTotalMode
                                  ? [{
                                      symbol: "Portfolio",
                                      color: "#7CC4FF",
                                      series: totalPortfolioPoints.map((point) => point.value),
                                      xRatios: totalPortfolioPoints.map((point) => {
                                        const startMs = tradePortfolioRequestedStartMs ?? point.timeMs;
                                        const endMs = tradePortfolioNowMs;
                                        const denom = Math.max(1, endMs - startMs);
                                        return (point.timeMs - startMs) / denom;
                                      }),
                                      points: totalPortfolioPoints,
                                    }]
                                  : portfolioLines;
                                const allVals = displayedLines.flatMap((l) => l.series).filter(Number.isFinite);
                                if (allVals.length < 2) {
                                  return (
                                    <div style={{ height: 560, borderRadius: 12, background: "rgba(13,17,23,0.8)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8" }}>
                                      {tradePortfolioChartsLoading ? "Loading portfolio chart..." : "No portfolio comparison data available"}
                                    </div>
                                  );
                                }
                                const pMin = Math.min(...allVals), pMax = Math.max(...allVals);
                                const pPad = (pMax - pMin) * 0.14 || 0.5;
                                const pLo = pMin - pPad, pHi = pMax + pPad;
                                const vy = (v) => yB - ((v - pLo) / (pHi - pLo || 1)) * chartH;
                                const ySteps = Array.from({ length: 4 }, (_, i) => {
                                  const ratio = i / 3;
                                  return { y: yT + chartH * ratio, val: pHi - (pHi - pLo) * ratio };
                                });
                                const tickStartMs = tradePortfolioRequestedStartMs ?? Math.min(...displayedLines.flatMap((line) => line.points.map((point) => point.timeMs)));
                                const tickEndMs = tradePortfolioNowMs;
                                const xTicks = buildTradePortfolioTicks(tickStartMs, tickEndMs, tradeChartRange);
                                return (
                                  <div style={{ height: 560, borderRadius: 12, background: "rgba(13,17,23,0.8)", border: "1px solid rgba(255,255,255,0.08)", padding: "10px 6px 6px 6px" }}>
                                    <svg viewBox="0 0 210 120" style={{ width: "100%", height: "100%" }}>
                                      {ySteps.map(({ y, val }, i) => (
                                        <g key={i}>
                                          <line x1={xL} y1={y} x2={xR} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
                                          <text x={xL - 2} y={y + 1.5} textAnchor="end" fontSize="5.5" fill="#7f8ea3" fontFamily="monospace">{val >= 0 ? "+" : ""}{val.toFixed(1)}%</text>
                                        </g>
                                      ))}
                                      <line x1={xL} y1={yT} x2={xL} y2={yB} stroke="rgba(255,255,255,0.1)" strokeWidth="0.4" />
                                      <line x1={xL} y1={yB} x2={xR} y2={yB} stroke="rgba(255,255,255,0.1)" strokeWidth="0.4" />
                                      {displayedLines.map(({ symbol, series, color, xRatios }) => {
                                        const n = series.length;
                                        if (n < 2) return null;
                                        const pts = series.map((v, i) => `${xL + (xRatios?.[i] ?? (i / (n - 1))) * chartW},${vy(v)}`).join(" ");
                                        return <polyline key={symbol} points={pts} fill="none" stroke={color} strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />;
                                      })}
                                      {xTicks.map((tick, index) => (
                                        <g key={`tick-${index}`}>
                                          <line x1={xL + tick.ratio * chartW} y1={yT} x2={xL + tick.ratio * chartW} y2={yB} stroke="rgba(255,255,255,0.025)" strokeWidth="0.4" />
                                          {tick.label ? (
                                            <text x={xL + tick.ratio * chartW} y={114.5} textAnchor="middle" fontSize="5.2" fill="#7f8ea3" fontFamily="monospace">
                                              {tick.label}
                                            </text>
                                          ) : null}
                                        </g>
                                      ))}
                                      {displayedLines.map(({ symbol, series, color, xRatios }) => {
                                        const n = series.length;
                                        const lastV = series[n - 1];
                                        const dotX = xL + (xRatios?.[n - 1] ?? 1) * chartW;
                                        const dotY = Math.max(8, Math.min(vy(lastV), yB - 2));
                                        return (
                                          <g key={symbol}>
                                            <circle cx={dotX} cy={dotY} r="3" fill={color} opacity="0.25">
                                              <animate attributeName="r" values="2;5;2" dur="2s" repeatCount="indefinite" />
                                              <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
                                            </circle>
                                            <circle cx={dotX} cy={dotY} r="2" fill={color} />
                                          </g>
                                        );
                                      })}
                                    </svg>
                                  </div>
                                );
                              })() : (
                                <div>
                                  <MarketClosedBanner assetType={tradePanelAssetType} updatedLabel={tradeChartUpdatedLabel} />
                                  <div style={{ height: 560, borderRadius: 12, overflow: "hidden", background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    {tradeChartAssetExplicitlyUnsupported ? (
                                      <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 6, alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "0 24px" }}>
                                        <div>Live chart unavailable</div>
                                        <div>Alpaca does not currently support trading this asset.</div>
                                      </div>
                                    ) : (
                                      <TradingViewLiveChart
                                        asset={tradeChartAsset}
                                        height="100%"
                                        interval={tradeChartRange}
                                        chartType="trades_live"
                                      />
                                    )}
                                  </div>
                                </div>
                              )}
                              {tradeIsComparisonMode ? (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                                  {(tradeIsPortfolioTotalMode
                                    ? [{ symbol: "Portfolio", color: "#7CC4FF" }]
                                    : tradePortfolioDisplayedPositions.map((position, index) => ({
                                        symbol: position.symbol,
                                        color: ["#60a5fa", "#34d399", "#f59e0b", "#f87171", "#a78bfa", "#fb923c"][index % 6],
                                      }))
                                  ).map((item) => {
                                    const { symbol, color } = item;
                                    return (
                                      <div key={symbol} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#cbd5e1", fontWeight: 600 }}>
                                        <span style={{ width: 10, height: 10, borderRadius: 999, background: color, boxShadow: `0 0 0 1px ${color}33` }} />
                                        <span>{symbol}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                                  <div>
                                    <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>{tradeIsComparisonMode ? "Assets Selected" : "Qty Held"}</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{tradeIsComparisonMode ? (tradeIsPortfolioTotalMode ? tradePortfolioAllSymbols.length : tradePortfolioDisplayedPositions.length) : tradeChartMatchingPosition ? tradeChartMatchingPosition.qty : "--"}</div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>{tradeIsComparisonMode ? "Comparison Mode" : "Avg Entry"}</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
                                      {tradeIsComparisonMode ? (tradeIsPortfolioTotalMode ? "Portfolio" : "% change") : tradeChartMatchingPosition ? formatCurrency(tradeChartMatchingPosition.avgEntryPrice) : "--"}
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Position Value</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
                                      {tradeIsComparisonMode
                                        ? formatCurrency(tradePortfolioCombinedMarketValue)
                                        : tradeChartMatchingPosition && Number.isFinite(tradeChartMatchingPosition.marketValue) ? formatCurrency(tradeChartMatchingPosition.marketValue) : "--"}
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Unrealized P/L</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: tradeIsComparisonMode ? (tradePortfolioCombinedUnrealizedPl >= 0 ? "#4ade80" : "#f87171") : tradeChartMatchingPosition?.unrealizedPl >= 0 ? "#4ade80" : tradeChartMatchingPosition ? "#f87171" : "#e2e8f0" }}>
                                      {tradeIsComparisonMode
                                        ? `${tradePortfolioCombinedUnrealizedPl >= 0 ? "+" : ""}${formatCurrency(tradePortfolioCombinedUnrealizedPl)}`
                                        : tradeChartMatchingPosition && Number.isFinite(tradeChartMatchingPosition.unrealizedPl)
                                        ? `${tradeChartMatchingPosition.unrealizedPl >= 0 ? "+" : ""}${formatCurrency(tradeChartMatchingPosition.unrealizedPl)}${Number.isFinite(tradeChartMatchingPosition.unrealizedPlpc) ? ` (${tradeChartMatchingPosition.unrealizedPlpc >= 0 ? "+" : ""}${(tradeChartMatchingPosition.unrealizedPlpc * 100).toFixed(1)}%)` : ""}`
                                        : "--"}
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()}

                      <div style={{ order: 2, padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "#7f8ea3" }}>
                          Order Ticket
                        </div>
                        {(() => {
                          const selectedSymbol = String(alpacaOrderForm.symbol || "").trim().toUpperCase();
                          if (!selectedSymbol) return null;

                          const matchingPosition = alpacaPositions.find((position) => position.symbol === selectedSymbol) || null;
                          const selectedOrderQuote = getKnownStockQuoteData(selectedSymbol, simulationQuotes, marketItems, alpacaAssetQuotes);
                          const selectedOrderAssetPrice = Number.isFinite(tradePanelCurrentPrice) && selectedSymbol === tradePanelSymbol
                            ? tradePanelCurrentPrice
                            : getKnownStockQuotePrice(selectedSymbol, simulationQuotes, marketItems, alpacaAssetQuotes);
                          const selectedOrderBid = Number(selectedOrderQuote?.bid);
                          const selectedOrderAsk = Number(selectedOrderQuote?.ask);
                          const selectedOrderLastTradePrice = Number(selectedOrderQuote?.lastTradePrice ?? selectedOrderQuote?.price);
                          const selectedOrderSpread = getQuoteSpread(selectedOrderQuote);
                          const orderQuoteIsFresh = isQuoteFresh(selectedOrderQuote);
                          const currentPositionPrice = Number.isFinite(selectedOrderAssetPrice)
                            ? selectedOrderAssetPrice
                            : matchingPosition?.currentPrice;
                          const unrealizedPl = matchingPosition?.unrealizedPl ?? null;
                          const unrealizedPlpc = matchingPosition?.unrealizedPlpc ?? null;
                          const selectedBrokerAsset = alpacaAssetSearchResults.find((asset) => asset.symbol === selectedSymbol)
                            || (tradeSelectedBrokerAsset?.symbol === selectedSymbol ? tradeSelectedBrokerAsset : null);
                          const accountMultiplier = Math.max(1, Number(alpacaAccount?.raw?.multiplier ?? 1) || 1);
                          const leverageAvailable = accountMultiplier > 1 && selectedBrokerAsset?.marginable;
                          const capabilityBadges = getBrokerCapabilityBadges({
                            tradable: selectedBrokerAsset?.tradable ?? true,
                            marginable: selectedBrokerAsset?.marginable ?? false,
                            shortable: selectedBrokerAsset?.shortable ?? false,
                            easyToBorrow: selectedBrokerAsset?.easyToBorrow ?? false,
                            assetClass: selectedBrokerAsset?.assetClass || matchingPosition?.assetClass || tradePanelAsset?.type || "us_equity",
                          });

                          return (
                            <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 8 }}>
                              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "#7f8ea3", marginBottom: 6 }}>
                                    Selected Asset
                                  </div>
                                  <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{selectedSymbol}</div>
                                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                                    {selectedBrokerAsset?.name || tradePanelAsset?.description || (matchingPosition ? "Connected broker position" : "Searching broker asset details")}
                                  </div>
                                </div>
                                {Number.isFinite(currentPositionPrice) ? (
                                  <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>
                                    {formatCurrency(currentPositionPrice)}
                                  </div>
                                ) : null}
                              </div>
                              {capabilityBadges.length ? (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {capabilityBadges.map((badge) => (
                                    <div
                                      key={badge.label}
                                      style={{
                                        padding: "4px 8px",
                                        borderRadius: 999,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        letterSpacing: "0.5px",
                                        ...getCapabilityBadgeStyle(badge.tone),
                                      }}
                                    >
                                      {badge.label}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              {matchingPosition ? (
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
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                                      <div style={{ fontSize: 12, color: "#7f8ea3" }}>Unrealized P/L</div>
                                      <InlineHelpButton topic="unrealizedPnL" activeTopic={tradeHelpTopic} onToggle={setTradeHelpTopic} />
                                    </div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: unrealizedPl >= 0 ? "#4ade80" : "#f87171" }}>
                                      {Number.isFinite(unrealizedPl)
                                        ? `${unrealizedPl >= 0 ? "+" : ""}${formatCurrency(unrealizedPl)}${Number.isFinite(unrealizedPlpc) ? ` (${unrealizedPlpc >= 0 ? "+" : ""}${(unrealizedPlpc * 100).toFixed(1)}%)` : ""}`
                                        : "--"}
                                    </div>
                                    {tradeHelpTopic === "unrealizedPnL" ? <InlineHelpCard topic="unrealizedPnL" /> : null}
                                  </div>
                                </div>
                              ) : (
                                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                                  {`No current position in ${selectedSymbol}.`}
                                </div>
                              )}
                              <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 6 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.9px", textTransform: "uppercase", color: "#7f8ea3" }}>
                                    Margin / Leverage
                                  </div>
                                  <InlineHelpButton topic="leverage" activeTopic={tradeHelpTopic} onToggle={setTradeHelpTopic} />
                                </div>
                                <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.55 }}>
                                  {leverageAvailable
                                    ? `Your account currently supports up to ${accountMultiplier}x buying power on marginable assets like ${selectedSymbol}. Leverage lets you control a bigger trade with less of your own money. It can make wins bigger, but it can also make losses bigger.`
                                    : "Leverage is not available for this Alpaca account."}
                                </div>
                                {tradeHelpTopic === "leverage" ? <InlineHelpCard topic="leverage" /> : null}
                              </div>
                              <div style={{ padding: 10, borderRadius: 10, background: "rgba(8,12,18,0.82)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 8 }}>
                                <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 }}>
                                  Chart is for visual reference. Rayla orders use Alpaca live market data.
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fbff" }}>
                                  Current Alpaca price: {Number.isFinite(selectedOrderAssetPrice) ? formatCurrency(selectedOrderAssetPrice) : "--"}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                                    Bid: <span style={{ color: "#e2e8f0" }}>{Number.isFinite(selectedOrderBid) ? formatCurrency(selectedOrderBid) : "--"}</span>
                                  </div>
                                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                                    Ask: <span style={{ color: "#e2e8f0" }}>{Number.isFinite(selectedOrderAsk) ? formatCurrency(selectedOrderAsk) : "--"}</span>
                                  </div>
                                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                                    Last trade: <span style={{ color: "#e2e8f0" }}>{Number.isFinite(selectedOrderLastTradePrice) ? formatCurrency(selectedOrderLastTradePrice) : "--"}</span>
                                  </div>
                                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                                    Spread: <span style={{ color: "#e2e8f0" }}>{Number.isFinite(selectedOrderSpread) ? formatCurrency(selectedOrderSpread) : "--"}</span>
                                  </div>
                                </div>
                                <div style={{ fontSize: 11, color: orderQuoteIsFresh ? "#7f8ea3" : "#fca5a5", lineHeight: 1.5 }}>
                                  {orderQuoteIsFresh
                                    ? `Last Alpaca update ${formatQuoteUpdatedAt(selectedOrderQuote?.updatedAt)}`
                                    : "Waiting for fresh Alpaca market data before placing order."}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        <form onSubmit={handleSubmitAlpacaOrder} style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                          <div style={{ position: "relative" }}>
                            {(() => {
                              const selectedOrderQuote = getKnownStockQuoteData(alpacaOrderForm.symbol, simulationQuotes, marketItems, alpacaAssetQuotes);
                              const selectedOrderAssetPrice = Number.isFinite(tradePanelCurrentPrice) && String(alpacaOrderForm.symbol || "").trim().toUpperCase() === tradePanelSymbol
                                ? tradePanelCurrentPrice
                                : getKnownStockQuotePrice(alpacaOrderForm.symbol, simulationQuotes, marketItems, alpacaAssetQuotes);
                              const orderQuoteIsFresh = isQuoteFresh(selectedOrderQuote);
                              return (
                                <>
                            <input
                              className="authInput"
                              placeholder="Search tradable asset (AAPL)"
                              value={alpacaOrderForm.symbol}
                              onChange={(e) => {
                                const nextSymbol = e.target.value.toUpperCase();
                                setAlpacaOrderForm((prev) => ({ ...prev, symbol: nextSymbol }));
                                setAlpacaSelectedAssetMeta((prev) => (prev?.symbol === nextSymbol ? prev : null));
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
                                    Searching tradable broker assets...
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
                                        setAlpacaSelectedAssetMeta(asset);
                                        setAlpacaAssetSearchResults([]);
                                        setAlpacaAssetSearchError("");
                                        setAlpacaAssetSearchOpen(false);
                                      }}
                                      style={{ width: "100%", textAlign: "left", padding: "10px 14px", cursor: "pointer", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "transparent", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                                    >
                                      <div>
                                        <div style={{ fontWeight: 700, color: "#fff", fontSize: 13 }}>{asset.symbol}</div>
                                        <div style={{ color: "#7f8ea3", fontSize: 12, marginTop: 2 }}>{asset.name}</div>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                                          {getBrokerCapabilityBadges(asset).map((badge) => (
                                            <span
                                              key={`${asset.symbol}-${badge.label}`}
                                              style={{
                                                padding: "3px 7px",
                                                borderRadius: 999,
                                                fontSize: 10,
                                                fontWeight: 700,
                                                letterSpacing: "0.4px",
                                                ...getCapabilityBadgeStyle(badge.tone),
                                              }}
                                            >
                                              {badge.label}
                                            </span>
                                          ))}
                                        </div>
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
                                    No tradable broker asset found
                                  </div>
                                ) : null}
                              </div>
                            )}
                                </>
                              );
                            })()}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <div>
                              <div style={{ fontSize: 11, color: "#7f8ea3", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.6px" }}>Order Action</div>
                              <select
                                className="authInput"
                                value={alpacaOrderForm.side}
                                onChange={(e) => setAlpacaOrderForm((prev) => ({ ...prev, side: e.target.value }))}
                              >
                                <option value="buy">Buy</option>
                                <option value="sell">Sell</option>
                                <option value="short_sell">Short Sell</option>
                                <option value="buy_to_cover">Buy to Cover</option>
                              </select>
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                                <div style={{ fontSize: 11, color: "#7f8ea3", textTransform: "uppercase", letterSpacing: "0.6px" }}>Quantity</div>
                                <InlineHelpButton topic="positionSize" activeTopic={tradeHelpTopic} onToggle={setTradeHelpTopic} />
                              </div>
                              <input
                                className="authInput"
                                type="number"
                                min="0"
                                step="0.0001"
                                placeholder="Qty"
                                value={alpacaOrderForm.qty}
                                onChange={(e) => setAlpacaOrderForm((prev) => ({ ...prev, qty: e.target.value }))}
                              />
                              {tradeHelpTopic === "positionSize" ? <InlineHelpCard topic="positionSize" /> : null}
                            </div>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {[
                              { label: "Buy", value: "buy" },
                              { label: "Sell", value: "sell" },
                              { label: "Short Sell", value: "short_sell" },
                              { label: "Buy to Cover", value: "buy_to_cover" },
                            ].map((item) => (
                              <button
                                key={item.label}
                                type="button"
                                onClick={() => setAlpacaOrderForm((prev) => ({ ...prev, side: item.value }))}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 8,
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  background: alpacaOrderForm.side === item.value ? "rgba(124,196,255,0.18)" : "rgba(255,255,255,0.03)",
                                  color: alpacaOrderForm.side === item.value ? "#f8fbff" : "#cbd5e1",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                                <div style={{ fontSize: 11, color: "#7f8ea3", textTransform: "uppercase", letterSpacing: "0.6px" }}>Order Type</div>
                                <InlineHelpButton topic="orderType" activeTopic={tradeHelpTopic} onToggle={setTradeHelpTopic} />
                              </div>
                              <select
                                className="authInput"
                                value={alpacaOrderForm.type}
                                onChange={(e) => setAlpacaOrderForm((prev) => ({ ...prev, type: e.target.value }))}
                              >
                                <option value="market">Market</option>
                                <option value="limit">Limit</option>
                                <option value="stop">Stop</option>
                                <option value="stop_limit">Stop Limit</option>
                              </select>
                              {tradeHelpTopic === "orderType" ? <InlineHelpCard topic="orderType" /> : null}
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: "#7f8ea3", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.6px" }}>Time In Force</div>
                              <select
                                className="authInput"
                                value={alpacaOrderForm.timeInForce}
                                onChange={(e) => setAlpacaOrderForm((prev) => ({ ...prev, timeInForce: e.target.value }))}
                              >
                                <option value="gtc">GTC</option>
                                <option value="ioc">IOC</option>
                                <option value="fok">FOK</option>
                              </select>
                            </div>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {[
                              { label: "GTC", value: "gtc", field: "timeInForce" },
                              { label: "IOC", value: "ioc", field: "timeInForce" },
                              { label: "FOK", value: "fok", field: "timeInForce" },
                              { label: "Stop", value: "stop", field: "type" },
                              { label: "Stop Limit", value: "stop_limit", field: "type" },
                            ].map((item) => (
                              <button
                                key={item.label}
                                type="button"
                                onClick={() => setAlpacaOrderForm((prev) => ({ ...prev, [item.field]: item.value }))}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 8,
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  background: alpacaOrderForm[item.field] === item.value ? "rgba(124,196,255,0.18)" : "rgba(255,255,255,0.03)",
                                  color: alpacaOrderForm[item.field] === item.value ? "#f8fbff" : "#cbd5e1",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                          {(alpacaOrderForm.type === "limit" || alpacaOrderForm.type === "stop_limit" || alpacaOrderForm.type === "stop") && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                              {(alpacaOrderForm.type === "limit" || alpacaOrderForm.type === "stop_limit") ? (
                                <input
                                  className="authInput"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="Limit Price"
                                  value={alpacaOrderForm.limitPrice}
                                  onChange={(e) => setAlpacaOrderForm((prev) => ({ ...prev, limitPrice: e.target.value }))}
                                />
                              ) : null}
                              {(alpacaOrderForm.type === "stop" || alpacaOrderForm.type === "stop_limit") ? (
                                <input
                                  className="authInput"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="Stop Price"
                                  value={alpacaOrderForm.stopPrice}
                                  onChange={(e) => setAlpacaOrderForm((prev) => ({ ...prev, stopPrice: e.target.value }))}
                                />
                              ) : null}
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 11, color: "#7f8ea3", textTransform: "uppercase", letterSpacing: "0.6px" }}>Leverage / Margin</div>
                            <InlineHelpButton topic="leverage" activeTopic={tradeHelpTopic} onToggle={setTradeHelpTopic} />
                          </div>
                          {tradeHelpTopic === "leverage" ? <InlineHelpCard topic="leverage" /> : null}
                          <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 8 }}>
                            {alpacaOrderValidation.leverageAvailable ? (
                              <>
                                <select
                                  className="authInput"
                                  value={alpacaOrderForm.leverage}
                                  onChange={(e) => setAlpacaOrderForm((prev) => ({ ...prev, leverage: e.target.value }))}
                                >
                                  {tradeSelectedLeverageOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                                <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.55 }}>
                                  Your account currently supports up to {alpacaOrderValidation.accountMultiplier}x buying power.
                                </div>
                                <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.55 }}>
                                  Leverage lets you control a bigger trade with less of your own money. It can make wins bigger, but it can also make losses bigger.
                                </div>
                                <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.55 }}>
                                  Buying power available at {alpacaOrderValidation.effectiveLeverage}x: {formatCurrency(alpacaOrderValidation.buyingPowerLimit)}
                                </div>
                                {alpacaOrderValidation.effectiveLeverage > 1 ? (
                                  <div style={{ fontSize: 11, color: "#fbbf24", lineHeight: 1.5 }}>
                                    Higher leverage increases risk because the same price move affects a larger position.
                                  </div>
                                ) : null}
                              </>
                            ) : (
                              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.55 }}>
                                Leverage is not available for this Alpaca account.
                              </div>
                            )}
                          </div>
                          {alpacaOrderValidation.estimatedValue != null ? (
                            <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.55 }}>
                              Estimated order value: <span style={{ color: "#e2e8f0" }}>{formatCurrency(alpacaOrderValidation.estimatedValue)}</span>
                            </div>
                          ) : null}
                          <button
                            type="submit"
                            className="ghostButton"
                            disabled={alpacaOrderSubmitting || Boolean(alpacaOrderValidation.error)}
                            title={alpacaOrderValidation.error || undefined}
                          >
                            {alpacaOrderSubmitting ? "Submitting..." : "Submit Rayla Paper Order"}
                          </button>
                          {alpacaOrderValidation.error ? (
                            <div style={{ fontSize: 11, color: "#fca5a5", lineHeight: 1.5 }}>
                              {alpacaOrderValidation.error}
                            </div>
                          ) : null}
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

              <div style={{ display: "grid", gridTemplateColumns: "minmax(360px, 1.15fr) minmax(360px, 1fr)", gap: 16, alignItems: "start", marginBottom: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fbff" }}>Broker Trade History</div>
                      <div style={{ fontSize: 12, color: "#7f8ea3", marginTop: 4 }}>
                        Recent broker-synced orders and fills from your connected Rayla paper trading workspace.
                      </div>
                    </div>
                  </div>
                  <BrokerTradeLogCard
                    trades={brokerTradeLog}
                    isLoading={brokerTradeLogLoading}
                    onRefresh={() => fetchBrokerTradeLog({ sync: true })}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fbff" }}>Manual Trade Journal</div>
                      <div style={{ fontSize: 12, color: "#7f8ea3", marginTop: 4 }}>
                        Keep Rayla journal entries separate from broker fills so manual review and execution history stay easy to scan.
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
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
                          {simulationMode === "live"
                            ? "Live mode uses current market quotes so you can practice execution on real movement without risking capital."
                            : "Scenario mode creates structured training conditions so you can rehearse setups, risk, and decision-making faster."}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <RaylaLaunchButton
                          label="Ask Rayla"
                          onClick={() => openGlobalRaylaPopup("Ask Rayla", simulationRaylaContext)}
                        />
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
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="ghostButton"
                        onClick={openSimulationWalkthrough}
                      >
                        {simulationMode === "scenario" ? "Guided simulated scenario trade" : "Guided simulated live trade"}
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

                  {guidedSimulationDraft && (
                    <div style={{ padding: 16, borderRadius: 14, background: "rgba(124,196,255,0.08)", border: "1px solid rgba(124,196,255,0.18)", display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: "#7CC4FF" }}>
                        Intel briefing
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc", lineHeight: 1.35 }}>
                        {guidedSimulationDraft.label || guidedSimulationDraft.asset} • {guidedSimulationDraft.direction === "short" ? "Short" : "Long"}
                      </div>
                      {guidedSimulationDraft.thesis ? (
                        <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.65 }}>
                          {guidedSimulationDraft.thesis}
                        </div>
                      ) : null}
                      <div style={{ fontSize: 12, color: "#dbeafe", lineHeight: 1.6 }}>
                        {buildGuidedSimulationWatchLine({
                          direction: guidedSimulationDraft.direction,
                          step: "review-controls",
                          simulationMode,
                        })}
                      </div>
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
                          Intel briefing
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
                          <div style={{ fontSize: 12, color: activeGuidedSimulation.step === "trade-closed" ? "#86efac" : "#dbeafe", lineHeight: 1.6 }}>
                            {buildGuidedSimulationWatchLine({
                              direction: activeGuidedSimulation.direction,
                              step: activeGuidedSimulation.step,
                              simulationMode,
                            })}
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc", lineHeight: 1.35 }}>
                            {activeGuidedSimulation.label || activeGuidedSimulation.asset} • {activeGuidedSimulation.direction === "short" ? "Short" : "Long"}
                          </div>
                          {activeGuidedSimulation.thesis ? (
                            <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.65 }}>
                              {activeGuidedSimulation.thesis}
                            </div>
                          ) : null}
                          <div style={{ fontSize: 12, color: activeGuidedSimulation.step === "trade-closed" ? "#86efac" : "#dbeafe", lineHeight: 1.6 }}>
                            {buildGuidedSimulationWatchLine({
                              direction: activeGuidedSimulation.direction,
                              step: activeGuidedSimulation.step,
                              simulationMode,
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {showSimulationHelp && (
                    <div style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>
                        {simulationHowToTitle}
                      </div>
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
                    </div>
                  )}

                  {isMobileView && (
                    <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 5, gap: 2, flexShrink: 0, marginBottom: 12 }}>
                      {[
                        { label: "Setup", index: 0 },
                        { label: "Chart", index: 1, badge: simulationPositions.length > 0 ? String(simulationPositions.length) : undefined },
                      ].map(({ label, index, badge }) => (
                        <button key={label} type="button" onClick={() => setSimMobileTab(index)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: simMobileTab === index ? "rgba(124,196,255,0.14)" : "transparent", color: simMobileTab === index ? "#7CC4FF" : "#64748b", fontWeight: simMobileTab === index ? 600 : 400, fontSize: 13, cursor: "pointer", transition: "color 0.15s ease, background 0.15s ease", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, whiteSpace: "nowrap", overflow: "hidden" }}>
                          {label}
                          {badge && <span style={{ background: "#7CC4FF", color: "#050d1f", borderRadius: 8, fontSize: 10, fontWeight: 700, padding: "1px 5px", lineHeight: 1.4 }}>{badge}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: isMobileView ? "1fr" : "minmax(280px, 320px) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
                  {(!isMobileView || simMobileTab === 0) && (
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
                        Set up the trade and press Play. Realistic mode unlocks AI coaching after close.
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
                            Realistic mode unlocks AI coaching after close.
                          </div>
                        </div>
                      )}

                      <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>Trade direction</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.55 }}>
                          {simulationMode === "scenario"
                            ? "Direction for this rep. Flip it only if your read changes."
                            : "Direction for this rep. Flip it only if your read changes."}
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

                      <div style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>
                          Setup <span style={{ fontWeight: 400, color: "#64748b", fontSize: 11 }}>optional</span>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {["range", "breakout", "pullback", "reversal", "trend"].map((type) => {
                            const active = simulationSetupType === type;
                            return (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setSimulationSetupType(active ? "" : type)}
                                style={{
                                  padding: "6px 13px",
                                  borderRadius: 20,
                                  border: active ? "1px solid rgba(124,196,255,0.35)" : "1px solid rgba(255,255,255,0.08)",
                                  background: active ? "rgba(124,196,255,0.13)" : "transparent",
                                  color: active ? "#7CC4FF" : "#64748b",
                                  fontSize: 12,
                                  fontWeight: active ? 600 : 400,
                                  cursor: "pointer",
                                  transition: "color 0.12s, background 0.12s, border-color 0.12s",
                                  letterSpacing: "0.01em",
                                }}
                              >
                                {type}
                              </button>
                            );
                          })}
                        </div>
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
                        <select
                          className="authInput"
                          value={simulationLeverage}
                          onChange={(e) => setSimulationLeverage(e.target.value)}
                        >
                          <option value="1x">Leverage: 1x</option>
                          <option value="2x">Leverage: 2x</option>
                          <option value="5x">Leverage: 5x</option>
                          <option value="10x">Leverage: 10x</option>
                        </select>
                        <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                          Leverage increases simulated exposure and P/L only inside Simulation. Default is 1x.
                        </div>
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
                  )}

                  {(!isMobileView || simMobileTab === 1 || simulationScenarioIsPlaying || simulationPositions.length > 0) && (
                  <div style={{ display: isMobileView && simMobileTab !== 1 ? "none" : "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
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

                  {simulationMode === "scenario" ? (
                  <div ref={setSimulationSectionRef("account")} style={getSimulationSectionStyle("account", { padding: 16, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 14 })}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7f8ea3" }}>
                          Scenario simulator P/L
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                          Based on Realistic mode trades.
                        </div>
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
                  ) : null}

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
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
                                <ChartTimeframeDropdown value={simulationChartTimeframe} onChange={setSimulationChartTimeframe} />
                              </div>
                              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                {[["line", "Line"], ["candlestick", "Candles"]].map(([mode, label]) => (
                                  <button
                                    key={mode}
                                    type="button"
                                    className="ghostButton"
                                    onClick={() => setSimulationScenarioChartMode(mode)}
                                    style={{
                                      padding: "3px 9px",
                                      fontSize: 10,
                                      borderRadius: 6,
                                      borderColor: simulationScenarioChartMode === mode ? "rgba(124,196,255,0.5)" : "rgba(255,255,255,0.1)",
                                      background: simulationScenarioChartMode === mode ? "rgba(124,196,255,0.13)" : "transparent",
                                      color: simulationScenarioChartMode === mode ? "#d7efff" : "#7f8ea3",
                                      fontWeight: 700,
                                      letterSpacing: "0.5px",
                                    }}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                {[
                                  ["horizontal", "Line"],
                                  ["profit", "Profit Line"],
                                  ["loss", "Loss Line"],
                                ].map(([tool, label]) => (
                                  <button
                                    key={tool}
                                    type="button"
                                    className="ghostButton"
                                    onClick={() => setSimulationScenarioDrawingMode((prev) => (prev === tool ? "none" : tool))}
                                    style={{
                                      padding: "3px 9px",
                                      fontSize: 10,
                                      borderRadius: 6,
                                      borderColor: simulationScenarioDrawingMode === tool ? "rgba(124,196,255,0.5)" : "rgba(255,255,255,0.1)",
                                      background: simulationScenarioDrawingMode === tool ? "rgba(124,196,255,0.13)" : "transparent",
                                      color: simulationScenarioDrawingMode === tool ? "#d7efff" : "#7f8ea3",
                                      fontWeight: 700,
                                      letterSpacing: "0.5px",
                                    }}
                                  >
                                    {label}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  className="ghostButton"
                                  onClick={() => undoStoredChartDrawing(scenarioDrawingStorageKey)}
                                  style={{
                                    padding: "3px 9px",
                                    fontSize: 10,
                                    borderRadius: 6,
                                    borderColor: "rgba(255,255,255,0.1)",
                                    color: "#cbd5e1",
                                    fontWeight: 700,
                                    letterSpacing: "0.5px",
                                  }}
                                >
                                  Undo
                                </button>
                                <button
                                  type="button"
                                  className="ghostButton"
                                  onClick={clearScenarioDrawings}
                                  style={{
                                    padding: "3px 9px",
                                    fontSize: 10,
                                    borderRadius: 6,
                                    borderColor: "rgba(248,113,113,0.24)",
                                    color: "#fca5a5",
                                    fontWeight: 700,
                                    letterSpacing: "0.5px",
                                  }}
                                >
                                  Clear Chart
                                </button>
                              </div>
                              <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "right" }}>
                                {simulationScenarioType === "uptrend" ? "Uptrend" : simulationScenarioType === "downtrend" ? "Downtrend" : simulationScenarioType === "realistic" ? "Realistic" : "Range"} · {simulationScenarioNoLimit ? simulationScenarioSpeed : simulationScenarioPlaybackDuration}
                              </div>
                              {scenarioDrawingStatus ? (
                                <div style={{ fontSize: 11, color: "#cbd5e1", textAlign: "right", lineHeight: 1.4 }}>
                                  {scenarioDrawingStatus}
                                </div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className="ghostButton"
                              onClick={handleStartScenarioRep}
                              style={{
                                padding: "9px 16px",
                                fontSize: 12,
                                fontWeight: 800,
                                color: simulationScenarioIsPlaying ? "#e2e8f0" : "#0b1017",
                                background: simulationScenarioIsPlaying ? "rgba(255,255,255,0.06)" : "#7CC4FF",
                                borderColor: simulationScenarioIsPlaying ? "rgba(255,255,255,0.1)" : "rgba(124,196,255,0.38)",
                                boxShadow: simulationScenarioIsPlaying ? "none" : "0 10px 24px rgba(124,196,255,0.18)",
                              }}
                            >
                              {!simulationScenarioIsPlaying && scenarioPlaybackElapsedMsRef.current === 0
                                ? "Play"
                                : simulationScenarioIsPlaying
                                  ? "Pause"
                                  : "Resume"}
                            </button>
                            <button
                              type="button"
                              className="ghostButton"
                              onClick={resetScenarioPlayback}
                            >
                              Reset
                            </button>
                          </>
                        )}
                        {simulationMode === "live" && (
                          <>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", flex: 1, minWidth: 0 }}>
                              <ChartTimeframeDropdown
                                value={simulationLiveChartRange}
                                onChange={setSimulationLiveChartRange}
                                options={LIVE_WIDGET_INTERVAL_OPTIONS}
                                width={88}
                              />
                              {simulationLivePaused ? (
                                <div style={{ fontSize: 11, color: "#fbbf24", lineHeight: 1.4 }}>
                                  Simulation paused
                                </div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className="ghostButton"
                              onClick={simulationLivePaused ? resumeLiveSimulation : pauseLiveSimulation}
                              style={{
                                padding: "9px 16px",
                                fontSize: 12,
                                fontWeight: 800,
                                color: simulationLivePaused ? "#0b1017" : "#e2e8f0",
                                background: simulationLivePaused ? "#fbbf24" : "rgba(255,255,255,0.06)",
                                borderColor: simulationLivePaused ? "rgba(251,191,36,0.36)" : "rgba(255,255,255,0.1)",
                                boxShadow: simulationLivePaused ? "0 10px 24px rgba(251,191,36,0.18)" : "none",
                              }}
                            >
                              {simulationLivePaused ? "Resume" : "Pause"}
                            </button>
                            {simulationLivePaused ? (
                              <button
                                type="button"
                                className="ghostButton"
                                onClick={returnLiveSimulationToCurrentMarket}
                              >
                                Return to Live
                              </button>
                            ) : null}
                            {simulationLiveChartUpdatedLabel && (
                              <div style={{ fontSize: 10, color: "#7f8ea3" }}>
                                Last updated: {simulationLiveChartUpdatedLabel}
                              </div>
                            )}
                          </>
                        )}
                        {renderSimulationInfoButton("chart")}
                      </div>
                    </div>
                    {simulationMode === "scenario" && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "0 2px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ fontSize: 11, color: "#7f8ea3", letterSpacing: "1px", textTransform: "uppercase" }}>Scenario Price</div>
                          <div style={{ fontSize: 24, fontWeight: 700, color: "#f8fafc", lineHeight: 1 }}>
                            {selectedSimulationPrice != null ? `$${formatCompactPrice(selectedSimulationPrice)}` : "--"}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, textAlign: "right", maxWidth: 420 }}>
                          Structured generated movement for practice. Use it like a training market, not a live feed.
                        </div>
                      </div>
                    )}
                  <div className="tradingviewFrameWrapFull" style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, overflow: "hidden" }}>
                    {simulationMode === "scenario" ? (
                      <div style={{ background: "#0d1117", paddingBottom: 10 }}>
                        {guidedScenarioActive && guidedScenarioMessage && (
                          <div style={{ margin: "14px 16px 0", maxWidth: 420, padding: 12, borderRadius: 12, background: "rgba(124,196,255,0.08)", border: "1px solid rgba(124,196,255,0.18)", boxShadow: "0 12px 24px rgba(8,12,18,0.18)" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.3px", textTransform: "uppercase", color: "#7CC4FF", marginBottom: 6 }}>
                              Rayla Guidance
                            </div>
                            <div style={{ fontSize: 12, color: "#dbeafe", lineHeight: 1.6 }}>
                              {guidedScenarioMessage}
                            </div>
                          </div>
                        )}
                        <div style={{ height: 560, minHeight: 560, padding: guidedScenarioActive && guidedScenarioMessage ? "12px 16px 0" : 0 }}>
                          {scenarioChartBars.length < 2 ? (
                            <div style={{ minHeight: 560, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "0 24px" }}>
                              Scenario chart will appear once the generated move has enough data points.
                            </div>
                          ) : (
                            <TradeChart
                              bars={scenarioChartBars}
                              mode={simulationScenarioChartMode}
                              latestPrice={selectedSimulationPrice}
                              assetSymbol={selectedSimulationItem?.id}
                              assetName={selectedSimulationItem?.description || selectedSimulationItem?.name || selectedSimulationItem?.id}
                              height="100%"
                              chartRange={simulationChartTimeframe}
                              tickMarkFormatter={scenarioTickMarkFormatter}
                              secondsVisible={scenarioUsesSecondLabels}
                              priceScaleMargins={{ top: 0.03, bottom: 0.03 }}
                              fixedVisiblePriceRange={scenarioStablePriceRange}
                              autoFitOnDataChange={false}
                              visibleBarCount={SCENARIO_CHART_VISIBLE_BAR_COUNT}
                              rightOffsetBars={SCENARIO_CHART_RIGHT_OFFSET_BARS}
                              minBarSpacing={7}
                              showVolume={false}
                              zoomEnabled={true}
                              annotations={scenarioVisibleDrawings}
                              drawingMode={simulationScenarioDrawingMode}
                              onChartClick={handleScenarioChartAnnotationClick}
                            />
                          )}
                        </div>
                        {!scenarioTapHintDismissed && scenarioChartBars.length >= 2 && simulationScenarioDrawingMode === "none" && (
                          <div style={{ textAlign: "center", fontSize: 11, color: "#475569", padding: "4px 0 2px", pointerEvents: "none" }}>
                            Tap any bar to ask Rayla about that price level
                          </div>
                        )}
                      </div>
                    ) : selectedSimulationItem ? (
                      <div style={{ background: "#0d1117", paddingBottom: 10 }}>
                        <MarketClosedBanner assetType={selectedSimulationItem.type} updatedLabel={simulationLiveChartUpdatedLabel} />
                        <div style={{ height: 560, minHeight: 560 }}>
                        {selectedSimulationAssetExplicitlyUnsupported ? (
                          <div style={{ minHeight: 560, display: "flex", flexDirection: "column", gap: 6, alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "0 24px" }}>
                            <div>Live chart unavailable</div>
                            <div>Alpaca does not currently support trading this asset.</div>
                          </div>
                        ) : (
                          <TradingViewLiveChart
                            asset={selectedSimulationItem}
                            height="100%"
                            interval={simulationLiveChartRange}
                            chartType="simulation_live"
                          />
                        )}
                        </div>
                      </div>
                    ) : null}
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
                          const isScenarioPosition = (position.marketMode || simulationMode) === "scenario";
                          const isSelectedSimulationPosition = selectedSimulationOpenPosition?.id === position.id;
                          const pendingDecision = isScenarioPosition
                            ? (simulationPendingScenarioDecision?.positionId === position.id ? simulationPendingScenarioDecision : null)
                            : (simulationPendingLiveDecision?.positionId === position.id ? simulationPendingLiveDecision : null);
                          const metrics = Number.isFinite(currentPrice)
                            ? calculateSimulationPnL(position, currentPrice)
                            : { profitLoss: 0, rMultiple: null };
                          const tradeStatusLabel = pendingDecision
                            ? pendingDecision.exitReason === "Target Hit" || pendingDecision.exitReason === "P/L Target Hit"
                              ? "Target Hit"
                              : "Stop Hit"
                            : isScenarioPosition
                              ? simulationScenarioIsPlaying
                                ? "Running"
                                : "Paused"
                              : "Running";

                          const tradeStatusColor = pendingDecision
                            ? pendingDecision.exitReason === "Target Hit" || pendingDecision.exitReason === "P/L Target Hit"
                              ? "#4ade80"
                              : "#f87171"
                            : isScenarioPosition && simulationScenarioIsPlaying
                              ? "#7CC4FF"
                              : "#e2e8f0";

                          return (
                            <div
                              key={position.id}
                              onClick={() => handleSelectSimulationTradeAsset(position)}
                              style={{
                                padding: 14,
                                borderRadius: 12,
                                background: isSelectedSimulationPosition ? "rgba(124,196,255,0.08)" : "rgba(255,255,255,0.03)",
                                border: isSelectedSimulationPosition ? "1px solid rgba(124,196,255,0.28)" : "1px solid rgba(255,255,255,0.06)",
                                display: "flex",
                                flexDirection: "column",
                                gap: 14,
                                cursor: "pointer",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                <div>
                                  <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>{position.asset}</div>
                                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                                    {position.label || position.asset} · {position.direction === "short" ? "Short" : "Long"} · {position.marketMode === "scenario" ? "Scenario" : "Live"} · Time in trade {formatTimeInTrade(position)}
                                  </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      letterSpacing: "0.8px",
                                      textTransform: "uppercase",
                                      color: pendingDecision
                                        ? tradeStatusColor
                                        : isScenarioPosition && simulationScenarioIsPlaying
                                          ? "#7CC4FF"
                                          : "#cbd5e1",
                                      background: pendingDecision
                                        ? pendingDecision.exitReason === "Target Hit" || pendingDecision.exitReason === "P/L Target Hit"
                                          ? "rgba(74,222,128,0.12)"
                                          : "rgba(248,113,113,0.12)"
                                        : isScenarioPosition && simulationScenarioIsPlaying
                                          ? "rgba(124,196,255,0.12)"
                                          : "rgba(255,255,255,0.06)",
                                      border: pendingDecision
                                        ? pendingDecision.exitReason === "Target Hit" || pendingDecision.exitReason === "P/L Target Hit"
                                          ? "1px solid rgba(74,222,128,0.2)"
                                          : "1px solid rgba(248,113,113,0.2)"
                                        : isScenarioPosition && simulationScenarioIsPlaying
                                          ? "1px solid rgba(124,196,255,0.24)"
                                          : "1px solid rgba(255,255,255,0.08)",
                                      borderRadius: 999,
                                      padding: "5px 10px",
                                    }}
                                  >
                                    {tradeStatusLabel}
                                  </div>
                                  {pendingDecision ? (
                                    <>
                                      <button
                                        type="button"
                                        className="ghostButton"
                                        style={{ borderColor: "rgba(74,222,128,0.28)", color: "#dcfce7", background: "rgba(74,222,128,0.1)" }}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          isScenarioPosition ? handleQuitAndSaveScenarioTrade(position.id) : handleQuitAndSaveLiveTrade(position.id);
                                        }}
                                      >
                                        Quit & Save
                                      </button>
                                      <button
                                        type="button"
                                        className="ghostButton"
                                        style={{ borderColor: "rgba(124,196,255,0.28)", color: "#dbeafe", background: "rgba(124,196,255,0.1)" }}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          isScenarioPosition ? handleReopenAndContinueScenarioTrade(position.id) : handleReopenAndContinueLiveTrade(position.id);
                                        }}
                                      >
                                        Reopen & Continue
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      className="ghostButton"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleCloseSimulationTrade(position.id);
                                      }}
                                    >
                                      Close Trade
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                                <div>
                                  <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Status</div>
                                  <div style={{ fontSize: 18, fontWeight: 700, color: tradeStatusColor }}>
                                    {tradeStatusLabel}
                                  </div>
                                </div>
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
                    {(() => {
                      const raylaReviewPreview = buildSimulationReflectionPreview(visibleSimulationClosedTrade);
                      if (!raylaReviewPreview) return null;
                      return (
                        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                          <div style={{ fontSize: 11, fontWeight: 500, color: "#4a5568", marginBottom: 6, letterSpacing: "0.02em" }}>
                            Rayla
                          </div>
                          <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.65 }}>
                            {raylaReviewPreview.join(" ")}
                          </div>
                          <button
                            type="button"
                            onClick={() => openPostTradeRaylaReview(visibleSimulationClosedTrade)}
                            style={{ marginTop: 10, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: "#4a5568", textDecoration: "underline", textUnderlineOffset: 3 }}
                          >
                            Ask Rayla
                          </button>
                        </div>
                      );
                    })()}
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
                              <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Result</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: trade.profitLoss > 0 ? "#4ade80" : trade.profitLoss < 0 ? "#f87171" : "#e2e8f0" }}>
                                {trade.profitLoss > 0 ? "Win" : trade.profitLoss < 0 ? "Loss" : "Flat"}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>R Multiple</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: trade.rMultiple == null ? "#e2e8f0" : trade.rMultiple >= 0 ? "#4ade80" : "#f87171" }}>
                                {trade.rMultiple == null ? "--" : `${trade.rMultiple >= 0 ? "+" : ""}${trade.rMultiple.toFixed(2)}R`}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Duration</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
                                {formatSimulationDuration(trade.durationMs)}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Close Reason</div>
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
                  )}
	              </div>
	            </div>
	          </div>
	        </div>
          </div>
        )}

        {activeTab === "ai" && (
          <div className="mainGrid">
            <div className="span12" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#f3f7fc", letterSpacing: "-0.01em" }}>Performance Analysis</div>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Review your edge, discipline, and progress in one place.</div>
                </div>
              </div>
              <PerformanceDashboard
                trades={combinedTrades}
                equityPoints={filteredEquityPoints}
                sourceLabel={equitySourceLabel}
                chartRange={chartRange}
                setChartRange={setChartRange}
                benchmarkSymbol={equityBenchmarkSymbol}
                benchmarkLabel={equityBenchmarkLabel}
                onSelectBenchmark={(option) => {
                  setEquityBenchmarkSymbol(option.symbol);
                  setEquityBenchmarkType(option.type || "stock");
                  setEquityBenchmarkLabel(option.label || option.symbol);
                }}
                benchmarkOptions={equityBenchmarkOptions}
                benchmarkPoints={normalizedBenchmarkPoints}
                benchmarkLoading={equityBenchmarkLoading}
                alpacaConnected={Boolean(alpacaAccount)}
                coachSummary={coachSummary}
                showNoNewTrades={showNoNewTrades}
                onRunAnalysis={runAIAnalysis}
                onOpenRaylaPopup={openGlobalRaylaPopup}
                alpacaPositions={alpacaPositions}
                performanceLiveAppliedSelection={performanceLiveAppliedSelection}
                setPerformanceLiveAppliedSelection={setPerformanceLiveAppliedSelection}
                tradeAppliedSelection={tradeAppliedSelection}
                applyTradeSelection={applyTradeSelection}
                tradePortfolioAllSymbols={tradePortfolioAllSymbols}
                tradeChartSymbol={tradeChartSymbol}
                tradeChartCurrentPrice={tradeChartCurrentPrice}
                tradeChartQuote={tradeChartQuote}
                tradeChartMatchingPosition={tradeChartMatchingPosition}
                tradeChartAsset={tradeChartAsset}
                tradeChartAssetType={tradeChartAssetType}
                tradeChartRange={tradeChartRange}
                setTradeChartRange={setTradeChartRange}
                tradeChartMode={tradeChartMode}
                setTradeChartMode={setTradeChartMode}
                tradeChartLastUpdated={tradeChartLastUpdated}
                tradeIsComparisonMode={tradeIsComparisonMode}
                tradeIsPortfolioTotalMode={tradeIsPortfolioTotalMode}
                tradePortfolioCombinedUnrealizedPl={tradePortfolioCombinedUnrealizedPl}
                tradePortfolioCombinedMarketValue={tradePortfolioCombinedMarketValue}
                tradePortfolioDisplayedPositions={tradePortfolioDisplayedPositions}
                tradePortfolioChartsLoading={tradePortfolioChartsLoading}
                tradePortfolioCharts={tradePortfolioCharts}
                brokerTradeLog={brokerTradeLog}
                tradePortfolioRequestedStartMs={tradePortfolioRequestedStartMs}
                tradePortfolioNowMs={tradePortfolioNowMs}
                tradeMarketChartLoading={tradeMarketChartLoading}
                tradeMarketChart={tradeMarketChart}
              />
            </div>
          </div>
        )}


        {activeTab === "journal" && (
          <div className="mainGrid">
            <div className="span12">
              <JournalTab trades={combinedTrades} onOpenRaylaPopup={openGlobalRaylaPopup} />
            </div>
          </div>
        )}

        {activeTab === "ask" && (
          <div
            className={askRaylaHasMessages ? "card" : undefined}
            style={{
              minHeight: askRaylaHasMessages ? "calc(100vh - 170px)" : "calc(100vh - 120px)",
              display: "flex",
              flexDirection: "column",
              padding: askRaylaHasMessages ? 0 : 0,
              overflow: "hidden",
              background: askRaylaHasMessages ? undefined : "transparent",
              border: askRaylaHasMessages ? undefined : "none",
              boxShadow: askRaylaHasMessages ? undefined : "none",
            }}
          >
            {!askRaylaHasMessages ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  gap: 22,
                  maxWidth: 920,
                  width: "100%",
                  margin: "0 auto",
                  padding: "48px 16px 56px 16px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="askRaylaHeadline">
                    ASK RAYLA ANYTHING
                  </div>
                  <div style={{ fontSize: 16, color: "#94a3b8", lineHeight: 1.7 }}>
                    Understand trades, charts, risk, and strategy in seconds.
                  </div>
                </div>

                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 10,
                    padding: 12,
                    borderRadius: 22,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(8,12,18,0.92)",
                    boxShadow: "0 18px 54px rgba(0,0,0,0.22)",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.04)",
                      color: "#94a3b8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginBottom: 4,
                    }}
                  >
                    <PlusSquare size={16} />
                  </div>
                  <textarea
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!aiInput.trim() || isRaylaLoading) return;
                        try {
                          await handleAskRaylaQuestion(aiInput, { clearInput: true, useChat: true });
                        } catch (err) {
                          console.error("ASK RAYLA FETCH ERROR:", err);
                        }
                      }
                    }}
                    placeholder="Ask anything"
                    style={{
                      flex: 1,
                      minHeight: 58,
                      maxHeight: 180,
                      borderRadius: 12,
                      border: "none",
                      background: "transparent",
                      color: "#e2e8f0",
                      padding: "8px 10px",
                      fontSize: 15,
                      resize: "none",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    className="ghostButton"
                    disabled={!aiInput.trim() || isRaylaLoading}
                    onClick={async () => {
                      try {
                        await handleAskRaylaQuestion(aiInput, { clearInput: true, useChat: true });
                      } catch (err) {
                        console.error("ASK RAYLA FETCH ERROR:", err);
                      }
                    }}
                    style={{
                      alignSelf: "stretch",
                      minWidth: 58,
                      borderRadius: 14,
                      background: !aiInput.trim() || isRaylaLoading ? "rgba(255,255,255,0.06)" : "#7CC4FF",
                      color: !aiInput.trim() || isRaylaLoading ? "#7f8ea3" : "#0b1017",
                      borderColor: !aiInput.trim() || isRaylaLoading ? "rgba(255,255,255,0.08)" : "rgba(124,196,255,0.35)",
                      fontWeight: 800,
                    }}
                  >
                    ↑
                  </button>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
                  {ASK_RAYLA_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="ghostButton"
                      disabled={isRaylaLoading}
                      onClick={async () => {
                        try {
                          await handleAskRaylaQuestion(suggestion, { clearInput: true, useChat: true });
                        } catch (err) {
                          console.error("ASK RAYLA SUGGESTION ERROR:", err);
                        }
                      }}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 999,
                        color: "#dbeafe",
                        background: "rgba(124,196,255,0.08)",
                        borderColor: "rgba(124,196,255,0.18)",
                        fontSize: 12,
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                {!raylaAdaptiveState.onboardingCompleted && activeRaylaAdaptiveQuestion ? (
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 720,
                      padding: 12,
                      borderRadius: 14,
                      background: "rgba(124,196,255,0.05)",
                      border: "1px solid rgba(124,196,255,0.12)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      textAlign: "left",
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#7CC4FF", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 700 }}>
                      Rayla onboarding
                    </div>
                    <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                      {activeRaylaAdaptiveQuestion.prompt}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {activeRaylaAdaptiveQuestion.options.map((option) => (
                        <button
                          key={`${activeRaylaAdaptiveQuestion.key}-${option}`}
                          type="button"
                          className="ghostButton"
                          onClick={() => handleRaylaAdaptiveOnboardingAnswer(activeRaylaAdaptiveQuestion.key, option)}
                          style={{
                            padding: "8px 12px",
                            fontSize: 12,
                            color: "#e2e8f0",
                            borderColor: "rgba(124,196,255,0.16)",
                            background: "rgba(124,196,255,0.06)",
                          }}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#7f8ea3", lineHeight: 1.6 }}>
                    Rayla adapts over time using your questions, simulation behavior, and prior interactions.
                  </div>
                )}
              </div>
            ) : (
              <>
                <div
                  ref={askRaylaThreadRef}
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "18px 18px 140px 18px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    background: "linear-gradient(180deg, rgba(10,14,20,0.76), rgba(11,16,23,0.94))",
                  }}
                >
                  {raylaChatMessages.map((message) => (
                    <div
                      key={message.id}
                      style={{
                        display: "flex",
                        justifyContent: message.role === "user" ? "flex-end" : "flex-start",
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "78%",
                          padding: "14px 16px",
                          borderRadius: message.role === "user" ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
                          background: message.role === "user" ? "rgba(124,196,255,0.16)" : "rgba(255,255,255,0.04)",
                          border: message.role === "user" ? "1px solid rgba(124,196,255,0.24)" : "1px solid rgba(255,255,255,0.08)",
                          color: "#e2e8f0",
                          boxShadow: "0 12px 28px rgba(0,0,0,0.16)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        <div style={{ fontSize: 11, color: message.role === "user" ? "#93c5fd" : "#94a3b8", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase" }}>
                          {message.role === "user" ? "You" : "Rayla"}
                        </div>
                        {message.loading ? (
                          <div style={{ fontSize: 14, color: "#94a3b8" }}>Rayla is thinking...</div>
                        ) : (
                          <div style={{ fontSize: 14, color: "#e2e8f0", display: "flex", flexDirection: "column", gap: 12 }}>
                            {renderRaylaMessageContent(message.content)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

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
                                await handleAskRaylaQuestion(option, { clearInput: true, useChat: true });
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

                  {capitalGuideResult?.directions?.length ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {capitalGuideResult.directions.map((direction) => (
                        <div
                          key={direction.id}
                          style={{
                            padding: 12,
                            borderRadius: 12,
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

                <div
                  style={{
                    position: "sticky",
                    bottom: 0,
                    padding: 16,
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(11,16,23,0.96)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 10,
                      padding: 10,
                      borderRadius: 18,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(8,12,18,0.86)",
                    }}
                  >
                    <textarea
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (!aiInput.trim() || isRaylaLoading) return;
                          try {
                            await handleAskRaylaQuestion(aiInput, { clearInput: true, useChat: true });
                          } catch (err) {
                            console.error("ASK RAYLA FETCH ERROR:", err);
                          }
                        }
                      }}
                      placeholder="Ask Rayla anything..."
                      style={{
                        flex: 1,
                        minHeight: 52,
                        maxHeight: 180,
                        borderRadius: 12,
                        border: "none",
                        background: "transparent",
                        color: "#e2e8f0",
                        padding: "8px 10px",
                        fontSize: 14,
                        resize: "none",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      className="ghostButton"
                      disabled={!aiInput.trim() || isRaylaLoading}
                      onClick={async () => {
                        try {
                          await handleAskRaylaQuestion(aiInput, { clearInput: true, useChat: true });
                        } catch (err) {
                          console.error("ASK RAYLA FETCH ERROR:", err);
                        }
                      }}
                      style={{
                        alignSelf: "stretch",
                        minWidth: 58,
                        borderRadius: 14,
                        background: !aiInput.trim() || isRaylaLoading ? "rgba(255,255,255,0.06)" : "#7CC4FF",
                        color: !aiInput.trim() || isRaylaLoading ? "#7f8ea3" : "#0b1017",
                        borderColor: !aiInput.trim() || isRaylaLoading ? "rgba(255,255,255,0.08)" : "rgba(124,196,255,0.35)",
                        fontWeight: 800,
                      }}
                    >
                      ↑
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "intel" && (
          <div className="mainGrid">
            <div className="span12">
              <div className="card">
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <h3 style={{ margin: 0 }}>Market Intel</h3>
                      <div style={{ fontSize: 13, color: "#7f8ea3", marginTop: 6 }}>
                        Scanning a broader Alpaca-supported stock, ETF, and crypto universe for the strongest hot and cold opportunities.
                      </div>
                    </div>
                    <RaylaLaunchButton label="Ask Rayla" onClick={() => openGlobalRaylaPopup("Ask Rayla")} />
                  </div>
                {(intelLoading || !hotColdReport) && <div className="listSubtext" style={{ marginTop: "4px" }}>Loading today&apos;s report...</div>}
                {hotColdReport && (
                  <MobileSegmentedPager segments={[
                    {
                      label: "Picks",
                      content: (
                        <div style={{ background: "rgba(18,26,38,0.78)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 16 }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#f3f7fc", marginBottom: 6 }}>
                            Rayla&apos;s Picks for You
                          </div>
                          <div style={{ fontSize: 13, color: "#7f8ea3", marginBottom: 14 }}>
                            Personalized ideas based on how your real trades and completed simulations have actually performed.
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                            {[raylaPicksContext.stockLong, raylaPicksContext.stockShort, raylaPicksContext.cryptoLong, raylaPicksContext.cryptoShort].map((pick) => (
                              <RaylaPickCard key={pick.title} pick={pick} />
                            ))}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 12 }}>
                            These picks are based on your logged trade and simulation history. They are not guarantees or financial advice.
                          </div>
                        </div>
                      ),
                    },
                    {
                      label: "Market",
                      content: (
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                            {[["Hottest Stocks / ETFs", "#ef4444", hotColdReport.stockHot], ["Coldest Stocks / ETFs", "#7CC4FF", hotColdReport.stockCold]].map(([label, color, items]) => (
                              <div key={label} style={{ background: "rgba(18,26,38,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 14 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7f8ea3" }}>{label}</div>
                                </div>
                                {items?.slice(0, 3).map((item) => <IntelAssetCard key={`${label}-${item.symbol}`} item={item} quoteOverride={intelLiveQuotes[item.symbol]} onTrySimulation={handleTryIntelInSimulation} onAskRayla={handleBeginnerIntelExplain} />)}
                              </div>
                            ))}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                            {[["Hottest Crypto", "#ef4444", hotColdReport.cryptoHot], ["Coldest Crypto", "#7CC4FF", hotColdReport.cryptoCold]].map(([label, color, item]) => (
                              <div key={label} style={{ background: "rgba(18,26,38,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 14 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7f8ea3" }}>{label}</div>
                                </div>
                                {item && <IntelAssetCard item={item} quoteOverride={intelLiveQuotes[item.symbol]} onTrySimulation={handleTryIntelInSimulation} onAskRayla={handleBeginnerIntelExplain} />}
                              </div>
                            ))}
                          </div>
                        </div>
                      ),
                    },
                  ]} />
                )}
                </div>
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
                  Rayla Mode
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                  {[
                    ["beginner", "Beginner Mode"],
                    ["experienced", "Experienced Mode"],
                  ].map(([modeValue, label]) => (
                    <button
                      key={modeValue}
                      type="button"
                      className="ghostButton"
                      onClick={() => setRaylaMode(modeValue)}
                      style={{
                        background: raylaMode === modeValue ? "rgba(124,196,255,0.12)" : undefined,
                        borderColor: raylaMode === modeValue ? "rgba(124,196,255,0.35)" : undefined,
                        color: raylaMode === modeValue ? "#d7efff" : undefined,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 14 }}>
                  Rayla will use this as a baseline tone and explanation depth across chat.
                </div>
                <div className="listSubtext" style={{ marginBottom: 8 }}>
                  Adaptive Learning
                </div>
                <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, marginBottom: 10 }}>
                  Rayla adjusts explanation depth from your onboarding answers, your questions, and how you use simulations over time.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {raylaAdaptiveState.onboardingAnswers.experience ? (
                    <div className="pill">{raylaAdaptiveState.onboardingAnswers.experience}</div>
                  ) : null}
                  {raylaAdaptiveState.onboardingAnswers.familiarity ? (
                    <div className="pill">{raylaAdaptiveState.onboardingAnswers.familiarity}</div>
                  ) : null}
                  {raylaAdaptiveState.onboardingAnswers.goal ? (
                    <div className="pill">{raylaAdaptiveState.onboardingAnswers.goal}</div>
                  ) : null}
                </div>
                <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 10 }}>
                  Current explanation depth: {raylaAdaptiveProfile.explanationDepth}
                </div>
                <button
                  type="button"
                  className="ghostButton"
                  onClick={() => setRaylaAdaptiveState(createDefaultRaylaAdaptiveState())}
                >
                  Retake Rayla onboarding
                </button>
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



        {chartExplainPopupOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 12000,
              pointerEvents: "none",
            }}
          >
            <div
              ref={chartExplainPopupWindowRef}
              className="card"
              style={{
                position: "fixed",
                right: chartExplainPopupIsMobile ? 12 : "auto",
                left: chartExplainPopupIsMobile ? 12 : chartExplainPopupPosition.x,
                top: chartExplainPopupIsMobile ? "auto" : chartExplainPopupPosition.y,
                bottom: chartExplainPopupIsMobile ? 12 : "auto",
                width: chartExplainPopupIsMobile ? "auto" : "min(400px, calc(100vw - 24px))",
                maxWidth: chartExplainPopupIsMobile ? "none" : 420,
                height: chartExplainPopupIsMobile ? "min(68vh, 640px)" : "min(64vh, 680px)",
                maxHeight: chartExplainPopupIsMobile ? "68vh" : "64vh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                border: "1px solid rgba(124,196,255,0.18)",
                background: "linear-gradient(180deg, rgba(10,16,28,0.98), rgba(7,12,22,0.98))",
                boxShadow: "0 28px 80px rgba(0,0,0,0.48)",
                animation: "fadeSlideIn 0.16s ease-out",
                pointerEvents: "auto",
              }}
            >
              <div
                onPointerDown={(event) => {
                  if (chartExplainPopupIsMobile || event.button !== 0 || !chartExplainPopupWindowRef.current) return;
                  const rect = chartExplainPopupWindowRef.current.getBoundingClientRect();
                  chartExplainPopupDragStateRef.current = {
                    offsetX: event.clientX - rect.left,
                    offsetY: event.clientY - rect.top,
                  };
                }}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "14px 16px 12px 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  cursor: chartExplainPopupIsMobile ? "default" : "grab",
                  touchAction: "none",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7cc4ff" }}>
                    Rayla Coach
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#f8fbff", marginTop: 4 }}>
                    {chartExplainPopupTitle}
                  </div>
                  {chartExplainPopupContext ? (
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
                      {chartExplainPopupContext?.assetName || chartExplainPopupContext?.symbol || "Selected asset"}
                      {chartExplainPopupContext?.timeframe ? ` · ${chartExplainPopupContext.timeframe}` : ""}
                      {Number.isFinite(chartExplainPopupContext?.currentPrice) ? ` · ${formatCurrency(chartExplainPopupContext.currentPrice)}` : ""}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
                      Ask anything about trades, charts, risk, or strategy.
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => {
                    setChartExplainPopupOpen(false);
                    setChartExplainPopupLoading(false);
                    chartTapCooldownRef.current = Date.now();
                  }}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.04)",
                    color: "#cbd5e1",
                    cursor: "pointer",
                    fontSize: 18,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>

              <div
                ref={chartExplainPopupThreadRef}
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  background: "radial-gradient(circle at top, rgba(124,196,255,0.05), transparent 42%)",
                }}
              >
                {chartExplainPopupMessages.map((message) => (
                  <div
                    key={message.id}
                    style={{
                      alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "85%",
                      borderRadius: 18,
                      padding: "12px 14px",
                      background: message.role === "user" ? "rgba(124,196,255,0.14)" : "rgba(255,255,255,0.05)",
                      border: message.role === "user" ? "1px solid rgba(124,196,255,0.2)" : "1px solid rgba(255,255,255,0.08)",
                      color: "#e2e8f0",
                    }}
                  >
                    {message.loading ? (
                      <div style={{ fontSize: 13, color: "#94a3b8" }}>
                        {chartExplainPopupContext?.contextType === "simulation"
                          ? "Rayla is reviewing this simulation..."
                          : "Rayla is reading the chart..."}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                        {message.role === "assistant" ? renderRaylaMessageContent(message.content) : message.content}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {intelSimulationSetupPrompt && (
                <div
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    padding: "12px 16px",
                    background: "rgba(9,14,24,0.92)",
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleAcceptIntelSimulationSetupPrompt}
                    style={{
                      border: "1px solid rgba(124,196,255,0.35)",
                      background: "#7CC4FF",
                      color: "#0b1017",
                      borderRadius: 12,
                      padding: "10px 14px",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Yes, walk me through it
                  </button>
                  <button
                    type="button"
                    onClick={handleDismissIntelSimulationSetupPrompt}
                    style={{
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.04)",
                      color: "#cbd5e1",
                      borderRadius: 12,
                      padding: "10px 14px",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    No, I&apos;ll set it up
                  </button>
                </div>
              )}

              {intelSimulationSetupChecklist && (
                <div
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    padding: "12px 16px",
                    background: "rgba(9,14,24,0.92)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "#7CC4FF" }}>
                    Guided setup
                  </div>
                  <div style={{ fontSize: 13, color: "#dbeafe", lineHeight: 1.55 }}>
                    {intelSimulationSetupChecklist.steps[intelSimulationSetupChecklist.currentStep]?.title}
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={handleAdvanceIntelSimulationSetupChecklist}
                      style={{
                        border: "1px solid rgba(124,196,255,0.35)",
                        background: "#7CC4FF",
                        color: "#0b1017",
                        borderRadius: 12,
                        padding: "10px 14px",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {intelSimulationSetupChecklist.currentStep >= intelSimulationSetupChecklist.steps.length - 1 ? "Done" : "Next step"}
                    </button>
                  </div>
                </div>
              )}

              {chartExplainPopupContext?.contextType === "simulation"
                && simulationRaylaPromptTradeId
                && simulationRaylaGuidanceStateByTrade[simulationRaylaPromptTradeId] === "pending" && (
                <div
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    padding: "12px 16px",
                    background: "rgba(9,14,24,0.92)",
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleEnableSimulationRaylaGuidance(simulationRaylaPromptTradeId)}
                    style={{
                      border: "1px solid rgba(124,196,255,0.35)",
                      background: "#7CC4FF",
                      color: "#0b1017",
                      borderRadius: 12,
                      padding: "10px 14px",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Yes, guide me
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDismissSimulationRaylaGuidance(simulationRaylaPromptTradeId)}
                    style={{
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.04)",
                      color: "#cbd5e1",
                      borderRadius: 12,
                      padding: "10px 14px",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    No, I'm good
                  </button>
                </div>
              )}

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: 12, background: "rgba(7,12,22,0.92)" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <textarea
                    value={chartExplainPopupInput}
                    onChange={(event) => setChartExplainPopupInput(event.target.value)}
                    onKeyDown={async (event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        if (!chartExplainPopupInput.trim() || chartExplainPopupLoading) return;
                        await handleChartExplainPopupQuestion(chartExplainPopupInput, chartExplainPopupContext);
                      }
                    }}
                    placeholder={
                      chartExplainPopupContext
                        ? chartExplainPopupContext.contextType === "simulation"
                          ? "Ask a follow-up about this simulation..."
                          : "Ask a follow-up about this chart..."
                        : "Ask Rayla anything..."
                    }
                    rows={1}
                    style={{
                      flex: 1,
                      resize: "none",
                      minHeight: 52,
                      maxHeight: 140,
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.04)",
                      color: "#e2e8f0",
                      padding: "14px 16px",
                      outline: "none",
                      fontSize: 14,
                      lineHeight: 1.5,
                    }}
                  />
                  <button
                    type="button"
                    disabled={!chartExplainPopupInput.trim() || chartExplainPopupLoading}
                    onClick={async () => {
                      await handleChartExplainPopupQuestion(chartExplainPopupInput, chartExplainPopupContext);
                    }}
                    style={{
                      alignSelf: "stretch",
                      minWidth: 94,
                      borderRadius: 16,
                      border: "1px solid",
                      borderColor: !chartExplainPopupInput.trim() || chartExplainPopupLoading ? "rgba(255,255,255,0.08)" : "rgba(124,196,255,0.35)",
                      background: !chartExplainPopupInput.trim() || chartExplainPopupLoading ? "rgba(255,255,255,0.06)" : "#7CC4FF",
                      color: !chartExplainPopupInput.trim() || chartExplainPopupLoading ? "#7f8ea3" : "#0b1017",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: !chartExplainPopupInput.trim() || chartExplainPopupLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {intelPracticeModeChoice && (
          <div
            onClick={handleCancelIntelPracticeModeChoice}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 11900,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              background: "rgba(4,8,16,0.6)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              className="card"
              onClick={(event) => event.stopPropagation()}
              style={{
                width: "min(460px, 100%)",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                border: "1px solid rgba(124,196,255,0.14)",
                background: "linear-gradient(180deg, rgba(10,16,28,0.98), rgba(7,12,22,0.98))",
                boxShadow: "0 28px 80px rgba(0,0,0,0.42)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "#7CC4FF" }}>
                  Simulate From Intel
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#f8fbff" }}>
                  {intelPracticeModeChoice.draft?.label || intelPracticeModeChoice.draft?.asset || "Selected asset"}
                </div>
                <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                  Build the setup here first, then open the simulator only after final confirmation.
                </div>
              </div>

              {(() => {
                const currentStep = intelPracticeModeChoice.wizardStep || 0;
                const currentPrice = intelPracticeModeChoice.launch?.asset?.id
                  ? getSimulationPrice(intelPracticeModeChoice.launch.asset.id, intelPracticeModeChoice.mode || "live")
                  : null;
                const sectionStyle = {
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 16,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                };
                const optionStyle = (active) => ({
                  border: "1px solid",
                  borderColor: active ? "rgba(124,196,255,0.38)" : "rgba(255,255,255,0.1)",
                  background: active ? "rgba(124,196,255,0.12)" : "rgba(255,255,255,0.04)",
                  color: active ? "#f8fbff" : "#cbd5e1",
                  borderRadius: 14,
                  padding: "12px 14px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "left",
                  flex: 1,
                });
                const inputTypeStyle = (active) => ({
                  border: "1px solid",
                  borderColor: active ? "rgba(124,196,255,0.38)" : "rgba(255,255,255,0.1)",
                  background: active ? "rgba(124,196,255,0.12)" : "rgba(255,255,255,0.04)",
                  color: active ? "#f8fbff" : "#cbd5e1",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                });

                return (
                  <>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                      {["Mode", "Direction", "Risk", "Entry", "Stop", "Target", "Review"].map((label, index) => (
                        <div
                          key={label}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 999,
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: index === currentStep ? "rgba(124,196,255,0.12)" : "rgba(255,255,255,0.03)",
                            color: index === currentStep ? "#dbeafe" : "#94a3b8",
                          }}
                        >
                          {label}
                        </div>
                      ))}
                    </div>

                    {currentStep === 0 && (
                      <div style={sectionStyle}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fbff" }}>Mode</div>
                        <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                          Pick how you want to practice this trade.
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button type="button" onClick={handleStartIntelLiveSimulation} style={optionStyle(intelPracticeModeChoice.mode === "live")}>Live</button>
                          <button type="button" onClick={handleStartIntelScenarioSimulation} style={optionStyle(intelPracticeModeChoice.mode === "scenario")}>Scenario</button>
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                          Live means you practice using the real market price right now. Scenario means you practice on a replay so you cannot see what happens next.
                        </div>
                      </div>
                    )}

                    {currentStep === 1 && (
                      <div style={sectionStyle}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fbff" }}>Direction</div>
                        <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                          Pick whether you think the price will go up or down.
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => updateIntelPracticeModeChoice({ direction: "long" })} style={optionStyle(intelPracticeModeChoice.direction === "long")}>Long</button>
                          <button type="button" onClick={() => updateIntelPracticeModeChoice({ direction: "short" })} style={optionStyle(intelPracticeModeChoice.direction === "short")}>Short</button>
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                          Long means you make money if the price goes up. Short means you make money if the price goes down.
                        </div>
                      </div>
                    )}

                    {currentStep === 2 && (
                      <div style={sectionStyle}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fbff" }}>Planned Risk ($)</div>
                        <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                          How much money you are willing to lose if the stop is hit. Example values: `50`, `$50`, `100`.
                        </div>
                        <input
                          className="authInput"
                          value={intelPracticeModeChoice.plannedRisk || ""}
                          onChange={(event) => updateIntelPracticeModeChoice({ plannedRisk: event.target.value })}
                          placeholder="e.g. 50"
                        />
                      </div>
                    )}

                    {currentStep === 3 && (
                      <div style={sectionStyle}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fbff" }}>Entry</div>
                        <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                          This is the price where you want to start the trade.
                        </div>
                        <input
                          className="authInput"
                          value={intelPracticeModeChoice.entry || ""}
                          onChange={(event) => updateIntelPracticeModeChoice({ entry: event.target.value })}
                          placeholder="e.g. 183.40"
                        />
                        {Number.isFinite(currentPrice) && (
                          <button
                            type="button"
                            onClick={handleIntelPracticeUseCurrentPrice}
                            style={optionStyle(false)}
                          >
                            Use current price {formatCurrency(currentPrice)}
                          </button>
                        )}
                        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                          If you are not sure, you can use the current market price as your starting point.
                        </div>
                      </div>
                    )}

                    {currentStep === 4 && (
                      <div style={sectionStyle}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fbff" }}>Stop Loss</div>
                        <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                          The price/level where this trade is wrong. Rayla uses this with dollar risk to size the simulation.
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => updateIntelPracticeModeChoice({ stopLossInputType: "price" })}
                            style={inputTypeStyle((intelPracticeModeChoice.stopLossInputType || "price") === "price")}
                          >
                            Price
                          </button>
                          <button
                            type="button"
                            onClick={() => updateIntelPracticeModeChoice({ stopLossInputType: "pnl" })}
                            style={inputTypeStyle((intelPracticeModeChoice.stopLossInputType || "price") === "pnl")}
                          >
                            P/L
                          </button>
                        </div>
                        <input
                          className="authInput"
                          value={intelPracticeModeChoice.stopLoss || ""}
                          onChange={(event) => updateIntelPracticeModeChoice({ stopLoss: event.target.value })}
                          placeholder={(intelPracticeModeChoice.stopLossInputType || "price") === "pnl" ? "e.g. 15" : "e.g. 183.40"}
                        />
                        {(intelPracticeModeChoice.stopLossInputType || "price") === "pnl" && (
                          <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                            In P/L mode, typing `15` means you are willing to lose $15.
                          </div>
                        )}
                      </div>
                    )}

                    {currentStep === 5 && (
                      <div style={sectionStyle}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fbff" }}>Take Profit</div>
                        <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                          This is where you want to lock in your win.
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => updateIntelPracticeModeChoice({ takeProfitInputType: "price" })}
                            style={inputTypeStyle((intelPracticeModeChoice.takeProfitInputType || "price") === "price")}
                          >
                            Price
                          </button>
                          <button
                            type="button"
                            onClick={() => updateIntelPracticeModeChoice({ takeProfitInputType: "pnl" })}
                            style={inputTypeStyle((intelPracticeModeChoice.takeProfitInputType || "price") === "pnl")}
                          >
                            P/L
                          </button>
                        </div>
                        <input
                          className="authInput"
                          value={intelPracticeModeChoice.takeProfit || ""}
                          onChange={(event) => updateIntelPracticeModeChoice({ takeProfit: event.target.value })}
                          placeholder={(intelPracticeModeChoice.takeProfitInputType || "price") === "pnl" ? "e.g. 25" : "e.g. 183.40"}
                        />
                        {(intelPracticeModeChoice.takeProfitInputType || "price") === "pnl" && (
                          <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                            In P/L mode, typing `25` means you want to make $25.
                          </div>
                        )}
                      </div>
                    )}

                    {currentStep === 6 && (
                      <div style={sectionStyle}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fbff" }}>Final Review</div>
                        <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                          Check that everything looks right before opening the simulator.
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13, color: "#dbeafe" }}>
                          <div>Mode: <span style={{ color: "#f8fbff" }}>{intelPracticeModeChoice.mode || "—"}</span></div>
                          <div>Direction: <span style={{ color: "#f8fbff" }}>{intelPracticeModeChoice.direction || "—"}</span></div>
                          <div>Risk: <span style={{ color: "#f8fbff" }}>{Number.isFinite(intelPracticeModeChoice.plannedRiskValue) ? formatCurrency(intelPracticeModeChoice.plannedRiskValue) : "—"}</span></div>
                          <div>Entry: <span style={{ color: "#f8fbff" }}>{Number.isFinite(intelPracticeModeChoice.entryValue) ? formatCurrency(intelPracticeModeChoice.entryValue) : "—"}</span></div>
                          <div>Stop: <span style={{ color: "#f8fbff" }}>{Number.isFinite(intelPracticeModeChoice.stopLossValue) ? `${(intelPracticeModeChoice.stopLossInputType || "price") === "pnl" ? "P/L " : ""}${formatCurrency(intelPracticeModeChoice.stopLossValue)}` : "—"}</span></div>
                          <div>Target: <span style={{ color: "#f8fbff" }}>{Number.isFinite(intelPracticeModeChoice.takeProfitValue) ? `${(intelPracticeModeChoice.takeProfitInputType || "price") === "pnl" ? "P/L " : ""}${formatCurrency(intelPracticeModeChoice.takeProfitValue)}` : "—"}</span></div>
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                          Confirm this setup to open the simulator on {intelPracticeModeChoice.draft?.asset || "the selected asset"}.
                        </div>
                      </div>
                    )}

                    {intelPracticeModeChoice.error && (
                      <div style={{ fontSize: 13, color: "#fca5a5", lineHeight: 1.6 }}>
                        {intelPracticeModeChoice.error}
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <button
                        type="button"
                        onClick={handleIntelPracticeWizardBack}
                        disabled={(intelPracticeModeChoice.wizardStep || 0) === 0}
                        style={{
                          border: "1px solid rgba(255,255,255,0.1)",
                          background: (intelPracticeModeChoice.wizardStep || 0) === 0 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.04)",
                          color: (intelPracticeModeChoice.wizardStep || 0) === 0 ? "#64748b" : "#cbd5e1",
                          borderRadius: 12,
                          padding: "10px 14px",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: (intelPracticeModeChoice.wizardStep || 0) === 0 ? "not-allowed" : "pointer",
                        }}
                      >
                        Back
                      </button>

                      {(intelPracticeModeChoice.wizardStep || 0) >= 6 ? (
                        <button
                          type="button"
                          onClick={handleConfirmIntelPracticeModeChoice}
                          style={{
                            border: "1px solid rgba(124,196,255,0.35)",
                            background: "#7CC4FF",
                            color: "#0b1017",
                            borderRadius: 12,
                            padding: "10px 14px",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Confirm and Open Simulator
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleIntelPracticeWizardNext}
                          style={{
                            border: "1px solid rgba(124,196,255,0.35)",
                            background: "#7CC4FF",
                            color: "#0b1017",
                            borderRadius: 12,
                            padding: "10px 14px",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Continue
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={handleCancelIntelPracticeModeChoice}
                  style={{
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.04)",
                    color: "#cbd5e1",
                    borderRadius: 12,
                    padding: "10px 14px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
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
