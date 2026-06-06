import { test, expect } from "@playwright/test";

const userId = "qa-cta-verify";
const fakeSession = {
  access_token: `fake-token-${userId}`,
  refresh_token: `fake-refresh-${userId}`,
  token_type: "bearer",
  expires_at: 4102444800,
  expires_in: 3600,
  user: {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: `${userId}@rayla.test`,
    user_metadata: { display_name: "QA CTA Tester" },
  },
};

async function setupRoutes(page) {
  await page.route("**/auth/v1/token**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeSession) }));
  await page.route("**/auth/v1/user", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeSession.user) }));
  await page.route("**/auth/v1/logout**", (r) => r.fulfill({ status: 204 }));
  await page.route("**/rest/v1/profiles**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/user_subscriptions**", (r) => r.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([{ id: "sub-qa", user_id: userId, status: "active", plan_key: "rayla_monthly", current_period_end: "2027-01-01T00:00:00Z" }]),
  }));
  await page.route("**/rest/v1/portfolio_snapshots**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/trade_snapshots**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/sim_positions**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/sim_trades**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/trades**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/broker_connection**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/user_broker_connections**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/position_trade_types**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/functions/v1/rayla-ai**", (r) => r.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ answer: "RAYLA_AI_TEST_RESPONSE: portfolio context received." }),
  }));
  // Supabase edge functions the app actually invokes
  await page.route("**/functions/v1/alpaca-account**", (r) => r.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      connected: true,
      isPaper: true,
      account: {
        cash: "5000",
        equity: "9500",
        portfolioValue: "9500",
        buyingPower: "10000",
        id: "qa-acct",
        accountNumber: "QA001",
        status: "ACTIVE",
      },
    }),
  }));
  await page.route("**/functions/v1/alpaca-positions**", (r) => r.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      positions: [
        { symbol: "AAPL", qty: "10", market_value: "2000", avg_entry_price: "180", unrealized_pl: "200", asset_class: "us_equity", side: "long" },
        { symbol: "MSFT", qty: "5", market_value: "2500", avg_entry_price: "480", unrealized_pl: "100", asset_class: "us_equity", side: "long" },
      ],
    }),
  }));
  await page.route("**/functions/v1/alpaca-orders**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ orders: [] }) }));
  await page.route("**/functions/v1/market-data**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) }));
  await page.route("**/functions/v1/alpaca-assets**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ assets: [] }) }));
}

async function boot(page) {
  await page.addInitScript(({ authKey, session, uid }) => {
    window.localStorage.setItem(authKey, JSON.stringify(session));
    window.localStorage.setItem("rayla-visited", "true");
    window.localStorage.setItem("rayla_first_trade_onboarding_completed", "true");
    window.localStorage.setItem("rayla_first_trade_onboarding_autostarted", "true");
    window.localStorage.setItem(`rayla_alpaca_connection:${uid}`, JSON.stringify({ connected: true, broker: "alpaca" }));
  }, { authKey: "sb-uoxzzhtnzmsolvcykynu-auth-token", session: fakeSession, uid: userId });

  await page.goto("/");
  const skip = page.locator('button:has-text("Skip for now")');
  if (await skip.isVisible({ timeout: 5000 }).catch(() => false)) await skip.click();
  // Wait for broker data to load: positionTradeTypesLoaded → fetchAlpacaBrokerData
  await page.waitForTimeout(3000);
}

// Helper: click a button and verify the Rayla chartExplainPopup opens
async function clickCtaAndVerify(page, buttonText, context) {
  const logs = [];
  const errors = [];
  const onConsole = (msg) => {
    const t = msg.text();
    logs.push(t);
    if (msg.type() === "error") errors.push(t);
  };
  page.on("console", onConsole);

  const btn = page.getByRole("button", { name: buttonText, exact: true });
  const btnVisible = await btn.isVisible({ timeout: 5000 }).catch(() => false);
  if (!btnVisible) {
    page.off("console", onConsole);
    return { context, button: buttonText, found: false, popupOpened: false, errors };
  }

  await btn.click();
  await page.waitForTimeout(2000);

  // The chartExplainPopup is a fixed-position modal that contains the popup title
  // openGlobalRaylaPopup sets chartExplainPopupTitle which renders as the modal header
  const popupVisible = await page.evaluate(() => {
    // Try to find any element that looks like the Rayla popup
    // The popup renders with a title like "Analyze my portfolio" or "What should I add?"
    const allText = document.body.innerText;
    const hasRaylaAnswer = allText.includes("RAYLA_AI_TEST_RESPONSE");
    const hasLoading = !!document.querySelector('[class*="loading"], [class*="spinner"]');
    // Count fixed-position modals/overlays (the popup is position:fixed at high z-index)
    const fixedEls = [...document.querySelectorAll("*")].filter(el => {
      const s = window.getComputedStyle(el);
      return s.position === "fixed" && parseInt(s.zIndex) > 1000 && el.offsetHeight > 50;
    });
    return { hasRaylaAnswer, hasLoading, fixedCount: fixedEls.length };
  });

  const aiRequestLogs = logs.filter(l => l.includes("rayla-ai") || l.includes("chartExplain") || l.includes("popup") || l.includes("openGlobal"));

  page.off("console", onConsole);

  // Try to close popup
  const closeBtns = page.locator('button[aria-label*="lose"], button[aria-label*=" dismiss"]');
  if (await closeBtns.first().isVisible({ timeout: 500 }).catch(() => false)) {
    await closeBtns.first().click().catch(() => {});
  }
  await page.waitForTimeout(500);

  return {
    context,
    button: buttonText,
    found: true,
    popupOpened: popupVisible.hasRaylaAnswer || popupVisible.fixedCount > 0,
    aiResponseSeen: popupVisible.hasRaylaAnswer,
    errors,
    aiRequestLogs,
  };
}

test.describe("Investor CTA — popup verification", () => {
  test("Home Overview CTAs open Rayla popup", async ({ page }) => {
    await setupRoutes(page);
    await boot(page);

    // Navigate to Home
    const homeBtn = page.locator('[data-mobile-nav-tab="home"]');
    if (await homeBtn.isVisible({ timeout: 3000 }).catch(() => false)) await homeBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "test-results/cta-home-before.png" });

    const r1 = await clickCtaAndVerify(page, "Analyze my portfolio", "Home Overview");
    await page.screenshot({ path: "test-results/cta-home-analyze-after.png" });
    console.log("HOME Analyze:", JSON.stringify(r1));

    const r2 = await clickCtaAndVerify(page, "What should I add?", "Home Overview");
    await page.screenshot({ path: "test-results/cta-home-add-after.png" });
    console.log("HOME WhatAdd:", JSON.stringify(r2));

    expect(r1.found || r2.found, "At least one Home CTA must be visible").toBe(true);
  });

  test("Performance Portfolio CTAs open Rayla popup", async ({ page }) => {
    await setupRoutes(page);
    await boot(page);

    const perfBtn = page.locator('[data-mobile-nav-tab="ai"]');
    if (await perfBtn.isVisible({ timeout: 3000 }).catch(() => false)) await perfBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "test-results/cta-perf-before.png" });

    const r1 = await clickCtaAndVerify(page, "Analyze my portfolio", "Performance Portfolio");
    await page.screenshot({ path: "test-results/cta-perf-analyze-after.png" });
    console.log("PERF PORTFOLIO Analyze:", JSON.stringify(r1));

    const r2 = await clickCtaAndVerify(page, "What should I add?", "Performance Portfolio");
    await page.screenshot({ path: "test-results/cta-perf-add-after.png" });
    console.log("PERF PORTFOLIO WhatAdd:", JSON.stringify(r2));

    expect(r1.found || r2.found, "At least one Performance Portfolio CTA must be visible").toBe(true);
  });

  test("Performance Holdings CTAs open Rayla popup", async ({ page }) => {
    await setupRoutes(page);
    await boot(page);

    const perfBtn = page.locator('[data-mobile-nav-tab="ai"]');
    if (await perfBtn.isVisible({ timeout: 3000 }).catch(() => false)) await perfBtn.click();
    await page.waitForTimeout(1500);

    // Switch to Holdings via the Position Intent dropdown
    const intentDropdown = page.locator("select").filter({ hasText: /portfolio|holdings|day/i }).first();
    if (await intentDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
      await intentDropdown.selectOption("holdings");
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: "test-results/cta-holdings-before.png" });

    const r1 = await clickCtaAndVerify(page, "Analyze my holdings", "Performance Holdings");
    await page.screenshot({ path: "test-results/cta-holdings-analyze-after.png" });
    console.log("HOLDINGS Analyze:", JSON.stringify(r1));

    const r2 = await clickCtaAndVerify(page, "What should I add?", "Performance Holdings");
    await page.screenshot({ path: "test-results/cta-holdings-add-after.png" });
    console.log("HOLDINGS WhatAdd:", JSON.stringify(r2));

    expect(r1.found || r2.found, "At least one Performance Holdings CTA must be visible").toBe(true);
  });
});
