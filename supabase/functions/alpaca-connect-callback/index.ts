import { alpacaPaperRequest, exchangeAlpacaCode, getAlpacaEnv } from "../_shared/alpaca.ts";
import { buildCorsHeaders, getSupabaseAdmin, redirectResponse } from "../_shared/auth.ts";

function buildAppRedirect(status: "connected" | "error", message = "") {
  const { appBaseUrl } = getAlpacaEnv();
  const url = new URL(appBaseUrl);
  url.searchParams.set("broker", "alpaca");
  url.searchParams.set("broker_status", status);
  if (message) {
    url.searchParams.set("broker_message", message.slice(0, 180));
  }
  return url.toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: buildCorsHeaders("GET, OPTIONS") });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      return redirectResponse(buildAppRedirect("error", "Missing Alpaca callback parameters."));
    }

    const supabase = getSupabaseAdmin();
    const { data: stateRow, error: stateError } = await supabase
      .from("broker_oauth_states")
      .select("*")
      .eq("provider", "alpaca")
      .eq("state_token", state)
      .eq("is_paper", true)
      .is("consumed_at", null)
      .maybeSingle();

    if (stateError) {
      return redirectResponse(buildAppRedirect("error", stateError.message));
    }

    if (!stateRow || new Date(stateRow.expires_at).getTime() < Date.now()) {
      return redirectResponse(buildAppRedirect("error", "Alpaca connect session expired. Please try again."));
    }

    const tokenData = await exchangeAlpacaCode(code);
    const account = await alpacaPaperRequest(tokenData.access_token, "/v2/account");

    const payload = {
      user_id: stateRow.user_id,
      provider: "alpaca",
      broker_user_id: account?.id || tokenData?.user_id || null,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      scope: tokenData.scope || "trading",
      is_paper: true,
      metadata: {
        env: "paper",
        token_type: tokenData.token_type || "bearer",
        expires_in: tokenData.expires_in || null,
        account_status: account?.status || null,
      },
      // TODO: encrypt access_token and refresh_token at rest before enabling live trading.
    };

    const { error: upsertError } = await supabase
      .from("user_broker_connections")
      .upsert(payload, {
        onConflict: "user_id,provider,is_paper",
      });

    if (upsertError) {
      return redirectResponse(buildAppRedirect("error", upsertError.message));
    }

    await supabase
      .from("broker_oauth_states")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", stateRow.id);

    return redirectResponse(buildAppRedirect("connected", "Alpaca Paper connected."));
  } catch (error) {
    return redirectResponse(
      buildAppRedirect(
        "error",
        error instanceof Error ? error.message : "Unable to complete Alpaca connect."
      )
    );
  }
});
