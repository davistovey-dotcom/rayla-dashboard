import { alpacaBrokerRequest, normalizeAlpacaPosition, resolveBrokerConnection } from "../_shared/alpaca.ts";
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
        positions: [],
      });
    }

    const positions = await alpacaBrokerRequest(connection.access_token, "/v2/positions", isPaper);

    return jsonResponse({
      ok: true,
      connected: true,
      provider: "alpaca",
      isPaper,
      positions: Array.isArray(positions) ? positions.map(normalizeAlpacaPosition) : [],
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to load Alpaca positions.",
      },
      400
    );
  }
});
