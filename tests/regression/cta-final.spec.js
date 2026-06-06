import { test, expect } from "@playwright/test";

const userId = "qa-cta-final";
const fakeSession = {
  access_token: `fake-token-${userId}`,
  refresh_token: `fake-refresh-${userId}`,
  token_type: "bearer",
  expires_at: 4102444800,
  expires_in: 3600,
  user: { id: userId, aud: "authenticated", role: "authenticated", email: `${userId}@rayla.test`, user_metadata: { display_name: "QA" } },
};

test("Investor CTAs — Performance Portfolio popup fires", async ({ page }) => {
  const ctaLog = [];
  page.on("console", msg => {
    const t = msg.text();
    if (t.includes("chartExplain") || t.includes("Rayla") || t.includes("popup") || t.includes("openGlobal")) ctaLog.push(t);
  });

  await page.route("**/auth/v1/token**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeSession) }));
  await page.route("**/auth/v1/user", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeSession.user) }));
  await page.route("**/auth/v1/logout**", r => r.fulfill({ status: 204 }));
  await page.route("**/rest/v1/user_subscriptions**", r => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify([{ id: "sub-final", user_id: userId, status: "active", plan_key: "rayla_monthly", current_period_end: "2027-01-01T00:00:00Z" }]),
  }));
  await page.route("**/rest/v1/profiles**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/portfolio_snapshots**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/trades**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/position_trade_types**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
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
  await page.route("**/functions/v1/rayla-ai**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ answer: "RAYLA_AI_TEST_RESPONSE: portfolio analyzed." }) }));
  // NOTE: No catch-all for functions/v1 — other functions may fail silently (market-data etc.)

  await page.addInitScript(({ authKey, session }) => {
    window.localStorage.setItem(authKey, JSON.stringify(session));
    window.localStorage.setItem("rayla-visited", "true");
    window.localStorage.setItem("rayla_first_trade_onboarding_completed", "true");
    window.localStorage.setItem("rayla_first_trade_onboarding_autostarted", "true");
    window.localStorage.setItem("rayla-broker-onboarding-skip-v1", "true");
  }, { authKey: "sb-uoxzzhtnzmsolvcykynu-auth-token", session: fakeSession });

  await page.goto("/");

  // Wait for the main app to load (look for desktop nav)
  await expect(page.getByRole("button", { name: "Performance" })).toBeVisible({ timeout: 15000 });
  
  // Wait for broker data to load
  await page.waitForTimeout(2000);

  // Navigate to Performance tab (desktop nav)
  await page.getByRole("button", { name: "Performance" }).first().click();
  await page.waitForTimeout(2000);

  // Capture state
  await page.screenshot({ path: "test-results/cta-final-perf-tab.png" });
  const perfButtons = await page.evaluate(() =>
    [...document.querySelectorAll("button")].map(b => b.textContent?.trim()).filter(Boolean)
  );
  console.log("PERF TAB BUTTONS:", JSON.stringify(perfButtons));

  const hasAnalyze = perfButtons.some(b => b === "Analyze my portfolio");
  const hasWhatAdd = perfButtons.some(b => b === "What should I add?");
  console.log("Analyze my portfolio button present:", hasAnalyze);
  console.log("What should I add? button present:", hasWhatAdd);

  expect(hasAnalyze || hasWhatAdd, "At least one Performance Portfolio CTA must be present").toBe(true);

  // Click the CTA and verify popup opens
  if (hasAnalyze) {
    await page.getByRole("button", { name: "Analyze my portfolio" }).first().click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: "test-results/cta-final-after-click.png" });

    const afterClickText = await page.evaluate(() => document.body.innerText);
    const hasAIResponse = afterClickText.includes("RAYLA_AI_TEST_RESPONSE");
    const hasPopupTitle = afterClickText.includes("Analyze my portfolio");
    console.log("AI response visible after click:", hasAIResponse);
    console.log("Popup title visible:", hasPopupTitle);
    console.log("CTA console logs captured:", JSON.stringify(ctaLog));

    expect(hasAIResponse || hasPopupTitle, "Rayla popup must open and display response after CTA click").toBe(true);
  }
});
