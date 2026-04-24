import { alpacaPaperRequest, normalizeAlpacaOrder, upsertBrokerTradeLogs } from "../_shared/alpaca.ts";
import { buildCorsHeaders, jsonResponse, requireSupabaseUser } from "../_shared/auth.ts";

function normalizeSymbol(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function validateOrderBody(body: any) {
  const symbol = normalizeSymbol(body?.symbol);
  const side = body?.side;
  const qty = Number(body?.qty);
  const type = body?.type;
  const limitPrice = body?.limit_price == null || body?.limit_price === "" ? null : Number(body.limit_price);
  const timeInForce = body?.time_in_force || "day";

  if (!/^[A-Z]{1,5}$/.test(symbol)) {
    throw new Error("Stocks only. Enter a valid stock symbol.");
  }

  if (side !== "buy" && side !== "sell") {
    throw new Error("Order side must be buy or sell.");
  }

  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("Quantity must be a positive number.");
  }

  if (type !== "market" && type !== "limit") {
    throw new Error("Order type must be market or limit.");
  }

  if (type === "limit" && (!Number.isFinite(limitPrice) || limitPrice <= 0)) {
    throw new Error("Limit orders require a positive limit price.");
  }

  if (timeInForce !== "day") {
    throw new Error("Only day time-in-force is supported in this first version.");
  }

  return {
    symbol,
    side,
    qty,
    type,
    time_in_force: "day",
    ...(type === "limit" ? { limit_price: limitPrice } : {}),
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

    const { data: connection, error } = await supabase
      .from("user_broker_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "alpaca")
      .eq("is_paper", true)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!connection) {
      throw new Error("Connect your Alpaca Paper account before placing an order.");
    }

    const order = await alpacaPaperRequest(connection.access_token, "/v2/orders", {
      method: "POST",
      body: JSON.stringify(orderPayload),
    });

    await upsertBrokerTradeLogs(supabase, user.id, "alpaca", [order], "rayla");

    return jsonResponse({
      ok: true,
      connected: true,
      provider: "alpaca",
      isPaper: true,
      order: normalizeAlpacaOrder(order),
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to place Alpaca paper order.",
      },
      400
    );
  }
});
