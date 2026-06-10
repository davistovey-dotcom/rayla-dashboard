import { getSupabaseAdmin } from "./auth.ts";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

export type StripeSubscriptionSummary = {
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: string;
  price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
};

export function getStripeSecretKey() {
  const key = Deno.env.get("STRIPE_SECRET_KEY") || "";
  if (!key) throw new Error("Missing Stripe secret key.");
  return key;
}

export function getStripePriceId() {
  const priceId = Deno.env.get("STRIPE_RAYLA_BASE_PRICE_ID") || Deno.env.get("STRIPE_PRICE_ID") || "";
  if (!priceId) throw new Error("Missing Stripe price id.");
  return priceId;
}

export function getAppBaseUrl(req?: Request) {
  const configured = Deno.env.get("APP_BASE_URL") || Deno.env.get("PUBLIC_APP_URL") || "";
  if (configured) return configured.replace(/\/$/, "");
  const origin = req?.headers.get("origin") || "";
  if (origin) return origin.replace(/\/$/, "");
  return "http://localhost:5002";
}

export function appendParam(params: URLSearchParams, key: string, value: unknown) {
  if (value == null) return;
  params.append(key, String(value));
}

export async function stripeRequest<T>(
  path: string,
  {
    method = "POST",
    params,
  }: {
    method?: "GET" | "POST";
    params?: URLSearchParams;
  } = {}
): Promise<T> {
  const url = method === "GET" && params
    ? `${STRIPE_API_BASE}${path}?${params.toString()}`
    : `${STRIPE_API_BASE}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? params?.toString() : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Stripe request failed (${response.status}).`;
    throw new Error(message);
  }

  return payload as T;
}

export function unixToIso(value: unknown) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

export function summarizeStripeSubscription(subscription: Record<string, any>): StripeSubscriptionSummary {
  const firstItem = subscription?.items?.data?.[0];
  return {
    stripe_subscription_id: typeof subscription?.id === "string" ? subscription.id : null,
    stripe_customer_id: typeof subscription?.customer === "string" ? subscription.customer : null,
    status: typeof subscription?.status === "string" ? subscription.status : "inactive",
    price_id: typeof firstItem?.price?.id === "string" ? firstItem.price.id : null,
    current_period_end: unixToIso(subscription?.current_period_end),
    cancel_at_period_end: Boolean(subscription?.cancel_at_period_end),
    trial_ends_at: unixToIso(subscription?.trial_end),
  };
}

export async function syncSubscriptionForUser(userId: string, summary: StripeSubscriptionSummary, metadata: Record<string, unknown> = {}) {
  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("user_subscriptions")
    .select("plan_key")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing?.plan_key === "rayla_discount") return existing;

  const { data, error } = await supabase
    .from("user_subscriptions")
    .upsert({
      user_id: userId,
      stripe_customer_id: summary.stripe_customer_id,
      stripe_subscription_id: summary.stripe_subscription_id,
      status: summary.status,
      plan_key: "rayla_base",
      price_id: summary.price_id,
      current_period_end: summary.current_period_end,
      cancel_at_period_end: summary.cancel_at_period_end,
      trial_ends_at: summary.trial_ends_at,
      metadata,
    }, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function findUserIdForStripeObject({
  customerId,
  subscriptionId,
  metadataUserId,
}: {
  customerId?: string | null;
  subscriptionId?: string | null;
  metadataUserId?: string | null;
}) {
  if (metadataUserId) return metadataUserId;

  const supabase = getSupabaseAdmin();
  if (subscriptionId) {
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.user_id) return data.user_id as string;
  }

  if (customerId) {
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.user_id) return data.user_id as string;
  }

  return null;
}

