import { getSupabaseAdmin } from "../_shared/auth.ts";
import { decodeJws, appleStatusToSubscriptionStatus, APPLE_BUNDLE_ID, APPLE_PRODUCT_ID } from "../_shared/apple.ts";

// Apple sends POST with no user auth. Always return 200 — Apple retries on non-200.
function ok() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function mapNotificationToStatus(
  notificationType: string,
  subtype: string
): string | null {
  switch (notificationType) {
    case "SUBSCRIBED":
    case "DID_RENEW":
      return "active";
    case "DID_CHANGE_RENEWAL_STATUS":
      // VOLUNTARY_CANCEL subtype means user turned off auto-renew — subscription still active until period end
      return null; // no status change needed; current_period_end already correct
    case "DID_FAIL_TO_RENEW":
      return "past_due";
    case "GRACE_PERIOD_EXPIRED":
      return "past_due";
    case "EXPIRED":
    case "REVOKE":
    case "REFUND":
      return "canceled";
    default:
      return null; // unhandled type — no update
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const signedPayload = String(body?.signedPayload || "").trim();
    if (!signedPayload) return ok();

    // Decode outer notification envelope (JWS — no signature verification needed for Apple-sent webhooks)
    const notification = decodeJws(signedPayload);
    const notificationType = String(notification.notificationType || "");
    const subtype = String(notification.subtype || "");

    const data = notification.data as Record<string, unknown> | undefined;
    if (!data) return ok();

    // Validate bundle
    if (data.bundleId !== APPLE_BUNDLE_ID) return ok();

    const signedTransactionInfo = String(data.signedTransactionInfo || "").trim();
    if (!signedTransactionInfo) return ok();

    const transaction = decodeJws(signedTransactionInfo);
    if (transaction.productId !== APPLE_PRODUCT_ID) return ok();

    const originalTransactionId = String(transaction.originalTransactionId || "").trim();
    if (!originalTransactionId) return ok();

    const newStatus = mapNotificationToStatus(notificationType, subtype);
    if (!newStatus) return ok();

    const expiresDate = typeof transaction.expiresDate === "number" ? transaction.expiresDate : null;
    const currentPeriodEnd = expiresDate ? new Date(expiresDate).toISOString() : null;

    const supabase = getSupabaseAdmin();

    // Look up user by apple_original_transaction_id
    const { data: row } = await supabase
      .from("user_subscriptions")
      .select("user_id")
      .eq("apple_original_transaction_id", originalTransactionId)
      .maybeSingle();

    if (!row?.user_id) return ok(); // unknown transaction — no action

    await supabase
      .from("user_subscriptions")
      .update({
        status: newStatus,
        ...(currentPeriodEnd ? { current_period_end: currentPeriodEnd } : {}),
        metadata: {
          apple_notification_type: notificationType,
          apple_subtype: subtype,
          apple_environment: data.environment,
          last_notification_at: new Date().toISOString(),
        },
      })
      .eq("user_id", row.user_id)
      .eq("billing_provider", "apple");

    return ok();
  } catch {
    // Swallow all errors — return 200 so Apple does not retry unnecessarily
    return ok();
  }
});
