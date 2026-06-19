import { buildCorsHeaders, jsonResponse, requireSupabaseUser } from "../_shared/auth.ts";
import { verifyTransaction, expiresDateToStatus, APPLE_BUNDLE_ID, APPLE_PRODUCT_ID } from "../_shared/apple.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: buildCorsHeaders() });
  }

  try {
    const { supabase, user } = await requireSupabaseUser(req);
    const payload = await req.json().catch(() => ({}));
    const transactionId = String(payload?.transactionId || "").trim();

    if (!transactionId) {
      return jsonResponse({ ok: false, reason: "missing_transaction_id", message: "transactionId is required." }, 400);
    }

    const transaction = await verifyTransaction(transactionId);

    if (transaction.bundleId !== APPLE_BUNDLE_ID) {
      return jsonResponse({ ok: false, reason: "invalid_bundle", message: "Bundle ID mismatch." }, 403);
    }
    if (transaction.productId !== APPLE_PRODUCT_ID) {
      return jsonResponse({ ok: false, reason: "invalid_product", message: "Product ID mismatch." }, 403);
    }

    const expiresDate = typeof transaction.expiresDate === "number" ? transaction.expiresDate : null;
    const status = expiresDateToStatus(expiresDate);
    const currentPeriodEnd = expiresDate ? new Date(expiresDate).toISOString() : null;

    const { data, error } = await supabase
      .from("user_subscriptions")
      .upsert(
        {
          user_id: user.id,
          billing_provider: "apple",
          apple_original_transaction_id: String(transaction.originalTransactionId),
          apple_product_id: String(transaction.productId),
          apple_bundle_id: String(transaction.bundleId),
          status,
          plan_key: "rayla_base",
          price_id: null,
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: false,
          trial_ends_at: null,
          metadata: {
            apple_transaction_id: String(transaction.transactionId),
            apple_environment: transaction.environment,
            restored_at: new Date().toISOString(),
          },
        },
        { onConflict: "user_id" }
      )
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return jsonResponse({ ok: true, subscription: data });
  } catch (error) {
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : "Unable to restore Apple purchase." },
      400
    );
  }
});
