import { expect, test } from "@playwright/test";
import { AUTH_STORAGE_KEY, closedSimulationTrade, fakeSessionPayload, installFakeSupabase, openTab, seedAuthenticatedWorkspace } from "./helpers.js";

test("Live Simulation history is user-scoped and renders in Performance ranges", async ({ page }) => {
  const sameTimestamp = new Date().toISOString();
  const userAHistory = [
    closedSimulationTrade({ id: "sim-a-1", asset: "AAPL", closedAt: sameTimestamp, profitLoss: 20, rMultiple: 1 }),
    closedSimulationTrade({ id: "sim-a-2", asset: "AAPL", closedAt: sameTimestamp, profitLoss: -10, rMultiple: -0.5 }),
    closedSimulationTrade({ id: "sim-a-3", asset: "BTC", type: "crypto", label: "Bitcoin", profitLoss: 0, rMultiple: 0 }),
  ];

  await seedAuthenticatedWorkspace(page, "qa-user-a", userAHistory);
  await page.goto("/");

  await openTab(page, "Performance");
  await page.getByRole("button", { name: "Live Simulation" }).click();

  for (const range of ["1D", "1W", "1M", "3M", "ALL"]) {
    await page.getByRole("button", { name: range, exact: true }).click();
    await expect(page.getByText("Log trades to build your equity curve.")).toHaveCount(0);
    await expect(page.getByText("3 of 3 trades", { exact: false })).toBeVisible();
  }

  await page.reload();
  await openTab(page, "Performance");
  await page.getByRole("button", { name: "Live Simulation" }).click();
  await expect(page.getByText("3 of 3 trades", { exact: false })).toBeVisible();

  const userBPage = await page.context().newPage();
  await installFakeSupabase(userBPage, "qa-user-b");
  await userBPage.addInitScript(({ authKey, sessionPayload }) => {
    window.localStorage.setItem(authKey, JSON.stringify(sessionPayload));
    window.localStorage.setItem("rayla-visited", "true");
    window.localStorage.setItem("rayla_first_trade_onboarding_completed", "true");
    window.localStorage.setItem("rayla_first_trade_onboarding_autostarted", "true");
  }, {
    authKey: AUTH_STORAGE_KEY,
    sessionPayload: fakeSessionPayload("qa-user-b"),
  });
  await userBPage.goto("/");
  await openTab(userBPage, "Performance");
  await userBPage.getByRole("button", { name: "Live Simulation" }).click();
  await expect(userBPage.getByText(/No live simulation trades to analyze yet/)).toBeVisible();
  await userBPage.close();
});

test("Journal source toggle separates Live Trades from closed Live Simulation trades", async ({ page }) => {
  const userAHistory = [
    closedSimulationTrade({ id: "sim-journal-1", asset: "NRG", label: "NRG Energy", profitLoss: 25, rMultiple: 1.25 }),
  ];

  await seedAuthenticatedWorkspace(page, "qa-journal-sim", userAHistory);
  await page.goto("/");
  await openTab(page, "Journal");

  await expect(page.getByText("No trades logged yet")).toBeVisible();
  await expect(page.getByText("NRG", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Live Simulation" }).click();
  await expect(page.getByText("NRG", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Live Simulation", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("+1.25R")).toBeVisible();

  await page.getByRole("button", { name: "Live Trades" }).nth(1).click();
  await expect(page.getByText("No trades logged yet")).toBeVisible();
  await expect(page.getByText("NRG", { exact: true })).toHaveCount(0);
});

test("Journal summary count follows the active trade source", async ({ page }) => {
  const userHistory = [
    closedSimulationTrade({ id: "sim-count-1", asset: "BTC", type: "crypto", direction: "long", profitLoss: 10, rMultiple: 1 }),
    closedSimulationTrade({ id: "sim-count-2", asset: "ETH", type: "crypto", direction: "short", profitLoss: -5, rMultiple: -0.5 }),
  ];
  const manualTrades = [
    { id: "manual-count-1", asset: "AAPL", direction: "long", result_r: 1, setup: "breakout", source: "manual", entry_price: 100, entry_size: 1000, entry_time: new Date().toISOString() },
    { id: "manual-count-2", asset: "NVDA", direction: "long", result_r: -0.5, setup: "pullback", source: "manual", entry_price: 100, entry_size: 1000, entry_time: new Date().toISOString() },
    { id: "manual-count-3", asset: "MSFT", direction: "short", result_r: 0.2, setup: "range", source: "manual", entry_price: 100, entry_size: 1000, entry_time: new Date().toISOString() },
  ];

  await seedAuthenticatedWorkspace(page, "qa-journal-count-source", userHistory);
  await page.route("**/rest/v1/trades**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(manualTrades) });
      return;
    }
    await route.fallback();
  });

  await page.goto("/");
  await openTab(page, "Journal");

  await expect(page.getByText("Total Trades").locator("..").getByText("3")).toBeVisible();
  await page.getByRole("button", { name: "Live Simulation" }).click();
  await expect(page.getByText("Total Trades").locator("..").getByText("2")).toBeVisible();
});

test("deleting a simulation trade removes it from shared history, analytics, and Picks input", async ({ page }) => {
  const userId = "qa-delete-sim";
  const deleteId = "sim-delete-me";
  const userHistory = [
    closedSimulationTrade({ id: deleteId, asset: "BTC", type: "crypto", label: "Bitcoin", direction: "long", profitLoss: 25, rMultiple: 1.1 }),
    closedSimulationTrade({ id: "sim-keep-1", asset: "BTC", type: "crypto", label: "Bitcoin", direction: "long", profitLoss: -5, rMultiple: -0.2 }),
    closedSimulationTrade({ id: "sim-keep-2", asset: "BTC", type: "crypto", label: "Bitcoin", direction: "long", profitLoss: 15, rMultiple: 0.7 }),
  ];

  page.on("dialog", (dialog) => dialog.accept());
  await seedAuthenticatedWorkspace(page, userId, userHistory);
  await page.goto("/");
  await openTab(page, "Journal");
  await page.getByRole("button", { name: "Live Simulation" }).click();

  await expect(page.locator(`[data-trade-id="${deleteId}"]`)).toHaveCount(1);
  await page.locator(`[data-trade-id="${deleteId}"]`).getByRole("button", { name: "Delete" }).click();
  await expect(page.locator(`[data-trade-id="${deleteId}"]`)).toHaveCount(0);
  await expect.poll(() => page.evaluate(({ storageKey, removedId }) => {
    const rows = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    return rows.some((row) => row?.id === removedId);
  }, {
    storageKey: `rayla_sim_trade_history:${userId}`,
    removedId: deleteId,
  })).toBe(false);

  const afterDeleteDebug = await page.evaluate(() => window.__raylaPicksDebug);
  const btcLongBucket = afterDeleteDebug?.bucketCounts?.find((entry) => entry.asset === "BTC" && entry.direction === "long");
  expect(btcLongBucket?.simTrades).toBe(2);
  expect(btcLongBucket?.eligible).toBe(false);

  await openTab(page, "Simulation");
  await expect(page.locator(`[data-trade-id="${deleteId}"]`)).toHaveCount(0);

  await openTab(page, "Performance");
  await page.getByRole("button", { name: "Live Simulation" }).click();
  await expect(page.getByText("2 of 2 trades", { exact: false })).toBeVisible();

  const refreshedPage = await page.context().newPage();
  await installFakeSupabase(refreshedPage, userId);
  await refreshedPage.goto("/");
  await openTab(refreshedPage, "Journal");
  await refreshedPage.getByRole("button", { name: "Live Simulation" }).click();
  await expect(refreshedPage.locator(`[data-trade-id="${deleteId}"]`)).toHaveCount(0);
  await refreshedPage.close();
});

test("simulation history preserves raw storage while scoped tombstones only hide visible rows", async ({ page }) => {
  const userId = "qa-sim-integrity";
  const storageKey = `rayla_sim_trade_history:${userId}`;
  const tombstoneKey = `rayla_sim_deleted_trade_ids:${storageKey}`;
  const deleteId = "sim-delete-target";
  const hiddenId = "sim-hidden-scoped";
  const keepIds = ["sim-keep-a", "sim-keep-b", "sim-keep-c"];
  const userHistory = [
    closedSimulationTrade({ id: deleteId, asset: "BTC", type: "crypto", label: "Bitcoin", direction: "long", profitLoss: 30, rMultiple: 1.2 }),
    closedSimulationTrade({ id: keepIds[0], asset: "BTC", type: "crypto", label: "Bitcoin", direction: "long", profitLoss: 20, rMultiple: 0.8 }),
    closedSimulationTrade({ id: keepIds[1], asset: "BTC", type: "crypto", label: "Bitcoin", direction: "long", profitLoss: 10, rMultiple: 0.4 }),
    closedSimulationTrade({ id: keepIds[2], asset: "BTC", type: "crypto", label: "Bitcoin", direction: "long", profitLoss: -5, rMultiple: -0.2 }),
    closedSimulationTrade({ id: hiddenId, asset: "ETH", type: "crypto", label: "Ethereum", direction: "short", profitLoss: 7, rMultiple: 0.5 }),
  ];

  page.on("dialog", (dialog) => dialog.accept());
  await installFakeSupabase(page, userId);
  await page.addInitScript(({ authKey, historyRows, legacyTombstoneIds, scopedHiddenId, scopedHistoryKey, scopedTombstoneKey, sessionPayload }) => {
    window.localStorage.setItem(authKey, JSON.stringify(sessionPayload));
    window.localStorage.setItem("rayla-visited", "true");
    window.localStorage.setItem("rayla_first_trade_onboarding_completed", "true");
    window.localStorage.setItem("rayla_first_trade_onboarding_autostarted", "true");
    window.localStorage.removeItem("rayla_sim_trade_history");
    window.localStorage.removeItem("rayla_sim_open_position");
    window.localStorage.removeItem("rayla_last_screenshot_parse_debug");
    if (!window.localStorage.getItem(scopedHistoryKey)) {
      window.localStorage.setItem(scopedHistoryKey, JSON.stringify(historyRows));
    }
    if (!window.localStorage.getItem(scopedTombstoneKey)) {
      window.localStorage.setItem(scopedTombstoneKey, JSON.stringify([scopedHiddenId]));
    }
    if (!window.localStorage.getItem("rayla_sim_deleted_trade_ids")) {
      window.localStorage.setItem("rayla_sim_deleted_trade_ids", JSON.stringify(legacyTombstoneIds));
    }
  }, {
    authKey: AUTH_STORAGE_KEY,
    historyRows: userHistory,
    legacyTombstoneIds: ["legacy-unrelated-id", keepIds[0]],
    scopedHistoryKey: storageKey,
    scopedHiddenId: hiddenId,
    scopedTombstoneKey: tombstoneKey,
    sessionPayload: fakeSessionPayload(userId),
  });

  await page.goto("/");
  await openTab(page, "Journal");
  await page.getByRole("button", { name: "Live Simulation" }).click();

  await expect(page.locator(`[data-trade-id="${hiddenId}"]`)).toHaveCount(0);
  await expect(page.locator(`[data-trade-id="${deleteId}"]`)).toHaveCount(1);
  for (const keepId of keepIds) {
    await expect(page.locator(`[data-trade-id="${keepId}"]`)).toHaveCount(1);
  }
  await expect(page.getByText("+0.80R")).toBeVisible();

  const firstStorageDebug = await page.evaluate(() => window.__raylaStorageDebug);
  expect(firstStorageDebug?.simulationHistoryKey).toBe(storageKey);
  expect(firstStorageDebug?.tombstoneKey).toBe(tombstoneKey);
  expect(firstStorageDebug?.simulationHistoryCountRaw).toBe(5);
  expect(firstStorageDebug?.visibleHistoryCount).toBe(4);
  expect(firstStorageDebug?.hiddenByTombstoneCount).toBe(1);
  expect(firstStorageDebug?.firstTombstoneIds).toContain(hiddenId);

  const firstPicksDebug = await page.evaluate(() => window.__raylaPicksDebug);
  const firstBtcLongBucket = firstPicksDebug?.bucketCounts?.find((entry) => entry.asset === "BTC" && entry.direction === "long");
  expect(firstBtcLongBucket?.simTrades).toBe(4);
  expect(firstBtcLongBucket?.eligible).toBe(true);

  await page.reload();
  await openTab(page, "Journal");
  await page.getByRole("button", { name: "Live Simulation" }).click();

  const rawIdsAfterRefresh = await page.evaluate(({ key }) => {
    return JSON.parse(window.localStorage.getItem(key) || "[]").map((trade) => trade?.id);
  }, { key: storageKey });
  expect(rawIdsAfterRefresh).toEqual([deleteId, ...keepIds, hiddenId]);
  await expect(page.locator(`[data-trade-id="${hiddenId}"]`)).toHaveCount(0);
  for (const visibleId of [deleteId, ...keepIds]) {
    await expect(page.locator(`[data-trade-id="${visibleId}"]`)).toHaveCount(1);
  }

  await page.locator(`[data-trade-id="${deleteId}"]`).getByRole("button", { name: "Delete" }).click();
  await expect(page.locator(`[data-trade-id="${deleteId}"]`)).toHaveCount(0);

  await expect.poll(() => page.evaluate(({ key }) => {
    return JSON.parse(window.localStorage.getItem(key) || "[]").map((trade) => trade?.id);
  }, { key: storageKey })).toEqual([...keepIds, hiddenId]);

  const tombstonesAfterDelete = await page.evaluate(({ key }) => {
    return JSON.parse(window.localStorage.getItem(key) || "[]");
  }, { key: tombstoneKey });
  expect(tombstonesAfterDelete).toEqual(expect.arrayContaining([hiddenId, deleteId]));

  await page.reload();
  await openTab(page, "Journal");
  await page.getByRole("button", { name: "Live Simulation" }).click();

  await expect(page.locator(`[data-trade-id="${deleteId}"]`)).toHaveCount(0);
  await expect(page.locator(`[data-trade-id="${hiddenId}"]`)).toHaveCount(0);
  for (const keepId of keepIds) {
    await expect(page.locator(`[data-trade-id="${keepId}"]`)).toHaveCount(1);
  }
  await expect(page.getByText("+0.80R")).toBeVisible();
  await expect(page.getByText("-0.20R")).toBeVisible();

  const finalStorageDebug = await page.evaluate(() => window.__raylaStorageDebug);
  expect(finalStorageDebug?.simulationHistoryCountRaw).toBe(4);
  expect(finalStorageDebug?.visibleHistoryCount).toBe(3);
  expect(finalStorageDebug?.hiddenByTombstoneCount).toBe(1);

  const finalPicksDebug = await page.evaluate(() => window.__raylaPicksDebug);
  const finalBtcLongBucket = finalPicksDebug?.bucketCounts?.find((entry) => entry.asset === "BTC" && entry.direction === "long");
  expect(finalBtcLongBucket?.simTrades).toBe(3);
  expect(finalBtcLongBucket?.eligible).toBe(true);
});

test("sign-out clears transient simulation/debug state but keeps scoped closed history", async ({ page }) => {
  const userAHistory = [closedSimulationTrade({ id: "sim-a-signout" })];
  await seedAuthenticatedWorkspace(page, "qa-user-a", userAHistory);
  await page.addInitScript(() => {
    window.localStorage.setItem("rayla_sim_open_position", JSON.stringify([{ id: "open-unsafe" }]));
    window.localStorage.setItem("rayla_last_screenshot_parse_debug", JSON.stringify({ collapsePoint: "test" }));
  });

  await page.goto("/");
  await openTab(page, "Profile & Settings");
  await page.getByRole("button", { name: "Sign out" }).click();

  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("rayla_sim_open_position"))).toBe("[]");
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("rayla_last_screenshot_parse_debug"))).toBeNull();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("rayla_sim_trade_history:qa-user-a"))).not.toBeNull();
});
