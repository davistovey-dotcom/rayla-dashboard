import { test, expect } from "@playwright/test";

const userId = "qa-picks-verify";
const fakeSession = {
  access_token: `fake-token-${userId}`,
  refresh_token: `fake-refresh-${userId}`,
  token_type: "bearer",
  expires_at: 4102444800,
  expires_in: 3600,
  user: { id: userId, aud: "authenticated", role: "authenticated", email: `${userId}@rayla.test`, user_metadata: { display_name: "QA Picks" } },
};

async function setupRoutes(page) {
  await page.route("**/auth/v1/token**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeSession) }));
  await page.route("**/auth/v1/user", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeSession.user) }));
  await page.route("**/auth/v1/logout**", r => r.fulfill({ status: 204 }));
  await page.route("**/rest/v1/user_subscriptions**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "sub-1", user_id: userId, status: "active", plan_key: "rayla_monthly", current_period_end: "2027-01-01T00:00:00Z" }]) }));
  await page.route("**/rest/v1/profiles**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/portfolio_snapshots**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/trades**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rest/v1/position_trade_types**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/functions/v1/alpaca-account**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ connected: true, isPaper: true, account: { cash: "5000", equity: "9390", portfolioValue: "9390", buyingPower: "10000", id: "qa-acct", status: "ACTIVE" } }) }));
  await page.route("**/functions/v1/alpaca-positions**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ positions: [
    { symbol: "AAPL", qty: "10", market_value: "1940", avg_entry_price: "180", unrealized_pl: "220", asset_class: "us_equity", side: "long" },
  ]}) }));
  await page.route("**/functions/v1/alpaca-orders**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ orders: [] }) }));
  // Stub Rayla AI to return structured picks
  await page.route("**/ask-rayla**", r => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ answer: `===PICK1===
Ticker: NVDA
FitScore: 91
Confidence: HIGH
Why: Nvidia is setting up a breakout above the $130 resistance level with volume surging 40% above average. Given your preference for breakout setups in the tech sector, this matches your strongest historical pattern.
WatchOut: Earnings are in 3 weeks — the setup could reverse if guidance disappoints. Size conservatively going into the report.
===END1===

===PICK2===
Ticker: META
FitScore: 78
Confidence: MEDIUM
Why: Meta is in a clean momentum trend with AI monetization accelerating. The stock has held key support and is showing institutional accumulation consistent with your momentum setup preference.
WatchOut: Social media ad spend is sensitive to macro slowdowns. Watch for any weakness in consumer spending data.
===END2===

===PICK3===
Ticker: MSFT
FitScore: 71
Confidence: MEDIUM
Why: Microsoft fills a gap in your portfolio — enterprise cloud exposure with a strong AI narrative. Steady price action suits your moderate risk tolerance and the 3-5% pullback from recent highs offers a reasonable entry zone.
WatchOut: Already in many portfolios which limits upside surprise. Expect measured moves rather than explosive gains.
===END3===` }),
  }));
}

async function boot(page) {
  await page.addInitScript(({ authKey, session, uid, skipKey }) => {
    // Clear picks storage so we get fresh first-time state
    localStorage.removeItem("rayla-picks-profile-v1");
    localStorage.removeItem("rayla-picks-cache-v1");
    localStorage.setItem(authKey, JSON.stringify(session));
    localStorage.setItem("rayla-visited", "true");
    localStorage.setItem("rayla_first_trade_onboarding_completed", "true");
    localStorage.setItem("rayla_first_trade_onboarding_autostarted", "true");
    localStorage.setItem(skipKey, "true");
  }, {
    authKey: "sb-uoxzzhtnzmsolvcykynu-auth-token",
    session: fakeSession,
    uid: userId,
    skipKey: `rayla-broker-onboarding-skip-v1:${userId}`,
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Performance" }).first().waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(1000);
}

test("Picks tab — full flow verification", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", err => consoleErrors.push(`PAGE ERROR: ${err.message}`));

  await setupRoutes(page);
  await boot(page);

  // ── 1. Navigate to Picks tab ──────────────────────────────────────────────
  const picksBtn = page.getByRole("button", { name: "Picks" }).first();
  await expect(picksBtn).toBeVisible({ timeout: 5000 });
  await picksBtn.click();
  await page.waitForTimeout(800);

  // Screenshot: first-time landing state
  await page.screenshot({ path: "test-results/picks-1-landing.png", fullPage: true });
  const landingText = await page.evaluate(() => document.body.innerText);
  console.log("LANDING STATE — has 'Get My First Picks':", landingText.includes("Get My First Picks"));
  console.log("LANDING STATE — has 'Skip':", landingText.includes("Skip"));

  // Verify landing screen elements
  const getPicksBtn = page.getByRole("button", { name: /Get My First Picks/i });
  await expect(getPicksBtn).toBeVisible({ timeout: 3000 });

  // ── 2. Start questionnaire ────────────────────────────────────────────────
  await getPicksBtn.click();
  await page.waitForTimeout(400);

  await page.screenshot({ path: "test-results/picks-2-q1.png", fullPage: true });
  const q1Text = await page.evaluate(() => document.body.innerText);
  console.log("Q1 — has 'How do you approach':", q1Text.includes("How do you approach"));
  console.log("Q1 — has 'Active Trader':", q1Text.includes("Active Trader"));
  console.log("Q1 — has 'Long-Term Investor':", q1Text.includes("Long-Term Investor"));

  // ── 3. Answer Q1: Active Trader ───────────────────────────────────────────
  await page.getByRole("button", { name: /Active Trader/i }).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/picks-3-q2.png", fullPage: true });
  const q2Text = await page.evaluate(() => document.body.innerText);
  console.log("Q2 — has 'losing 10%':", q2Text.includes("losing 10%"));

  // ── 4. Answer Q2: I can handle it ─────────────────────────────────────────
  await page.getByRole("button", { name: /I can handle it/i }).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/picks-4-q3.png", fullPage: true });
  const q3Text = await page.evaluate(() => document.body.innerText);
  console.log("Q3 — has 'Breakouts':", q3Text.includes("Breakouts"));
  console.log("Q3 — has 'Momentum':", q3Text.includes("Momentum"));

  // ── 5. Answer Q3: Breakouts ───────────────────────────────────────────────
  await page.getByRole("button", { name: /Breakouts/i }).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/picks-5-q4-sectors.png", fullPage: true });
  const q4Text = await page.evaluate(() => document.body.innerText);
  console.log("Q4 — has 'sectors':", q4Text.toLowerCase().includes("sector"));
  console.log("Q4 — has 'Tech':", q4Text.includes("Tech"));

  // ── 6. Select sectors (multi-select) ──────────────────────────────────────
  await page.getByRole("button", { name: /^Tech$/ }).first().click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /^Finance$/ }).first().click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: "test-results/picks-6-q4-selected.png", fullPage: true });

  // Click Continue
  const continueBtn = page.getByRole("button", { name: /Continue/i });
  await expect(continueBtn).toBeVisible({ timeout: 3000 });
  await continueBtn.click();
  await page.waitForTimeout(400);

  // ── 7. Answer Q5: Goal ────────────────────────────────────────────────────
  await page.screenshot({ path: "test-results/picks-7-q5.png", fullPage: true });
  const q5Text = await page.evaluate(() => document.body.innerText);
  console.log("Q5 — has 'building toward':", q5Text.includes("building toward"));

  await page.getByRole("button", { name: /Extra income/i }).first().click();
  await page.waitForTimeout(600);

  // ── 8. Picks output page ───────────────────────────────────────────────────
  await page.screenshot({ path: "test-results/picks-8-loading.png", fullPage: true });
  await page.waitForTimeout(5000); // Wait for AI response

  await page.screenshot({ path: "test-results/picks-9-output.png", fullPage: true });
  const outputText = await page.evaluate(() => document.body.innerText);
  console.log("OUTPUT — has 'Rayla Picks':", outputText.includes("Rayla Picks"));
  console.log("OUTPUT — has 'NVDA':", outputText.includes("NVDA"));
  console.log("OUTPUT — has 'META':", outputText.includes("META"));
  console.log("OUTPUT — has 'MSFT':", outputText.includes("MSFT"));
  console.log("OUTPUT — has 'Rayla's Top Pick':", outputText.includes("Rayla's Top Pick"));
  console.log("OUTPUT — has 'Fit Score':", outputText.includes("Fit Score"));
  console.log("OUTPUT — has 'Confidence':", outputText.includes("Confidence"));
  console.log("OUTPUT — has 'Why this pick':", outputText.includes("Why this pick"));

  // ── 9. Verify localStorage persistence ─────────────────────────────────────
  const storedProfile = await page.evaluate(() => localStorage.getItem("rayla-picks-profile-v1"));
  const storedCache = await page.evaluate(() => localStorage.getItem("rayla-picks-cache-v1"));
  console.log("STORAGE — profile saved:", !!storedProfile);
  console.log("STORAGE — picks cache saved:", !!storedCache);
  if (storedProfile) {
    const p = JSON.parse(storedProfile);
    console.log("STORAGE — profile contents:", JSON.stringify(p));
  }

  // ── 10. Ask Rayla button on top pick ──────────────────────────────────────
  const askRaylaBtn = page.getByRole("button", { name: /Ask Rayla about NVDA/i }).first();
  const askRaylaBtnVisible = await askRaylaBtn.isVisible({ timeout: 3000 }).catch(() => false);
  console.log("ASK RAYLA BTN — visible:", askRaylaBtnVisible);

  if (askRaylaBtnVisible) {
    await askRaylaBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/picks-10-ask-rayla.png", fullPage: true });
    const popupText = await page.evaluate(() => document.body.innerText);
    console.log("POPUP — 'Rayla Coach' visible:", popupText.includes("Rayla Coach"));
    console.log("POPUP — 'About NVDA' title:", popupText.includes("About NVDA"));

    // Close popup
    const closeBtn = page.locator("button").filter({ hasText: "×" }).last();
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) await closeBtn.click();
    await page.waitForTimeout(300);
  }

  // ── 11. Refresh picks ─────────────────────────────────────────────────────
  const refreshBtn = page.getByRole("button", { name: /Refresh/i }).first();
  const refreshBtnVisible = await refreshBtn.isVisible({ timeout: 2000 }).catch(() => false);
  console.log("REFRESH BTN — visible:", refreshBtnVisible);
  if (refreshBtnVisible) {
    await refreshBtn.click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: "test-results/picks-11-refreshed.png", fullPage: true });
    const refreshedText = await page.evaluate(() => document.body.innerText);
    console.log("AFTER REFRESH — has 'NVDA':", refreshedText.includes("NVDA"));
  }

  // ── 12. Retune ────────────────────────────────────────────────────────────
  const retuneBtn = page.getByRole("button", { name: /Retune/i }).first();
  const retuneBtnVisible = await retuneBtn.isVisible({ timeout: 2000 }).catch(() => false);
  console.log("RETUNE BTN — visible:", retuneBtnVisible);
  if (retuneBtnVisible) {
    await retuneBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: "test-results/picks-12-retune.png", fullPage: true });
    const retuneText = await page.evaluate(() => document.body.innerText);
    console.log("AFTER RETUNE — back to questionnaire:", retuneText.includes("How do you approach") || retuneText.includes("Get My First Picks"));
    const profileAfterRetune = await page.evaluate(() => localStorage.getItem("rayla-picks-profile-v1"));
    console.log("STORAGE after retune — profile cleared:", !profileAfterRetune || profileAfterRetune === "null");
  }

  // ── 13. Console errors ────────────────────────────────────────────────────
  console.log("\nCONSOLE ERRORS:", consoleErrors.length === 0 ? "none" : JSON.stringify(consoleErrors));

  // Soft assertions — log results rather than hard-fail so we get full output
  expect(outputText.includes("NVDA"), "NVDA pick must appear").toBe(true);
  expect(outputText.includes("Rayla Picks"), "Rayla Picks header must appear").toBe(true);
  expect(!!storedProfile, "Profile must be saved to localStorage").toBe(true);
});
