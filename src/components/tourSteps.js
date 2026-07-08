// Guided walkthrough step definitions for each main tab.
// tourId must match a [data-tour-id="..."] attribute in the DOM.
// If a tourId element is not found, the step is skipped automatically.

export const tourSteps = {
  home: [
    {
      tourId: "home-portfolio-value",
      title: "Portfolio Value",
      description: "This shows your total portfolio market value and unrealized P/L right now. It updates live as prices move. This is the top-line number — what your positions are worth today.",
    },
    {
      tourId: "home-chart-range",
      title: "Chart Timeframe",
      description: "Switch between 1D, 1W, 1M, 3M views to see how your portfolio has moved over different periods. Shorter ranges show recent action; longer ranges show the bigger trend.",
    },
    {
      tourId: "home-chart",
      title: "Main Chart",
      description: "The main chart shows your portfolio performance or a live price chart for any asset you tap in the carousel. Use the Portfolio / Active / Holdings buttons below to change what's displayed.",
    },
    {
      tourId: "home-carousel",
      title: "Asset Carousel",
      description: "These cards show your open positions and watchlist assets with live price and today's change percentage. Tap any card to focus the chart on that asset.",
    },
    {
      tourId: "home-pnl",
      title: "Total P/L & Return",
      description: "Your Total P/L is the dollar profit or loss across all tracked trades and positions. Total Portfolio Return shows the percentage gain or loss from your starting cost basis.",
    },
    {
      tourId: "home-holdings",
      title: "Holdings Snapshot",
      description: "A quick summary of your long-term positions — the assets you're holding as investments. Shows total holdings value, unrealized P/L, and your top position by allocation.",
    },
    {
      tourId: "home-recent",
      title: "Recent Trades",
      description: "Your last few logged trades with outcome at a glance. Keeping this list populated gives Rayla the data it needs to analyze your patterns and generate coaching insights.",
    },
    {
      tourId: "home-stats",
      title: "Account Overview Tabs",
      description: "The right panel has three tabs: Overview (P/L + holdings summary), Positions (all open broker positions), and Account Balance (cash, buying power, equity). Tap each to explore.",
    },
  ],

  trades: [
    {
      tourId: "trades-asset-search",
      title: "Search an Asset",
      description: "Type a ticker symbol (like AAPL or BTC) to search tradable assets through your connected broker. The search shows whether each asset is tradable, marginable, or shortable on your account.",
    },
    {
      tourId: "trades-direction",
      title: "Trade Direction",
      description: "Long means you're buying the asset expecting the price to go up. Short means you're selling borrowed shares expecting the price to go down. Most beginners start with Long (Buy) only.",
    },
    {
      tourId: "trades-position-size",
      title: "Position Size",
      description: "How much of the asset you want to buy or sell. You can enter a share quantity, a dollar amount, or let Rayla calculate shares based on your planned risk. Risk-based sizing keeps losses predictable.",
    },
    {
      tourId: "trades-type",
      title: "Trade Type",
      description: "Label each trade as Day Trade (in and out same day), Swing Trade (held days to weeks), or Investment (long-term hold). Rayla uses this to track strategy performance separately for each type.",
    },
    {
      tourId: "trades-exit-plan",
      title: "Stop & Target",
      description: "Set a stop loss (max loss) and profit target before you enter. These are for your reference only — they are not submitted to the broker. Knowing your exit before entry is one of the most important habits in trading.",
    },
    {
      tourId: "trades-ticket",
      title: "Order Ticket",
      description: "The full order form. Review your symbol, direction, size, and order type before submitting. The current Alpaca price and bid/ask spread are shown so you know what you're getting.",
    },
    {
      tourId: "trades-open",
      title: "Open Positions",
      description: "Your current broker positions synced from Alpaca — the assets you own right now with live unrealized P/L for each. Tap a position to pull up its live chart.",
    },
    {
      tourId: "trades-history",
      title: "Broker Trade History",
      description: "Recent orders and fills from your connected broker. This shows what was executed, when, and at what price. Use Refresh to pull the latest data from Alpaca.",
    },
  ],

  simulation: [
    {
      tourId: "sim-controls",
      title: "Trade Controls",
      description: "Set up each simulated trade here. Pick the asset, choose Long or Short, and size the position. This panel mirrors the real Trade tab so reps build the same muscle memory.",
    },
    {
      tourId: "sim-risk",
      title: "Risk Inputs",
      description: "Define your stop and target before you enter — never after. The stop is where the trade is wrong; the target is where you get paid. Rayla scores the R multiple from these two numbers.",
    },
    {
      tourId: "sim-stats",
      title: "Simulator Stats",
      description: "Live and Scenario P/L tracked separately, plus win rate and average R. Watch R multiple over time, not just dollar swings — that is the signal a strategy actually has edge.",
    },
    {
      tourId: "sim-chart",
      title: "Chart & Controls",
      description: "The price chart and its controls — timeframe, pause/play, candles vs. line. In Scenario mode, use Play to advance the market bar-by-bar so you can practice reading price as it develops.",
    },
    {
      tourId: "sim-history",
      title: "Trade History",
      description: "Every simulation trade you've closed, searchable by asset, direction, or close reason. Build a sample size here — patterns in your simulation history feed Rayla's coaching and Intel picks.",
    },
  ],

  performancePortfolio: [
    {
      tourId: "perf-filters",
      title: "Data Source & View Selector",
      description: "Toggle between Live Trades (real broker data) and Live Simulation (practice trades). The Position Intent dropdown switches this panel between Portfolio, Long-Term Holdings, and Day Trades views.",
    },
    {
      tourId: "perf-portfolio-chart",
      title: "Portfolio Trend Chart",
      description: "Shows how your total portfolio value has moved over time based on your live broker positions. Switch the time range to zoom into recent action or see the full trend since you started.",
    },
    {
      tourId: "perf-portfolio-stats",
      title: "Account Snapshot",
      description: "Three quick numbers: available cash, today's realized P/L from closed trades, and your total open position count — all pulling live from your connected broker.",
    },
    {
      tourId: "perf-portfolio-allocation",
      title: "Allocation Breakdown",
      description: "How your portfolio is split across each asset as a percentage. A bar that takes up most of the width means that position dominates your portfolio — concentration risk worth watching.",
    },
    {
      tourId: "perf-portfolio-positions",
      title: "Open Positions",
      description: "Every asset you currently hold, with your average entry price, current market value, and unrealized P/L. Green means you're up on that position; red means you're down.",
    },
    {
      tourId: "perf-panel",
      title: "Explore Other Views",
      description: "Use the Position Intent dropdown at the top to switch to Day Trades for trade-by-trade analytics and Rayla's AI coaching, or Long-Term Holdings to review your investment positions separately.",
    },
  ],

  performanceDayTrades: [
    {
      tourId: "perf-filters",
      title: "Data Source & View Selector",
      description: "You're viewing Day Trades — this shows performance for your day-trade and swing-trade activity. Switch the Source tab to Live Simulation to review practice trades instead.",
    },
    {
      tourId: "perf-daytrades-hero",
      title: "Day Trades Overview",
      description: "The headline card shows your current open day-trade value or total realized P/L from closed trades, plus a performance chart built from broker snapshots collected over time.",
    },
    {
      tourId: "perf-daytrades-equity",
      title: "Equity Curve",
      description: "Your running P/L line across all closed day and swing trades. An upward slope means your strategy is working. A flat or downward curve is a signal to review what's not clicking.",
    },
    {
      tourId: "perf-daytrades-closed-stats",
      title: "Win Rate & Realized P/L",
      description: "Total realized profit or loss, number of closed trades, and your win rate across all day and swing trades logged in this view. Win rate above 50% with a positive P/L is the goal.",
    },
    {
      tourId: "perf-daytrades-open-positions",
      title: "Open Day Trade Positions",
      description: "Your currently open day-trade and swing-trade positions from the broker, with unrealized P/L for each. These update live as prices move.",
    },
    {
      tourId: "perf-daytrades-history",
      title: "Closed Trade History",
      description: "Every closed day and swing trade from your broker, with entry price, exit price, date, and P/L. This is the raw record Rayla uses to calculate win rate and spot patterns.",
    },
    {
      tourId: "perf-daytrades-ai",
      title: "Rayla's Day Trade Analysis",
      description: "AI-generated coaching based on your actual closed trade history. Strongest edge, weakest pattern, and a next-step recommendation. Hit Run AI Analysis to refresh after new trades close.",
    },
  ],

  performanceHoldings: [
    {
      tourId: "perf-filters",
      title: "Data Source & View Selector",
      description: "You're viewing Long-Term Holdings — broker positions classified as investments. Use the Source tab to switch data sets, or the Position Intent dropdown to jump to Portfolio or Day Trades.",
    },
    {
      tourId: "perf-holdings-hero",
      title: "Holdings Overview",
      description: "The headline card shows your total long-term holdings value and a performance chart built from broker snapshots. The trend line shows how this subset of positions has performed over time.",
    },
    {
      tourId: "perf-holdings-stats",
      title: "Holdings Summary",
      description: "Three key numbers: total holdings value, unrealized P/L in dollars, and unrealized return as a percentage. These reflect only positions you've classified as investments or long-term holds.",
    },
    {
      tourId: "perf-holdings-allocation",
      title: "Allocation by Asset",
      description: "How your long-term holdings are split across each position. A wide bar means that asset makes up a large slice of your investment portfolio — useful for spotting over-concentration.",
    },
    {
      tourId: "perf-holdings-list",
      title: "Holdings List",
      description: "Every investment position with your entry price, current market value, and unrealized P/L. Green is up, red is down. Tap any position in Live Trades to reclassify it if needed.",
    },
    {
      tourId: "perf-panel",
      title: "Explore Other Views",
      description: "Switch the Position Intent dropdown to Portfolio for a full broker overview, or Day Trades to see your active trading performance and Rayla's AI coaching on your strategy.",
    },
  ],

  journal: [
    {
      tourId: "journal-source",
      title: "Live Trades vs Simulation",
      description: "Toggle between Live Trades (real broker activity you've logged) and Live Simulation (practice trades). Both give you a full trade-by-trade record with P/L, setup tags, and session data.",
    },
    {
      tourId: "journal-stats",
      title: "Performance Summary",
      description: "Your headline stats across all logged trades: win rate, total P/L, average per trade, average winner, average loser, and profit factor. These numbers update dynamically as you apply filters.",
    },
    {
      tourId: "journal-breakdown",
      title: "Strategy & Session Breakdown",
      description: "Your P/L and win rate broken down by setup strategy and trading session. This is where patterns show up — which setups and time-of-day are consistently profitable and which ones are costing you.",
    },
    {
      tourId: "journal-trades",
      title: "Trade History",
      description: "Your complete trade log. Tap any trade card to expand it for a full review — entry, exit, P/L, duration, and a reflection space for notes on what went well and what to improve.",
    },
    {
      tourId: "journal-filters",
      title: "Search & Filter",
      description: "Search by asset, strategy, or session. Filter by direction (long/short), result (win/loss/breakeven), or specific setup. Toggle newest or oldest first to spot timing patterns in your log.",
    },
  ],

  intel: [
    {
      tourId: "intel-ask-rayla",
      title: "Ask Rayla",
      description: "Tap here to ask Rayla why an asset is ranked hot or cold, what the news means, or whether it fits your current strategy. Rayla gives context in plain language based on your trading history.",
    },
    {
      tourId: "intel-picks",
      title: "Rayla's Picks",
      description: "Personalized trade ideas based on how your real trades and simulations have actually performed. Hot picks (red dot) are gaining momentum. Cold picks (blue dot) are losing it. These are calibrated to your patterns.",
    },
    {
      tourId: "intel-hot-stocks",
      title: "Hottest Stocks",
      description: "Today's top-gaining stocks and ETFs ranked by momentum. These are the assets with the strongest upside movement right now. Tap any card to pull up details or try it in Simulation.",
    },
    {
      tourId: "intel-cold-stocks",
      title: "Coldest Stocks",
      description: "Today's weakest stocks and ETFs — the assets losing the most ground. Cold stocks can be short setups for experienced traders, or simply assets to avoid until momentum shifts.",
    },
    {
      tourId: "intel-hot-crypto",
      title: "Hottest Crypto",
      description: "The crypto asset with the strongest upside momentum today. Crypto moves faster than stocks — use Simulation to practice before trading it live.",
    },
    {
      tourId: "intel-cold-crypto",
      title: "Coldest Crypto",
      description: "The crypto asset losing the most ground today. Useful context even if you're not trading it — crypto sentiment often reflects broader risk appetite in the market.",
    },
    {
      tourId: "intel-hot-cold",
      title: "Full Hot/Cold Grid",
      description: "Rayla's daily ranked list of the strongest and weakest stocks and crypto. Tap any asset card to see more detail or try it in a Simulation rep. This list refreshes daily.",
    },
  ],
};
