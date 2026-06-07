const ALPACA_AUTHORIZE_URL = "https://app.alpaca.markets/oauth/authorize";
const ALPACA_TOKEN_URL = "https://api.alpaca.markets/oauth/token";
const ALPACA_PAPER_API_BASE = "https://paper-api.alpaca.markets";
const ALPACA_LIVE_API_BASE = "https://api.alpaca.markets";
const ALPACA_MARKET_DATA_BASE = "https://data.alpaca.markets";

export function getAlpacaEnv() {
  const clientId = Deno.env.get("ALPACA_CLIENT_ID");
  const clientSecret = Deno.env.get("ALPACA_CLIENT_SECRET");
  const redirectUri = Deno.env.get("ALPACA_REDIRECT_URI");
  const appBaseUrl = Deno.env.get("APP_BASE_URL");

  if (!clientId || !clientSecret || !redirectUri || !appBaseUrl) {
    throw new Error("Missing one or more Alpaca environment variables.");
  }

  return { clientId, clientSecret, redirectUri, appBaseUrl };
}

export function getAlpacaMarketDataEnv() {
  const keyId = Deno.env.get("ALPACA_MARKET_DATA_KEY_ID");
  const secretKey = Deno.env.get("ALPACA_MARKET_DATA_SECRET_KEY");
  const stockFeed = (Deno.env.get("ALPACA_MARKET_DATA_STOCK_FEED") || "iex").toLowerCase();

  if (!keyId || !secretKey) {
    throw new Error("Missing Alpaca market-data credentials.");
  }

  return {
    keyId,
    secretKey,
    stockFeed: stockFeed === "sip" ? "sip" : "iex",
  };
}

export function buildAlpacaAuthorizeUrl(state: string, isPaper = false) {
  const { clientId, redirectUri } = getAlpacaEnv();
  const url = new URL(ALPACA_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "trading");
  if (isPaper) url.searchParams.set("env", "paper");
  return url.toString();
}

export async function exchangeAlpacaCode(code: string) {
  const { clientId, clientSecret, redirectUri } = getAlpacaEnv();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  const response = await fetch(ALPACA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Alpaca token exchange failed.");
  }

  return data;
}

export async function alpacaBrokerRequest(accessToken: string, path: string, isPaper: boolean, init: RequestInit = {}) {
  const base = isPaper ? ALPACA_PAPER_API_BASE : ALPACA_LIVE_API_BASE;
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Alpaca API request failed.");
  }

  return data;
}

export async function alpacaBrokerRequestWithHeaders(accessToken: string, path: string, isPaper: boolean, init: RequestInit = {}) {
  const base = isPaper ? ALPACA_PAPER_API_BASE : ALPACA_LIVE_API_BASE;
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Alpaca API request failed.");
  }

  return { data, headers: response.headers };
}

// Kept for backwards compatibility in place-order (which has its own raw request)
export async function alpacaPaperRequest(accessToken: string, path: string, init: RequestInit = {}) {
  return alpacaBrokerRequest(accessToken, path, true, init);
}

export async function alpacaMarketDataRequest(path: string, init: RequestInit = {}) {
  const { keyId, secretKey } = getAlpacaMarketDataEnv();
  const response = await fetch(`${ALPACA_MARKET_DATA_BASE}${path}`, {
    ...init,
    headers: {
      "APCA-API-KEY-ID": keyId,
      "APCA-API-SECRET-KEY": secretKey,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Alpaca market-data request failed.");
  }

  return data;
}

export function normalizeAlpacaAccount(account: any, isPaper = false) {
  return {
    id: account?.id || null,
    accountNumber: account?.account_number || null,
    status: account?.status || null,
    buyingPower: Number(account?.buying_power ?? 0),
    cash: Number(account?.cash ?? 0),
    portfolioValue: Number(account?.portfolio_value ?? 0),
    equity: Number(account?.equity ?? 0),
    lastEquity: Number(account?.last_equity ?? 0),
    // dayPnl intentionally omitted: equity - last_equity includes deposits/withdrawals
    // and would misrepresent trading performance. Day P&L is computed client-side
    // from position-level unrealized_intraday_pl which is deposit-immune.
    isPaper,
    currency: account?.currency || "USD",
    raw: account,
  };
}

export function normalizeAlpacaPosition(position: any) {
  return {
    assetId: position?.asset_id || null,
    symbol: position?.symbol || "",
    qty: Number(position?.qty ?? 0),
    qtyAvailable: Number(position?.qty_available ?? position?.qty ?? 0),
    side: position?.side || "",
    marketValue: Number(position?.market_value ?? 0),
    avgEntryPrice: Number(position?.avg_entry_price ?? 0),
    unrealizedPl: Number(position?.unrealized_pl ?? 0),
    unrealizedPlpc: Number(position?.unrealized_plpc ?? 0),
    // Intraday P&L: price movement only since today's open, deposit-immune.
    // Alpaca sets this to the gain/loss vs. the position's intraday baseline price.
    unrealizedIntradayPl: Number(position?.unrealized_intraday_pl ?? 0),
    unrealizedIntradayPlpc: Number(position?.unrealized_intraday_plpc ?? 0),
    currentPrice: Number(position?.current_price ?? 0),
    changeToday: Number(position?.change_today ?? 0),
    exchange: position?.exchange || null,
    assetClass: position?.asset_class || "us_equity",
    raw: position,
  };
}

export function normalizeAlpacaOrder(order: any) {
  return {
    id: order?.id || null,
    clientOrderId: order?.client_order_id || null,
    status: order?.status || null,
    symbol: order?.symbol || null,
    side: order?.side || null,
    qty: Number(order?.qty ?? 0),
    type: order?.type || null,
    timeInForce: order?.time_in_force || null,
    limitPrice: order?.limit_price ? Number(order.limit_price) : null,
    filledQty: Number(order?.filled_qty ?? 0),
    submittedAt: order?.submitted_at || null,
    filledAt: order?.filled_at || null,
    raw: order,
  };
}

export function normalizeAlpacaSnapshot(symbol: string, snapshot: any, assetType = "stock") {
  if (!snapshot) return null;

  const bid = Number(snapshot?.latestQuote?.bp ?? snapshot?.latestQuote?.bidPrice ?? 0);
  const ask = Number(snapshot?.latestQuote?.ap ?? snapshot?.latestQuote?.askPrice ?? 0);
  const normalizedBid = Number.isFinite(bid) && bid > 0 ? bid : null;
  const normalizedAsk = Number.isFinite(ask) && ask > 0 ? ask : null;

  if (assetType === "crypto") {
    const latestTradePrice = Number(snapshot?.latestTrade?.p ?? 0);
    const prevClose = Number(snapshot?.dailyBar?.o ?? snapshot?.prevDailyBar?.c ?? 0);
    const change = prevClose > 0 ? ((latestTradePrice - prevClose) / prevClose) * 100 : null;
    const updatedAt = snapshot?.latestTrade?.t || snapshot?.minuteBar?.t || snapshot?.dailyBar?.t || null;

    console.log(`[alpaca] crypto snapshot ${symbol}: latestTrade.p=${snapshot?.latestTrade?.p} dailyBar.o=${snapshot?.dailyBar?.o} prevDailyBar.c=${snapshot?.prevDailyBar?.c} prevClose=${prevClose} change=${change}`);

    if (!Number.isFinite(latestTradePrice) || latestTradePrice <= 0) return null;

    return {
      symbol,
      price: latestTradePrice,
      change: change !== null ? Number(change.toFixed(2)) : null,
      previousClose: prevClose || null,
      updatedAt,
      bid: normalizedBid,
      ask: normalizedAsk,
      lastTradePrice: latestTradePrice,
      assetType,
      raw: snapshot,
    };
  }

  const latestTradePrice = Number(snapshot?.latestTrade?.p ?? snapshot?.dailyBar?.c ?? 0);
  const prevClose = Number(snapshot?.prevDailyBar?.c ?? 0);
  const change = prevClose > 0 ? ((latestTradePrice - prevClose) / prevClose) * 100 : 0;
  const updatedAt = snapshot?.latestTrade?.t || snapshot?.minuteBar?.t || snapshot?.dailyBar?.t || null;

  if (!Number.isFinite(latestTradePrice) || latestTradePrice <= 0) return null;

  return {
    symbol,
    price: latestTradePrice,
    change: Number(change.toFixed(2)),
    previousClose: prevClose || null,
    updatedAt,
    bid: normalizedBid,
    ask: normalizedAsk,
    lastTradePrice: latestTradePrice,
    assetType,
    raw: snapshot,
  };
}

export function normalizeAlpacaBar(bar: any) {
  return {
    time: bar?.t || null,
    open: Number(bar?.o ?? 0),
    high: Number(bar?.h ?? 0),
    low: Number(bar?.l ?? 0),
    close: Number(bar?.c ?? 0),
    volume: Number(bar?.v ?? 0),
    raw: bar,
  };
}

export function normalizeAlpacaNewsItem(article: any) {
  return {
    id: article?.id || null,
    headline: article?.headline || article?.title || "",
    summary: article?.summary || article?.content || "",
    url: article?.url || null,
    source: article?.source || null,
    createdAt: article?.created_at || article?.updated_at || null,
    symbols: Array.isArray(article?.symbols) ? article.symbols : [],
    raw: article,
  };
}

function normalizeRaylaTradeType(value: any) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "crypto_hold") return "investment";
  return ["day_trade", "swing_trade", "investment"].includes(normalized) ? normalized : "day_trade";
}

export function buildBrokerTradeLogRow(userId: string, provider: string, order: any, source = "alpaca_import", existingSource?: string | null, existingTradeType?: string | null) {
  const normalizedOrder = normalizeAlpacaOrder(order);
  return {
    user_id: userId,
    broker_provider: provider,
    broker_order_id: normalizedOrder.id,
    symbol: normalizedOrder.symbol || "",
    side: normalizedOrder.side || "",
    qty: normalizedOrder.qty || 0,
    order_type: normalizedOrder.type || "market",
    limit_price: normalizedOrder.limitPrice,
    time_in_force: normalizedOrder.timeInForce,
    status: normalizedOrder.status || "new",
    source: existingSource === "rayla" ? "rayla" : source,
    trade_type: normalizeRaylaTradeType(existingTradeType || normalizedOrder.raw?.trade_type),
    submitted_at: normalizedOrder.submittedAt,
    filled_at: normalizedOrder.filledAt,
    raw_payload: normalizedOrder.raw || {},
  };
}

export async function upsertBrokerTradeLogs(supabase: any, userId: string, provider: string, orders: any[], source = "alpaca_import") {
  const validOrders = (orders || []).filter((order) => order?.id);
  if (!validOrders.length) return [];

  const orderIds = validOrders.map((order) => order.id);
  const { data: existingRows, error: existingError } = await supabase
    .from("broker_trade_logs")
    .select("broker_order_id, source, trade_type")
    .eq("user_id", userId)
    .eq("broker_provider", provider)
    .in("broker_order_id", orderIds);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingByOrderId = new Map(
    (existingRows || []).map((row: any) => [row.broker_order_id, row])
  );

  const payload = validOrders.map((order) =>
    buildBrokerTradeLogRow(
      userId,
      provider,
      order,
      source,
      existingByOrderId.get(order.id)?.source || null,
      existingByOrderId.get(order.id)?.trade_type || null
    )
  );

  const { data, error } = await supabase
    .from("broker_trade_logs")
    .upsert(payload, { onConflict: "user_id,broker_provider,broker_order_id" })
    .select("*");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

const CASHFLOW_ACTIVITY_TYPES = ["CSD", "CSW", "JNLC", "ACATC", "ACATS"];

export async function fetchCashflowActivities(
  accessToken: string,
  isPaper: boolean,
  afterMs: number | null = null,
): Promise<Array<{ date: string | null; netAmount: number }>> {
  const activities: Array<{ date: string | null; netAmount: number }> = [];
  let pageToken: string | null = null;
  let pageGuard = 0;

  do {
    const params = new URLSearchParams({
      category: "non_trade_activity",
      activity_types: CASHFLOW_ACTIVITY_TYPES.join(","),
      direction: "asc",
      page_size: "100",
    });
    if (pageToken) params.set("page_token", pageToken);

    const { data, headers } = await alpacaBrokerRequestWithHeaders(
      accessToken,
      `/v2/account/activities?${params.toString()}`,
      isPaper,
    );

    const page = Array.isArray(data) ? data : [];
    for (const activity of page) {
      const activityType = String(activity?.activity_type || "").trim().toUpperCase();
      if (!CASHFLOW_ACTIVITY_TYPES.includes(activityType)) continue;
      const netAmount = Number(activity?.net_amount ?? activity?.netAmount);
      if (!Number.isFinite(netAmount)) continue;
      const date = activity?.date || activity?.transaction_time || activity?.created_at || null;
      activities.push({ date, netAmount });
    }

    pageToken =
      headers.get("pagination-token") ||
      headers.get("Pagination-Token") ||
      headers.get("next-page-token") ||
      headers.get("Next-Page-Token") ||
      null;
    pageGuard += 1;
  } while (pageToken && pageGuard < 50);

  if (afterMs != null) {
    return activities.filter((a) => {
      const parsed = Date.parse(String(a.date || ""));
      return Number.isFinite(parsed) && parsed >= afterMs;
    });
  }

  return activities;
}

// Resolves the best available broker connection: live first, paper fallback.
export async function resolveBrokerConnection(supabase: any, userId: string) {
  const { data: liveConn } = await supabase
    .from("user_broker_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "alpaca")
    .eq("is_paper", false)
    .maybeSingle();

  if (liveConn) return { connection: liveConn, isPaper: false };

  const { data: paperConn } = await supabase
    .from("user_broker_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "alpaca")
    .eq("is_paper", true)
    .maybeSingle();

  if (paperConn) return { connection: paperConn, isPaper: true };

  return { connection: null, isPaper: false };
}
