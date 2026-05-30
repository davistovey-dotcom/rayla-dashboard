/**
 * Regression test: guided tour Next button must not pass events through to
 * underlying navigation on mobile viewport.
 *
 * Failure mode: tapping "Next →" was activating the mobileNav (navigating to
 * Intel) instead of advancing the tour step.
 *
 * This test verifies event routing, not final UI state. UI state after Next is
 * unreliable in the test environment (broker data absent → steps auto-skip).
 * The definitive proof is in the console logs:
 *   - [tour-click] next touchend must appear  → button received the event
 *   - [tour-step] from=0 to=1 must appear     → goNext fired
 *   - [nav-click] must NOT appear             → mobileNav was not triggered
 *   - [overlay] must NOT appear               → overlay was not tapped instead
 */
import { test, expect } from "@playwright/test";
import { seedAuthenticatedWorkspace } from "./helpers.js";

test.describe("Guided Tour — mobile click-through isolation", () => {
  // iPhone 14 Pro with full touch emulation
  test.use({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
  });

  test("Next tap fires on tour button — not underlying navigation", async ({ page }) => {
    const tourCaptureLogs = [];  // [tour-capture] ALLOW - events passing through blocker
    const tourClickLogs = [];    // [tour-click] - button-level events
    const tourStepLogs = [];     // [tour-step] - goNext/goPrev actions
    const tourBlockLogs = [];    // [tour-block] - events blocked by capture listener
    const navLogs = [];          // [nav-click] - mobileNav activations
    const overlayLogs = [];      // [overlay] - overlay receiving events (should be 0)

    page.on("console", (msg) => {
      const text = msg.text();
      if (text.startsWith("[tour-capture]")) tourCaptureLogs.push(text);
      else if (text.startsWith("[tour-click]")) tourClickLogs.push(text);
      else if (text.startsWith("[tour-step]")) tourStepLogs.push(text);
      else if (text.startsWith("[tour-block]")) tourBlockLogs.push(text);
      else if (text.startsWith("[nav-click]")) navLogs.push(text);
      else if (text.startsWith("[overlay]")) overlayLogs.push(text);
    });

    await seedAuthenticatedWorkspace(page, "qa-tour-mobile");

    // helpers.js returns [] for subscriptions → paywall. Override with active sub.
    await page.route("**/rest/v1/user_subscriptions**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{
          id: "fake-sub-qa",
          user_id: "qa-tour-mobile",
          status: "active",
          plan_key: "rayla_monthly",
          current_period_end: "2027-01-01T00:00:00Z",
        }]),
      });
    });

    await page.addInitScript(() => {
      window.localStorage.setItem("rayla_mode_preference", "beginner");
    });

    await page.goto("/");

    // Dismiss broker onboarding (appears after subscription loads)
    const skipEl = await page.waitForSelector('button:has-text("Skip for now")', { state: "visible", timeout: 15000 }).catch(() => null);
    if (skipEl) await skipEl.click();

    // Confirm main app is loaded
    const perfNavBtn = page.locator('[data-mobile-nav-tab="ai"]');
    await expect(perfNavBtn).toBeVisible({ timeout: 8000 });

    // Navigate to Performance tab
    await perfNavBtn.tap();

    // Performance filter bar must appear
    const perfFilters = page.locator('[data-tour-id="perf-filters"]');
    await expect(perfFilters).toBeVisible({ timeout: 8000 });

    // "Feeling lost?" must appear (requires isBeginnerMode=true)
    const feelingLost = page.getByText("Feeling lost? Click here.");
    await expect(feelingLost).toBeVisible({ timeout: 5000 });

    // Start the tour
    await feelingLost.tap();

    // Step 1 indicator must appear
    const stepIndicator = page.locator('[data-tour-portal]').getByText(/Step \d+ \/ \d+/);
    await expect(stepIndicator).toBeVisible({ timeout: 5000 });
    const stepBefore = await stepIndicator.textContent();

    // Capture tab before tap
    const activeTabBefore = await page.evaluate(() => sessionStorage.getItem("rayla-active-tab"));

    // Snapshot log counts before tap — initial perfNavBtn.tap() may have fired [nav-click]
    const navLogCountBefore = navLogs.length;
    const overlayOnTouchEndCountBefore = overlayLogs.filter((l) => l.includes("onTouchEnd")).length;

    // Screenshot before tap for evidence
    await page.screenshot({ path: "test-results/tour-before-tap.png" });

    // ── THE CRITICAL TEST: tap Next using touch ──────────────────────────────
    const nextBtn = page.locator('[data-tour-portal]').getByRole("button", { name: "Next →" });
    await expect(nextBtn).toBeVisible({ timeout: 3000 });

    // Get button bounding box for evidence
    const bbox = await nextBtn.boundingBox();
    console.log(`Next button bbox: ${JSON.stringify(bbox)}`);
    console.log(`Viewport: 393 x 852`);
    console.log(`Button bottom edge: ${bbox ? bbox.y + bbox.height : "unknown"}`);

    await nextBtn.tap();
    // ────────────────────────────────────────────────────────────────────────

    // Wait for any async processing (auto-skip timer is 350ms per step)
    await page.waitForTimeout(600);

    // Capture tab after tap
    const activeTabAfter = await page.evaluate(() => sessionStorage.getItem("rayla-active-tab"));

    // Screenshot after tap for evidence
    await page.screenshot({ path: "test-results/tour-after-tap.png" });

    // ── Print full diagnostic report ─────────────────────────────────────────
    console.log("\n=== TOUR MOBILE CLICK-THROUGH TEST RESULTS ===");
    console.log(`Next button bbox       : ${JSON.stringify(bbox)}`);
    console.log(`Step before tap        : ${stepBefore}`);
    console.log(`Active tab before      : ${activeTabBefore}`);
    console.log(`Active tab after       : ${activeTabAfter}`);
    console.log(`[tour-capture] logs    : ${JSON.stringify(tourCaptureLogs)}`);
    console.log(`[tour-click] logs      : ${JSON.stringify(tourClickLogs)}`);
    console.log(`[tour-step] logs       : ${JSON.stringify(tourStepLogs)}`);
    console.log(`[tour-block] logs      : ${JSON.stringify(tourBlockLogs.slice(0, 10))}`);
    console.log(`[nav-click] logs       : ${JSON.stringify(navLogs)}`);
    console.log(`[nav-click] new after tap: ${JSON.stringify(navLogs.slice(navLogCountBefore))}`);
    console.log(`[overlay] logs         : ${JSON.stringify(overlayLogs)}`);
    console.log("===============================================\n");

    // ── Hard assertions ───────────────────────────────────────────────────────

    // 1. The Next button must have received touchend (not the overlay)
    expect(
      tourClickLogs.some((l) => l.includes("next touchend")),
      "FAIL: [tour-click] next touchend was NOT logged — button did not receive the touchend event",
    ).toBe(true);

    // 2. goNext must have been called (tour-step from=0 to=1)
    expect(
      tourStepLogs.some((l) => l.includes("from=0") && l.includes("to=1")),
      "FAIL: [tour-step] from=0 to=1 was NOT logged — goNext was not called",
    ).toBe(true);

    // 3. No NEW nav-click logs must appear after the tour tap (initial navigation is pre-counted)
    expect(
      navLogs.slice(navLogCountBefore),
      "FAIL: [nav-click] fired after tour tap — mobileNav was triggered despite tour being active",
    ).toHaveLength(0);

    // 4. The overlay must NOT have received a NEW onTouchEnd after the tap
    expect(
      overlayLogs.filter((l) => l.includes("onTouchEnd")).length,
      "FAIL: [overlay] onTouchEnd fired after tap — tap hit the overlay instead of the Next button",
    ).toBe(overlayOnTouchEndCountBefore);

    // 5. Active tab must not have changed
    expect(
      activeTabAfter,
      "FAIL: active tab changed — navigation was triggered",
    ).toBe(activeTabBefore);
  });
});
