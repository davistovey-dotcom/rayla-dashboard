import { normalizeAlpacaOrder, resolveBrokerConnection, upsertBrokerTradeLogs } from "../_shared/alpaca.ts";
import { buildCorsHeaders, jsonResponse, requireSupabaseUser } from "../_shared/auth.ts";

const ALPACA_PAPER_API_BASE = "https://paper-api.alpaca.markets";
const ALPACA_LIVE_API_BASE = "https://api.alpaca.markets";
const CRYPTO_BASE_SYMBOLS = new Set(["BTC", "ETH", "SOL", "XRP", "DOGE", "LTC", "BCH", "AAVE", "UNI", "LINK", "AVAX", "BAT", "CRV", "GRT", "MKR", "SHIB", "SUSHI", "USDT", "USDC"]);

async function alpacaRawRequest(accessToken: string, path: string, isPaper: boolean, init: RequestInit = {}) {
  const base = isPaper ? ALPACA_PAPER_API_BASE : ALPACA_LIVE_API_BASE;
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const detail = data?.message || data?.error || `Alpaca API request failed with status ${response.status}.`;
    throw new Error(`${detail} (${init.method || "GET"} ${path})`);
  }

  return data;
}

function normalizeOrderSymbol(value: unknown) {
  const raw = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!raw) return "";
  if (/^[A-Z0-9]{2,10}\/USD$/.test(raw)) return raw;

  const compact = raw.replace(/[^A-Z0-9]/g, "");
  const usdPair = compact.match(/^([A-Z0-9]{2,6})USD$/);
  if (usdPair && CRYPTO_BASE_SYMBOLS.has(usdPair[1])) {
    return `${usdPair[1]}/USD`;
  }
  if (CRYPTO_BASE_SYMBOLS.has(compact)) {
    return `${compact}/USD`;
  }
  return compact;
}

function getPositionEndpointSymbol(symbol: string) {
  const usdPair = symbol.match(/^([A-Z0-9]{2,10})\/USD$/);
  return usdPair ? `${usdPair[1]}USD` : symbol;
}

function findMatchingPosition(positions: any[], symbol: string) {
  const endpointSymbol = getPositionEndpointSymbol(symbol);
  return (positions || []).find((position) => {
    const rawSymbol = String(position?.symbol || "").trim().toUpperCase();
    const rawAssetId = String(position?.asset_id || "").trim();
    return (
      normalizeOrderSymbol(rawSymbol) === symbol
      || rawSymbol === endpointSymbol
      || rawAssetId === symbol
    );
  }) || null;
}

function validateOrderBody(body: any) {
  const symbol = normalizeOrderSymbol(body?.symbol);
  const side = body?.side;
  const qty = Number(body?.qty);
  const type = body?.type;
  const closePosition = body?.close_position === true;
  const limitPrice = body?.limit_price == null || body?.limit_price === "" ? null : Number(body.limit_price);
  const stopPrice = body?.stop_price == null || body?.stop_price === "" ? null : Number(body.stop_price);
  const timeInForce = String(body?.time_in_force || "gtc").toLowerCase();

  if (!(/^[A-Z][A-Z0-9.]{0,9}$/.test(symbol) || /^[A-Z0-9]{2,10}\/USD$/.test(symbol))) {
    throw new Error("Enter a valid Alpaca stock or crypto symbol.");
  }

  if (side !== "buy" && side !== "sell") {
    throw new Error("Order side must be buy or sell.");
  }

  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("Quantity must be a positive number.");
  }

  if (!["market", "limit", "stop", "stop_limit"].includes(type)) {
    throw new Error("Order type must be market, limit, stop, or stop limit.");
  }

  if (type === "limit" && (!Number.isFinite(limitPrice) || limitPrice <= 0)) {
    throw new Error("Limit orders require a positive limit price.");
  }

  if (type === "stop" && (!Number.isFinite(stopPrice) || stopPrice <= 0)) {
    throw new Error("Stop orders require a positive stop price.");
  }

  if (type === "stop_limit") {
    if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
      throw new Error("Stop limit orders require a positive limit price.");
    }
    if (!Number.isFinite(stopPrice) || stopPrice <= 0) {
      throw new Error("Stop limit orders require a positive stop price.");
    }
  }

  if (!["gtc", "ioc", "fok"].includes(timeInForce)) {
    throw new Error("Time in force must be GTC, IOC, or FOK.");
  }

  return {
    symbol,
    side,
    qty,
    type,
    close_position: closePosition,
    time_in_force: timeInForce,
    ...(type === "limit" || type === "stop_limit" ? { limit_price: limitPrice } : {}),
    ...(type === "stop" || type === "stop_limit" ? { stop_price: stopPrice } : {}),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: buildCorsHeaders() });
  }

  try {
    const { supabase, user } = await requireSupabaseUser(req);
    const body = await req.json();
    const orderPayload = validateOrderBody(body);

    const { connection, isPaper } = await resolveBrokerConnection(supabase, user.id);

    if (!connection) {
      throw new Error("Connect your Alpaca account before placing an order.");
    }

    let order;
    let cancelledOpenOrderCount = 0;

    if (orderPayload.close_position) {
      const positions = await alpacaRawRequest(connection.access_token, "/v2/positions", isPaper);
      const matchingPosition = findMatchingPosition(Array.isArray(positions) ? positions : [], orderPayload.symbol);
      if (!matchingPosition) {
        const availablePositionSymbols = (Array.isArray(positions) ? positions : [])
          .map((position) => position?.symbol || position?.asset_id)
          .filter(Boolean);
        throw new Error(`Broker position not found for ${orderPayload.symbol}. Available positions: ${availablePositionSymbols.join(", ") || "none"}.`);
      }

      const openOrders = await alpacaRawRequest(
        connection.access_token,
        "/v2/orders?status=open&direction=desc&limit=500&nested=false",
        isPaper
      );
      const matchingOpenOrders = (Array.isArray(openOrders) ? openOrders : [])
        .filter((orderItem) => (
          normalizeOrderSymbol(orderItem?.symbol) === orderPayload.symbol
          || String(orderItem?.symbol || "").trim().toUpperCase() === String(matchingPosition?.symbol || "").trim().toUpperCase()
        ));

      for (const openOrder of matchingOpenOrders) {
        if (!openOrder?.id) continue;
        try {
          await alpacaRawRequest(connection.access_token, `/v2/orders/${openOrder.id}`, isPaper, { method: "DELETE" });
          cancelledOpenOrderCount += 1;
        } catch {
          // If Alpaca marks an order non-cancelable between fetch and cancel, the close request below will return the real broker error.
        }
      }

      const positionEndpointIdentifier = matchingPosition?.asset_id || getPositionEndpointSymbol(String(matchingPosition?.symbol || orderPayload.symbol));
      const closePositionPath = `/v2/positions/${encodeURIComponent(positionEndpointIdentifier)}?percentage=100`;
      console.log("alpaca-place-order close_position", {
        requestSymbol: body?.symbol,
        normalizedOrderSymbol: orderPayload.symbol,
        rawPositionSymbol: matchingPosition?.symbol,
        rawPositionAssetId: matchingPosition?.asset_id,
        rawPositionExchange: matchingPosition?.exchange,
        rawPositionAssetClass: matchingPosition?.asset_class,
        rawPositionQty: matchingPosition?.qty,
        rawPositionQtyAvailable: matchingPosition?.qty_available,
        positionEndpointIdentifier,
        closePositionPath,
        cancelledOpenOrderCount,
        isPaper,
      });

      order = await alpacaRawRequest(
        connection.access_token,
        closePositionPath,
        isPaper,
        { method: "DELETE" }
      );
    } else {
      order = await alpacaRawRequest(connection.access_token, "/v2/orders", isPaper, {
        method: "POST",
        body: JSON.stringify(orderPayload),
      });
    }

    await upsertBrokerTradeLogs(supabase, user.id, "alpaca", [order], "rayla");

    return jsonResponse({
      ok: true,
      connected: true,
      provider: "alpaca",
      isPaper,
      order: normalizeAlpacaOrder(order),
      closePosition: orderPayload.close_position,
      cancelledOpenOrderCount,
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to place Alpaca order.",
      },
      400
    );
  }
});
