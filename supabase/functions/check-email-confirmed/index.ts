import { buildCorsHeaders, jsonResponse } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: buildCorsHeaders() });
  }

  try {
    const { email } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string") return jsonResponse({ confirmed: false });

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ confirmed: false });

    const response = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email.toLowerCase().trim())}&page=1&per_page=1`,
      {
        headers: {
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
      }
    );

    if (!response.ok) return jsonResponse({ confirmed: false });

    const data = await response.json();
    const user = Array.isArray(data?.users) ? data.users[0] : null;
    return jsonResponse({ confirmed: Boolean(user?.email_confirmed_at) });
  } catch {
    return jsonResponse({ confirmed: false });
  }
});
