import { expect, test } from "@playwright/test";

test("app boots to the auth shell without crashing", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: "Rayla" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
});

test("error boundary renders the calm fallback when a dev-only crash probe is forced", async ({ page }) => {
  await page.goto("/?__rayla_test_crash=1");
  await expect(page.getByText("Rayla hit a temporary display issue.")).toBeVisible();
  await expect(page.getByText("Your data was not changed.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload Rayla" })).toBeVisible();
});
