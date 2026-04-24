import { alpacaPaperRequest, normalizeAlpacaAccount } from "../_shared/alpaca.ts";
import { buildCorsHeaders, jsonResponse, requireSupabaseUser } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: buildCorsHeaders() });
  }

  try {
    const { supabase, user } = await requireSupabaseUser(req);
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
      return jsonResponse({
        ok: true,
        connected: false,
        provider: "alpaca",
        isPaper: true,
        account: null,
      });
    }

    const account = await alpacaPaperRequest(connection.access_token, "/v2/account");

    return jsonResponse({
      ok: true,
      connected: true,
      provider: "alpaca",
      isPaper: true,
      account: normalizeAlpacaAccount(account),
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
