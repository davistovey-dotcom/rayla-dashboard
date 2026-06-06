import { test } from "@playwright/test";

const userId = "qa-diag-cta";
const fakeSession = {
  access_token: `fake-token-${userId}`,
  refresh_token: `fake-refresh-${userId}`,
  token_type: "bearer",
  expires_at: 4102444800,
  expires_in: 3600,
  user: { id: userId, aud: "authenticated", role: "authenticated", email: `${userId}@rayla.test`, user_metadata: { display_name: "QA" } },
};

test("diagnose CTA visibility", async ({ page }) => {
  const networkLog = [];
  page.on("request", req => {
    const url = req.url().replace(/https?:\/\/[^\/]+/, "HOST");
    if (url.includes("supabase") || url.includes("alpaca") || url.includes("functions")) {
      networkLog.push(`${req.method()} ${url.slice(0, 120)}`);
    }
  });
  page.on("response", resp => {
    const url = resp.url().replace(/https?:\/\/[^\/]+/, "HOST");
    if (url.includes("functions/v1/alpaca")) {
      networkLog.push(`RESP ${resp.status()} ${url.slice(0, 120)}`);
    }
  });

  await page.route("**/auth/v1/token**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeSession) }));
  await page.route("**/auth/v1/user", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeSession.user) }));
  await page.route("**/auth/v1/logout**", r => r.fulfill({ status: 204 }));

  // Subscription — active
  await page.route("**/rest/v1/user_subscriptions**", r => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify([{ id: "sub-diag", user_id: userId, status: "active", plan_key: "rayla_monthly", current_period_end: "2027-01-01T00:00:00Z" }]),
  }));

  // Other REST
  await page.route("**/rest/v1/profiles**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/portfolio_snapshots**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/trade_snapshots**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/sim_positions**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/sim_trades**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/trades**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/broker_connection**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/user_broker_connections**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/position_trade_types**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

  // Alpaca via Supabase edge functions
  await page.route("**/functions/v1/alpaca-account**", r => {
    console.log("ALPACA-ACCOUNT STUB HIT");
    return r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ connected: true, isPaper: true, account: { cash: "5000", equity: "9500", portfolioValue: "9500", buyingPower: "10000", id: "qa-acct", status: "ACTIVE" } }),
    });
  });
  await page.route("**/functions/v1/alpaca-positions**", r => {
    console.log("ALPACA-POSITIONS STUB HIT");
    return r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ positions: [
        { symbol: "AAPL", qty: "10", market_value: "2000", avg_entry_price: "180", unrealized_pl: "200", asset_class: "us_equity", side: "long" },
        { symbol: "MSFT", qty: "5", market_value: "2500", avg_entry_price: "480", unrealized_pl: "100", asset_class: "us_equity", side: "long" },
      ]}),
    });
  });
  await page.route("**/functions/v1/alpaca-orders**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ orders: [] }) }));
  await page.route("**/functions/v1/rayla-ai**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ answer: "RAYLA_AI_TEST_RESPONSE" }) }));
  await page.route("**/functions/v1/market-data**", r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/functions/v1/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));

  await page.addInitScript(({ authKey, session }) => {
    window.localStorage.setItem(authKey, JSON.stringify(session));
    window.localStorage.setItem("rayla-visited", "true");
    window.localStorage.setItem("rayla_first_trade_onboarding_completed", "true");
    window.localStorage.setItem("rayla_first_trade_onboarding_autostarted", "true");
  }, { authKey: "sb-uoxzzhtnzmsolvcykynu-auth-token", session: fakeSession });

  await page.goto("/");
  const skip = page.locator('button:has-text("Skip for now")');
  if (await skip.isVisible({ timeout: 5000 }).catch(() => false)) await skip.click();
  await page.waitForTimeout(4000);

  await page.screenshot({ path: "test-results/diag-home-after-load.png", fullPage: false });

  const buttons = await page.evaluate(() =>
    [...document.querySelectorAll("button")].map(b => b.textContent?.trim()).filter(Boolean)
  );
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));

  console.log("\n=== NETWORK LOG ===");
  networkLog.forEach(l => console.log(l));
  console.log("\n=== BUTTONS ON PAGE ===");
  console.log(JSON.stringify(buttons));
  console.log("\n=== BODY TEXT (first 2000 chars) ===");
  console.log(bodyText);

  // Navigate to Performance tab and check again
  const perfBtn = page.locator('[data-mobile-nav-tab="ai"]');
  if (await perfBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await perfBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/diag-perf-after-nav.png", fullPage: false });
    const perfButtons = await page.evaluate(() =>
      [...document.querySelectorAll("button")].map(b => b.textContent?.trim()).filter(Boolean)
    );
    console.log("\n=== BUTTONS ON PERFORMANCE TAB ===");
    console.log(JSON.stringify(perfButtons));
  }
});
