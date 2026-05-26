import { expect } from "@playwright/test";

export const AUTH_STORAGE_KEY = "sb-uoxzzhtnzmsolvcykynu-auth-token";
export const PARSE_SCREENSHOT_URL = "https://uoxzzhtnzmsolvcykynu.functions.supabase.co/parse-screenshot";

export function fakeSessionPayload(userId = "qa-user-a", email = `${userId}@rayla.test`) {
  return {
    access_token: `fake-token-${userId}`,
    refresh_token: `fake-refresh-${userId}`,
    token_type: "bearer",
    expires_at: 4102444800,
    expires_in: 3600,
    user: {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email,
      user_metadata: { display_name: "Rayla QA" },
    },
  };
}

export async function installFakeSupabase(page, userId = "qa-user-a") {
  await page.route("**/auth/v1/token**", async (route) => {
    const requestBody = route.request().postData() || "";
    let refreshToken = "";
    try {
      refreshToken = JSON.parse(requestBody)?.refresh_token || "";
    } catch {
      refreshToken = new URLSearchParams(requestBody).get("refresh_token") || "";
    }
    const tokenUserId = refreshToken.startsWith("fake-refresh-")
      ? refreshToken.replace("fake-refresh-", "")
      : userId;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fakeSessionPayload(tokenUserId)),
    });
  });

  await page.route("**/auth/v1/user", async (route) => {
    const authHeader = route.request().headers().authorization || "";
    const tokenUserId = authHeader.match(/fake-token-([A-Za-z0-9_-]+)/)?.[1];
    const session = fakeSessionPayload(tokenUserId || userId);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(session.user),
    });
  });

  await page.route("**/auth/v1/logout**", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/rest/v1/profiles**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.route("**/rest/v1/user_subscriptions**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/rest/v1/broker_trade_logs**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/rest/v1/user_broker_connections**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/rest/v1/trades**", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }
    if (method === "POST") {
      const body = route.request().postDataJSON();
      const row = Array.isArray(body) ? body[0] : body;
      const insertedRow = { id: `manual-qa-trade-${Date.now()}`, created_at: new Date().toISOString(), ...row };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(insertedRow),
      });
      return;
    }
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/rest/v1/**", async (route) => {
    const method = route.request().method();
    const body = method === "GET" ? "[]" : "{}";
    await route.fulfill({ status: 200, contentType: "application/json", body });
  });

  await page.route("**/functions/v1/daily-intel**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, hot: [], cold: [], picks: [] }),
    });
  });

  await page.route("**/functions/v1/market-data**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, quotes: [] }),
    });
  });
}

export async function seedAuthenticatedWorkspace(page, userId = "qa-user-a", history = []) {
  await installFakeSupabase(page, userId);
  await page.addInitScript(({ authKey, sessionPayload, scopedHistoryKey, historyRows }) => {
    window.localStorage.setItem(authKey, JSON.stringify(sessionPayload));
    window.localStorage.setItem(scopedHistoryKey, JSON.stringify(historyRows));
    window.localStorage.setItem("rayla-visited", "true");
    window.localStorage.setItem("rayla_first_trade_onboarding_completed", "true");
    window.localStorage.setItem("rayla_first_trade_onboarding_autostarted", "true");
    window.localStorage.removeItem("rayla_sim_trade_history");
    window.localStorage.removeItem("rayla_sim_open_position");
    window.localStorage.removeItem("rayla_last_screenshot_parse_debug");
  }, {
    authKey: AUTH_STORAGE_KEY,
    sessionPayload: fakeSessionPayload(userId),
    scopedHistoryKey: `rayla_sim_trade_history:${userId}`,
    historyRows: history,
  });
}

export async function openTab(page, label) {
  const continueButton = page.getByRole("button", { name: "Continue" });
  if (await continueButton.isVisible().catch(() => false)) {
    await continueButton.click();
  }
  const skipButton = page.getByRole("button", { name: "Skip" });
  if (await skipButton.isVisible().catch(() => false)) {
    await skipButton.click({ force: true });
  }
  const button = page.getByRole("button", { name: label, exact: true });
  await expect(button).toBeVisible();
  await button.click();
}

export async function openManualTradeForm(page, userId = "qa-manual") {
  await seedAuthenticatedWorkspace(page, userId, []);
  await page.goto("/");
  await openTab(page, "Live Trades");
  await page.getByRole("button", { name: "Log Trade" }).click();
  await expect(page.getByRole("heading", { name: "Log Trade" })).toBeVisible();
}

export async function fillManualTradeFields(page, overrides = {}) {
  await page.getByPlaceholder("Search asset (AAPL, BTC, NRG)").fill(overrides.asset ?? "AAPL");
  await page.getByPlaceholder("Entry Price").fill(overrides.entryPrice ?? "190");
  await page.getByPlaceholder("Size ($)").fill(overrides.size ?? "1000");
  await page.locator('input[type="datetime-local"]').fill(overrides.entryTime ?? "2026-05-16T10:30");
  await page.getByPlaceholder("Result, e.g. +1.5R or -0.5R").fill(overrides.result ?? "+1.5R");
}

export async function selectManualDirection(page, direction = "long") {
  await page.locator("select").filter({ hasText: "Direction" }).selectOption(direction);
}

export function closedSimulationTrade(overrides = {}) {
  const now = Date.now();
  return {
    id: `sim-${now}-${Math.random().toString(36).slice(2)}`,
    asset: "AAPL",
    label: "Apple Inc.",
    type: "stock",
    direction: "long",
    marketMode: "live",
    status: "closed",
    entryPrice: 190,
    exitPrice: 195,
    amount: 1000,
    profitLoss: 25,
    rMultiple: 1.5,
    createdAt: new Date(now - 60 * 60 * 1000).toISOString(),
    closedAt: new Date(now).toISOString(),
    durationMs: 60 * 60 * 1000,
    ...overrides,
  };
}
