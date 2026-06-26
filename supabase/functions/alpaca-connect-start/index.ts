import { buildAlpacaAuthorizeUrl } from "../_shared/alpaca.ts";
import { buildCorsHeaders, jsonResponse, requireSupabaseUser } from "../_shared/auth.ts";

function createSecureStateToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sanitizeReturnUri(uri: unknown): string | null {
  if (typeof uri !== "string" || !uri) return null;
  if (uri === "rayla://broker-return") return uri;
  try {
    const parsed = new URL(uri);
    if (parsed.protocol === "https:" && (parsed.host === "raylainc.live" || parsed.host === "www.raylainc.live")) {
      return uri;
    }
  } catch {
    // fall through
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: buildCorsHeaders() });
  }

  try {
    const { supabase, user } = await requireSupabaseUser(req);

    let isPaper = false;
    let returnUri: string | null = null;
    try {
      const body = await req.json();
      isPaper = body?.isPaper === true;
      returnUri = sanitizeReturnUri(body?.returnUri);
    } catch {
      // no body or invalid JSON — default to live
    }

    const state = createSecureStateToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabase
      .from("broker_oauth_states")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "alpaca")
      .eq("is_paper", isPaper);

    const { error } = await supabase.from("broker_oauth_states").insert({
      user_id: user.id,
      provider: "alpaca",
      state_token: state,
      is_paper: isPaper,
      expires_at: expiresAt,
      metadata: {
        scope: "trading",
        return_uri: returnUri,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return jsonResponse({
      ok: true,
      provider: "alpaca",
      isPaper,
      url: buildAlpacaAuthorizeUrl(state, isPaper),
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
