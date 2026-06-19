import { buildCorsHeaders, jsonResponse, requireSupabaseUser } from "../_shared/auth.ts";

const DEFAULT_DISCOUNT_CODE = "RAYLA-DISCOUNT-FREE";
const LEGACY_DISCOUNT_CODES = ["RAYLA-FOUNDERS-FREE"];

function normalizeCode(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: buildCorsHeaders() });
  }

  try {
    const { supabase, user } = await requireSupabaseUser(req);
    const payload = await req.json().catch(() => ({}));
    const submittedCode = normalizeCode(payload?.code);
    const discountCode = normalizeCode(Deno.env.get("RAYLA_DISCOUNT_CODE") || DEFAULT_DISCOUNT_CODE);
    const validCodes = new Set([discountCode, ...LEGACY_DISCOUNT_CODES].filter(Boolean));

    if (!submittedCode || !validCodes.has(submittedCode)) {
      return jsonResponse({
        ok: false,
        reason: "invalid_code",
        message: "That discount code is not active.",
      }, 403);
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("user_subscriptions")
      .upsert({
        user_id: user.id,
        billing_provider: "stripe",
        status: "active",
        plan_key: "rayla_discount",
        price_id: null,
        current_period_end: null,
        cancel_at_period_end: false,
        trial_ends_at: null,
        metadata: {
          discount_access: true,
          discount_code_redeemed_at: now,
        },
      }, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return jsonResponse({
      ok: true,
      subscription: data,
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unable to redeem discount code.",
    }, 400);
  }
});
