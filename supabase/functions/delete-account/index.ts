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
