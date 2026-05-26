import { test, expect } from "@playwright/test";
import { AUTH_STORAGE_KEY, fakeSessionPayload, installFakeSupabase, openTab } from "./helpers.js";

test("new live simulation close carries R multiple into Journal", async ({ page }) => {
  const userId = "qa-sim-r-path";
  const storageKey = `rayla_sim_trade_history:${userId}`;
  await installFakeSupabase(page, userId);
  await page.addInitScript(({ authKey, scopedHistoryKey, sessionPayload }) => {
    window.localStorage.setItem(authKey, JSON.stringify(sessionPayload));
    window.localStorage.setItem("rayla-visited", "true");
    window.localStorage.setItem("rayla_first_trade_onboarding_completed", "true");
    window.localStorage.setItem("rayla_first_trade_onboarding_autostarted", "true");
    window.localStorage.removeItem("rayla_sim_trade_history");
    window.localStorage.removeItem("rayla_sim_open_position");
    window.localStorage.removeItem("rayla_last_screenshot_parse_debug");
    if (!window.localStorage.getItem(scopedHistoryKey)) {
      window.localStorage.setItem(scopedHistoryKey, "[]");
    }
  }, {
    authKey: AUTH_STORAGE_KEY,
    scopedHistoryKey: storageKey,
    sessionPayload: fakeSessionPayload(userId),
  });
  await page.goto("/");
  await openTab(page, "Simulation");

  await expect(page.getByText("BTC (BTC)")).toBeVisible();
  const numberInputs = page.locator('input[type="number"]');
  await expect(numberInputs).toHaveCount(3);
  await numberInputs.nth(0).fill("1000");
  await numberInputs.nth(1).fill("64000");
  await numberInputs.nth(2).fill("64500");
  await page.getByRole("button", { name: "Open Trade" }).click();

  await expect(page.getByText("Trade Active")).toBeVisible();
  await page.getByRole("button", { name: "Close Trade" }).first().click();

  await expect(page.getByText("+0.00R").first()).toBeVisible();

  await page.getByRole("button", { name: "×" }).click();
  await openTab(page, "Journal");
  await page.getByRole("button", { name: "Live Simulation" }).click();

  await expect(page.getByText("Live Simulation").first()).toBeVisible();
  await expect(page.locator("body")).toContainText("BTC");
  await expect(page.locator("body")).toContainText("+0.00R");
  await expect(page.locator("body")).not.toContainText("--R");

  const persistedRows = await page.evaluate(({ key }) => JSON.parse(window.localStorage.getItem(key) || "[]"), { key: storageKey });
  expect(persistedRows.some((trade) => (
    trade?.asset === "BTC"
    && trade?.direction === "long"
    && Number.isFinite(Number(trade?.rMultiple))
  ))).toBe(true);

  await page.reload();
  await openTab(page, "Journal");
  await page.getByRole("button", { name: "Live Simulation" }).click();
  await expect(page.locator("body")).toContainText("BTC");
  await expect(page.locator("body")).toContainText("+0.00R");
  await expect(page.locator("body")).not.toContainText("--R");

  const picksDebug = await page.evaluate(() => window.__raylaPicksDebug);
  expect(picksDebug?.meta?.strategyRTrades).toBeGreaterThanOrEqual(1);
  expect(picksDebug?.meta?.eligibleDirectionalTrades).toBeGreaterThanOrEqual(1);
  expect(picksDebug?.bucketCounts?.some((entry) => (
    entry.asset === "BTC"
    && entry.direction === "long"
    && entry.simTrades >= 1
    && entry.totalTrades >= 1
  ))).toBe(true);
});
