import { useEffect, useMemo, useState } from "react";
import "./App.css";
import Login from "./Login";
import { supabase } from "./supabase";
import { LayoutDashboard, PlusSquare, Receipt, Brain, User } from "lucide-react";

const statCards = [
  { title: "Best Edge", value: "Breakout × New York", subtext: "+0.83R avg", tone: "accent" },
  { title: "Weak Edge", value: "No clear weak edge", subtext: "Need more data", tone: "neutral" },
  { title: "Win Rate", value: "0%", subtext: "Recent closed trades", tone: "neutral" },
  { title: "Avg R", value: "0R", subtext: "Average result per trade", tone: "accent" },
];



const marketSeeds = [
  {
    id: "BTC",
    label: "Bitcoin",
    tvSymbol: "BINANCE:BTCUSDT",
    fallbackPrice: "64,210",
    fallbackChange: "+1.2%",
  },
  {
    id: "ETH",
    label: "Ethereum",
    tvSymbol: "BINANCE:ETHUSDT",
    fallbackPrice: "3,120",
    fallbackChange: "+0.9%",
  },
  {
    id: "SPY",
    label: "SPDR S&P 500 ETF",
    tvSymbol: "AMEX:SPY",
    fallbackPrice: "521.14",
    fallbackChange: "-0.4%",
  },
  {
    id: "NVDA",
    label: "NVIDIA",
    tvSymbol: "NASDAQ:NVDA",
    fallbackPrice: "908.55",
    fallbackChange: "+3.2%",
  },
  {
    id: "AAPL",
    label: "Apple",
    tvSymbol: "NASDAQ:AAPL",
    fallbackPrice: "212.44",
    fallbackChange: "-0.4%",
  },
];

const fallbackEquity = [100, 101.5, 100.7, 102.1, 103.4, 102.8, 104.6, 105.2];


const SETUP_OPTIONS = [
  "rejection",
  "breakout",
  "pullback",
  "reversal",
  "range",
];

const SESSION_OPTIONS = [
  "Asia",
  "London",
  "New York",
  "After Hours",
];

const MISTAKE_OPTIONS = [
  "none",
  "moved_stop",
  "fomo_entry",
  "early_exit",
  "oversized",
  "revenge_trade",
];


function Card({ title, children, className = "" }) {
  return (
    <section className={`card ${className}`}>
      <div className="cardHeader">
        <h2>{title}</h2>
      </div>
      <div className="cardBody">{children}</div>
    </section>
  );
}

function StatCard({ title, value, subtext, tone }) {
  return (
    <Card title={title} className={`statCard ${tone === "accent" ? "statAccent" : ""}`}>
      <div className="statValue">{value}</div>
      <div className="statSubtext">{subtext}</div>
    </Card>
  );
}

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatCompactPrice(value) {
  if (value == null || Number.isNaN(value)) return "--";
  return formatNumber(value, 2);
}

function formatPctChange(value) {
  if (value == null || Number.isNaN(value)) return "--";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function buildSvgLinePoints(data) {
  const max = Math.max(...data);
  const min = Math.min(...data);

  return data
    .map((value, index) => {
      const x = (index / (data.length - 1 || 1)) * 100;
      const y = 88 - ((value - min) / (max - min || 1)) * 68;
      return `${x},${y}`;
    })
    .join(" ");
}

function TickerBar({ items, onRemove }) {
  return (
    <div className="tickerBar">
      {items.map((item) => (
        <div className="tickerItem" key={item.id}>
          <span className="tickerSymbol">{item.id}</span>

          <span className="tickerPrice">
            {item.priceText}
          </span>

          <span className={`tickerChange ${item.changeValue < 0 ? "negative" : "positive"}`}>
            {item.changeText}
          </span>

          <button
            className="tickerRemove"
            onClick={() => onRemove(item.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function EquityCurveCard({ equitySeries, sourceLabel, chartRange, setChartRange }) {
  const points = useMemo(() => buildSvgLinePoints(equitySeries), [equitySeries]);
  const areaPoints = `0,100 ${points} 100,100`;

  const startValue = equitySeries[0];
  const currentValue = equitySeries[equitySeries.length - 1];
  const netValue = currentValue - startValue;
  const netText = `${netValue >= 0 ? "+" : ""}${netValue.toFixed(2)}R`;

  return (
    <Card title="Equity Curve" className="equityCard">
      
      <div className="chartTabs">
        {["1D", "1W", "1M", "3M", "ALL"].map((range) => (
          <button
            key={range}
            className={`chartTab ${chartRange === range ? "active" : ""}`}
            onClick={() => setChartRange(range)}
            type="button"
          >
            {range}
          </button>
        ))}
      </div>
      <div className="equityMeta">
        <div>
          <span>Start</span>
          <strong>{startValue.toFixed(1)}</strong>
        </div>
        <div>
          <span>Current</span>
          <strong>{currentValue.toFixed(1)}</strong>
        </div>
        <div>
          <span>Net</span>
          <strong>{netText}</strong>
        </div>
      </div>

      <div className="equityChart">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points={areaPoints} className="equityArea" />
          <polyline points={points} />
        </svg>
      </div>

      <div className="equityFooter">
        <div className="equityFooterLabel">{sourceLabel}</div>
      </div>
    </Card>
  );
}

function TodayPlanCard({ aiAnalysis, onRunAnalysis }) {
  return (
    <Card title="Today's Plan" className="todayCard">
      <div className="planGrid">
        <div className="planItem">
          <span>Focus Setup</span>
          <strong>Breakout</strong>
        </div>
        <div className="planItem">
          <span>Focus Session</span>
          <strong>New York</strong>
        </div>
        <div className="planItem">
          <span>Avoid Mistake</span>
          <strong>moved_stop</strong>
        </div>
        <div className="planItem">
          <span>Confidence</span>
          <strong>LOW</strong>
        </div>
      </div>

      <div className="coachNote">{aiAnalysis}</div>

      <button className="ghostButton" type="button" onClick={onRunAnalysis}>
        Run AI Analysis
      </button>
    </Card>
  );
}

function TopEdgesCard({ topEdges }) {
  return (
    <Card title="Top Edges">
      <div className="list">
        {topEdges.map((edge, index) => (
          <div className="listRow" key={edge.name}>
            <div>
              <div className="listTitle">
                {index + 1}. {edge.name}
              </div>

              <div className="listSubtext">{edge.trades} trades</div>
            </div>

            <div className="pill">{edge.avgR}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RecentTradesCard({ recentTrades, onDeleteTrade }) {
  return (
    <Card title="Recent Trades">
      <div className="listSubtext" style={{ marginBottom: "8px" }}>
        {recentTrades.length} trades logged
      </div>
      <div className="list">
        {recentTrades.length === 0 ? (
          <div className="listSubtext">
            No trades yet — log your first trade to start tracking.
          </div>
        ) : (
          recentTrades.map((trade) => (
          <div className="listRow" key={trade.id}>
            <div>
              <div className="listSubtext">
                Market: —
              </div>
              <div className="listTitle">
                <span className="assetText">{trade.asset}</span> {trade.setup ? `· ${trade.setup}` : ""}
              </div>

              <div className="listSubtext">
                Entry: ${trade.entry_price ? Number(trade.entry_price).toFixed(2) : "-"} · 
                Size: ${trade.entry_size ? Number(trade.entry_size).toFixed(0) : "-"} · 
                {trade.entry_time
                  ? (() => {
                      const [date, time] = trade.entry_time.split("T");
                      const [year, month, day] = date.split("-");
                      let [hour, minute] = time.split(":");

                      const ampm = hour >= 12 ? "PM" : "AM";
                      hour = hour % 12 || 12;

                      return `${month}/${day}/${year}, ${hour}:${minute} ${ampm}`;
                    })()
                  : "-"}
              </div>
            </div>

            <div
              className={`tradeResult ${
                trade.result_r < 0
                  ? "negative"
                  : trade.result_r > 0
                  ? "positive"
                  : "neutral"
              }`}
            >
              {trade.result_r !== null && trade.result_r !== undefined
              ? `${trade.result_r > 0 ? "+" : ""}${Number(trade.result_r).toFixed(1)}R`
              : "-"}
            </div>

            <div className="listSubtext">
              {trade.coachTag || "Disciplined"}
            </div>

            <button
              type="button"
              className="deleteTradeButton"
              onClick={() => onDeleteTrade(trade.id)}
            >
              Delete
            </button>
          </div>
          ))
        )}
      </div>
    </Card>
  );
}

function MarketCard({ items, selectedId, onSelect, onRemove, newSymbol, setNewSymbol, onAddSymbol }) {
  const selectedItem = items.find((item) => item.id === selectedId) || items[0];

  const iframeSrc = selectedItem
    ? `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(
        selectedItem.tvSymbol
      )}&interval=15&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&hideideas=1&studies=%5B%5D`
    : "";

  return (
    <div id="dashboard">
      <Card title="Live Market" className="marketCard">
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
          <input
            type="text"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            placeholder="Add symbol (AAPL or NASDAQ:AAPL)"
            className="authInput"
          />
          <button type="button" onClick={onAddSymbol} className="ghostButton">
            Add
          </button>
        </div>

        <div className="marketLayout">
          <div className="marketWatchlist">
            {items.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`marketWatchRow ${item.id === selectedId ? "active" : ""}`}
                onClick={() => onSelect(item.id)}
              >
                <div className="marketWatchLeft">
                  <div className="marketWatchLabel">{item.priceText}</div>
                  <div className="marketWatchSymbol">{item.id}</div>
                </div>

                <div className="marketWatchRight">
                  <div className={`marketWatchChange ${item.changeValue < 0 ? "negative" : "positive"}`}>
                    {item.changeText}
                  </div>

                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item.id);
                    }}
                    style={{ marginLeft: "8px", cursor: "pointer", fontWeight: "700", fontSize: "16px" }}
                  >
                    ×
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="tradingviewFrameWrap">
            {selectedItem ? (
              <iframe
                key={selectedItem.tvSymbol}
                title={`${selectedItem.id} chart`}
                className="tradingviewFrame"
                src={iframeSrc}
              />
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function App() {
  const [selectedMarketId, setSelectedMarketId] = useState("BTC");

  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem("rayla-watchlist");
    return saved ? JSON.parse(saved) : marketSeeds;
  });

  const [activeTab, setActiveTab] = useState("home");
  const [newSymbol, setNewSymbol] = useState("");
  const [screenshotResult, setScreenshotResult] = useState(null);
  const [user, setUser] = useState(null);
  const [chartRange, setChartRange] = useState("ALL");
  const [showTradeEntry, setShowTradeEntry] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [session, setSession] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState("No analysis run yet.");
  const [equitySourceLabel, setEquitySourceLabel] = useState(
    "No trades yet. Add your first trade."
  );
  const [trades, setTrades] = useState([]);

  

  const [raylaUserCount, setRaylaUserCount] = useState(0);
  
const getAIFeedback = () => {
  if (!trades || trades.length === 0) {
    return "No trades yet. Start logging so I can coach you.";
  }

  const wins = trades.filter(t => t.result_r > 0);

const bestSetup = Object.entries(
  trades.reduce((acc, t) => {
    if (!t.setup) return acc;

    if (!acc[t.setup]) {
      acc[t.setup] = { total: 0, count: 0 };
    }

    acc[t.setup].total += t.result_r;
    acc[t.setup].count += 1;

    return acc;
  }, {})
)
.filter(([_, data]) => data.count >= 2)
.map(([setup, data]) => [setup, data.total / data.count])
.sort((a, b) => b[1] - a[1])[0];

  const losses = trades.filter(t => t.result_r <= 0);

  const winRate = wins.length / trades.length;

  const avgWin =
    wins.length > 0
      ? wins.reduce((sum, t) => sum + t.result_r, 0) / wins.length
      : 0;

  const avgLoss =
    losses.length > 0
      ? Math.abs(losses.reduce((sum, t) => sum + t.result_r, 0) / losses.length)
      : 0;

  // Core diagnosis
  let diagnosis = "";
  if (avgLoss > avgWin) {
    diagnosis = "You're letting losers run bigger than winners.";
  } else if (winRate < 0.4) {
    diagnosis = "Your win rate is low — entries need work.";
  } else {
    diagnosis = "Your core performance is solid.";
  }
  if (trades.length >= 5 && winRate < 0.5) {
  diagnosis += " You may be overtrading or forcing setups.";
}

  // Actionable fix
  let action = "";
  if (avgLoss > avgWin) {
    action = "Cut losers faster. Define your stop before entry and respect it.";
  } else if (winRate < 0.4) {
    action = "Be more selective. Only take your A+ setups.";
  } else {
    action = "Keep executing the same setups consistently.";
  }

    return `${diagnosis} ${action} ${bestSetup ? `Double down on ${bestSetup[0]} — that’s where your edge is forming.` : "You need at least 2 trades in the same setup before I can identify a real edge."} Market idea: Watch ${trades[0]?.asset || "your main asset"} — look for ${bestSetup ? bestSetup[0] : "high-quality"} setups based on momentum.`;
    };

  const [tradeForm, setTradeForm] = useState({
    asset: "",
    entryPrice: "",
    size: "",
    entryTime: "",
    setup: "",
    session: "",
    result: "",
    exitPrice: "",
    exitTime: "",
  });

  useEffect(() => {
  supabase.auth.getSession().then(({ data }) => {
    setSession(data.session);
  });

  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
  });

  return () => {
    listener.subscription.unsubscribe();
  };
}, []);


  useEffect(() => {
    fetchRaylaUserCount();
  }, []);

  useEffect(() => {
    if (user) {
      setDisplayName(user.user_metadata?.display_name || user.email?.split("@")[0] || "");
    }
  }, [user]);

  useEffect(() => {

  async function loadUserAndTrades() {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.error(error);
      return;
    }

    const currentUser = data.user;
    setUser(currentUser);

    if (!currentUser) return;

    const { data: tradesData, error: tradesError } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (tradesError) {
      console.error(tradesError);
      return;
    }

    setTrades(tradesData);
    setEquitySourceLabel("Equity based on logged trades");
  }

  loadUserAndTrades();
}, []);

  const recentTrades = trades.slice(0, 5);

  const topEdges = Object.values(
    trades.reduce((acc, trade) => {
      const key = `${trade.setup} × ${trade.session}`;

      if (!acc[key]) {
        acc[key] = { name: key, trades: 0, totalR: 0 };
      }

      acc[key].trades += 1;
      acc[key].totalR += parseFloat(trade.result_r || 0);

      return acc;
    }, {})
  )
    .map((edge) => ({
      name: edge.name,
      trades: edge.trades,
      avgR: (edge.totalR / edge.trades).toFixed(2) + "R",
    }))
    .sort((a, b) => parseFloat(b.avgR) - parseFloat(a.avgR))
    .slice(0, 3);

  const winRate =
    trades.length === 0
      ? "0%"
      : `${(
          (trades.filter((t) => parseFloat(t.result) > 0).length /
            trades.length) *
          100
        ).toFixed(1)}%`;

  const avgR =
    trades.length === 0
      ? "0R"
      : (
          trades.reduce((sum, t) => sum + parseFloat(t.result || 0), 0) /
          trades.length
        ).toFixed(2) + "R";

  const totalR = trades.length
    ? trades.reduce((sum, t) => sum + parseFloat(t.result_r || 0), 0).toFixed(2)
    : "0.00";

  const equitySeries = trades.length
    ? trades.map(
        (_, i) =>
          100 +
          trades
            .slice(0, i + 1)
            .reduce((sum, x) => sum + parseFloat(x.result_r || 0), 0)
      )
    : fallbackEquity;

  const filteredEquitySeries =
    chartRange === "1D"
      ? equitySeries.slice(-5)
      : chartRange === "1W"
      ? equitySeries.slice(-10)
      : chartRange === "1M"
      ? equitySeries.slice(-20)
      : chartRange === "3M"
      ? equitySeries.slice(-40)
      : equitySeries;



async function handleAddTrade(e) {
  e.preventDefault();

  if (!user) {
    alert("No user loaded");
    return;
  }

  if (
    !tradeForm.asset ||
    !tradeForm.entryPrice ||
    !tradeForm.size ||
    !tradeForm.entryTime ||
    !tradeForm.result
  ) {
    alert("Fill out required fields");
    return;
  }

  const newTrade = {
    user_id: user.id,
    asset: tradeForm.asset,
    entry_price: parseFloat(tradeForm.entryPrice),
    entry_size: parseFloat(tradeForm.size),
    entry_time: tradeForm.entryTime,
    setup: tradeForm.setup,
    session: tradeForm.session,
    status: "open",
    source: "manual",
    result_r: parseFloat(tradeForm.result),
  };

  const { data, error } = await supabase
    .from("trades")
    .insert([newTrade])
    .select()
    .single();

  if (error) {
    console.error("SAVE ERROR:", error);
    alert("Failed to save trade");
    return;
  }

  setTrades((prev) => [data, ...prev]);

  setTradeForm({
    asset: "",
    entryPrice: "",
    size: "",
    entryTime: "",
    setup: "",
    session: "",
    result: "",
    exitPrice: "",
    exitTime: "",
  });

  setShowTradeEntry(false);
}

async function handleDeleteTrade(tradeId) {
  if (!tradeId) return;

  const confirmed = window.confirm("Delete this trade?");
  if (!confirmed) return;

  const { error } = await supabase
    .from("trades")
    .delete()
    .eq("id", tradeId);

  if (error) {
    console.error("DELETE ERROR:", error);
    alert("Could not delete trade: " + error.message);
    return;
  }

  setTrades((prev) => prev.filter((trade) => trade.id !== tradeId));
}

function handleTagTrade(index, tag) {
  const updated = [...trades];
  const tradeIndex = trades.length - 1 - index;

  updated[tradeIndex] = {
    ...updated[tradeIndex],
    coachTag: tag,
  };

  setTrades(updated);
}

function runAIAnalysis() {
  if (trades.length === 0) {
    setAiAnalysis("No trades to analyze yet.");
    return;
  }

  const wins = trades.filter(t => parseFloat(t.result_r) > 0).length;
  const winRate = ((wins / trades.length) * 100).toFixed(1);

  const avgR = (
    trades.reduce((sum, t) => sum + parseFloat(t.result_r || 0), 0) /
    trades.length
  ).toFixed(2);

    let coachFeedback = "";

  if (parseFloat(avgR) < 0) {
    coachFeedback = "You are currently losing money. Tighten execution and stop forcing trades.";
  } else if (parseFloat(winRate) >= 60 && parseFloat(avgR) >= 1) {
    coachFeedback = "Strong performance. You are winning often and extracting solid value from your winners.";
  } else if (parseFloat(winRate) >= 60 && parseFloat(avgR) < 1) {
    coachFeedback = "Your win rate is strong, but your average R is light. You may be cutting winners too early.";
  } else if (parseFloat(winRate) < 50 && parseFloat(avgR) >= 1) {
    coachFeedback = "Your expectancy may still be workable, but your accuracy is low. Focus on cleaner setups.";
  } else {
    coachFeedback = "The sample is still developing. Stay disciplined and keep logging clean trades.";
  }

  setAiAnalysis(
    `Win Rate: ${winRate}% · Avg R: ${avgR}R · Trades: ${trades.length}\nCoach Feedback: ${coachFeedback}`
  );
}

async function handleScreenshotUpload(e) {
  const file = e.target.files?.[0];
  if (!file || !user) return;

  const fileExt = file.name.split(".").pop();
  const fileName = `${user.id}-${Date.now()}.${fileExt}`;
  const filePath = fileName;

  const { error: uploadError } = await supabase.storage
    .from("trade-screenshots")
    .upload(filePath, file);

  if (uploadError) {
    alert("Screenshot upload failed.");
    return;
  }

  const { data } = supabase.storage
    .from("trade-screenshots")
    .getPublicUrl(filePath);

  setScreenshotResult({
    screenshot_url: data.publicUrl,
    asset: "",
    setup: "",
    session: "",
    result_r: 0,
  });

  console.log("Screenshot URL:", data.publicUrl);
  alert("Screenshot uploaded.");

  setShowTradeEntry(false);
}


async function fetchRaylaUserCount() {
  const { data, error } = await supabase
    .from("trades")
    .select("user_id");

  if (error) {
    console.error("Failed to fetch user count:", error);
    return;
  }

  const uniqueUsers = new Set(
    (data || [])
      .map((row) => row.user_id)
      .filter(Boolean)
  );

  setRaylaUserCount(uniqueUsers.size);
}

async function handleLogTradeFromScreenshot() {
  if (!screenshotResult || !user) return;

  const { data: newTrade, error } = await supabase
    .from("trades")
    .insert([
      {
        user_id: user.id,
        asset: screenshotResult.asset || "Screenshot",
        setup: screenshotResult.setup || "screenshot",
        session: screenshotResult.session || "upload",
        result_r: screenshotResult.result_r || 0,
        screenshot_url: screenshotResult.screenshot_url,
      },
    ])
    .select()
    .single();

  if (error) {
    alert("Trade row failed: " + error.message);
    return;
  }

  setTrades((prev) => [newTrade, ...prev]);
  setScreenshotResult(null);
  alert("Trade created.");
}

  function handleAddSymbol() {
    const raw = newSymbol.trim();
    if (!raw) return;

    const isTradingViewFormat = raw.includes(":");
    const id = isTradingViewFormat ? raw.split(":").pop().toUpperCase() : raw.toUpperCase();
    const tvSymbol = isTradingViewFormat ? raw.toUpperCase() : `NASDAQ:${raw.toUpperCase()}`;

    const alreadyExists = watchlist.some((item) => item.tvSymbol === tvSymbol || item.id === id);

    if (alreadyExists) {
      alert("That symbol is already in the watchlist.");
      return;
    }

    const newItem = {
      id,
      label: id,
      tvSymbol,
      fallbackPrice: "0.00",
      fallbackChange: "0.0%",
    };

    setWatchlist((prev) => [...prev, newItem]);
    setSelectedMarketId(id);
    setNewSymbol("");
  }

  function handleRemoveSymbol(id) {
    const remaining = watchlist.filter((item) => item.id !== id);
    setWatchlist(remaining);

    if (selectedMarketId === id) {
      setSelectedMarketId(remaining[0]?.id || "");
    }
  }

  const marketItems = watchlist.map((item) => {
    const fallbackPrice = Number(String(item.fallbackPrice).replace(/,/g, ""));
    const fallbackChange = Number(String(item.fallbackChange).replace("%", ""));

    return {
      ...item,
      priceValue: fallbackPrice,
      changeValue: fallbackChange,
      priceText: formatCompactPrice(fallbackPrice),
      changeText: formatPctChange(fallbackChange),
    };
  });

  if (!session) {
    return <Login onLogin={() => window.location.reload()} />;
  }

return (
  <div className="appShell">
    <div className="topbar">
      <div>
        <p className="eyebrow">Rayla</p>

        {user?.email === "davis.tovey@gmail.com" && (
          <div style={{ fontSize: "12px", opacity: 0.7 }}>
            Users: {raylaUserCount}
          </div>
        )}

        <div className={`portfolioValue ${parseFloat(totalR) >= 0 ? "positive" : "negative"}`}>
          {parseFloat(totalR) >= 0 ? "+" : ""}
          {totalR}R
        </div>

        <p className="subheading">Total Performance</p>
      </div>

      <button
        className="ghostButton"
        type="button"
        onClick={() => setShowTradeEntry(!showTradeEntry)}
      >
        {showTradeEntry ? "Close Trade Entry" : "+ Log Trade"}
      </button>

      {showTradeEntry && (
        <div className="card">
          <h3>Log Trade</h3>
          <form onSubmit={handleAddTrade} className="tradeEntryRow">

            <input
              className="authInput"
              placeholder="Asset (BTC, AAPL)"
              value={tradeForm.asset}
              onChange={(e) => setTradeForm({ ...tradeForm, asset: e.target.value })}
            />

            <input
              className="authInput"
              placeholder="Entry Price"
              value={tradeForm.entryPrice}
              onChange={(e) => setTradeForm({ ...tradeForm, entryPrice: e.target.value })}
            />

            <input
              className="authInput"
              placeholder="Size ($)"
              value={tradeForm.size}
              onChange={(e) => setTradeForm({ ...tradeForm, size: e.target.value })}
            />

            <input
              className="authInput"
              type="datetime-local"
              value={tradeForm.entryTime}
              onChange={(e) => setTradeForm({ ...tradeForm, entryTime: e.target.value })}
            />

            <select
              className="authInput"
              value={tradeForm.setup}
              onChange={(e) => setTradeForm({ ...tradeForm, setup: e.target.value })}
            >
              <option value="">Select Setup</option>
              {SETUP_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              className="authInput"
              value={tradeForm.session}
              onChange={(e) => setTradeForm({ ...tradeForm, session: e.target.value })}
            >
              <option value="">Select Session</option>
              {SESSION_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <input
              className="authInput"
              placeholder="Result (R)"
              value={tradeForm.result}
              onChange={(e) => setTradeForm({ ...tradeForm, result: e.target.value })}
            />

            <button type="submit" className="ghostButton">
              Save Trade
            </button>

          </form>
        </div>
      )}
    </div>

    

    {filteredEquitySeries.length < 2 ? (
      <div className="card">
        <div className="cardTitle">Equity Curve</div>
        <div className="listSubtext">
          Log at least 2 trades to see your equity curve.
        </div>
      </div>
    ) : null}

      {user?.email === "davis.tovey@gmail.com" && screenshotResult && (
      <div className="screenshotCard">
        <h3>Screenshot Uploaded</h3>

        <img
          src={screenshotResult.screenshot_url}
          alt="Trade screenshot"
          style={{ maxWidth: "100%", borderRadius: "12px", marginBottom: "12px" }}
        />

        <button
          type="button"
          onClick={() => setScreenshotResult(null)}
        >
          Clear
        </button>
      </div>
    )}

    {activeTab === "home" && (
      <>
        <div className="statsGrid">
          {statCards.map((card) => (
            <StatCard
              key={card.title}
              title={card.title}
              value={card.value}
              subtext={card.subtext}
              tone={card.tone}
            />
          ))}
        </div>

        <div className="mainGrid">

          <div className="span6">
            <EquityCurveCard
              equitySeries={filteredEquitySeries}
              sourceLabel={equitySourceLabel}
              chartRange={chartRange}
              setChartRange={setChartRange}
            />
          </div>

          <div className="span6">
            <MarketCard
              items={marketItems}
              selectedId={selectedMarketId}
              onSelect={setSelectedMarketId}
              onRemove={handleRemoveSymbol}
              newSymbol={newSymbol}
              setNewSymbol={setNewSymbol}
              onAddSymbol={handleAddSymbol}
            />
          </div>

          <div className="span4">
            <div id="trades">
              <RecentTradesCard
                recentTrades={recentTrades}
                onDeleteTrade={handleDeleteTrade}
              />
            </div>
          </div>

          <div className="span4">
            <div id="ai">
              <TodayPlanCard
                aiAnalysis={aiAnalysis}
                onRunAnalysis={runAIAnalysis}
              />
            </div>
          </div>

          <div className="span4">
            <TopEdgesCard topEdges={topEdges} />
          </div>

          <div className="span12">
            <div id="profile" className="card profileCard">
              <h3>Profile</h3>

              <div className="list">
                <div className="listRow">
                  <div>
                    <input
                      className="authInput"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                    <div className="listSubtext">
                      {user?.email || "No email found"}
                    </div>
                  </div>
                </div>

                <div className="listRow">
                  <div>
                    <div className="listTitle">Trades Logged</div>
                    <div className="listSubtext">{trades.length}</div>
                  </div>
                </div>

                <button
                  className="ghostButton"
                  type="button"
                  onClick={async () => {
                    const { error } = await supabase.auth.updateUser({
                      data: { display_name: displayName },
                    });

                    if (error) {
                      alert("Could not save name.");
                      return;
                    }

                    alert("Name updated.");
                    window.location.reload();
                  }}
                >
                  Save Name
                </button>

                <div className="listRow">
                  <div>
                    <div className="listTitle">Win Rate</div>
                    <div className="listSubtext">{winRate}</div>
                  </div>
                </div>

                <div className="listRow">
                  <div>
                    <div className="listTitle">Average R</div>
                    <div className="listSubtext">{avgR}</div>
                  </div>
                </div>

                <button
                  className="ghostButton"
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.reload();
                  }}
                  >
                  Sign Out
                </button>
              </div>
            </div>
          </div>

        </div>
      </>
    )}
  
    {activeTab === "market" && (
      <div className="mainGrid">
        <div className="span12">
          <MarketCard
            items={marketItems}
            selectedId={selectedMarketId}
            onSelect={setSelectedMarketId}
            onRemove={handleRemoveSymbol}
            newSymbol={newSymbol}
            setNewSymbol={setNewSymbol}
            onAddSymbol={handleAddSymbol}
          />
        </div>
      </div>
    )}

    {activeTab === "trades" && (
      <div className="mainGrid">
        <div className="span12">
          <div id="trades">
            <RecentTradesCard
              recentTrades={recentTrades}
              onDeleteTrade={handleDeleteTrade}
            />
          </div>
        </div>
      </div>
    )}

    {activeTab === "ai" && (
      <div className="mainGrid">
        <div className="span12">
          <div id="ai">
            <TodayPlanCard
              aiAnalysis={aiAnalysis}
              onRunAnalysis={runAIAnalysis}
            />
            <Card title="AI Coach">
              <div className="aiFeedback">
                {getAIFeedback()}
              </div>
            </Card>
          </div>
        </div>

        <div className="span12">
          <TopEdgesCard topEdges={topEdges} />
        </div>
      </div>
    )}

    {activeTab === "profile" && (
    <div className="mainGrid">
      <div className="span12">
        <div id="profile" className="card profileCard">
          <h3>Profile</h3>

          <div className="list">
            <div className="listRow">
              <div>
                <input
                  className="authInput"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <div className="listSubtext">
                  {user?.email || "No email found"}
                </div>
              </div>
            </div>

            <div className="listRow">
              <div>
                <div className="listTitle">Trades Logged</div>
                <div className="listSubtext">{trades.length}</div>
              </div>
            </div>

            <button
              className="ghostButton"
              type="button"
              onClick={async () => {
                const { error } = await supabase.auth.updateUser({
                  data: { display_name: displayName },
                });

                if (error) {
                  alert("Could not save name.");
                  return;
                }

                alert("Name updated.");
                window.location.reload();
              }}
            >
              Save Name
            </button>

            <div className="listRow">
              <div>
                <div className="listTitle">Win Rate</div>
                <div className="listSubtext">{winRate}</div>
              </div>
            </div>

            <div className="listRow">
              <div>
                <div className="listTitle">Average R</div>
                <div className="listSubtext">{avgR}</div>
              </div>
            </div>

            <button
              className="ghostButton"
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.reload();
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

    <div className="mobileNav">
      <button
        className={activeTab === "home" ? "active" : ""}
        onClick={() => {
          setActiveTab("home");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      >
        <LayoutDashboard size={18} />
        <span>Home</span>
      </button>

      <button
        className={activeTab === "market" ? "active" : ""}
        onClick={() => {
          setActiveTab("market");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      >
        <PlusSquare size={18} />
        <span>Market</span>
      </button>

      <button
        className={activeTab === "trades" ? "active" : ""}
        onClick={() => {
          setActiveTab("trades");
          document.getElementById("trades")?.scrollIntoView({ behavior: "smooth" });
        }}
      >
        <Receipt size={18} />
        <span>Trades</span>
      </button>

      <button
        className={activeTab === "ai" ? "active" : ""}
        onClick={() => {
          setActiveTab("ai");
          document.getElementById("ai")?.scrollIntoView({ behavior: "smooth" });
        }}
      >
        <Brain size={18} />
        <span>AI</span>
      </button>

      <button
        className={activeTab === "profile" ? "active" : ""}
        onClick={() => {
          setActiveTab("profile");
          document.getElementById("profile")?.scrollIntoView({ behavior: "smooth" });
        }}
      >
        <User size={18} />
        <span>Profile</span>
      </button>
    </div>
  </div>
);
}