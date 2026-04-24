import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function buildCorsHeaders(methods = "POST, OPTIONS") {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": methods,
    "Content-Type": "application/json",
  };
}

export function jsonResponse(payload: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...buildCorsHeaders(),
      ...extraHeaders,
    },
  });
}

export function redirectResponse(location: string, status = 302) {
  return new Response(null, {
    status,
    headers: {
      Location: location,
      ...buildCorsHeaders("GET, OPTIONS"),
    },
  });
}

export function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getBearerToken(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization bearer token.");
  }

  return authHeader.replace("Bearer ", "");
}

export async function requireSupabaseUser(req: Request) {
  const supabase = getSupabaseAdmin();
  const token = getBearerToken(req);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error(error?.message || "Invalid authenticated user.");
  }

  return { supabase, user, token };
}
