import { expect, test } from "@playwright/test";
import { closedSimulationTrade } from "./helpers.js";

async function loadRegressionHarness(page) {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean(window.__raylaRegression))).toBe(true);
}

function manualTrade(overrides = {}) {
  return {
    id: `manual-${Math.random().toString(36).slice(2)}`,
    asset: "AAPL",
    setup: "",
    session: "",
    direction: "long",
    result_r: 1,
    entry_price: 100,
    exit_price: 101,
    entry_size: 1000,
    entry_time: "2026-05-16T10:00:00.000Z",
    exit_time: "2026-05-16T10:05:00.000Z",
    source: "manual",
    isBrokerTrade: false,
    ...overrides,
  };
}

function brokerTrade(overrides = {}) {
  return {
    id: `broker-${Math.random().toString(36).slice(2)}`,
    asset: "AAPL",
    symbol: "AAPL",
    setup: "Broker Import",
    session: "Broker",
    result_r: null,
    pnl_value: 42,
    filled_at: "2026-05-16T11:00:00.000Z",
    source: "broker",
    isBrokerTrade: true,
    ...overrides,
  };
}

test("Picks eligibility requires directional finite-R history without setup/session", async ({ page }) => {
  await loadRegressionHarness(page);

  const eligible = await page.evaluate((trades) => (
    window.__raylaRegression.buildRaylaPicksContext({ trades, simulationTradeHistory: [] })
  ), [
    manualTrade({ result_r: 1.2 }),
    manualTrade({ result_r: -0.4 }),
    manualTrade({ result_r: 2 }),
  ]);
  expect(eligible.stockLong.eligible).toBe(true);
  expect(eligible.stockLong.asset).toBe("AAPL");
  expect(eligible.stockLong.totalTrades).toBe(3);

  const missingDirection = await page.evaluate((trades) => (
    window.__raylaRegression.buildRaylaPicksContext({ trades, simulationTradeHistory: [] })
  ), [
    manualTrade({ direction: "", result_r: 1 }),
    manualTrade({ direction: "", result_r: 1 }),
    manualTrade({ direction: "", result_r: 1 }),
  ]);
  expect(missingDirection.stockLong.eligible).toBe(false);
  expect(missingDirection.meta.missingDirectionTrades).toBe(3);

  const ignored = await page.evaluate((trades) => (
    window.__raylaRegression.buildRaylaPicksContext({ trades, simulationTradeHistory: [] })
  ), [
    brokerTrade({ result_r: null, pnl_value: 100 }),
    manualTrade({ result_r: null }),
    manualTrade({ result_r: "" }),
  ]);
  expect(ignored.stockLong.eligible).toBe(false);
  expect(ignored.meta.strategyRTrades).toBe(0);
});

test("simulation trades with direction and rMultiple can unlock Picks", async ({ page }) => {
  await loadRegressionHarness(page);

  const context = await page.evaluate((simulationTradeHistory) => (
    window.__raylaRegression.buildRaylaPicksContext({ trades: [], simulationTradeHistory })
  ), [
    closedSimulationTrade({ asset: "BTC", direction: "long", rMultiple: 1.1 }),
    closedSimulationTrade({ asset: "BTC", direction: "long", rMultiple: -0.2 }),
    closedSimulationTrade({ asset: "BTC", direction: "long", rMultiple: 1.6 }),
  ]);

  expect(context.cryptoLong.eligible).toBe(true);
  expect(context.cryptoLong.asset).toBe("BTC");
  expect(context.cryptoLong.simTrades).toBe(3);
});

test("simulation P/L risk mode converts negative stop risk into R multiple", async ({ page }) => {
  await loadRegressionHarness(page);

  const metrics = await page.evaluate(() => (
    window.__raylaRegression.calculateSimulationPositionPnL({
      asset: "BTC",
      direction: "long",
      entryPrice: 100,
      amount: 1000,
      amountMode: "dollars",
      leverage: "1x",
      plannedRisk: -50,
    }, 105)
  ));

  expect(metrics.profitLoss).toBeCloseTo(50, 4);
  expect(metrics.rMultiple).toBeCloseTo(1, 4);
});

test("Performance strategy analytics exclude broker/null-R contamination", async ({ page }) => {
  await loadRegressionHarness(page);
  const trades = [
    manualTrade({ setup: "breakout", session: "New York", result_r: 1.5 }),
    brokerTrade({ pnl_value: 300 }),
    { ...brokerTrade({ isBrokerTrade: false, source: "manual", result_r: 3 }) },
    manualTrade({ id: "manual-null", setup: "pullback", session: "London", result_r: null }),
  ];

  const report = await page.evaluate((inputTrades) => ({
    blended: window.__raylaRegression.buildPerformanceOutcomeReport(inputTrades),
    strategyOnly: window.__raylaRegression.buildPerformanceOutcomeReport(inputTrades, { excludeBrokerTrades: true }),
    coach: window.__raylaRegression.buildCoachReport(inputTrades),
    topEdges: window.__raylaRegression.buildTopEdges(inputTrades),
  }), trades);

  expect(report.blended.hasMixedUnits).toBe(true);
  expect(report.blended.hasBrokerTrades).toBe(true);
  expect(report.strategyOnly.trades).toBe(1);
  expect(report.strategyOnly.avgR).toBe(1.5);
  expect(report.coach.trades).toBe(1);
  expect(report.coach.setupStats.map((row) => row.setup)).not.toContain("Broker Import");
  expect(report.topEdges).toEqual([
    { name: "breakout × New York", trades: 1, avgR: "1.50R" },
  ]);
});

test("analytics use R values for app trades even when dollar P/L is present", async ({ page }) => {
  await loadRegressionHarness(page);
  const trades = [
    manualTrade({ id: "r-win", asset: "BTC", setup: "breakout", session: "New York", result_r: 2, pnl_value: 250 }),
    manualTrade({ id: "r-loss", asset: "BTC", setup: "breakout", session: "New York", result_r: -0.5, pnl_value: -75 }),
    manualTrade({ id: "r-flat", asset: "ETH", setup: "pullback", session: "London", result_r: 0, pnl_value: 12 }),
  ];

  const result = await page.evaluate((inputTrades) => {
    const report = window.__raylaRegression.buildPerformanceOutcomeReport(inputTrades);
    return {
      outcomeValues: inputTrades.map((trade) => window.__raylaRegression.getTradeOutcomeValue(trade)),
      trades: report.trades,
      wins: report.wins,
      losses: report.losses,
      winRate: report.winRate,
      totalR: report.totalR,
      avgR: report.avgR,
      bestAsset: report.assetStats[0],
      setup: report.setupStats.find((row) => row.setup === "breakout"),
    };
  }, trades);

  expect(result.outcomeValues).toEqual([2, -0.5, 0]);
  expect(result.trades).toBe(3);
  expect(result.wins).toBe(1);
  expect(result.losses).toBe(1);
  expect(result.winRate).toBeCloseTo(100 / 3, 5);
  expect(result.totalR).toBeCloseTo(1.5, 5);
  expect(result.avgR).toBeCloseTo(0.5, 5);
  expect(result.bestAsset).toMatchObject({ asset: "BTC", trades: 2, totalR: 1.5, avgR: 0.75 });
  expect(result.setup).toMatchObject({ setup: "breakout", trades: 2, totalR: 1.5, avgR: 0.75, winRate: 50 });
});

test("Broker Portfolio curve can activate from one live position entry and current price", async ({ page }) => {
  await loadRegressionHarness(page);
  const bars = await page.evaluate(() => (
    window.__raylaRegression.buildBrokerPositionCurveBars({
      position: {
        symbol: "ETH/USD",
        qty: 1,
        avgEntryPrice: 3000,
        currentPrice: 3090,
      },
      rawBars: [],
      entryTimeMs: Date.parse("2026-05-23T14:00:00.000Z"),
      requestedStartMs: Date.parse("2026-05-23T13:00:00.000Z"),
      nowMs: Date.parse("2026-05-23T15:00:00.000Z"),
    })
  ));

  expect(bars).toEqual([
    expect.objectContaining({
      barTime: Date.parse("2026-05-23T14:00:00.000Z"),
      close: 3000,
      source: "broker_avg_entry",
    }),
    expect.objectContaining({
      barTime: Date.parse("2026-05-23T15:00:00.000Z"),
      close: 3090,
      source: "broker_current_price",
    }),
  ]);
});

test("Broker Portfolio entry resolver matches crypto broker symbol variants", async ({ page }) => {
  await loadRegressionHarness(page);
  const entry = await page.evaluate(() => (
    window.__raylaRegression.resolveTradePortfolioEntryTime(
      { symbol: "ETH/USD" },
      [
        {
          symbol: "ETHUSD",
          side: "buy",
          qty: 1,
          status: "filled",
          filled_at: "2026-05-23T14:00:00.000Z",
        },
      ]
    )
  ));

  expect(entry).toEqual({
    timeMs: Date.parse("2026-05-23T14:00:00.000Z"),
    source: "broker_open_lot_average_fill_time",
  });
});

test("Broker order reconciliation matches crypto symbol variants", async ({ page }) => {
  await loadRegressionHarness(page);
  const result = await page.evaluate(() => {
    const submittedOrder = {
      id: "order-1",
      symbol: "ETH/USD",
      side: "buy",
      qty: "0.03125",
      status: "accepted",
    };
    const brokerOrders = [
      {
        broker_order_id: "different-id",
        symbol: "ETHUSD",
        side: "buy",
        qty: "0.03125",
        filled_qty: "0.03125",
        status: "filled",
        filled_at: "2026-05-23T14:05:00.000Z",
        submitted_at: "2026-05-23T14:00:00.000Z",
      },
    ];
    const pendingClose = window.__raylaRegression.getPendingCloseOrderForPosition(
      [
        {
          symbol: "ETHUSD",
          side: "sell",
          qty: "0.03125",
          status: "accepted",
          submitted_at: "2026-05-23T14:10:00.000Z",
        },
      ],
      { symbol: "ETH/USD", side: "long", qty: "0.03125" }
    );

    return {
      symbolsMatch: window.__raylaRegression.brokerSymbolsMatch("ETH/USD", "ETHUSD"),
      reconciled: window.__raylaRegression.findMatchingBrokerOrder(brokerOrders, submittedOrder),
      pendingClose,
    };
  });

  expect(result.symbolsMatch).toBe(true);
  expect(result.reconciled).toMatchObject({ symbol: "ETHUSD", status: "filled" });
  expect(result.pendingClose).toMatchObject({ symbol: "ETHUSD", status: "accepted" });
});

test("Broker helpers keep fractional crypto quantities and filled statuses stable", async ({ page }) => {
  await loadRegressionHarness(page);
  const result = await page.evaluate(() => ({
    tinyQty: window.__raylaRegression.formatBrokerQuantity("0.00001234567"),
    decimalQty: window.__raylaRegression.formatBrokerQuantity("1.23456789"),
    invalidQty: window.__raylaRegression.formatBrokerQuantity("not-a-number"),
    fullByFilledQty: window.__raylaRegression.getBrokerOrderStatusKind({
      symbol: "BTCUSD",
      side: "buy",
      qty: "0.00001234",
      filled_qty: "0.00001234",
      status: "accepted",
    }),
    fullByFilledAt: window.__raylaRegression.getBrokerOrderStatusPresentation({
      symbol: "ETHUSD",
      side: "buy",
      qty: "0.03125",
      filled_qty: "0.03125",
      status: "new",
      filled_at: "2026-05-23T14:05:00.000Z",
    }).label,
  }));

  expect(result.tinyQty).toBe("0.00001235");
  expect(result.decimalQty).toBe("1.234568");
  expect(result.invalidQty).toBe("--");
  expect(result.fullByFilledQty).toBe("filled");
  expect(result.fullByFilledAt).toBe("Order filled");
});

test("Broker Portfolio curve merges market bars without replacing broker entry/current truth", async ({ page }) => {
  await loadRegressionHarness(page);
  const entryMs = Date.parse("2026-05-23T14:00:00.000Z");
  const midMs = Date.parse("2026-05-23T14:30:00.000Z");
  const nowMs = Date.parse("2026-05-23T15:00:00.000Z");
  const bars = await page.evaluate(({ entryMs, midMs, nowMs }) => (
    window.__raylaRegression.buildBrokerPositionCurveBars({
      position: {
        symbol: "ETH/USD",
        qty: 1,
        avgEntryPrice: 3000,
        currentPrice: 3090,
      },
      rawBars: [
        { time: "2026-05-23T13:30:00.000Z", close: 2980 },
        { time: "2026-05-23T14:00:00.000Z", close: 3025 },
        { time: "2026-05-23T14:30:00.000Z", close: 3050 },
        { time: "2026-05-23T15:00:00.000Z", close: 3075 },
      ],
      entryTimeMs: entryMs,
      requestedStartMs: Date.parse("2026-05-23T13:00:00.000Z"),
      nowMs,
    })
  ), { entryMs, midMs, nowMs });

  expect(bars.map((bar) => bar.barTime)).toEqual([entryMs, midMs, nowMs]);
  expect(bars).toEqual([
    expect.objectContaining({ close: 3000, source: "broker_avg_entry" }),
    expect.objectContaining({ close: 3050, source: "market_bar" }),
    expect.objectContaining({ close: 3090, source: "broker_current_price" }),
  ]);
});

test("same-timestamp equity points normalize to strictly ascending chart data", async ({ page }) => {
  await loadRegressionHarness(page);
  const sameTime = "2026-05-16T10:00:00.000Z";
  const points = await page.evaluate((trades) => {
    const raw = window.__raylaRegression.buildLoggedEquityCurvePoints(trades);
    return window.__raylaRegression.normalizeChartSeriesToStrictAscending(raw);
  }, [
    manualTrade({ id: "same-1", exit_time: sameTime, result_r: 1, exit_price: 101 }),
    manualTrade({ id: "same-2", exit_time: sameTime, result_r: -0.5, exit_price: 99 }),
    manualTrade({ id: "same-3", exit_time: sameTime, result_r: 0, exit_price: 100 }),
  ]);

  expect(points).toHaveLength(3);
  for (let index = 1; index < points.length; index += 1) {
    expect(points[index].timeMs).toBeGreaterThan(points[index - 1].timeMs);
  }
});
