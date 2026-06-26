import { buildCorsHeaders, jsonResponse, requireSupabaseUser } from "../_shared/auth.ts";
import { verifyTransaction, verifyJwsTransaction, expiresDateToStatus, APPLE_BUNDLE_ID, APPLE_PRODUCT_ID } from "../_shared/apple.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: buildCorsHeaders() });
  }

  try {
    const { supabase, user } = await requireSupabaseUser(req);
    const payload = await req.json().catch(() => ({}));
    const transactionId = String(payload?.transactionId || "").trim();
    const jwsRepresentation = String(payload?.jwsRepresentation || "").trim();

    if (!transactionId && !jwsRepresentation) {
      return jsonResponse({ ok: false, reason: "missing_transaction", message: "transactionId or jwsRepresentation is required." }, 400);
    }

    let transaction: Record<string, unknown>;
    try {
      transaction = jwsRepresentation
        ? verifyJwsTransaction(jwsRepresentation)
        : await verifyTransaction(transactionId);
    } catch (verifyError) {
      console.error("[apple-verify-purchase] verification_failed", {
        userId: user.id,
        via: jwsRepresentation ? "jws" : "id_lookup",
        transactionId: transactionId || null,
        hasJws: Boolean(jwsRepresentation),
        error: verifyError instanceof Error ? verifyError.message : String(verifyError),
      });
      throw verifyError;
    }

    if (transaction.bundleId !== APPLE_BUNDLE_ID) {
      return jsonResponse({ ok: false, reason: "invalid_bundle", message: "Bundle ID mismatch." }, 403);
    }
    if (transaction.productId !== APPLE_PRODUCT_ID) {
      return jsonResponse({ ok: false, reason: "invalid_product", message: "Product ID mismatch." }, 403);
    }

    // Block if user already has an active Stripe subscription
    const { data: existing } = await supabase
      .from("user_subscriptions")
      .select("billing_provider, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (
      existing?.billing_provider === "stripe" &&
      ["active", "trialing"].includes(String(existing.status))
    ) {
      return jsonResponse(
        {
          ok: false,
          reason: "already_subscribed",
          message: "An active Stripe subscription is already associated with this account.",
        },
        409
      );
    }

    const expiresDate = typeof transaction.expiresDate === "number" ? transaction.expiresDate : null;
    const status = expiresDateToStatus(expiresDate);
    const currentPeriodEnd = expiresDate ? new Date(expiresDate).toISOString() : null;
    const appleStatus = expiresDate == null ? null : (expiresDate > Date.now() ? "ACTIVE" : "EXPIRED");
    const appleOriginalTxn = String(transaction.originalTransactionId);
    const appleTxn = String(transaction.transactionId);

    // Idempotency: an Apple original_transaction_id is the stable identifier
    // for a subscription across renewals. If a row already exists keyed on it
    // (current user, prior session, or a stale test account), reuse it.
    const { data: existingApple } = await supabase
      .from("user_subscriptions")
      .select("user_id")
      .eq("apple_original_transaction_id", appleOriginalTxn)
      .maybeSingle();

    if (existingApple && existingApple.user_id !== user.id) {
      return jsonResponse(
        {
          ok: false,
          reason: "transaction_owned_by_other_user",
          message: "This Apple subscription is already linked to a different Rayla account.",
        },
        409
      );
    }

    const upsertRow = {
      user_id: user.id,
      billing_provider: "apple",
      apple_original_transaction_id: appleOriginalTxn,
      apple_transaction_id: appleTxn,
      apple_product_id: String(transaction.productId),
      apple_bundle_id: String(transaction.bundleId),
      apple_environment: transaction.environment ? String(transaction.environment) : null,
      apple_expires_at: currentPeriodEnd,
      apple_status: appleStatus,
      status,
      plan_key: "rayla_base",
      price_id: null,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: false,
      trial_ends_at: null,
      metadata: { verified_at: new Date().toISOString() },
    };

    // Prefer the apple_original_transaction_id unique index when present so a
    // stale row from the same user with a different prior apple_transaction_id
    // is refreshed in place instead of triggering a unique-constraint violation.
    let writeResult = await supabase
      .from("user_subscriptions")
      .upsert(upsertRow, { onConflict: "apple_original_transaction_id" })
      .select("*")
      .single();

    if (writeResult.error) {
      // Fallback: legacy schemas may only have the user_id unique index.
      writeResult = await supabase
        .from("user_subscriptions")
        .upsert(upsertRow, { onConflict: "user_id" })
        .select("*")
        .single();
    }

    if (writeResult.error) {
      console.error("[apple-verify-purchase] upsert_failed", {
        userId: user.id,
        appleOriginalTxn,
        appleTxn,
        message: writeResult.error.message,
        code: (writeResult.error as any)?.code || null,
      });
      throw new Error(writeResult.error.message);
    }

    return jsonResponse({ ok: true, subscription: writeResult.data });
  } catch (error) {
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : "Unable to verify Apple purchase." },
      400
    );
  }
});
