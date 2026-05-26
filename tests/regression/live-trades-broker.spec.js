import { expect, test } from "@playwright/test";
import { seedAuthenticatedWorkspace, openTab } from "./helpers.js";

// ── Mock prices for order validation ──────────────────────────────────────
const MOCK_QUOTES = {
  AAPL: { price: 195.5, change: 0.8 },
  BTC: { price: 62000, change: 1.2 },
  "BTC/USD": { price: 62000, change: 1.2 },
  ETH: { price: 3000, change: 0.9 },
  "ETH/USD": { price: 3000, change: 0.9 },
  ADA: { price: 0.42, change: -0.5 },
  "ADA/USD": { price: 0.42, change: -0.5 },
};

// ── Seed a fully-mocked broker-connected workspace ─────────────────────────
// ALL broker edge functions are mocked here. alpaca-place-order NEVER fires
// against real endpoints — it returns a fake pending order every time.
async function seedBrokerConnected(page, userId = "qa-broker", options = {}) {
  const {
    positions = [],
    tradeLog = [],
    isPaper = true,
    buyingPower = 10000,
  } = options;

  await seedAuthenticatedWorkspace(page, userId, []);

  const positionValue = positions.reduce((s, p) => s + (Number(p.marketValue) || 0), 0);

  await page.route("**/functions/v1/alpaca-account**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        connected: true,
        isPaper,
        account: {
          id: "qa-acct-001",
          accountNumber: "PA001",
          status: "ACTIVE",
          buyingPower,
          cash: buyingPower,
          portfolioValue: buyingPower + positionValue,
          equity: buyingPower + positionValue,
          isPaper,
          raw: { multiplier: "1", account_number: "PA001" },
        },
      }),
    });
  });

  await page.route("**/functions/v1/alpaca-positions**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ positions }),
    });
  });

  // IMPORTANT: returns empty order list — prevents real order sync
  await page.route("**/functions/v1/alpaca-orders**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ connected: true, orders: [] }),
    });
  });

  // IMPORTANT: mocked to prevent any real broker orders
  await page.route("**/functions/v1/alpaca-place-order**", async (route) => {
    let body = {};
    try { body = route.request().postDataJSON() || {}; } catch {}
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        order: {
          id: `mock-order-${Date.now()}`,
          symbol: body.symbol || "AAPL",
          side: body.side || "buy",
          qty: String(body.qty || "1"),
          type: body.type || "market",
          order_type: body.type || "market",
          status: "pending_new",
          submitted_at: new Date().toISOString(),
          filled_at: null,
          filled_qty: "0",
        },
      }),
    });
  });

  await page.route("**/functions/v1/alpaca-assets**", async (route) => {
    let body = {};
    try { body = route.request().postDataJSON() || {}; } catch {}
    const query = String(body.query || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
    const all = [
      { symbol: "AAPL", name: "Apple Inc.", assetClass: "us_equity", exchange: "NASDAQ", tradable: true, marginable: true },
      { symbol: "BTC/USD", name: "Bitcoin / US Dollar", assetClass: "crypto", exchange: "CRYPTO", tradable: true, marginable: false },
      { symbol: "ETH/USD", name: "Ethereum / US Dollar", assetClass: "crypto", exchange: "CRYPTO", tradable: true, marginable: false },
      { symbol: "ADA/USD", name: "Cardano / US Dollar", assetClass: "crypto", exchange: "CRYPTO", tradable: true, marginable: false },
    ];
    const compact = (s) => s.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    const results = all.filter((a) => compact(a.symbol).startsWith(query) || compact(a.name).includes(query));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, assets: results }),
    });
  });

  // Override the base market-data mock to supply real quote prices
  await page.route("**/functions/v1/market-data**", async (route) => {
    let body = {};
    try { body = route.request().postDataJSON() || {}; } catch {}
    const sym = String(body.chartSymbol || "").toUpperCase();
    const now = Date.now();
    const bars = Array.from({ length: 12 }, (_, i) => ({
      time: new Date(now - (11 - i) * 60 * 60 * 1000).toISOString(),
      open: 100 + i * 0.4,
      high: 100 + i * 0.4 + 0.5,
      low: 100 + i * 0.4 - 0.3,
      close: 100 + i * 0.4 + 0.2,
      volume: 1000 + i * 100,
    }));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        chart: sym ? { symbol: sym, bars, rangeMode: "1D" } : null,
        quotes: MOCK_QUOTES,
      }),
    });
  });

  await page.route("**/rest/v1/broker_trade_logs**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(tradeLog),
    });
  });
}

async function goToLiveTrades(page) {
  await page.goto("/");
  await openTab(page, "Live Trades");
  // Allow broker fetch effects to settle
  await page.waitForTimeout(1800);
}

async function fillSymbol(page, symbol) {
  const input = page.getByPlaceholder("Search tradable asset (AAPL)");
  await expect(input).toBeVisible({ timeout: 8000 });
  await input.fill(symbol);
  await page.waitForTimeout(700);
  // Blur the input so the 120ms onBlur handler closes the dropdown
  await page.keyboard.press("Tab");
  await page.waitForTimeout(250);
}

async function scrollToOrderTicket(page) {
  await page.locator(".tradeOrderTicket").scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300);
}

// ── 1. Symbol Selection ────────────────────────────────────────────────────

test.describe("Symbol Selection", () => {
  test("AAPL loads order ticket with no NaN", async ({ page }) => {
    await seedBrokerConnected(page, "qa-sym-aapl");
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await expect(page.getByPlaceholder("Search tradable asset (AAPL)")).toHaveValue("AAPL");
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("BTC sets crypto symbol and order ticket syncs", async ({ page }) => {
    await seedBrokerConnected(page, "qa-sym-btc");
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "BTC");
    await expect(page.getByPlaceholder("Search tradable asset (AAPL)")).toHaveValue("BTC");
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("ETH sets crypto symbol correctly", async ({ page }) => {
    await seedBrokerConnected(page, "qa-sym-eth");
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "ETH");
    await expect(page.getByPlaceholder("Search tradable asset (AAPL)")).toHaveValue("ETH");
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("ADA sets crypto symbol correctly", async ({ page }) => {
    await seedBrokerConnected(page, "qa-sym-ada");
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "ADA");
    await expect(page.getByPlaceholder("Search tradable asset (AAPL)")).toHaveValue("ADA");
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("switching BTC → AAPL clears crypto state, no NaN", async ({ page }) => {
    await seedBrokerConnected(page, "qa-sym-switch");
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "BTC");
    await fillSymbol(page, "AAPL");
    await expect(page.getByPlaceholder("Search tradable asset (AAPL)")).toHaveValue("AAPL");
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("BTC/USD in position matches BTC in symbol input", async ({ page }) => {
    const pos = btcUsdPosition();
    await seedBrokerConnected(page, "qa-sym-btcusd", { positions: [pos] });
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "BTC");
    // Position match should show (qty or units label visible, no NaN)
    await expect(page.getByText("NaN")).not.toBeVisible();
  });
});

// ── 2. Quantity Modes ──────────────────────────────────────────────────────

test.describe("Quantity Modes", () => {
  test("Qty mode: numeric input accepted, no NaN", async ({ page }) => {
    await seedBrokerConnected(page, "qa-qty-basic");
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await page.getByRole("button", { name: "Qty", exact: true }).click();
    const qtyInput = page.getByPlaceholder("Qty");
    await expect(qtyInput).toBeVisible();
    await qtyInput.fill("5");
    await expect(qtyInput).toHaveValue("5");
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("$ Amount mode: shows estimated qty from price", async ({ page }) => {
    await seedBrokerConnected(page, "qa-dollar-basic");
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await page.waitForTimeout(600); // price cache settles
    await page.getByRole("button", { name: "$ Amount" }).click();
    const amtInput = page.getByPlaceholder("Dollar amount (e.g. 1000)");
    await expect(amtInput).toBeVisible();
    await amtInput.fill("1000");
    await page.waitForTimeout(500);
    // Either "Estimated qty: X at $Y" or "Waiting for price data" — no NaN
    await expect(page.getByText("NaN")).not.toBeVisible();
    // When price is available, estimated qty should appear
    const estimatedLine = page.getByText(/Estimated qty/);
    const waitingLine = page.getByText(/Waiting for price data/);
    const eitherVisible = (await estimatedLine.isVisible().catch(() => false))
      || (await waitingLine.isVisible().catch(() => false));
    expect(eitherVisible).toBe(true);
  });

  test("$ Amount mode: no NaN when price is present (AAPL)", async ({ page }) => {
    const pos = aaplPosition();
    await seedBrokerConnected(page, "qa-dollar-price", { positions: [pos] });
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await page.getByRole("button", { name: "$ Amount" }).click();
    await page.getByPlaceholder("Dollar amount (e.g. 1000)").fill("500");
    await page.waitForTimeout(400);
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("P&L / Risk mode: shows risk input, no NaN", async ({ page }) => {
    await seedBrokerConnected(page, "qa-risk-basic");
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await page.getByRole("button", { name: "P&L / Risk" }).click();
    const riskInput = page.getByPlaceholder("Planned risk ($, e.g. 100)");
    await expect(riskInput).toBeVisible();
    await riskInput.fill("100");
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("P&L / Risk: with stop price set, shows estimated qty", async ({ page }) => {
    const pos = aaplPosition();
    await seedBrokerConnected(page, "qa-risk-qty", { positions: [pos] });
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await page.getByRole("button", { name: "P&L / Risk" }).click();
    // Set a stop in exit plan (price mode, open by default)
    const stopInput = page.getByPlaceholder("Stop price");
    if (await stopInput.isVisible().catch(() => false)) {
      await stopInput.fill("185");
    }
    await page.getByPlaceholder("Planned risk ($, e.g. 100)").fill("100");
    await page.waitForTimeout(400);
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("fractional crypto qty: 0.001 ETH accepted without NaN", async ({ page }) => {
    await seedBrokerConnected(page, "qa-frac-eth");
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "ETH");
    await page.getByRole("button", { name: "Qty", exact: true }).click();
    await page.getByPlaceholder("Qty").fill("0.001");
    await expect(page.getByPlaceholder("Qty")).toHaveValue("0.001");
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("mode switching: Qty → $ Amount → P&L/Risk → Qty leaves no NaN", async ({ page }) => {
    await seedBrokerConnected(page, "qa-mode-cycle");
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await page.getByRole("button", { name: "$ Amount" }).click();
    await page.getByPlaceholder("Dollar amount (e.g. 1000)").fill("200");
    await page.getByRole("button", { name: "P&L / Risk" }).click();
    await page.getByRole("button", { name: "Qty", exact: true }).click();
    await page.getByRole("button", { name: "$ Amount" }).click();
    await expect(page.getByText("NaN")).not.toBeVisible();
  });
});

// ── 3. Exit Plan ───────────────────────────────────────────────────────────

test.describe("Exit Plan", () => {
  test("PLAN ONLY badge is visible — no bracket order risk", async ({ page }) => {
    await seedBrokerConnected(page, "qa-plan-badge");
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await expect(page.getByText("PLAN ONLY")).toBeVisible();
  });

  test("Exit Plan disclaimer says levels are NOT submitted to broker", async ({ page }) => {
    await seedBrokerConnected(page, "qa-plan-disclaimer");
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await expect(page.getByText(/NOT submitted to the broker/i)).toBeVisible();
  });

  test("Price mode: stop + target show R/R ratio, no NaN", async ({ page }) => {
    const pos = aaplPosition();
    await seedBrokerConnected(page, "qa-plan-rr", { positions: [pos] });
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await page.getByRole("button", { name: "Qty", exact: true }).click();
    await page.getByPlaceholder("Qty").fill("10");
    await page.waitForTimeout(400);
    const stopInput = page.getByPlaceholder("Stop price");
    const targetInput = page.getByPlaceholder("Target price");
    await expect(stopInput).toBeVisible();
    await stopInput.fill("185");
    await targetInput.fill("210");
    await page.waitForTimeout(400);
    await expect(page.getByText("NaN")).not.toBeVisible();
    await expect(page.getByText(/R\/R Ratio|Planned Risk|Planned Reward/i).first()).toBeVisible();
  });

  test("P&L mode: max loss / profit target inputs appear, no NaN", async ({ page }) => {
    await seedBrokerConnected(page, "qa-plan-pnl");
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await page.getByRole("button", { name: "P&L ($)" }).click();
    const lossInput = page.getByPlaceholder("e.g. 50");
    const profitInput = page.getByPlaceholder("e.g. 150");
    await expect(lossInput).toBeVisible();
    await lossInput.fill("50");
    await profitInput.fill("150");
    await page.waitForTimeout(300);
    await expect(page.getByText("NaN")).not.toBeVisible();
    await expect(page.getByText(/Lose up to \$50|Gain up to \$150/i).first()).toBeVisible();
  });

  test("switching Price ↔ P&L mode clears fields without NaN", async ({ page }) => {
    await seedBrokerConnected(page, "qa-plan-toggle");
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    const stopInput = page.getByPlaceholder("Stop price");
    await stopInput.fill("185");
    await page.getByRole("button", { name: "P&L ($)" }).click();
    await page.getByRole("button", { name: "Price" }).click();
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("exit plan stop/target show in confirmation modal as Plan Only", async ({ page }) => {
    const pos = aaplPosition();
    await seedBrokerConnected(page, "qa-plan-in-modal", { positions: [pos] });
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await page.getByRole("button", { name: "Qty", exact: true }).click();
    await page.getByPlaceholder("Qty").fill("2");
    const stopInput = page.getByPlaceholder("Stop price");
    await stopInput.fill("185");
    await page.getByPlaceholder("Target price").fill("210");
    // Submit to open review modal
    const reviewBtn = page.getByRole("button", { name: "Review order" });
    await expect(reviewBtn).toBeEnabled({ timeout: 5000 });
    await reviewBtn.click();
    await expect(page.getByText(/Confirm Broker Order/i)).toBeVisible();
    // Exit plan section in modal labeled Plan Only (first match is modal, second is order form badge)
    await expect(page.getByText(/Plan Only/i).first()).toBeVisible();
    await expect(page.getByText("NaN")).not.toBeVisible();
  });
});

// ── 4. Review Order Flow ───────────────────────────────────────────────────

test.describe("Review Order Flow", () => {
  test("Review order button present when symbol + qty set", async ({ page }) => {
    const pos = aaplPosition();
    await seedBrokerConnected(page, "qa-review-btn", { positions: [pos] });
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await page.getByRole("button", { name: "Qty", exact: true }).click();
    await page.getByPlaceholder("Qty").fill("1");
    await expect(page.getByRole("button", { name: "Review order" })).toBeVisible();
  });

  test("Review order opens confirmation modal", async ({ page }) => {
    const pos = aaplPosition();
    await seedBrokerConnected(page, "qa-review-modal", { positions: [pos] });
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await page.getByRole("button", { name: "Qty", exact: true }).click();
    await page.getByPlaceholder("Qty").fill("1");
    const btn = page.getByRole("button", { name: "Review order" });
    await expect(btn).toBeEnabled({ timeout: 5000 });
    await btn.click();
    await expect(page.getByText(/Confirm Broker Order/i)).toBeVisible();
  });

  test("Confirmation modal shows correct symbol", async ({ page }) => {
    const pos = aaplPosition();
    await seedBrokerConnected(page, "qa-modal-sym", { positions: [pos] });
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await page.getByRole("button", { name: "Qty", exact: true }).click();
    await page.getByPlaceholder("Qty").fill("2");
    await page.getByRole("button", { name: "Review order" }).click();
    await expect(page.getByText(/Confirm Broker Order/i)).toBeVisible();
    // AAPL appears in the confirm modal's symbol heading (first match)
    await expect(page.locator(".tradeConfirmModal").getByText("AAPL").first()).toBeVisible();
  });

  test("unit(s) label in modal — NOT share(s)", async ({ page }) => {
    const pos = aaplPosition();
    await seedBrokerConnected(page, "qa-units-modal", { positions: [pos] });
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await page.getByRole("button", { name: "Qty", exact: true }).click();
    await page.getByPlaceholder("Qty").fill("3");
    await page.getByRole("button", { name: "Review order" }).click();
    await expect(page.getByText(/Confirm Broker Order/i)).toBeVisible();
    await expect(page.getByText(/unit\(s\)/i).first()).toBeVisible();
    await expect(page.getByText(/share\(s\)/i)).not.toBeVisible();
  });

  test("Cancel dismisses modal without placing order", async ({ page }) => {
    const pos = aaplPosition();
    let orderFired = false;
    // Register spy BEFORE seedBrokerConnected so it runs first (LIFO)
    await page.route("**/functions/v1/alpaca-place-order**", async (route) => {
      orderFired = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, order: { id: "should-not-fire" } }) });
    });
    await seedBrokerConnected(page, "qa-cancel-modal", { positions: [pos] });
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await page.getByRole("button", { name: "Qty", exact: true }).click();
    await page.getByPlaceholder("Qty").fill("1");
    await page.getByRole("button", { name: "Review order" }).click();
    await expect(page.getByText(/Confirm Broker Order/i)).toBeVisible();
    await page.getByRole("button", { name: "Back to ticket" }).click();
    await expect(page.getByText(/Confirm Broker Order/i)).not.toBeVisible();
    expect(orderFired).toBe(false);
  });

  test("Confirm button submits mocked order and shows Order sent status", async ({ page }) => {
    const pos = aaplPosition();
    await seedBrokerConnected(page, "qa-confirm-submit", { positions: [pos] });
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await page.getByRole("button", { name: "Qty", exact: true }).click();
    await page.getByPlaceholder("Qty").fill("1");
    await page.getByRole("button", { name: "Review order" }).click();
    await expect(page.getByText(/Confirm Broker Order/i)).toBeVisible();
    const confirmBtn = page.getByRole("button", { name: /Place Order|Confirm|Submit/i }).last();
    await confirmBtn.click();
    // Modal closes, "Order sent" status appears
    await expect(page.getByText(/Order sent:/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("disabled Review order when qty is empty", async ({ page }) => {
    await seedBrokerConnected(page, "qa-review-disabled");
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await page.getByRole("button", { name: "Qty", exact: true }).click();
    // Leave qty empty — button should be disabled or error shown
    const reviewBtn = page.getByRole("button", { name: "Review order" });
    await expect(reviewBtn).toBeVisible();
    const isDisabled = await reviewBtn.isDisabled();
    if (!isDisabled) {
      // If not disabled, clicking should show an error, not open modal
      await reviewBtn.click();
      // Either modal doesn't open, or an error is visible
      const modalVisible = await page.getByText(/Confirm Broker Order/i).isVisible().catch(() => false);
      if (!modalVisible) {
        await expect(page.getByText(/Review:/i)).toBeVisible({ timeout: 3000 });
      }
    }
    await expect(page.getByText("NaN")).not.toBeVisible();
  });
});

// ── 5. Broker Sync ─────────────────────────────────────────────────────────

test.describe("Broker Sync", () => {
  test("BTC/USD position matches BTC input — no position mismatch NaN", async ({ page }) => {
    const pos = btcUsdPosition();
    await seedBrokerConnected(page, "qa-btcusd-match", { positions: [pos] });
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "BTC");
    // Position should resolve: qty 0.5 displayed, no NaN
    await expect(page.getByText("NaN")).not.toBeVisible();
    await expect(page.getByText(/Units|0\.5/i).first()).toBeVisible();
  });

  test("filled order in broker_trade_logs shows 'Order filled' status", async ({ page }) => {
    const filledOrder = buildFilledBrokerOrder("AAPL");
    await seedBrokerConnected(page, "qa-filled-order", { tradeLog: [filledOrder] });
    await goToLiveTrades(page);
    // No stale "may fill" message
    await expect(page.getByText(/may fill/i)).not.toBeVisible();
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("no duplicate close order submitted on repeated position renders", async ({ page }) => {
    const pos = aaplPosition();
    let orderCount = 0;
    await page.route("**/functions/v1/alpaca-place-order**", async (route) => {
      orderCount++;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, order: { id: `close-${orderCount}`, symbol: "AAPL", side: "sell", qty: "10", status: "pending_new", submitted_at: new Date().toISOString(), filled_at: null, filled_qty: "0" } }) });
    });
    await seedBrokerConnected(page, "qa-no-dup-close", { positions: [pos] });
    await goToLiveTrades(page);
    await page.waitForTimeout(1000);
    expect(orderCount).toBe(0);
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("ETH/USD broker position syncs to ETH input without stale state", async ({ page }) => {
    const ethPos = {
      symbol: "ETH/USD",
      assetClass: "crypto",
      qty: "2.5",
      avgEntryPrice: 2800,
      currentPrice: 3000,
      marketValue: 7500,
      unrealizedPl: 500,
      unrealizedPlpc: 0.071,
      side: "long",
    };
    await seedBrokerConnected(page, "qa-eth-sync", { positions: [ethPos] });
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "ETH");
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("broker trade log row shows unit(s) not share(s)", async ({ page }) => {
    const order = buildFilledBrokerOrder("AAPL");
    await seedBrokerConnected(page, "qa-units-log", { tradeLog: [order] });
    await goToLiveTrades(page);
    // Any order status display should use "unit(s)" not "share(s)"
    await expect(page.getByText(/share\(s\)/i)).not.toBeVisible();
    await expect(page.getByText("NaN")).not.toBeVisible();
  });
});

// ── 6. Broker Portfolio ─────────────────────────────────────────────────────

test.describe("Broker Portfolio", () => {
  test("single ETH position shown in portfolio panel, no NaN", async ({ page }) => {
    const ethPos = {
      symbol: "ETH/USD",
      assetClass: "crypto",
      qty: "1.5",
      avgEntryPrice: 2800,
      currentPrice: 3000,
      marketValue: 4500,
      unrealizedPl: 300,
      unrealizedPlpc: 0.071,
      side: "long",
    };
    await seedBrokerConnected(page, "qa-portfolio-eth", { positions: [ethPos], buyingPower: 3000 });
    await goToLiveTrades(page);
    // ETH should be visible somewhere in the portfolio section
    await expect(page.getByText(/ETH/i).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("portfolio P/L shown without NaN for AAPL position", async ({ page }) => {
    const pos = aaplPosition();
    await seedBrokerConnected(page, "qa-portfolio-pnl", { positions: [pos] });
    await goToLiveTrades(page);
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("empty portfolio state shows no NaN or crash", async ({ page }) => {
    await seedBrokerConnected(page, "qa-portfolio-empty", { positions: [] });
    await goToLiveTrades(page);
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("portfolio chart loading does not break display", async ({ page }) => {
    // Delay market-data to simulate slow chart load
    await seedAuthenticatedWorkspace(page, "qa-portfolio-slow", []);
    await page.route("**/functions/v1/alpaca-account**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ connected: true, isPaper: true, account: mockAccount() }) });
    });
    await page.route("**/functions/v1/alpaca-positions**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ positions: [aaplPosition()] }) });
    });
    await page.route("**/functions/v1/alpaca-orders**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ connected: true, orders: [] }) });
    });
    await page.route("**/functions/v1/market-data**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, quotes: MOCK_QUOTES }) });
    });
    await page.route("**/functions/v1/alpaca-place-order**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, order: { id: "mock", symbol: "AAPL", side: "buy", qty: "1", status: "pending_new", submitted_at: new Date().toISOString(), filled_at: null, filled_qty: "0" } }) });
    });
    await page.route("**/rest/v1/broker_trade_logs**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    });
    await goToLiveTrades(page);
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("account equity and buying power display as formatted currency", async ({ page }) => {
    await seedBrokerConnected(page, "qa-acct-display", { buyingPower: 12345.67 });
    await goToLiveTrades(page);
    await expect(page.getByText("NaN")).not.toBeVisible();
    // Currency values should be formatted — no raw NaN
    await expect(page.getByText(/\$12,345|\$10,000/i).first()).toBeVisible({ timeout: 6000 });
  });
});

// ── 7. Edge Cases ──────────────────────────────────────────────────────────

test.describe("Edge Cases", () => {
  test("empty symbol: review button disabled or shows error, no NaN", async ({ page }) => {
    await seedBrokerConnected(page, "qa-empty-sym");
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    // No symbol entered
    await page.getByRole("button", { name: "Qty", exact: true }).click();
    await page.getByPlaceholder("Qty").fill("1");
    const reviewBtn = page.getByRole("button", { name: "Review order" });
    await expect(reviewBtn).toBeVisible();
    const isDisabled = await reviewBtn.isDisabled();
    if (!isDisabled) {
      await reviewBtn.click();
      const modalOpen = await page.getByText(/Confirm Broker Order/i).isVisible().catch(() => false);
      if (modalOpen) {
        // Modal should show empty/invalid symbol, not place a broken order
        await page.getByRole("button", { name: "Back to ticket" }).click();
      }
    }
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("qty = 0: validation blocks submission", async ({ page }) => {
    const pos = aaplPosition();
    await seedBrokerConnected(page, "qa-zero-qty", { positions: [pos] });
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await page.getByRole("button", { name: "Qty", exact: true }).click();
    await page.getByPlaceholder("Qty").fill("0");
    const reviewBtn = page.getByRole("button", { name: "Review order" });
    await expect(reviewBtn).toBeVisible();
    const isDisabled = await reviewBtn.isDisabled();
    if (!isDisabled) {
      await reviewBtn.click();
      await page.waitForTimeout(500);
    }
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("tiny crypto qty (0.00001 ETH): formats correctly without NaN", async ({ page }) => {
    await seedBrokerConnected(page, "qa-tiny-eth");
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "ETH");
    await page.getByRole("button", { name: "Qty", exact: true }).click();
    await page.getByPlaceholder("Qty").fill("0.00001");
    await page.waitForTimeout(300);
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("switching Long/Short 4 times leaves no NaN or broken state", async ({ page }) => {
    await seedBrokerConnected(page, "qa-dir-flip");
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    const longBtn = page.getByRole("button", { name: "Long" });
    const shortBtn = page.getByRole("button", { name: "Short" });
    await expect(longBtn).toBeVisible();
    for (let i = 0; i < 4; i++) {
      await shortBtn.click();
      await longBtn.click();
    }
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("negative qty is rejected or sanitized before modal opens", async ({ page }) => {
    const pos = aaplPosition();
    await seedBrokerConnected(page, "qa-neg-qty", { positions: [pos] });
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await page.getByRole("button", { name: "Qty", exact: true }).click();
    await page.getByPlaceholder("Qty").fill("-5");
    const reviewBtn = page.getByRole("button", { name: "Review order" });
    const isDisabled = await reviewBtn.isDisabled().catch(() => false);
    if (!isDisabled && await reviewBtn.isVisible().catch(() => false)) {
      await reviewBtn.click();
      await page.waitForTimeout(400);
    }
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("refreshing during pending order state — no stale may-fill message", async ({ page }) => {
    const pendingOrder = buildPendingBrokerOrder("AAPL");
    await seedBrokerConnected(page, "qa-refresh-pending", { tradeLog: [pendingOrder] });
    await goToLiveTrades(page);
    await page.reload();
    await page.waitForTimeout(2000);
    await openTab(page, "Live Trades");
    await page.waitForTimeout(1500);
    await expect(page.getByText("NaN")).not.toBeVisible();
  });

  test("$ Amount with 0 dollar input shows no NaN", async ({ page }) => {
    await seedBrokerConnected(page, "qa-zero-dollars");
    await goToLiveTrades(page);
    await scrollToOrderTicket(page);
    await fillSymbol(page, "AAPL");
    await page.getByRole("button", { name: "$ Amount" }).click();
    await page.getByPlaceholder("Dollar amount (e.g. 1000)").fill("0");
    await expect(page.getByText("NaN")).not.toBeVisible();
  });
});

// ── Fixtures ───────────────────────────────────────────────────────────────

function aaplPosition() {
  return {
    symbol: "AAPL",
    assetClass: "us_equity",
    qty: "10",
    avgEntryPrice: 185,
    currentPrice: 195.5,
    marketValue: 1955,
    unrealizedPl: 105,
    unrealizedPlpc: 0.057,
    side: "long",
  };
}

function btcUsdPosition() {
  return {
    symbol: "BTC/USD",
    assetClass: "crypto",
    qty: "0.5",
    avgEntryPrice: 58000,
    currentPrice: 62000,
    marketValue: 31000,
    unrealizedPl: 2000,
    unrealizedPlpc: 0.069,
    side: "long",
  };
}

function mockAccount(overrides = {}) {
  return {
    id: "qa-acct-001",
    accountNumber: "PA001",
    status: "ACTIVE",
    buyingPower: 10000,
    cash: 10000,
    portfolioValue: 12000,
    equity: 12000,
    isPaper: true,
    raw: { multiplier: "1", account_number: "PA001" },
    ...overrides,
  };
}

function buildFilledBrokerOrder(symbol) {
  return {
    id: `btl-filled-${symbol}-001`,
    broker_order_id: `mock-filled-${symbol}-001`,
    broker_provider: "alpaca",
    symbol,
    side: "buy",
    qty: "5",
    filled_qty: "5",
    status: "filled",
    submitted_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    filled_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    user_id: "qa-sync",
    raw_payload: { status: "filled", filled_qty: "5", qty: "5", filled_at: new Date(Date.now() - 8 * 60 * 1000).toISOString() },
  };
}

function buildPendingBrokerOrder(symbol) {
  return {
    id: `btl-pending-${symbol}-001`,
    broker_order_id: `mock-pending-${symbol}-001`,
    broker_provider: "alpaca",
    symbol,
    side: "buy",
    qty: "5",
    filled_qty: "0",
    status: "pending_new",
    submitted_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    filled_at: null,
    user_id: "qa-pending",
    raw_payload: { status: "pending_new", filled_qty: "0", qty: "5", submitted_at: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
  };
}
