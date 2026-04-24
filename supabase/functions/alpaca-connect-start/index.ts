import { buildAlpacaAuthorizeUrl } from "../_shared/alpaca.ts";
import { buildCorsHeaders, jsonResponse, requireSupabaseUser } from "../_shared/auth.ts";

function createSecureStateToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: buildCorsHeaders() });
  }

  try {
    const { supabase, user } = await requireSupabaseUser(req);
    const state = createSecureStateToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabase
      .from("broker_oauth_states")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "alpaca")
      .eq("is_paper", true);

    const { error } = await supabase.from("broker_oauth_states").insert({
      user_id: user.id,
      provider: "alpaca",
      state_token: state,
      is_paper: true,
      expires_at: expiresAt,
      metadata: {
        scope: "trading",
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return jsonResponse({
      ok: true,
      provider: "alpaca",
      isPaper: true,
      url: buildAlpacaAuthorizeUrl(state),
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to start Alpaca connect flow.",
      },
      400
    );
  }
});
