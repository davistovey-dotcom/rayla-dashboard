import { alpacaBrokerRequest, normalizeAlpacaOrder, resolveBrokerConnection, upsertBrokerTradeLogs } from "../_shared/alpaca.ts";
import { buildCorsHeaders, jsonResponse, requireSupabaseUser } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: buildCorsHeaders() });
  }

  try {
    const { supabase, user } = await requireSupabaseUser(req);
    const { connection, isPaper } = await resolveBrokerConnection(supabase, user.id);

    if (!connection) {
      return jsonResponse({
        ok: true,
        connected: false,
        provider: "alpaca",
        isPaper: false,
        orders: [],
      });
    }

    const recentOrders = await alpacaBrokerRequest(
      connection.access_token,
      "/v2/orders?status=all&direction=desc&limit=50&nested=false",
      isPaper
    );
    const openOrders = await alpacaBrokerRequest(
      connection.access_token,
      "/v2/orders?status=open&direction=desc&limit=500&nested=false",
      isPaper
    );
    const ordersById = new Map();
    [...(Array.isArray(openOrders) ? openOrders : []), ...(Array.isArray(recentOrders) ? recentOrders : [])]
      .forEach((order) => {
        if (order?.id) ordersById.set(order.id, order);
      });
    const orders = [...ordersById.values()];

    await upsertBrokerTradeLogs(supabase, user.id, "alpaca", orders, "alpaca_import");

    return jsonResponse({
      ok: true,
      connected: true,
      provider: "alpaca",
      isPaper,
      orders: orders.map(normalizeAlpacaOrder),
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to sync Alpaca orders.",
      },
      400
    );
  }
});
