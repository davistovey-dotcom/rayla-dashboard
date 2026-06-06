import { test, expect } from "@playwright/test";

const userId = "qa-cta-robust";
const fakeSession = {
  access_token: `fake-token-${userId}`,
  refresh_token: `fake-refresh-${userId}`,
  token_type: "bearer",
  expires_at: 4102444800,
  expires_in: 3600,
  user: { id: userId, aud: "authenticated", role: "authenticated", email: `${userId}@rayla.test`, user_metadata: { display_name: "QA" } },
};

test("CTA buttons end-to-end", async ({ page }) => {
  const requestLog = [];
  page.on("request", req => {
    const u = req.url().replace(/https?:\/\/[^\/]+/, "HOST");
    if (u.includes("functions/v1/alpaca")) requestLog.push(`REQ ${req.method()} ${u}`);
  });
  page.on("response", resp => {
    const u = resp.url().replace(/https?:\/\/[^\/]+/, "HOST");
    if (u.includes("functions/v1/alpaca")) requestLog.push(`RSP ${resp.status()} ${u}`);
  });

  // Auth stubs
  await page.route("**/auth/v1/token**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeSession) }));
  await page.route("**/auth/v1/user", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeSession.user) }));
  await page.route("**/auth/v1/logout**", r => r.fulfill({ status: 204 }));

  // Active subscription
  await page.route("**/rest/v1/user_subscriptions**", r => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify([{ id: "sub-robust", user_id: userId, status: "active", plan_key: "rayla_monthly", current_period_end: "2027-01-01T00:00:00Z" }]),
  }));

  // Other REST tables
  await page.route("**/rest/v1/profiles**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/portfolio_snapshots**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/trade_snapshots**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/sim_positions**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/sim_trades**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/trades**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/broker_connection**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/user_broker_connections**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/position_trade_types**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

  // Alpaca Supabase functions — specific stubs (registered BEFORE any catch-alls)
  await page.route("**/functions/v1/alpaca-account**", r => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ connected: true, isPaper: true, account: { cash: "5000", equity: "9500", portfolioValue: "9500", buyingPower: "10000", id: "qa-acct", status: "ACTIVE" } }),
  }));
  await page.route("**/functions/v1/alpaca-positions**", r => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ positions: [
      { symbol: "AAPL", qty: "10", market_value: "2000", avg_entry_price: "180", unrealized_pl: "200", asset_class: "us_equity", side: "long" },
      { symbol: "MSFT", qty: "5", market_value: "2500", avg_entry_price: "480", unrealized_pl: "100", asset_class: "us_equity", side: "long" },
    ]}),
  }));
  await page.route("**/functions/v1/alpaca-orders**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ orders: [] }) }));
  // Stub the Rayla AI endpoint — actual URL is functions.supabase.co/ask-rayla (NOT functions/v1/rayla-ai)
  await page.route("**/ask-rayla**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ answer: "RAYLA_AI_TEST_RESPONSE: portfolio analyzed." }) }));

  await page.addInitScript(({ authKey, session }) => {
    window.localStorage.setItem(authKey, JSON.stringify(session));
    window.localStorage.setItem("rayla-visited", "true");
    window.localStorage.setItem("rayla_first_trade_onboarding_completed", "true");
    window.localStorage.setItem("rayla_first_trade_onboarding_autostarted", "true");
    // Skip broker onboarding so we don't block on broker connect screen
    window.localStorage.setItem("rayla-broker-onboarding-skip-v1", "true");
  }, { authKey: "sb-uoxzzhtnzmsolvcykynu-auth-token", session: fakeSession });

  await page.goto("/");

  // Wait for main app — look for desktop nav "Performance" button (visible at 1280px)
  // The mobile nav [data-mobile-nav-tab] is hidden at desktop widths
  const perfNavDesktop = page.getByRole("button", { name: "Performance" });
  const mainAppLoaded = await perfNavDesktop.first().waitFor({ state: "visible", timeout: 15000 }).then(() => true).catch(() => false);

  await page.screenshot({ path: "test-results/cta-robust-initial.png" });
  const initialButtons = await page.evaluate(() => [...document.querySelectorAll("button")].map(b => b.textContent?.trim()).filter(Boolean));
  console.log("MAIN APP LOADED:", mainAppLoaded);
  console.log("ALPACA REQUESTS:", JSON.stringify(requestLog));
  console.log("INITIAL BUTTONS:", JSON.stringify(initialButtons));

  if (!mainAppLoaded) {
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1000));
    console.log("PAGE TEXT (not main app):", bodyText);
    expect(mainAppLoaded, "Main app desktop nav did not load").toBe(true);
    return;
  }

  // Give broker data time to load (alpaca-account → alpaca-positions async chain)
  await page.waitForTimeout(2000);

  // Check Home tab first
  await page.getByRole("button", { name: "Home" }).first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "test-results/cta-robust-home.png", fullPage: true });
  const homeButtons = await page.evaluate(() => [...document.querySelectorAll("button")].map(b => b.textContent?.trim()).filter(Boolean));
  console.log("HOME BUTTONS:", JSON.stringify(homeButtons));
  console.log("HOME has Analyze:", homeButtons.some(b => b.includes("Analyze my portfolio")));
  console.log("HOME has WhatAdd:", homeButtons.some(b => b.includes("What should I add")));

  // Navigate to Performance tab (desktop nav)
  await perfNavDesktop.first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "test-results/cta-robust-perf.png", fullPage: true });

  const perfButtons = await page.evaluate(() => [...document.querySelectorAll("button")].map(b => b.textContent?.trim()).filter(Boolean));
  console.log("PERF BUTTONS:", JSON.stringify(perfButtons));
  console.log("PERF has Analyze:", perfButtons.some(b => b.includes("Analyze my portfolio")));
  console.log("PERF has WhatAdd:", perfButtons.some(b => b.includes("What should I add")));

  // Click Analyze my portfolio if present, verify popup
  if (perfButtons.some(b => b === "Analyze my portfolio")) {
    await page.getByRole("button", { name: "Analyze my portfolio" }).first().click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/cta-robust-after-click.png" });

    // Check for popup: "Rayla Coach" header only appears inside chartExplainPopup
    const raylaCoachVisible = await page.locator("text=Rayla Coach").isVisible().catch(() => false);
    // Check popup title matches what we set
    const popupTitleVisible = await page.locator("text=Analyze my portfolio").nth(1).isVisible().catch(() => false);
    // Check AI response text
    const fullText = await page.evaluate(() => document.body.innerText);
    const hasAIResponse = fullText.includes("RAYLA_AI_TEST_RESPONSE");
    const hasPopupHeader = fullText.includes("Rayla Coach");

    console.log("POPUP: 'Rayla Coach' visible (locator):", raylaCoachVisible);
    console.log("POPUP: 'Analyze my portfolio' 2nd instance visible:", popupTitleVisible);
    console.log("POPUP: 'Rayla Coach' in full body text:", hasPopupHeader);
    console.log("POPUP: AI test response in full body text:", hasAIResponse);
    console.log("FULL BODY (last 1000 chars):", fullText.slice(-1000));
  }
});
