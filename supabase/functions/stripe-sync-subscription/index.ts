import { buildCorsHeaders, jsonResponse, requireSupabaseUser } from "../_shared/auth.ts";
import {
  stripeRequest,
  summarizeStripeSubscription,
  syncSubscriptionForUser,
} from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: buildCorsHeaders() });
  }

  try {
    const { supabase, user } = await requireSupabaseUser(req);

    const { data: existing, error: existingError } = await supabase
      .from("user_subscriptions")
      .select("stripe_subscription_id, plan_key, billing_provider")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    if (!existing) {
      return jsonResponse({ ok: true, synced: false, reason: "no_subscription_row" });
    }
    if (existing.plan_key === "rayla_discount") {
      return jsonResponse({ ok: true, synced: false, reason: "discount_plan" });
    }
    if (existing.billing_provider && existing.billing_provider !== "stripe") {
      return jsonResponse({ ok: true, synced: false, reason: "non_stripe_provider" });
    }
    if (!existing.stripe_subscription_id) {
      return jsonResponse({ ok: true, synced: false, reason: "no_stripe_subscription_id" });
    }

    const subscription = await stripeRequest<Record<string, any>>(
      `/subscriptions/${existing.stripe_subscription_id}`,
      { method: "GET" }
    );
    const summary = summarizeStripeSubscription(subscription);
    const synced = await syncSubscriptionForUser(user.id, summary, {
      last_stripe_event_type: "stripe.sync_subscription",
      last_stripe_event_at: new Date().toISOString(),
    });

    return jsonResponse({ ok: true, synced: true, subscription: synced });
  } catch (error) {
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : "Unable to sync subscription." },
      400
    );
  }
});
