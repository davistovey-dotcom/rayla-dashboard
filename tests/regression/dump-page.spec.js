import { test } from "@playwright/test";

const userId = "qa-dump";
const fakeSession = {
  access_token: `fake-token-${userId}`,
  refresh_token: `fake-refresh-${userId}`,
  token_type: "bearer",
  expires_at: 4102444800,
  expires_in: 3600,
  user: { id: userId, aud: "authenticated", role: "authenticated", email: `${userId}@rayla.test`, user_metadata: { display_name: "QA" } },
};

test("dump page state", async ({ page }) => {
  const allRequests = [];
  page.on("request", req => {
    if (req.url().includes("supabase") || req.url().includes("alpaca")) {
      allRequests.push(`${req.method()} ${req.url().replace(/https:\/\/[^\/]+/, "HOST")}`);
    }
  });

  await page.route("**/auth/v1/token**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeSession) }));
  await page.route("**/auth/v1/user", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeSession.user) }));
  await page.route("**/auth/v1/logout**", r => r.fulfill({ status: 204 }));
  await page.route("**/rest/v1/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/functions/v1/alpaca-account**", r => r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ connected: true, isPaper: true, account: { cash: "5000", equity: "9500", portfolioValue: "9500", buyingPower: "10000", id: "qa-acct", status: "ACTIVE" } })
  }));
  await page.route("**/functions/v1/alpaca-positions**", r => r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ positions: [
      { symbol: "AAPL", qty: "10", market_value: "2000", avg_entry_price: "180", unrealized_pl: "200", asset_class: "us_equity", side: "long" },
      { symbol: "MSFT", qty: "5", market_value: "2500", avg_entry_price: "480", unrealized_pl: "100", asset_class: "us_equity", side: "long" },
    ]})
  }));
  await page.route("**/functions/v1/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));

  await page.addInitScript(({ authKey, session, uid }) => {
    window.localStorage.setItem(authKey, JSON.stringify(session));
    window.localStorage.setItem("rayla-visited", "true");
    window.localStorage.setItem("rayla_first_trade_onboarding_completed", "true");
    window.localStorage.setItem("rayla_first_trade_onboarding_autostarted", "true");
  }, { authKey: "sb-uoxzzhtnzmsolvcykynu-auth-token", session: fakeSession, uid: userId });

  await page.goto("/");
  
  const skip = page.locator('button:has-text("Skip for now")');
  if (await skip.isVisible({ timeout: 5000 }).catch(() => false)) await skip.click();
  
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "test-results/page-dump-home.png", fullPage: true });

  // Log all buttons on screen
  const buttons = await page.evaluate(() => {
    return [...document.querySelectorAll("button")].map(b => b.textContent?.trim()).filter(Boolean);
  });

  // Log what routes were actually hit
  console.log("REQUESTS HIT:", JSON.stringify(allRequests.slice(0, 30)));
  console.log("BUTTONS ON PAGE:", JSON.stringify(buttons));

  // Also check for InvestorCtaBand by looking for specific text
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  console.log("BODY TEXT SAMPLE:", bodyText);
});
