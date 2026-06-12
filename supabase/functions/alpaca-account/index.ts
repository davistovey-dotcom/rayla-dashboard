import { alpacaBrokerRequest, normalizeAlpacaAccount, resolveBrokerConnection } from "../_shared/alpaca.ts";
import { buildCorsHeaders, jsonResponse, requireSupabaseUser } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: buildCorsHeaders() });
  }

  try {
    const { supabase, user } = await requireSupabaseUser(req);
    const body = await req.json().catch(() => ({}));
    const preferPaper: boolean | null = body?.preferPaper ?? null;

    const [{ data: liveConn }, { data: paperConn }] = await Promise.all([
      supabase.from("user_broker_connections").select("id").eq("user_id", user.id).eq("provider", "alpaca").eq("is_paper", false).maybeSingle(),
      supabase.from("user_broker_connections").select("id").eq("user_id", user.id).eq("provider", "alpaca").eq("is_paper", true).maybeSingle(),
    ]);

    const { connection, isPaper } = await resolveBrokerConnection(supabase, user.id, preferPaper);

    const hasLiveConnection = Boolean(liveConn);
    const hasPaperConnection = Boolean(paperConn);

    if (!connection) {
      return jsonResponse({
        ok: true,
        connected: false,
        provider: "alpaca",
        isPaper: false,
        hasLiveConnection,
        hasPaperConnection,
        account: null,
      });
    }

    const account = await alpacaBrokerRequest(connection.access_token, "/v2/account", isPaper);

    return jsonResponse({
      ok: true,
      connected: true,
      provider: "alpaca",
      isPaper,
      hasLiveConnection,
      hasPaperConnection,
      account: normalizeAlpacaAccount(account, isPaper),
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to load Alpaca account.",
      },
      400
    );
  }
});
