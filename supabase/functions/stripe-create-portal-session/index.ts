import { buildCorsHeaders, jsonResponse, requireSupabaseUser } from "../_shared/auth.ts";
import { appendParam, getAppBaseUrl, stripeRequest } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: buildCorsHeaders() });
  }

  try {
    const { supabase, user } = await requireSupabaseUser(req);
    const appBaseUrl = getAppBaseUrl(req);

    const { data: subscription, error } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!subscription?.stripe_customer_id) {
      return jsonResponse({
        ok: false,
        reason: "no_customer",
        message: "Start a Rayla subscription before opening billing management.",
      }, 404);
    }

    const params = new URLSearchParams();
    appendParam(params, "customer", subscription.stripe_customer_id);
    appendParam(params, "return_url", `${appBaseUrl}/?billing=portal_return`);

    const portal = await stripeRequest<Record<string, any>>("/billing_portal/sessions", { params });

    return jsonResponse({
      ok: true,
      url: portal.url,
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unable to open billing portal.",
    }, 400);
  }
});

