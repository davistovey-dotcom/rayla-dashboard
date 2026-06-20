// Canonical production host for all user-facing redirects (auth emails,
// password reset, signup confirmation). Vercel preview branches and local dev
// keep their own origin so QA and dev still work; the rayla-dashboard.vercel.app
// production alias and any other host falls back to the canonical so users
// never receive a vercel.app link.

const CANONICAL_PRODUCTION_URL = "https://raylainc.live";

function isLocalDevOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/i.test(origin);
}

function isCanonicalProductionOrigin(origin) {
  return /^https:\/\/(www\.)?raylainc\.live$/i.test(origin);
}

function isVercelPreviewOrigin(origin) {
  // Vercel branch deploys: rayla-dashboard-<branch>-<team>.vercel.app or
  // rayla-dashboard-git-<branch>-<team>.vercel.app. The canonical alias
  // `rayla-dashboard.vercel.app` (no extra dash segment) deliberately does
  // NOT match — production-alias visits get forced to raylainc.live.
  return /^https:\/\/rayla-dashboard-[a-z0-9-]+\.vercel\.app$/i.test(origin);
}

export function getCanonicalAppUrl() {
  if (typeof window === "undefined") return CANONICAL_PRODUCTION_URL;
  const origin = window.location.origin || "";
  if (isLocalDevOrigin(origin)) return origin;
  if (isCanonicalProductionOrigin(origin)) return origin;
  if (isVercelPreviewOrigin(origin)) return origin;
  return CANONICAL_PRODUCTION_URL;
}

export function getAuthRedirectUrl() {
  return `${getCanonicalAppUrl()}/`;
}

export function getResetPasswordRedirectUrl() {
  return `${getCanonicalAppUrl()}/reset-password`;
}
