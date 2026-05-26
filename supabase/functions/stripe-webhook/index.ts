import { buildCorsHeaders, jsonResponse } from "../_shared/auth.ts";
import {
  findUserIdForStripeObject,
  stripeRequest,
  summarizeStripeSubscription,
  syncSubscriptionForUser,
} from "../_shared/stripe.ts";

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a: string, b: string) {
  const aBytes = hexToBytes(a);
  const bBytes = hexToBytes(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i += 1) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

async function hmacSha256Hex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyStripeSignature(rawBody: string, signatureHeader: string | null) {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
  if (!secret) throw new Error("Missing Stripe webhook secret.");
  if (!signatureHeader) throw new Error("Missing Stripe signature.");

  const parts = signatureHeader.split(",").reduce<Record<string, string[]>>((acc, part) => {
    const [key, value] = part.split("=");
    if (!key || !value) return acc;
    acc[key] = [...(acc[key] || []), value];
    return acc;
  }, {});

  const timestamp = parts.t?.[0];
  const signatures = parts.v1 || [];
  if (!timestamp || !signatures.length) throw new Error("Invalid Stripe signature.");

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = await hmacSha256Hex(secret, signedPayload);
  if (!signatures.some((signature) => timingSafeEqual(expected, signature))) {
    throw new Error("Stripe signature verification failed.");
  }
}

async function syncStripeSubscription(subscriptionId: string, fallbackUserId?: string | null) {
  const subscription = await stripeRequest<Record<string, any>>(`/subscriptions/${subscriptionId}`, { method: "GET" });
  const summary = summarizeStripeSubscription(subscription);
  const userId = await findUserIdForStripeObject({
    customerId: summary.stripe_customer_id,
    subscriptionId: summary.stripe_subscription_id,
    metadataUserId: typeof subscription?.metadata?.user_id === "string" ? subscription.metadata.user_id : fallbackUserId,
  });

  if (!userId) throw new Error("Unable to resolve subscription owner.");
  await syncSubscriptionForUser(userId, summary, {
    last_stripe_event_at: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: buildCorsHeaders() });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
  }

  try {
    const rawBody = await req.text();
    await verifyStripeSignature(rawBody, req.headers.get("stripe-signature"));

    const event = JSON.parse(rawBody);
    const object = event?.data?.object || {};

    if (event.type === "checkout.session.completed") {
      const subscriptionId = typeof object.subscription === "string" ? object.subscription : null;
      const userId = typeof object.client_reference_id === "string"
        ? object.client_reference_id
        : typeof object.metadata?.user_id === "string"
          ? object.metadata.user_id
          : null;

      if (subscriptionId) await syncStripeSubscription(subscriptionId, userId);
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const summary = summarizeStripeSubscription(object);
      if (event.type === "customer.subscription.deleted") summary.status = "canceled";
      const userId = await findUserIdForStripeObject({
        customerId: summary.stripe_customer_id,
        subscriptionId: summary.stripe_subscription_id,
        metadataUserId: typeof object?.metadata?.user_id === "string" ? object.metadata.user_id : null,
      });

      if (!userId) throw new Error("Unable to resolve subscription owner.");
      await syncSubscriptionForUser(userId, summary, {
        last_stripe_event_type: event.type,
        last_stripe_event_at: new Date().toISOString(),
      });
    }

    if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const subscriptionId = typeof object.subscription === "string" ? object.subscription : null;
      if (subscriptionId) await syncStripeSubscription(subscriptionId);
    }

    return jsonResponse({ ok: true, received: true });
  } catch (error) {
    console.error("[stripe-webhook] failed", error instanceof Error ? error.message : error);
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Stripe webhook failed.",
    }, 400);
  }
});

