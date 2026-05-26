import { expect, test } from "@playwright/test";
import { fillManualTradeFields, openManualTradeForm, openTab, seedAuthenticatedWorkspace, selectManualDirection } from "./helpers.js";

test("manual trade save blocks missing direction before DB insert", async ({ page }) => {
  await openManualTradeForm(page);
  await fillManualTradeFields(page);
  await page.getByRole("button", { name: "Save Trade" }).click();
  await expect(page.getByText("Choose Long or Short so this trade can count toward Picks.")).toBeVisible();
});

test("manual trade save blocks invalid numeric input", async ({ page }) => {
  await openManualTradeForm(page);
  await fillManualTradeFields(page, { entryPrice: "100abc" });
  await selectManualDirection(page, "long");
  await page.getByRole("button", { name: "Save Trade" }).click();
  await expect(page.getByText("Check price, size, date, and result before saving.")).toBeVisible();
});

test("+1.5R with direction passes client validation and inserts through mocked DB", async ({ page }) => {
  await openManualTradeForm(page);
  await fillManualTradeFields(page, { result: "+1.5R" });
  await selectManualDirection(page, "long");
  await page.getByRole("button", { name: "Save Trade" }).click();
  await expect(page.getByText("Trade logged.")).toBeVisible();
});

test("0R with direction is accepted intentionally", async ({ page }) => {
  await openManualTradeForm(page);
  await fillManualTradeFields(page, { result: "0R" });
  await selectManualDirection(page, "long");
  await page.getByRole("button", { name: "Save Trade" }).click();
  await expect(page.getByText("Trade logged.")).toBeVisible();
});

test("duplicate manual trade is blocked against existing saved trade", async ({ page }) => {
  const duplicateFields = {
    asset: "AAPL",
    entryPrice: "190",
    size: "1000",
    entryTime: "2026-05-16T10:30",
    result: "+1.5R",
  };
  const existingTrade = {
    id: "existing-duplicate",
    user_id: "qa-duplicate",
    asset: "AAPL",
    entry_price: 190,
    entry_size: 1000,
    entry_time: "2026-05-16T10:30",
    direction: "long",
    result_r: 1.5,
    source: "manual",
  };

  await seedAuthenticatedWorkspace(page, "qa-duplicate", []);
  await page.route("**/rest/v1/trades**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([existingTrade]),
      });
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "Duplicate test should block before insert." }),
    });
  });

  await page.goto("/");
  await openTab(page, "Live Trades");
  await page.getByRole("button", { name: "Log Trade" }).click();
  await expect(page.getByRole("heading", { name: "Log Trade" })).toBeVisible();
  await fillManualTradeFields(page, duplicateFields);
  await selectManualDirection(page, "long");
  await page.getByRole("button", { name: "Save Trade" }).click();
  await expect(page.getByText("This looks like a duplicate trade. Review before saving again.")).toBeVisible();
});
