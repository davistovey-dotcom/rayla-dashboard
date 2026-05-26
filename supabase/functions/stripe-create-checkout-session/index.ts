import { buildCorsHeaders, jsonResponse, requireSupabaseUser } from "../_shared/auth.ts";
import { appendParam, getAppBaseUrl, getStripePriceId, stripeRequest } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: buildCorsHeaders() });
  }

  try {
    const { supabase, user } = await requireSupabaseUser(req);
    const priceId = getStripePriceId();
    const appBaseUrl = getAppBaseUrl(req);

    const { data: existing, error: existingError } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    if (["active", "trialing", "past_due"].includes(existing?.status)) {
      return jsonResponse({
        ok: false,
        reason: "already_subscribed",
        message: "Your subscription is already managed in billing.",
      }, 409);
    }

    let customerId = existing?.stripe_customer_id || null;
    if (!customerId) {
      const customerParams = new URLSearchParams();
      appendParam(customerParams, "email", user.email || undefined);
      appendParam(customerParams, "metadata[user_id]", user.id);
      const customer = await stripeRequest<Record<string, any>>("/customers", { params: customerParams });
      customerId = customer.id;
    }

    const checkoutParams = new URLSearchParams();
    appendParam(checkoutParams, "mode", "subscription");
    appendParam(checkoutParams, "customer", customerId);
    appendParam(checkoutParams, "client_reference_id", user.id);
    appendParam(checkoutParams, "line_items[0][price]", priceId);
    appendParam(checkoutParams, "line_items[0][quantity]", 1);
    appendParam(checkoutParams, "success_url", `${appBaseUrl}/?billing=success`);
    appendParam(checkoutParams, "cancel_url", `${appBaseUrl}/?billing=cancelled`);
    appendParam(checkoutParams, "metadata[user_id]", user.id);
    appendParam(checkoutParams, "subscription_data[metadata][user_id]", user.id);
    appendParam(checkoutParams, "subscription_data[metadata][plan_key]", "rayla_base");

    const trialDays = Number(Deno.env.get("STRIPE_RAYLA_TRIAL_DAYS") || 14);
    if (Number.isFinite(trialDays) && trialDays > 0) {
      appendParam(checkoutParams, "subscription_data[trial_period_days]", Math.floor(trialDays));
    }

    const session = await stripeRequest<Record<string, any>>("/checkout/sessions", { params: checkoutParams });

    const { error: upsertError } = await supabase
      .from("user_subscriptions")
      .upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        status: "checkout_started",
        plan_key: "rayla_base",
        price_id: priceId,
        metadata: {
          checkout_session_id: session.id,
          checkout_started_at: new Date().toISOString(),
        },
      }, { onConflict: "user_id" });

    if (upsertError) throw new Error(upsertError.message);

    return jsonResponse({
      ok: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unable to start checkout.",
    }, 400);
  }
});

