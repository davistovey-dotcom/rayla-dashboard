import { expect, test } from "@playwright/test";
import { PARSE_SCREENSHOT_URL, openManualTradeForm } from "./helpers.js";

test("screenshot prefill resets stale manual fields before applying partial parse", async ({ page }) => {
  await openManualTradeForm(page, "qa-screenshot-prefill");
  await page.getByPlaceholder("Result, e.g. +1.5R or -0.5R").fill("+1.5R");

  await page.route(PARSE_SCREENSHOT_URL, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        partial: true,
        fields: {
          asset: "NRG",
          entryPrice: "156.65",
          size: "20",
          entryTime: "2026-03-16T14:30:00.000Z",
          direction: "long",
        },
        partialPrefill: {
          fields: {
            asset: "NRG",
            entryPrice: "156.65",
            size: "20",
            entryTime: "2026-03-16T14:30:00.000Z",
            direction: "long",
          },
          notes: {
            result: "Result required.",
          },
        },
        missing: ["result"],
        failedFields: ["result"],
        failureReasons: ["Result was not present in the screenshot."],
        collapsePoint: "partial_prefill",
      }),
    });
  });

  await page.locator('input[type="file"]').setInputFiles({
    name: "nrg-order.png",
    mimeType: "image/png",
    buffer: Buffer.from("fake image bytes"),
  });

  await expect(page.getByText("Partially read. Check highlighted fields.")).toBeVisible();
  await expect(page.getByPlaceholder("Search asset (AAPL, BTC, NRG)")).toHaveValue("NRG");
  await expect(page.getByPlaceholder("Entry Price")).toHaveValue("156.65");
  await expect(page.getByPlaceholder("Size ($)")).toHaveValue("20");
  await expect(page.getByPlaceholder("Result, e.g. +1.5R or -0.5R")).toHaveValue("");
  await expect(page.getByText("Result required.")).toBeVisible();
});
