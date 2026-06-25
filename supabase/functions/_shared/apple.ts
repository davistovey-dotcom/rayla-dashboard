const APPLE_BUNDLE_ID_EXPECTED = "com.raylainc.rayla";
const APPLE_PRODUCT_ID_EXPECTED = "rayla.sub";
const STOREKIT_PRODUCTION = "https://api.storekit.itunes.apple.com";
const STOREKIT_SANDBOX = "https://api.storekit-sandbox.itunes.apple.com";

export { APPLE_BUNDLE_ID_EXPECTED as APPLE_BUNDLE_ID, APPLE_PRODUCT_ID_EXPECTED as APPLE_PRODUCT_ID };

function getCredentials() {
  const keyId = Deno.env.get("APPLE_KEY_ID") || "";
  const issuerId = Deno.env.get("APPLE_ISSUER_ID") || "";
  const privateKeyPem = Deno.env.get("APPLE_PRIVATE_KEY") || "";
  if (!keyId || !issuerId || !privateKeyPem) throw new Error("Missing Apple API credentials.");
  return { keyId, issuerId, privateKeyPem };
}

function base64url(data: ArrayBuffer | string): string {
  const base64 =
    typeof data === "string"
      ? btoa(data)
      : btoa(String.fromCharCode(...new Uint8Array(data)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlDecode(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (padded.length % 4)) % 4;
  return atob(padded + "=".repeat(pad));
}

async function buildJwt(): Promise<string> {
  const { keyId, issuerId, privateKeyPem } = getCredentials();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 3600,
    aud: "appstoreconnect-v1",
    bid: APPLE_BUNDLE_ID_EXPECTED,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const pemContent = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${base64url(signature)}`;
}

export function decodeJws(jws: string): Record<string, unknown> {
  const parts = jws.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWS format.");
  return JSON.parse(base64urlDecode(parts[1]));
}

// Modern path: StoreKit 2 hands the device-verified JWS payload straight to the
// client. Decoding it on the server avoids the App Store Server API round-trip
// (and the per-app In-App Purchase API key scoping required to make that
// round-trip resolve a transaction).
export function verifyJwsTransaction(jws: string): Record<string, unknown> {
  const trimmed = String(jws || "").trim();
  if (!trimmed) throw new Error("JWS representation is empty.");
  const payload = decodeJws(trimmed);
  if (!payload || typeof payload !== "object") {
    throw new Error("JWS payload is invalid.");
  }
  return payload;
}

async function fetchAppleErrorDetail(res: Response): Promise<{ errorCode: number | null; errorMessage: string | null; bodyPreview: string }> {
  const bodyText = await res.text().catch(() => "");
  let parsed: any = null;
  try { parsed = JSON.parse(bodyText); } catch { /* keep raw text */ }
  return {
    errorCode: typeof parsed?.errorCode === "number" ? parsed.errorCode : null,
    errorMessage: typeof parsed?.errorMessage === "string" ? parsed.errorMessage : null,
    bodyPreview: bodyText.slice(0, 240),
  };
}

function formatAppleError(prefix: string, status: number, detail: { errorCode: number | null; errorMessage: string | null }): string {
  const parts = [`status ${status}`];
  if (detail.errorCode != null) parts.push(`errorCode ${detail.errorCode}`);
  if (detail.errorMessage) parts.push(detail.errorMessage);
  return `${prefix} (${parts.join(", ")})`;
}

// Legacy path: look up the transaction by id at Apple's App Store Server API.
// Kept as a fallback for clients that cannot supply jwsRepresentation.
export async function verifyTransaction(transactionId: string): Promise<Record<string, unknown>> {
  const jwt = await buildJwt();

  const prodRes = await fetch(`${STOREKIT_PRODUCTION}/inApps/v2/transactions/${transactionId}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });

  if (prodRes.ok) {
    const data = await prodRes.json();
    return decodeJws(data.signedTransactionInfo);
  }

  // 404 from production = sandbox transaction; retry against sandbox
  if (prodRes.status === 404) {
    const sandboxRes = await fetch(`${STOREKIT_SANDBOX}/inApps/v2/transactions/${transactionId}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (sandboxRes.ok) {
      const data = await sandboxRes.json();
      return decodeJws(data.signedTransactionInfo);
    }
    const detail = await fetchAppleErrorDetail(sandboxRes);
    console.error("[apple verifyTransaction] sandbox_lookup_failed", {
      transactionId,
      jwtBundleId: APPLE_BUNDLE_ID_EXPECTED,
      status: sandboxRes.status,
      errorCode: detail.errorCode,
      errorMessage: detail.errorMessage,
      bodyPreview: detail.bodyPreview,
    });
    throw new Error(formatAppleError("Apple sandbox verification failed", sandboxRes.status, detail));
  }

  const detail = await fetchAppleErrorDetail(prodRes);
  console.error("[apple verifyTransaction] production_lookup_failed", {
    transactionId,
    jwtBundleId: APPLE_BUNDLE_ID_EXPECTED,
    status: prodRes.status,
    errorCode: detail.errorCode,
    errorMessage: detail.errorMessage,
    bodyPreview: detail.bodyPreview,
  });
  throw new Error(formatAppleError("Apple verification failed", prodRes.status, detail));
}

// Maps Apple expiresDate (ms timestamp) to subscription status.
export function expiresDateToStatus(expiresDate: number | null | undefined): string {
  if (expiresDate == null) return "active";
  return expiresDate > Date.now() ? "active" : "canceled";
}

// Maps Apple JWS subscription status integer (from Last-Transactions API or notification data).
export function appleStatusToSubscriptionStatus(appleStatus: number): string {
  switch (appleStatus) {
    case 1: return "active";           // ACTIVE
    case 3:                            // IN_BILLING_RETRY_PERIOD
    case 4: return "past_due";         // IN_GRACE_PERIOD
    case 2:                            // EXPIRED
    case 5: return "canceled";         // REVOKED
    default: return "inactive";
  }
}
