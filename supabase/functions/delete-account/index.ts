import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "jsr:@panva/jose@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const SUPABASE_JWT_ISSUER =
  Deno.env.get("SB_JWT_ISSUER") ?? `${Deno.env.get("SUPABASE_URL")}/auth/v1`;

const SUPABASE_JWT_KEYS = jose.createRemoteJWKSet(
  new URL(`${Deno.env.get("SUPABASE_URL")}/auth/v1/.well-known/jwks.json`)
);

function getAuthToken(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization bearer token.");
  }

  return authHeader.replace("Bearer ", "");
}

async function verifySupabaseJWT(token: string) {
  return await jose.jwtVerify(token, SUPABASE_JWT_KEYS, {
    issuer: SUPABASE_JWT_ISSUER,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders, status: 200 });
  }

  try {
    console.log("[delete-account] request_started", { method: req.method });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[delete-account] missing_env", {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      });
      return new Response(JSON.stringify({
        ok: false,
        stage: "env",
        error: "Missing Supabase server environment variables.",
      }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("[delete-account] missing_or_invalid_auth_header", {
        present: Boolean(authHeader),
        hasBearerPrefix: Boolean(authHeader?.startsWith("Bearer ")),
      });
      return new Response(JSON.stringify({
        ok: false,
        stage: "auth_header",
        error: "Missing or invalid Authorization bearer token.",
      }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    console.log("[delete-account] auth_header_present");

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = getAuthToken(req);

    let userId: string | null = null;
    try {
      const { payload } = await verifySupabaseJWT(token);
      userId = typeof payload.sub === "string" ? payload.sub : null;
      console.log("[delete-account] verify_token_success", { userId });
    } catch (verifyError) {
      const errorMessage = verifyError instanceof Error ? verifyError.message : "Invalid JWT";
      console.error("[delete-account] verify_token_failed", errorMessage);
      return new Response(JSON.stringify({ ok: false, stage: "verify_token", error: errorMessage }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    if (!userId) {
      console.error("[delete-account] resolve_user_failed", "JWT missing sub claim");
      return new Response(JSON.stringify({ ok: false, stage: "resolve_user", error: "JWT missing sub claim." }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const {
      data: resolvedUser,
      error: userError,
    } = await supabase.auth.admin.getUserById(userId);

    if (userError || !resolvedUser?.user) {
      const errorMessage = userError?.message || "Invalid user";
      console.error("[delete-account] resolve_user_failed", errorMessage);
      return new Response(JSON.stringify({ ok: false, stage: "resolve_user", error: errorMessage }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    console.log("[delete-account] user_resolved", { userId });

    const { data: deletedTrades, error: tradesError } = await supabase
      .from("trades")
      .delete()
      .eq("user_id", userId)
      .select("id");
    if (tradesError) {
      console.error("[delete-account] delete_trades_failed", {
        message: tradesError.message,
        code: tradesError.code,
        details: tradesError.details,
        hint: tradesError.hint,
        assumedColumn: "trades.user_id",
      });
      return new Response(JSON.stringify({
        ok: false,
        stage: "delete_trades",
        error: tradesError.message,
        details: tradesError.details || null,
        hint: tradesError.hint || "Expected trades.user_id to reference auth.users.id.",
      }), {
        status: 500,
        headers: corsHeaders,
      });
    }
    console.log("[delete-account] delete_trades_success", {
      userId,
      deletedCount: deletedTrades?.length || 0,
    });

    let deletedProfileCount = 0;
    {
      const { data: deletedProfiles, error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId)
        .select("id");
      if (profileError) {
        console.error("[delete-account] delete_profile_failed", {
          message: profileError.message,
          code: profileError.code,
          details: profileError.details,
          hint: profileError.hint,
          assumedColumn: "profiles.id",
        });
        return new Response(JSON.stringify({
          ok: false,
          stage: "delete_profile",
          error: profileError.message,
          details: profileError.details || null,
          hint: profileError.hint || "Expected profiles.id to match auth.users.id.",
        }), {
          status: 500,
          headers: corsHeaders,
        });
      }
      deletedProfileCount = deletedProfiles?.length || 0;
    }
    console.log("[delete-account] delete_profile_success", {
      userId,
      deletedCount: deletedProfileCount,
    });

    // Cancel an active Stripe subscription before wiping user_subscriptions so
    // the customer is not billed after deletion. Apple IAP rows are skipped —
    // Apple subscriptions can only be canceled by the user in the App Store.
    try {
      const { data: subRow, error: subErr } = await supabase
        .from("user_subscriptions")
        .select("billing_provider, stripe_subscription_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (subErr) {
        console.error("[delete-account] stripe_lookup_failed", { message: subErr.message });
      } else if (subRow?.billing_provider === "stripe" && subRow?.stripe_subscription_id) {
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (!stripeKey) {
          console.error("[delete-account] stripe_cancel_skipped", { reason: "missing_STRIPE_SECRET_KEY" });
        } else {
          const subscriptionId = subRow.stripe_subscription_id;
          let cancelRes: Response | null = null;
          let cancelPayload: any = {};
          let attempts = 0;
          const maxAttempts = 2;
          while (attempts < maxAttempts) {
            attempts += 1;
            cancelRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${stripeKey}` },
            });
            cancelPayload = await cancelRes.json().catch(() => ({}));
            if (cancelRes.ok) break;
            if (attempts < maxAttempts) {
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }
          if (!cancelRes || !cancelRes.ok) {
            console.error("[delete-account] stripe_cancel_failed", {
              subscriptionId,
              status: cancelRes?.status || null,
              error: cancelPayload?.error?.message || null,
              attempts,
            });
            return new Response(JSON.stringify({
              ok: false,
              stage: "stripe_cancel",
              error: "Could not cancel your Stripe subscription. Please try again in a moment or contact support.",
            }), {
              status: 502,
              headers: corsHeaders,
            });
          }
          console.log("[delete-account] stripe_cancel_success", {
            subscriptionId,
            cancelStatus: cancelPayload?.status || null,
            attempts,
          });
        }
      }
    } catch (stripeErr) {
      console.error("[delete-account] stripe_cancel_threw", {
        message: stripeErr instanceof Error ? stripeErr.message : String(stripeErr),
      });
      return new Response(JSON.stringify({
        ok: false,
        stage: "stripe_cancel",
        error: "Could not cancel your Stripe subscription. Please try again in a moment or contact support.",
      }), {
        status: 502,
        headers: corsHeaders,
      });
    }

    // Clean up remaining user-scoped rows — log errors and continue so a single
    // missing table never blocks the auth.users deletion.
    const softDeletes: Array<{ table: string; column: string }> = [
      { table: "user_broker_connections", column: "user_id" },
      { table: "broker_oauth_states", column: "user_id" },
      { table: "position_trade_types", column: "user_id" },
      { table: "portfolio_snapshots", column: "user_id" },
      { table: "broker_trade_logs", column: "user_id" },
      { table: "user_subscriptions", column: "user_id" },
    ];
    for (const { table, column } of softDeletes) {
      const { error: softErr } = await supabase.from(table).delete().eq(column, userId);
      if (softErr) {
        console.error(`[delete-account] delete_${table}_failed`, { message: softErr.message, code: softErr.code });
      } else {
        console.log(`[delete-account] delete_${table}_success`, { userId });
      }
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("[delete-account] delete_auth_user_failed", {
        message: deleteError.message,
        status: deleteError.status || null,
      });
      return new Response(JSON.stringify({
        ok: false,
        stage: "delete_auth_user",
        error: deleteError.message,
      }), {
        status: 500,
        headers: corsHeaders,
      });
    }
    console.log("[delete-account] delete_auth_user_success", { userId });

    return new Response(JSON.stringify({
      ok: true,
      message: "Account deleted",
      deletedTrades: deletedTrades?.length || 0,
      deletedProfiles: deletedProfileCount,
    }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Server error";
    console.error("[delete-account] unexpected_error", errorMessage);
    return new Response(JSON.stringify({ ok: false, stage: "unexpected", error: errorMessage }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
