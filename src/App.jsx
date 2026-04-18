import { useEffect, useMemo, useState } from "react";
import "./App.css";
import Login from "./Login";
import { supabase } from "./supabase";
import { LayoutDashboard, PlusSquare, Brain, User, ClipboardList, TrendingUp, Target, Gamepad2 } from "lucide-react";
import { Tutorial } from "./Login";


function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeout));
}

const SUPABASE_FUNCTIONS_BASE_URL = "https://uoxzzhtnzmsolvcykynu.functions.supabase.co";
const DAILY_INTEL_URL = `${SUPABASE_FUNCTIONS_BASE_URL}/daily-intel`;
const ASK_RAYLA_URL = `${SUPABASE_FUNCTIONS_BASE_URL}/ask-rayla`;

const marketSeeds = [
  { id: "BTC", type: "crypto", label: "Bitcoin", tvSymbol: "BINANCE:BTCUSDT", fallbackPrice: "64,210", fallbackChange: "+1.2%" },
  { id: "ETH", type: "crypto", label: "Ethereum", tvSymbol: "BINANCE:ETHUSDT", fallbackPrice: "3,120", fallbackChange: "+0.9%" },
  { id: "SPY", type: "stock", label: "SPDR S&P 500 ETF", tvSymbol: "AMEX:SPY", fallbackPrice: "521.14", fallbackChange: "-0.4%" },
  { id: "NVDA", type: "stock", label: "NVIDIA", tvSymbol: "NASDAQ:NVDA", fallbackPrice: "908.55", fallbackChange: "+3.2%" },
  { id: "AAPL", type: "stock", label: "Apple", tvSymbol: "NASDAQ:AAPL", fallbackPrice: "212.44", fallbackChange: "-0.4%" },
];

const fallbackEquity = [100, 101.5, 100.7, 102.1, 103.4, 102.8, 104.6, 105.2];

const SETUP_OPTIONS = ["rejection","breakout","pullback","reversal","range"];
const SESSION_OPTIONS = ["Asia","London","New York","After Hours"];

function parseTradeResult(value) {
  const parsed = Number.parseFloat(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMetric(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function buildTradeStats(trades) {
  const safeTrades = Array.isArray(trades) ? trades : [];
  const results = safeTrades.map((trade) => ({
    ...trade,
    resultValue: parseTradeResult(trade?.result_r),
    assetName: String(trade?.asset || "Unknown").toUpperCase(),
    setupName: String(trade?.setup || "").trim(),
  }));

  const wins = results.filter((trade) => trade.resultValue > 0);
  const losses = results.filter((trade) => trade.resultValue < 0);
  const totalTrades = results.length;
  const totalR = results.reduce((sum, trade) => sum + trade.resultValue, 0);
  const winRate = totalTrades ? (wins.length / totalTrades) * 100 : 0;
  const avgR = totalTrades ? totalR / totalTrades : 0;
  const averageWin = wins.length
    ? wins.reduce((sum, trade) => sum + trade.resultValue, 0) / wins.length
    : 0;
  const averageLoss = losses.length
    ? losses.reduce((sum, trade) => sum + trade.resultValue, 0) / losses.length
    : 0;
  const maxLoss = losses.length
    ? Math.min(...losses.map((trade) => trade.resultValue))
    : 0;
  const largestWin = wins.length
    ? Math.max(...wins.map((trade) => trade.resultValue))
    : 0;

  const summarizeGroup = (key) => {
    const groups = {};

    results.forEach((trade) => {
      const rawName = key === "setupName" ? trade.setupName : trade.assetName;
      if (!rawName) return;
      if (!groups[rawName]) {
        groups[rawName] = { name: rawName, trades: 0, wins: 0, totalR: 0 };
      }
      groups[rawName].trades += 1;
      groups[rawName].totalR += trade.resultValue;
      if (trade.resultValue > 0) groups[rawName].wins += 1;
    });

    return Object.values(groups)
      .map((group) => ({
        name: group.name,
        trades: group.trades,
        winRate: group.trades ? roundMetric((group.wins / group.trades) * 100, 1) : 0,
        avgR: group.trades ? roundMetric(group.totalR / group.trades) : 0,
        totalR: roundMetric(group.totalR),
      }))
      .sort((a, b) => {
        if (b.avgR !== a.avgR) return b.avgR - a.avgR;
        if (b.totalR !== a.totalR) return b.totalR - a.totalR;
        return b.trades - a.trades;
      });
  };

  const setupStats = summarizeGroup("setupName");
  const assetStats = summarizeGroup("assetName");

  let recentLossStreak = 0;
  for (const trade of results) {
    if (trade.resultValue < 0) recentLossStreak += 1;
    else break;
  }

  return {
    totalTrades,
    winRate: roundMetric(winRate, 1),
    avgR: roundMetric(avgR),
    totalR: roundMetric(totalR),
    averageWin: roundMetric(averageWin),
    averageLoss: roundMetric(averageLoss),
    maxLoss: roundMetric(maxLoss),
    largestWin: roundMetric(largestWin),
    bestSetup: setupStats[0] || null,
    worstSetup: setupStats[setupStats.length - 1] || null,
    bestAsset: assetStats[0] || null,
    worstAsset: assetStats[assetStats.length - 1] || null,
    recentLossStreak,
  };
}

function buildAskRaylaContext({ trades, userLevel, selectedMarketId }) {
  return {
    userLevel,
    selectedMarketId,
    stats: buildTradeStats(trades),
    recentTrades: (Array.isArray(trades) ? trades : []).slice(0, 10).map((trade) => ({
      asset: trade?.asset || "",
      setup: trade?.setup || "",
      session: trade?.session || "",
      resultR: roundMetric(parseTradeResult(trade?.result_r)),
      direction: trade?.direction || "",
      createdAt: trade?.created_at || trade?.entry_time || null,
    })),
  };
}

function buildCoachReport(trades) {
  if (!trades || trades.length === 0) return null;

  const wins = trades.filter(t => parseFloat(t.result_r) > 0);
  const losses = trades.filter(t => parseFloat(t.result_r) < 0);
  const winRate = trades.length ? (wins.length / trades.length) * 100 : 0;
  const avgR = trades.length ? trades.reduce((s, t) => s + parseFloat(t.result_r || 0), 0) / trades.length : 0;
  const avgWin = wins.length ? wins.reduce((s, t) => s + parseFloat(t.result_r || 0), 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + parseFloat(t.result_r || 0), 0) / losses.length) : 0;
  const totalR = trades.reduce((s, t) => s + parseFloat(t.result_r || 0), 0);
  const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : null;

  const setupMap = {};
  trades.forEach(t => {
    if (!t.setup) return;
    if (!setupMap[t.setup]) setupMap[t.setup] = { trades: 0, wins: 0, totalR: 0 };
    setupMap[t.setup].trades++;
    setupMap[t.setup].totalR += parseFloat(t.result_r || 0);
    if (parseFloat(t.result_r) > 0) setupMap[t.setup].wins++;
  });
  const setupStats = Object.entries(setupMap)
    .map(([setup, s]) => ({ setup, trades: s.trades, winRate: (s.wins / s.trades) * 100, avgR: s.totalR / s.trades, totalR: s.totalR }))
    .sort((a, b) => b.avgR - a.avgR);

  const assetMap = {};
  trades.forEach(t => {
    const asset = (t.asset || "Unknown").toUpperCase();
    if (!assetMap[asset]) assetMap[asset] = { trades: 0, wins: 0, totalR: 0 };
    assetMap[asset].trades++;
    assetMap[asset].totalR += parseFloat(t.result_r || 0);
    if (parseFloat(t.result_r) > 0) assetMap[asset].wins++;
  });
  const assetStats = Object.entries(assetMap)
    .map(([asset, s]) => ({ asset, trades: s.trades, winRate: (s.wins / s.trades) * 100, avgR: s.totalR / s.trades, totalR: s.totalR }))
    .sort((a, b) => b.avgR - a.avgR);

  const comboMap = {};
  trades.forEach(t => {
    if (!t.setup?.trim()) return;
    const key = `${(t.asset||"").toUpperCase()}_${t.setup.trim()}`;
    if (!comboMap[key]) comboMap[key] = { asset: (t.asset||"").toUpperCase(), setup: t.setup.trim(), trades: 0, wins: 0, totalR: 0 };
    comboMap[key].trades++;
    comboMap[key].totalR += parseFloat(t.result_r || 0);
    if (parseFloat(t.result_r) > 0) comboMap[key].wins++;
  });
  const comboStats = Object.values(comboMap)
    .map(c => ({ ...c, winRate: (c.wins / c.trades) * 100, avgR: c.totalR / c.trades }))
    .filter(c => c.trades >= 2)
    .sort((a, b) => b.avgR - a.avgR);

  const warnings = [];
  if (winRate < 40) warnings.push("Win rate is below 40% — entries need refinement.");
  if (avgLoss > avgWin && wins.length > 0 && losses.length > 0) warnings.push("Avg loss is larger than avg win — cutting winners too early or letting losers run.");
  if (profitFactor !== null && profitFactor < 1) warnings.push("Profit factor is below 1.0 — system is net negative. Review setups immediately.");
  if (trades.length >= 5 && winRate < 50) warnings.push("Win rate under 50% with 5+ trades — possible overtrading or setup quality issues.");
  if (assetStats.length > 4) warnings.push(`You are trading ${assetStats.length} different assets. Consider narrowing focus.`);
  const recentLosses = trades.slice(0, 4).filter(t => parseFloat(t.result_r) < 0).length;
  if (recentLosses >= 3) warnings.push("3 or more losses in your last 4 trades — consider taking a break.");

  const actions = [];
  const bestCombo = comboStats[0];
  const worstSetup = setupStats[setupStats.length - 1];
  if (bestCombo) actions.push(`Focus on ${bestCombo.setup} setups on ${bestCombo.asset} — your strongest edge (${bestCombo.avgR.toFixed(2)}R avg).`);
  if (worstSetup && setupStats.length > 1 && worstSetup.avgR < 0) actions.push(`Reduce or stop trading ${worstSetup.setup} setups — negative avg R (${worstSetup.avgR.toFixed(2)}R).`);
  if (avgLoss > avgWin) actions.push("Define your stop before entry on every trade and respect it without exception.");
  if (winRate < 50) actions.push("Be more selective — only take your clearest A+ setups.");
  if (actions.length === 0) actions.push("Keep executing consistently. Log every trade and review weekly.");

  return { winRate, avgR, avgWin, avgLoss, totalR, profitFactor, trades: trades.length, wins: wins.length, losses: losses.length, setupStats, assetStats, comboStats, warnings, actions, bestCombo, worstCombo: comboStats[comboStats.length - 1] };
}

function CoachSection({ label, children, accent }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        {accent && <div style={{ width: 8, height: 8, borderRadius: "50%", background: accent }} />}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7f8ea3" }}>{label}</div>
      </div>
      {children}
    </div>
  );
}

function CoachRow({ left, right, sub, tone }) {
  const color = tone === "positive" ? "#4ade80" : tone === "negative" ? "#f87171" : "#e2e8f0";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{left}</div>
        {sub && <div style={{ fontSize: 12, color: "#7f8ea3", marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color, textAlign: "right" }}>{right}</div>
    </div>
  );
}

function AICoachTab({ trades, onRunAnalysis, showNoNewTrades, coachSummary }) {
  const report = useMemo(() => buildCoachReport(trades), [trades]);

  if (!report) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 16, color: "#7f8ea3", marginBottom: 8 }}>No trades yet</div>
        <div style={{ fontSize: 13, color: "#7f8ea3" }}>Log your first trade to unlock AI Coach insights.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ borderColor: "rgba(124,196,255,0.2)" }}>
        <div className="cardHeader"><h2>Coach Insights</h2></div>
        <div className="cardBody">
          <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
            {`Win Rate: ${report.winRate.toFixed(1)}% · Avg R: ${report.avgR >= 0 ? "+" : ""}${report.avgR.toFixed(2)}R · Trades: ${report.trades}`}
          </div>
          {report.bestCombo && (
            <div style={{ marginTop: 10, fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
              {`Your strongest edge is ${report.bestCombo.setup} on ${report.bestCombo.asset} — ${report.bestCombo.avgR.toFixed(2)}R avg · ${report.bestCombo.winRate.toFixed(0)}% win rate across ${report.bestCombo.trades} trades.${report.bestCombo.trades < 3 ? " (early edge forming — low sample size)" : ""}`}
            </div>
          )}
          {report.warnings.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 14, color: "#fbbf24", lineHeight: 1.7 }}>{report.warnings[0]}</div>
          )}
          {report.actions.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 14, color: "#7CC4FF", lineHeight: 1.7 }}>{`Next step: ${report.actions[0]}`}</div>
          )}
          <button className="ghostButton" type="button" onClick={onRunAnalysis} style={{ marginTop: 12 }}>
            Refresh Analysis
          </button>
          {showNoNewTrades && (
            <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 13, color: "#7f8ea3" }}>
              No new trades since last analysis
            </div>
          )}
          {coachSummary && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 10, color: "#7f8ea3", letterSpacing: "1px", textTransform: "uppercase" }}>Last run · {coachSummary.generatedAt}</div>
              {coachSummary.strongestEdge && (
                <div style={{ background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#4ade80" }}>
                  <strong>Strongest Edge:</strong> {coachSummary.strongestEdge}
                </div>
              )}
              {coachSummary.weakestPattern && (
                <div style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#f87171" }}>
                  <strong>Weakest Pattern:</strong> {coachSummary.weakestPattern}
                </div>
              )}
              {coachSummary.warning && (
                <div style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#fbbf24" }}>
                  ⚠ {coachSummary.warning}
                </div>
              )}
              {coachSummary.nextAction && (
                <div style={{ background: "rgba(124,196,255,0.07)", border: "1px solid rgba(124,196,255,0.15)", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#7CC4FF" }}>
                  <strong>Next:</strong> {coachSummary.nextAction}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="cardHeader"><h2>Overall Performance</h2></div>
        <div className="cardBody">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 12 }}>
            {[
              { label: "Trades", value: report.trades },
              { label: "Win Rate", value: `${report.winRate.toFixed(1)}%`, tone: report.winRate >= 50 ? "positive" : "negative" },
              { label: "Avg R", value: `${report.avgR >= 0 ? "+" : ""}${report.avgR.toFixed(2)}R`, tone: report.avgR >= 0 ? "positive" : "negative" },
              { label: "Total R", value: `${report.totalR >= 0 ? "+" : ""}${report.totalR.toFixed(2)}R`, tone: report.totalR >= 0 ? "positive" : "negative" },
              { label: "Avg Win", value: `+${report.avgWin.toFixed(2)}R`, tone: "positive" },
              { label: "Avg Loss", value: `-${report.avgLoss.toFixed(2)}R`, tone: "negative" },
              ...(report.profitFactor !== null ? [{ label: "Profit Factor", value: report.profitFactor.toFixed(2), tone: report.profitFactor >= 1 ? "positive" : "negative" }] : []),
            ].map(item => (
              <div key={item.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: "#7f8ea3", marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: item.tone === "positive" ? "#4ade80" : item.tone === "negative" ? "#f87171" : "#e2e8f0" }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardHeader"><h2>Edge Analysis</h2></div>
        <div className="cardBody">
          {report.comboStats.length === 0 ? (
            <div style={{ fontSize: 13, color: "#7f8ea3" }}>Need at least 2 trades in the same setup to identify an edge.</div>
          ) : (
            <>
              <CoachSection label="Strongest Edge" accent="#4ade80">
                {report.comboStats.slice(0, 3).map((c, i) => (
                  <CoachRow key={i} left={`${c.asset} · ${c.setup}`} sub={`${c.trades} trades · ${c.winRate.toFixed(0)}% win rate`} right={`${c.avgR >= 0 ? "+" : ""}${c.avgR.toFixed(2)}R avg`} tone="positive" />
                ))}
              </CoachSection>
              {report.comboStats.length > 1 && (
                <CoachSection label="Weakest Edge" accent="#f87171">
                  {report.comboStats.slice(-Math.min(2, report.comboStats.length)).reverse().map((c, i) => (
                    <CoachRow key={i} left={`${c.asset} · ${c.setup}`} sub={`${c.trades} trades · ${c.winRate.toFixed(0)}% win rate`} right={`${c.avgR >= 0 ? "+" : ""}${c.avgR.toFixed(2)}R avg`} tone={c.avgR < 0 ? "negative" : "neutral"} />
                  ))}
                </CoachSection>
              )}
            </>
          )}
        </div>
      </div>

      {report.setupStats.length > 0 && (
        <div className="card">
          <div className="cardHeader"><h2>Setup Insights</h2></div>
          <div className="cardBody">
            {report.setupStats.map((s, i) => (
              <CoachRow key={i} left={s.setup} sub={`${s.trades} trades · ${s.winRate.toFixed(0)}% win rate`} right={`${s.avgR >= 0 ? "+" : ""}${s.avgR.toFixed(2)}R avg`} tone={s.avgR > 0 ? "positive" : s.avgR < 0 ? "negative" : "neutral"} />
            ))}
          </div>
        </div>
      )}

      {report.assetStats.length > 0 && (
        <div className="card">
          <div className="cardHeader"><h2>Asset Insights</h2></div>
          <div className="cardBody">
            {report.assetStats.map((a, i) => (
              <CoachRow key={i} left={a.asset} sub={`${a.trades} trades · ${a.winRate.toFixed(0)}% win rate`} right={`${a.avgR >= 0 ? "+" : ""}${a.avgR.toFixed(2)}R avg`} tone={a.avgR > 0 ? "positive" : a.avgR < 0 ? "negative" : "neutral"} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, children, className = "" }) {
  return (
    <section className={`card ${className}`}>
      <div className="cardHeader"><h2>{title}</h2></div>
      <div className="cardBody">{children}</div>
    </section>
  );
}

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
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
  return data.map((value, index) => {
    const x = (index / (data.length - 1 || 1)) * 100;
    const y = 88 - ((value - min) / (max - min || 1)) * 68;
    return `${x},${y}`;
  }).join(" ");
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
        {["1D","1W","1M","3M","ALL"].map((range) => (
          <button key={range} className={`chartTab ${chartRange === range ? "active" : ""}`} onClick={() => setChartRange(range)} type="button">{range}</button>
        ))}
      </div>
      <div className="equityMeta">
        <div><span>Start</span><strong>{startValue.toFixed(1)}</strong></div>
        <div><span>Current</span><strong>{currentValue.toFixed(1)}</strong></div>
        <div><span>Net</span><strong>{netText}</strong></div>
      </div>
      <div className="equityChart">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points={areaPoints} className="equityArea" />
          <polyline points={points} />
        </svg>
      </div>
      <div className="equityFooter"><div className="equityFooterLabel">{sourceLabel}</div></div>
    </Card>
  );
}

function RecentTradesCard({ recentTrades, onDeleteTrade }) {
  return (
    <Card title="Recent Trades">
      <div className="listSubtext" style={{ marginBottom: "8px" }}>{recentTrades.length} trades logged</div>
      <div className="list">
        {recentTrades.length === 0 ? (
          <div className="listSubtext">No trades yet — log your first trade to start tracking.</div>
        ) : (
          recentTrades.map((trade) => (
            <div className="listRow" key={trade.id}>
              <div>
                <div className="listTitle">
                  <span className="assetText">{trade.asset}</span> {trade.setup ? `· ${trade.setup}` : ""}
                </div>
                <div className="listSubtext">
                  Entry: ${trade.entry_price ? Number(trade.entry_price).toFixed(2) : "-"} ·
                  Size: ${trade.entry_size ? Number(trade.entry_size).toFixed(0) : "-"} ·
                  {trade.entry_time ? (() => {
                    const [date, time] = trade.entry_time.split("T");
                    const [year, month, day] = date.split("-");
                    let [hour, minute] = time.split(":");
                    const ampm = hour >= 12 ? "PM" : "AM";
                    hour = hour % 12 || 12;
                    return `${month}/${day}/${year}, ${hour}:${minute} ${ampm}`;
                  })() : "-"}
                </div>
              </div>
              <div className={`tradeResult ${trade.result_r < 0 ? "negative" : trade.result_r > 0 ? "positive" : "neutral"}`}>
                {trade.result_r !== null && trade.result_r !== undefined ? `${trade.result_r > 0 ? "+" : ""}${Number(trade.result_r).toFixed(1)}R` : "-"}
              </div>
              <div className="listSubtext">{trade.coachTag || "Disciplined"}</div>
              <button type="button" className="deleteTradeButton" onClick={() => onDeleteTrade(trade.id)}>Delete</button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function MarketCard({ items, selectedId, onSelect, onRemove, newSymbol, setNewSymbol, onAddSymbol, fullPage = false }) {
  const [quotes, setQuotes] = useState(() => {
  try {
    return JSON.parse(sessionStorage.getItem("rayla-market-quotes") || "{}");
  } catch {
    return {};
  }
});
  const [searchResults, setSearchResults] = useState([]);
  const symbolsKey = items.map((item) => item.id).sort().join("|");
  const selectedItem = items.find((item) => item.id === selectedId) || items[0];
  const iframeSrc = selectedItem
    ? `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(selectedItem.tvSymbol)}&interval=15&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&hideideas=1&studies=%5B%5D`
    : "";


useEffect(() => {
  if (!items.length) return;


  async function fetchQuotes() {
    try {
      const symbols = items.map(item => ({
        symbol: item.id,
        type: item.type || "stock",
      }));
      const res = await fetchWithTimeout('https://uoxzzhtnzmsolvcykynu.functions.supabase.co/market-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ symbols }),
      });
      const data = await res.json();

        if (!res.ok || !data.ok) {
          console.error("market-data bad response:", data);
          return;
        }

        if (data.ok) {
        
        setQuotes((prev) => {
          const next = { ...prev };
          Object.entries(data.quotes || {}).forEach(([symbol, q]) => {
            if (q?.price != null) next[symbol] = q;
          });
          sessionStorage.setItem("rayla-market-quotes", JSON.stringify(next));
          return next;
        });
      }
    } catch (err) {
      console.error("fetchQuotes failed:", err);
    }
  }

  fetchQuotes();
  const interval = setInterval(fetchQuotes, 30000);
  return () => clearInterval(interval);
}, [symbolsKey]);


  const WatchlistItems = () => (
    <div className="marketWatchlist">
      {[...items].sort((a, b) => a.id.localeCompare(b.id)).map((item) => (
        <button
          type="button"
          key={item.id}
          className={`marketWatchRow ${item.id === selectedId ? "active" : ""}`}
          onClick={() => onSelect(item.id)}
        >
          <div className="marketWatchLeft">
            <div className="marketWatchLabel">
              {quotes[item.id]?.price != null
                ? quotes[item.id].price.toFixed(2)
                : "..."}
            </div>
            <div className="marketWatchSymbol">{item.id}</div>
          </div>
          <div className="marketWatchRight">
            <div
              className={`marketWatchChange ${
                (quotes[item.id]?.change ?? item.changeValue) < 0 ? "negative" : "positive"
              }`}
            >
              {quotes[item.id]?.change != null
                ? `${quotes[item.id].change >= 0 ? "+" : ""}${quotes[item.id].change.toFixed(2)}%`
                : "..."}
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
  );



  return (
    <Card title="Live Market" className="marketCard">
      <div style={{ position: "relative", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "10px" }}>
        <input
          type="text"
          value={newSymbol}
          onChange={async (e) => {
            const val = e.target.value;
            setNewSymbol(val);
            if (val.length < 1) { setSearchResults([]); return; }
            try {
              const res = await fetch("https://finnhub.io/api/v1/search?q=" + encodeURIComponent(val) + "&token=" + import.meta.env.VITE_FINNHUB_KEY);
              const data = await res.json();
              
              setSearchResults((data.result || []).slice(0, 6));
            } catch { setSearchResults([]); }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { onAddSymbol(); setSearchResults([]); }
          }}
          placeholder="Search symbol (AAPL, BTC, NRG)"
          className="authInput"
        />
        <button type="button" onClick={() => { onAddSymbol(); setSearchResults([]); }} className="ghostButton">Add</button>
        </div>
        {searchResults.length > 0 && (
          <div style={{ position: "absolute", zIndex: 999, background: "#111827", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, width: "100%", maxHeight: 220, overflowY: "auto", marginTop: 4 }}>
            {searchResults.map((r) => (
              <div key={r.symbol} onClick={() => { onAddSymbol(r); setSearchResults([]); setNewSymbol(""); }} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: "#fff", fontSize: 13 }}>{r.symbol}</span>
                <span style={{ color: "#7f8ea3", fontSize: 12, marginLeft: 8 }}>{r.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`marketLayout ${fullPage ? "marketLayoutFull" : "marketLayoutDash"}`}>
        {!fullPage && <WatchlistItems />}

        {!fullPage && (
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
        )}

        {fullPage && (
          <div className="tradingviewFrameWrapFull">
            {selectedItem ? (
              <iframe
                key={selectedItem.tvSymbol + "_full"}
                title={`${selectedItem.id} chart full`}
                className="tradingviewFrame"
                src={iframeSrc}
              />
            ) : null}
          </div>
        )}

        {fullPage && <WatchlistItems />}
      </div>
    </Card>
  );
}

function normalizeIntelArticles(items = []) {
  return (items || []).map((article) => ({
    title: article.title || "No title",
    description: article.description || article.content || "No summary available",
    image: article.image || article.image_url || article.urlToImage || "",
    url: article.url || "#",
    source: typeof article.source === "object" ? article.source : { name: article.source || "Unknown source" },
    publishedAt: article.publishedAt || "",
  }));
}

function getScoreLabel(score) {
  if (score >= 4) return { label: "Hot", cls: "hot" };
  if (score >= 1) return { label: "Leaning Hot", cls: "leaning-hot" };
  if (score <= -4) return { label: "Cold", cls: "cold" };
  if (score <= -1) return { label: "Leaning Cold", cls: "leaning-cold" };
  return { label: "Neutral", cls: "neutral" };
}

function IntelAssetCard({ item }) {
  if (!item) return null;
  const { label, cls } = getScoreLabel(item.score);
  const changePos = !item.change?.startsWith("-");
  const article = (item.rawArticles || [])[0];
  const drivers = item.breakdown
    ? Object.entries(item.breakdown).filter(([k]) => k !== "total").sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 2)
    : [];
  const pillColors = {
    "hot": { bg: "rgba(239,68,68,0.15)", color: "#f87171" },
    "leaning-hot": { bg: "rgba(239,68,68,0.08)", color: "#fca5a5" },
    "cold": { bg: "rgba(124,196,255,0.15)", color: "#7CC4FF" },
    "leaning-cold": { bg: "rgba(124,196,255,0.08)", color: "#93c5fd" },
    "neutral": { bg: "rgba(255,255,255,0.08)", color: "#7f8ea3" },
  };
  const pill = pillColors[cls];
  const driverLabels = { demand: "Demand", costMargin: "Margin", guidance: "Guidance", narrative: "Narrative", priceConfirmation: "Price", liquidity: "Liquidity", sentiment: "Sentiment", momentum: "Momentum", catalyst: "Catalyst", relativeStrength: "Rel. Strength" };

  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#ffffff" }}>{item.symbol}</div>
            <div style={{ fontSize: 11, color: "#7f8ea3", marginTop: 1 }}>{item.name}</div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999, background: pill.bg, color: pill.color }}>{label}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: changePos ? "#4ade80" : "#f87171" }}>{item.change}</div>
          <div style={{ fontSize: 11, color: "#7f8ea3", marginTop: 2 }}>Score: {item.score}</div>
        </div>
      </div>
      {drivers.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {drivers.map(([key, val]) => (
            <div key={key} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: val > 0 ? "rgba(74,222,128,0.1)" : val < 0 ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.06)", color: val > 0 ? "#4ade80" : val < 0 ? "#f87171" : "#7f8ea3", fontWeight: 600 }}>
              {driverLabels[key] || key} {val > 0 ? "↑" : val < 0 ? "↓" : "—"}
            </div>
          ))}
        </div>
      )}
      {article && (
        <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", gap: 10, textDecoration: "none", marginTop: 6, padding: "10px 10px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", alignItems: "flex-start" }}>
          {article.image ? (
            <img src={article.image} alt="" onError={e => e.target.style.display = "none"} style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: 8, flexShrink: 0, background: "rgba(124,196,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📰</div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "#7CC4FF", lineHeight: 1.4, marginBottom: 3 }}>{article.title}</div>
            <div style={{ fontSize: 10, color: "#7f8ea3" }}>{article.source?.name}</div>
            {article.description && <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4, marginTop: 4 }}>{article.description?.slice(0, 120)}...</div>}
          </div>
        </a>
      )}
    </div>
  );
}

function CoachAskBox({ trades, onAskRayla, isLoading }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  async function handleAsk() {
    const q = question.trim();
    if (!q) return;
    const r = buildCoachReport(trades);
    if (!r) { setAnswer("No trades logged yet. Start logging trades first."); setQuestion(""); return; }
    try {
      const nextAnswer = await onAskRayla(q);
      setAnswer(nextAnswer);
      setQuestion("");
    } catch (error) {
      setAnswer(`API error: ${error?.message || "unknown error"}`);
    }
  }

  return (
    <div className="card">
      <div className="cardHeader"><h2>Ask Rayla About Your Performance</h2></div>
      <div className="cardBody">
        <p style={{ fontSize: 13, color: "#7f8ea3", margin: "0 0 12px 0" }}>Ask anything about your trades, setups, edges, or what to focus on next.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={question}
            placeholder="e.g. What's my best setup? How am I doing? Am I overtrading?"
            style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#e2e8f0", outline: "none" }}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAsk(); }}
            disabled={isLoading}
          />
          <button type="button" style={{ background: "#7CC4FF", color: "#0b1017", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }} onClick={handleAsk} disabled={isLoading}>{isLoading ? "Thinking..." : "Ask"}</button>
        </div>
        {answer && <div style={{ marginTop: 12, fontSize: 13, color: "#e2e8f0", lineHeight: 1.6 }}>{answer}</div>}
      </div>
    </div>
  );
}

function SubscriptionCard() {
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);

  const VALID_CODES = { "RAYLA5": 5, "RAYLAFREE": 20 };

  function handleApply() {
    const code = promoCode.trim().toUpperCase();
    if (VALID_CODES[code]) {
      setPromoApplied(code);
      setPromoCode("");
    } else {
      alert("Invalid promo code.");
    }
  }

  const trialDays = 14;
  const trialEnd = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="cardHeader"><h2>Subscription</h2></div>
      <div className="cardBody">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "#7f8ea3", marginBottom: 4 }}>Current plan</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>Rayla</div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: "rgba(74,222,128,0.1)", color: "#4ade80" }}>Free trial</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: "#7f8ea3" }}>Trial ends</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{trialEnd}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: "#7f8ea3" }}>Then</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>
              {promoApplied === "RAYLAFREE" ? (
                <span style={{ color: "#4ade80" }}>Free</span>
              ) : promoApplied === "RAYLA5" ? (
                <><span style={{ textDecoration: "line-through", color: "#7f8ea3", marginRight: 6 }}>$20.00</span><span style={{ color: "#4ade80" }}>$15.00 / month</span></>
              ) : "$20.00 / month"}
            </span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 999, height: 4 }}>
            <div style={{ background: "#4ade80", borderRadius: 999, height: 4, width: "100%" }} />
          </div>
          <div style={{ fontSize: 12, color: "#7f8ea3", marginTop: 6 }}>{trialDays} days remaining in trial</div>
        </div>
        {!promoApplied && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 6 }}>Promo code</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                className="authInput"
                placeholder="Enter code"
                value={promoCode}
                onChange={e => setPromoCode(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleApply(); }}
                style={{ flex: 1 }}
              />
              <button type="button" className="ghostButton" onClick={handleApply}>Apply</button>
            </div>
          </div>
        )}
        {promoApplied && (
          <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10, background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.15)", fontSize: 13, color: "#4ade80" }}>
            ✓ Promo code applied — {promoApplied === "RAYLAFREE" ? "first month free" : "$5 off per month"}
          </div>
        )}
        <button type="button" className="ghostButton" style={{ width: "100%" }}>Manage subscription</button>
        <div style={{ fontSize: 12, color: "#7f8ea3", textAlign: "center", marginTop: 10 }}>Subscription feature coming soon</div>
      </div>
    </div>
  );
}

export default function App() {
  const [selectedMarketId, setSelectedMarketId] = useState("BTC");
 const [watchlist, setWatchlist] = useState(() => {
  const saved = localStorage.getItem("rayla-watchlist");
  if (!saved) return marketSeeds;

  const parsed = JSON.parse(saved).map((item) => ({
    ...item,
    type: item.type || (item.tvSymbol?.includes("BINANCE") || item.tvSymbol?.includes("USDT") ? "crypto" : "stock"),
  }));

  const seen = new Set();
  return parsed.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
});
  useEffect(() => {
  localStorage.setItem("rayla-watchlist", JSON.stringify(watchlist));
}, [watchlist]);

useEffect(() => {
  if (watchlist.length > 0 && !watchlist.find(item => item.id === selectedMarketId)) {
    setSelectedMarketId(watchlist[0].id);
  }
}, [watchlist]);

const watchlistSymbolsKey = watchlist.map((item) => item.id).sort().join("|");

useEffect(() => {
  if (!watchlist.length) return;

  async function fetchSimulationQuotes() {
    try {
      const symbols = watchlist.map((item) => ({
        symbol: item.id,
        type: item.type || "stock",
      }));
      const res = await fetchWithTimeout("https://uoxzzhtnzmsolvcykynu.functions.supabase.co/market-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ symbols }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) return;

      setSimulationQuotes((prev) => {
        const next = { ...prev };
        Object.entries(data.quotes || {}).forEach(([symbol, quote]) => {
          if (quote?.price != null) next[symbol] = quote;
        });
        sessionStorage.setItem("rayla-market-quotes", JSON.stringify(next));
        return next;
      });
    } catch (error) {
      console.error("simulation quote fetch failed:", error);
    }
  }

  fetchSimulationQuotes();
  const interval = setInterval(fetchSimulationQuotes, 30000);
  return () => clearInterval(interval);
}, [watchlistSymbolsKey]);

  const [intelLoading, setIntelLoading] = useState(false);
  const [hotColdReport, setHotColdReport] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("rayla-intel-report") || "null");
    } catch {
      return null;
    }
  });
  const [isRaylaLoading, setIsRaylaLoading] = useState(false);
  const [raylaResponse, setRaylaResponse] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [activeTab, setActiveTab] = useState("home");
    const [newSymbol, setNewSymbol] = useState("");
  const [user, setUser] = useState(null);
  const [chartRange, setChartRange] = useState("ALL");
  const [displayName, setDisplayName] = useState("");
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [userLevel, setUserLevel] = useState("beginner");
    const [showBeginnerTutorial, setShowBeginnerTutorial] = useState(false);
  const [beginnerTutorialView, setBeginnerTutorialView] = useState("menu");
    const [beginnerTutorialStep, setBeginnerTutorialStep] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [lastAnalyzedCount, setLastAnalyzedCount] = useState(-1);
  const [showNoNewTrades, setShowNoNewTrades] = useState(false);
  const [coachSummary, setCoachSummary] = useState(null);
  const [equitySourceLabel, setEquitySourceLabel] = useState("No trades yet. Add your first trade.");
  const [trades, setTrades] = useState([]);
  const [simulationQuotes, setSimulationQuotes] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("rayla-market-quotes") || "{}");
    } catch {
      return {};
    }
  });
  const [simulationDirection, setSimulationDirection] = useState("long");
  const [simulationAmount, setSimulationAmount] = useState("");
  const [simulationStopLoss, setSimulationStopLoss] = useState("");
  const [simulationTakeProfit, setSimulationTakeProfit] = useState("");
  const [simulationPosition, setSimulationPosition] = useState(null);
  const [simulationClosedTrade, setSimulationClosedTrade] = useState(null);
  const [simulationNow, setSimulationNow] = useState(Date.now());
  const [raylaUserCount, setRaylaUserCount] = useState(0);
  const [toast, setToast] = useState(null);
  const [showTooltip, setShowTooltip] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tradeView, setTradeView] = useState("recent");
  const [tradeForm, setTradeForm] = useState({
    asset: "", entryPrice: "", size: "", entryTime: "", setup: "", session: "", marketCondition: "", direction: "", result: "", exitPrice: "", exitTime: "",
  });

  useEffect(() => {
    if (!simulationPosition) return;
    const interval = setInterval(() => setSimulationNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [simulationPosition]);

  function showToast(message, type = "success") { setToast({ message, type }); setTimeout(() => setToast(null), 3500); }

  useEffect(() => {
  supabase.auth.getSession().then(({ data }) => {
    setSession(data.session);
    setAuthLoading(false);
  });

  const { data: listener } = supabase.auth.onAuthStateChange((_event, sessionData) => {
    setSession(sessionData);
    setAuthLoading(false);
  });

  return () => {
    listener.subscription.unsubscribe();
  };
}, []);

      useEffect(() => {
        async function loadProfile() {
          const { data: { user } } = await supabase.auth.getUser();

          if (!user) return;

          const { data, error } = await supabase
            .from("profiles")
            .select("user_level")
            .eq("id", user.id)
            .single();

          if (error) {
            console.error("Error loading profile:", error);
            return;
          }

          setProfile(data);
          setUserLevel(data.user_level || "beginner");

          console.log("USER LEVEL:", data.user_level);
        }

        loadProfile();
      }, []);

  useEffect(() => { fetchRaylaUserCount(); }, []);

  useEffect(() => {
    if (hotColdReport !== null) return;
    setIntelLoading(true);
    fetch(DAILY_INTEL_URL)
      .then(r => r.json())
      .then(data => {
        const report = { stockHot: data.stockHot || [], stockCold: data.stockCold || [], cryptoHot: data.cryptoHot || null, cryptoCold: data.cryptoCold || null };
        sessionStorage.setItem("rayla-intel-report", JSON.stringify(report));
        setHotColdReport(report);
        setIntelLoading(false);
      })
      .catch(() => {
        setHotColdReport({ stockHot: [], stockCold: [], cryptoHot: null, cryptoCold: null });
        setIntelLoading(false);
      });
  }, []);

  useEffect(() => {
    if (user) setDisplayName(user.user_metadata?.display_name || user.email?.split("@")[0] || "");
  }, [user]);



  useEffect(() => {
    async function loadUserAndTrades() {
      const { data, error } = await supabase.auth.getUser();
      if (error) { console.error(error); return; }
      const currentUser = data.user;
      setUser(currentUser);
      if (!currentUser) return;
      const { data: tradesData, error: tradesError } = await supabase.from("trades").select("*").eq("user_id", currentUser.id).order("created_at", { ascending: false });
      if (tradesError) { console.error(tradesError); return; }
      setTrades(tradesData);
      if (!localStorage.getItem("rayla-visited")) {
        setShowTutorial(true);
      }
      setEquitySourceLabel("Equity based on logged trades");
    }
    loadUserAndTrades();
  }, [session]);

    const recentTrades = trades.slice(0, 5);
    const isBeginner = userLevel === "beginner";

  const topEdges = Object.values(
    trades.reduce((acc, trade) => {
      const key = `${trade.setup} × ${trade.session}`;
      if (!acc[key]) acc[key] = { name: key, trades: 0, totalR: 0 };
      acc[key].trades += 1;
      acc[key].totalR += parseFloat(trade.result_r || 0);
      return acc;
    }, {})
  ).map((edge) => ({ name: edge.name, trades: edge.trades, avgR: (edge.totalR / edge.trades).toFixed(2) + "R" }))
    .sort((a, b) => parseFloat(b.avgR) - parseFloat(a.avgR)).slice(0, 3);

  const winRate = trades.length === 0 ? "0%" : `${((trades.filter((t) => parseFloat(t.result_r) > 0).length / trades.length) * 100).toFixed(1)}%`;
  const avgR = trades.length === 0 ? "0R" : (trades.reduce((sum, t) => sum + parseFloat(t.result_r || 0), 0) / trades.length).toFixed(2) + "R";
  const totalR = trades.length ? trades.reduce((sum, t) => sum + parseFloat(t.result_r || 0), 0).toFixed(2) : "0.00";

  const equitySeries = trades.length
    ? trades.map((_, i) => 100 + trades.slice(0, i + 1).reduce((sum, x) => sum + parseFloat(x.result_r || 0), 0))
    : fallbackEquity;

  const filteredEquitySeries =
    chartRange === "1D" ? equitySeries.slice(-5)
    : chartRange === "1W" ? equitySeries.slice(-10)
    : chartRange === "1M" ? equitySeries.slice(-20)
    : chartRange === "3M" ? equitySeries.slice(-40)
    : equitySeries;

  async function handleAddTrade(e) {
    e.preventDefault();
    if (!user) { showToast("No user loaded.", "error"); return; }
    if (!tradeForm.asset || !tradeForm.entryPrice || !tradeForm.size || !tradeForm.entryTime || !tradeForm.result) { showToast("Fill out required fields.", "warning"); return; }
    const newTrade = {
      user_id: user.id, asset: tradeForm.asset, entry_price: Number(tradeForm.entryPrice),
      entry_size: Number(tradeForm.size), entry_time: tradeForm.entryTime, setup: tradeForm.setup || "",
      session: tradeForm.session || "", direction: tradeForm.direction || "", result_r: Number(tradeForm.result),
      exit_price: tradeForm.exitPrice ? Number(tradeForm.exitPrice) : null, exit_time: tradeForm.exitTime || null,
    };
    const { data, error } = await supabase.from("trades").insert([newTrade]).select().single();
    if (error) { console.error("SAVE ERROR FULL:", error); showToast(error.message, "error"); return; }
    setTrades((prev) => [data, ...prev]);
    setTradeForm({ asset: "", entryPrice: "", size: "", entryTime: "", setup: "", session: "", marketCondition: "", direction: "", result: "", exitPrice: "", exitTime: "" });
    showToast("Trade logged.", "success");
  }

  async function handleUserLevelChange(level) {
        if (!user) {
          showToast("No user loaded.", "error");
          return;
        }

        const { error } = await supabase
          .from("profiles")
          .update({ user_level: level })
          .eq("id", user.id);

        if (error) {
          console.error("USER LEVEL SAVE ERROR:", error);
          showToast("Could not save user level.", "error");
          return;
        }

        setUserLevel(level);
        setProfile((prev) => ({ ...(prev || {}), user_level: level }));
        showToast("User level updated.", "success");
      }

  async function requestRaylaAnswer(question) {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return "Question is required.";

    const response = await fetchWithTimeout(
      ASK_RAYLA_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          context: buildAskRaylaContext({
            trades,
            userLevel,
            selectedMarketId,
          }),
        }),
      }
    );

    const data = await response.json();

    if (!response.ok && !data?.answer) {
      throw new Error(data?.error || `Request failed with status ${response.status}`);
    }

    return data?.answer || data?.error || "No response.";
  }

  async function handleAskRaylaQuestion(question, { clearInput = false } = {}) {
    if (!question.trim()) return;

    setIsRaylaLoading(true);
    setRaylaResponse("");

    try {
      const answer = await requestRaylaAnswer(question);
      setRaylaResponse(answer);
      if (clearInput) setAiInput("");
      return answer;
    } catch (error) {
      const message = `API error: ${error?.message || "unknown error"}`;
      setRaylaResponse(message);
      throw error;
    } finally {
      setIsRaylaLoading(false);
    }
  }

  async function handleScreenshotUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    showToast("Parsing screenshot...", "success");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(",")[1];
        const mimeType = file.type || "image/jpeg";
        const res = await fetch("https://uoxzzhtnzmsolvcykynu.functions.supabase.co/parse-screenshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        });
        const data = await res.json();
        if (!data.ok) { showToast("Parse failed — fill in manually.", "error"); return; }
        const f = data.fields || {};
        setTradeForm({ asset: f.asset || "", entryPrice: f.entryPrice || "", size: f.size || "", entryTime: "", setup: f.setup || "", session: f.session || "", marketCondition: "", direction: f.direction || "", result: f.result?.toString() || "", exitPrice: "", exitTime: "" });
        const missing = data.missing || [];
        showToast(`Prefilled — still need: ${missing.join(", ")}`, "warning");
      } catch { showToast("Could not parse screenshot — fill in manually.", "error"); }
    };
    reader.readAsDataURL(file);
  }

  async function handleDeleteTrade(tradeId) {
    if (!tradeId) return;
    const confirmed = window.confirm("Delete this trade?");
    if (!confirmed) return;
    const { error } = await supabase.from("trades").delete().eq("id", tradeId);
    if (error) { console.error("DELETE ERROR:", error); showToast("Could not delete trade: " + error.message, "error"); return; }
    setTrades((prev) => prev.filter((trade) => trade.id !== tradeId));
  }

  function getSimulationPrice(assetId) {
    const livePrice = simulationQuotes[assetId]?.price;
    if (livePrice != null) return livePrice;
    const item = marketItems.find((marketItem) => marketItem.id === assetId);
    return Number.isFinite(item?.priceValue) ? item.priceValue : null;
  }

  function calculateSimulationPnL(position, currentPrice) {
    if (!position || !Number.isFinite(currentPrice)) return { profitLoss: 0, rMultiple: 0 };
    const movePct = position.direction === "long"
      ? (currentPrice - position.entryPrice) / position.entryPrice
      : (position.entryPrice - currentPrice) / position.entryPrice;
    const profitLoss = position.amount * movePct;
    const rMultiple = position.plannedRisk > 0 ? profitLoss / position.plannedRisk : 0;
    return { profitLoss, rMultiple };
  }

  function formatTimeInTrade(openedAt) {
    if (!openedAt) return "--";
    const elapsedMs = Math.max(0, simulationNow - openedAt);
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  function buildSimulationCloseFeedback(position, exitPrice, profitLoss, rMultiple, durationMs) {
    const durationMinutes = durationMs / 60000;
    const isWin = profitLoss > 0;
    const isLoss = profitLoss < 0;
    const tinyGain = isWin && rMultiple < 0.25;
    const strongWinner = isWin && rMultiple >= 1.5;
    const heldLongEnough = durationMinutes >= 5;
    const veryQuickTrade = durationMinutes < 2;
    const smallLoss = isLoss && Math.abs(rMultiple) <= 0.25;

    if (strongWinner) {
      return `Strong follow-through on that ${position.direction} in ${position.asset}. You let the move work from ${formatCompactPrice(position.entryPrice)} to ${formatCompactPrice(exitPrice)} and got paid ${rMultiple.toFixed(2)}R for staying with it.`;
    }

    if (isWin && heldLongEnough) {
      return `Good patience here. You gave that ${position.direction} enough time to develop and the exit shows controlled execution instead of rushing the close.`;
    }

    if (tinyGain && veryQuickTrade) {
      return `You locked in a green trade, but it was a very quick exit for a small gain. Make sure you are not cutting winners short before the move has real room to expand.`;
    }

    if (isWin) {
      return `Solid paper trade. You stayed on the right side of the move and closed it with a clean gain instead of letting it drift back on you.`;
    }

    if (smallLoss && veryQuickTrade) {
      return `Good protection. You kept the loss small and got out quickly, which is exactly what disciplined damage control should look like.`;
    }

    if (isLoss) {
      return `Controlled loss. It did not work, but the rep still matters because you respected risk and closed it before the damage got out of hand.`;
    }

    return `Flat result overall. The main win here is practicing clean decision-making around entry, management, and exit.`;
  }

  function finalizeSimulationTrade(exitPrice, exitReason = "Manual Close") {
    if (!simulationPosition) return;

    const { profitLoss, rMultiple } = calculateSimulationPnL(simulationPosition, exitPrice);
    const closedAt = Date.now();
    const durationMs = Math.max(0, closedAt - simulationPosition.openedAt);
    const feedback = buildSimulationCloseFeedback(
      simulationPosition,
      exitPrice,
      profitLoss,
      rMultiple,
      durationMs
    );

    setSimulationClosedTrade({
      ...simulationPosition,
      closedAt,
      durationMs,
      exitPrice,
      exitReason,
      profitLoss,
      rMultiple,
      feedback,
    });
    setSimulationPosition(null);
  }

  function handleOpenSimulationTrade() {
    const amount = Number.parseFloat(simulationAmount);
    const entryPrice = getSimulationPrice(selectedMarketId);
    const stopLoss = Number.parseFloat(simulationStopLoss);
    const takeProfit = Number.parseFloat(simulationTakeProfit);

    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid amount to simulate.", "warning");
      return;
    }

    if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
      showToast("Live price is not available for this asset yet.", "warning");
      return;
    }

    if (!Number.isFinite(stopLoss) || !Number.isFinite(takeProfit)) {
      showToast("Enter a valid stop loss and take profit.", "warning");
      return;
    }

    const longSetupValid = simulationDirection === "long" && stopLoss < entryPrice && takeProfit > entryPrice;
    const shortSetupValid = simulationDirection === "short" && stopLoss > entryPrice && takeProfit < entryPrice;

    if (!longSetupValid && !shortSetupValid) {
      showToast("For longs: stop below entry and target above. For shorts: stop above entry and target below.", "warning");
      return;
    }

    const riskPerUnit = simulationDirection === "long"
      ? entryPrice - stopLoss
      : stopLoss - entryPrice;
    const plannedRisk = amount * (riskPerUnit / entryPrice);

    if (!Number.isFinite(plannedRisk) || plannedRisk <= 0) {
      showToast("Planned risk must be greater than zero.", "warning");
      return;
    }

    setSimulationClosedTrade(null);
    setSimulationPosition({
      asset: selectedMarketId,
      direction: simulationDirection,
      amount,
      entryPrice,
      stopLoss,
      takeProfit,
      riskPerUnit,
      plannedRisk,
      openedAt: Date.now(),
    });
  }

  function handleCloseSimulationTrade() {
    if (!simulationPosition) return;

    const currentPrice = getSimulationPrice(simulationPosition.asset);
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      showToast("Current price is not available yet.", "warning");
      return;
    }
    finalizeSimulationTrade(currentPrice, "Manual Close");
  }

  function runAIAnalysis() {
  if (trades.length === 0) { showToast("No trades logged yet.", "warning"); return; }
  if (trades.length === lastAnalyzedCount) { showToast("No new trades since last analysis.", "warning"); return; }
  const r = buildCoachReport(trades);
  if (!r) return;
  setCoachSummary({
    strongestEdge: r.bestCombo ? `${r.bestCombo.setup} on ${r.bestCombo.asset} — ${r.bestCombo.avgR.toFixed(2)}R avg, ${r.bestCombo.winRate.toFixed(0)}% win rate (${r.bestCombo.trades} trades)` : null,
    weakestPattern: r.comboStats.length > 1 ? (() => { const w = r.comboStats[r.comboStats.length - 1]; return `${w.setup} on ${w.asset} — ${w.avgR.toFixed(2)}R avg, ${w.winRate.toFixed(0)}% win rate`; })() : null,
    warning: r.warnings[0] || null,
    nextAction: r.actions[0] || null,
    generatedAt: new Date().toLocaleTimeString(),
  });
  setLastAnalyzedCount(trades.length);
  showToast("Analysis updated.", "success");
}

  async function fetchRaylaUserCount() {
    const { data, error } = await supabase.from("trades").select("user_id");
    if (error) { console.error("Failed to fetch user count:", error); return; }
    const uniqueUsers = new Set((data || []).map((row) => row.user_id).filter(Boolean));
    setRaylaUserCount(uniqueUsers.size);
  }

  const CRYPTO_SYMBOL_SET = new Set(["BTC","ETH","SOL","XRP","DOGE","BNB","ADA","AVAX","LINK","MATIC","DOT","UNI","ATOM","LTC","BCH","ALGO","NEAR","FTM","SAND","MANA","TRX","TRON"]);
  function handleAddSymbol(overrideSymbol) {
    
  const raw = (typeof overrideSymbol === "string" ? overrideSymbol : overrideSymbol?.symbol || newSymbol).trim();
  if (!raw) return;

  const upper = ({ TRON: "TRX" }[raw.toUpperCase()] || raw.toUpperCase());
  const selectedResult = typeof overrideSymbol === "object" ? overrideSymbol : null;

  const exchangeMap = {
    SPY: "AMEX:SPY",
    QQQ: "NASDAQ:QQQ",
    DIA: "AMEX:DIA",
    IWM: "AMEX:IWM",
    BTC: "BINANCE:BTCUSDT",
    ETH: "BINANCE:ETHUSDT",
    SOL: "BINANCE:SOLUSDT",
    XRP: "BINANCE:XRPUSDT",
    DOGE: "BINANCE:DOGEUSDT",
    ADA: "BINANCE:ADAUSDT",
    AVAX: "BINANCE:AVAXUSDT",
    LINK: "BINANCE:LINKUSDT",
    NRG: "NYSE:NRG",
    KO: "NYSE:KO",
    DIS: "NYSE:DIS",
    BA: "NYSE:BA",
    JPM: "NYSE:JPM",
    XOM: "NYSE:XOM",
    WMT: "NYSE:WMT",
    NKE: "NYSE:NKE",
    MCD: "NYSE:MCD",
    GS: "NYSE:GS",
  };

  const id = upper.includes(":") ? upper.split(":").pop() : upper;
  const tvSymbol = upper.includes(":") ? upper : (exchangeMap[upper] || `NASDAQ:${upper}`);

  const alreadyExists = watchlist.some(
    (item) => item.id === id || item.tvSymbol === tvSymbol
  );

  if (alreadyExists) {
    showToast("That symbol is already in the watchlist.", "warning");
    return;
  }

  const isCrypto = CRYPTO_SYMBOL_SET.has(id) || tvSymbol.includes("USDT") || tvSymbol.includes("BINANCE");

  setWatchlist((prev) => [...prev, {
    id,
    label: id,
    tvSymbol,
    type: isCrypto ? "crypto" : "stock",
    fallbackPrice: "--",
    fallbackChange: "--",
  }]);

  setSelectedMarketId(id);
  setNewSymbol("");
  showToast(`${id} added.`, "success");
}

  function handleRemoveSymbol(id) {
    const remaining = watchlist.filter((item) => item.id !== id);
    setWatchlist(remaining);
    if (selectedMarketId === id) setSelectedMarketId(remaining[0]?.id || "");
  }

  const marketItems = watchlist.map((item) => {
    const fallbackPrice = Number(String(item.fallbackPrice).replace(/,/g, ""));
    const fallbackChange = Number(String(item.fallbackChange).replace("%", ""));
    return { ...item,
      priceValue: fallbackPrice, changeValue: fallbackChange, priceText: formatCompactPrice(fallbackPrice), changeText: formatPctChange(fallbackChange) };
  });

  const selectedSimulationItem = marketItems.find((item) => item.id === selectedMarketId) || marketItems[0];
  const simulationChartSrc = selectedSimulationItem
    ? `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(selectedSimulationItem.tvSymbol)}&interval=15&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&hideideas=1&studies=%5B%5D`
    : "";
  const selectedSimulationPrice = selectedSimulationItem ? getSimulationPrice(selectedSimulationItem.id) : null;
  const openPositionCurrentPrice = simulationPosition ? getSimulationPrice(simulationPosition.asset) : null;
  const openPositionMetrics = simulationPosition && Number.isFinite(openPositionCurrentPrice)
    ? calculateSimulationPnL(simulationPosition, openPositionCurrentPrice)
    : { profitLoss: 0, rMultiple: 0 };

  useEffect(() => {
    if (!simulationPosition || !Number.isFinite(openPositionCurrentPrice)) return;

    if (simulationPosition.direction === "long") {
      if (openPositionCurrentPrice <= simulationPosition.stopLoss) {
        finalizeSimulationTrade(simulationPosition.stopLoss, "Stopped Out");
        return;
      }
      if (openPositionCurrentPrice >= simulationPosition.takeProfit) {
        finalizeSimulationTrade(simulationPosition.takeProfit, "Target Hit");
      }
      return;
    }

    if (openPositionCurrentPrice >= simulationPosition.stopLoss) {
      finalizeSimulationTrade(simulationPosition.stopLoss, "Stopped Out");
      return;
    }
    if (openPositionCurrentPrice <= simulationPosition.takeProfit) {
      finalizeSimulationTrade(simulationPosition.takeProfit, "Target Hit");
    }
  }, [simulationPosition, openPositionCurrentPrice]);

  

  const navTabs = [
  { id: "home", icon: <LayoutDashboard size={18} />, label: "Home" },
  { id: "trades", icon: <PlusSquare size={18} />, label: "Trades" },
  { id: "market", icon: <TrendingUp size={18} />, label: "Market" },
  { id: "simulation", icon: <Gamepad2 size={18} />, label: "Simulation" },
  { id: "ask", icon: <Brain size={18} />, label: "Ask Rayla" },
  { id: "ai", icon: <Target size={18} />, label: "AI Coach" },
  { id: "intel", icon: <ClipboardList size={18} />, label: "Intel" },
];




if (!session) return <Login onLogin={() => setShowSplash(false)} />;

async function handleDeleteAccount() {
  const confirmDelete = window.confirm(
    "Are you sure you want to delete your account? This will permanently delete all your data and cannot be undone."
  );

  if (!confirmDelete) return;

  const { error } = await supabase.functions.invoke("delete-account");

  if (error) {
    alert("Error deleting account");
    return;
  }

  alert("Account deleted");
  window.location.reload();
}

return (

  
  
    <div className="appShell">
      {showTutorial && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#0b1017" }}>
          <Tutorial onDone={() => { localStorage.setItem("rayla-visited", "true"); setShowTutorial(false); }} />
        </div>
      )}

              {showBeginnerTutorial && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.72)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 9999,
                    padding: 20
                  }}
                  onClick={() => setShowBeginnerTutorial(false)}
                >
                  <div
                    className="card"
                    style={{
                      width: "100%",
                      maxWidth: 760,
                      maxHeight: "85vh",
                      overflowY: "auto",
                      border: "1px solid rgba(255,255,255,0.1)"
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="cardHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h2>
                        {beginnerTutorialView === "menu" && "Beginner Help"}
                        {beginnerTutorialView === "basics" && "Investing & Stock Trading Basics"}
                        {beginnerTutorialView === "app" && "How To Use Beginner Rayla"}
                      </h2>
                      <button
                        type="button"
                        className="ghostButton"
                        onClick={() => setShowBeginnerTutorial(false)}
                      >
                        Close
                      </button>
                    </div>

                    <div className="cardBody">
                      {beginnerTutorialView === "menu" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                          <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.7 }}>
                            What do you want help with?
                          </div>

                          {/* BASICS CARD */}
                          <div
                            onClick={() => {
                              setBeginnerTutorialStep(0);
                              setBeginnerTutorialView("basics");
                            }}
                            style={{
                              padding: 18,
                              borderRadius: 14,
                              background: "rgba(124,196,255,0.08)",
                              border: "1px solid rgba(124,196,255,0.2)",
                              cursor: "pointer"
                            }}
                          >
                            <div style={{ fontSize: 28, marginBottom: 6 }}>📚</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>
                              Learn Investing Basics
                            </div>
                            <div style={{ fontSize: 13, color: "#94a3b8" }}>
                              Quick, simple explanations of trading, stocks, and how everything works.
                            </div>
                          </div>

                          {/* APP CARD */}
                          <div
                            onClick={() => {
                              setBeginnerTutorialStep(0);
                              setBeginnerTutorialView("app");
                            }}
                            style={{
                              padding: 18,
                              borderRadius: 14,
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              cursor: "pointer"
                            }}
                          >
                            <div style={{ fontSize: 28, marginBottom: 6 }}>📱</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>
                              Learn How to Use Rayla
                            </div>
                            <div style={{ fontSize: 13, color: "#94a3b8" }}>
                              Walk through the beginner version of the app step by step.
                            </div>
                          </div>

                        </div>
                      )}

                                      {beginnerTutorialView === "basics" && (
                                <div
                                    key={`${beginnerTutorialView}-${beginnerTutorialStep}`}
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 16,
                                      animation: "fadeSlideIn 0.25s ease"
                                    }}
                                  >           
                                                    <div style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
                              Step {beginnerTutorialStep + 1} of 11
                            </div>
                            <div
                              style={{
                                width: "100%",
                                height: 8,
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.08)",
                                overflow: "hidden"
                              }}
                            >
                              <div
                                style={{
                                  width: `${((beginnerTutorialStep + 1) / 11) * 100}%`,
                                  height: "100%",
                                  background: "#7CC4FF",
                                  borderRadius: 999,
                                  transition: "width 0.25s ease"
                                }}
                              />
                            </div>
                          </div>
                          {beginnerTutorialStep === 0 && (
                            <>
                              <div style={{ fontSize: 40 }}>💰</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>What is Investing?</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                Investing means putting your money into something so it can grow over time.
                              </div>
                            </>
                          )}

                          {beginnerTutorialStep === 1 && (
                            <>
                              <div style={{ fontSize: 40 }}>🏢</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>What is a Stock?</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                A stock means you own a small piece of a company.
                                <br /><br />
                                If the company grows, your money can grow too.
                              </div>
                            </>
                          )}

                          {beginnerTutorialStep === 2 && (
                            <>
                              <div style={{ fontSize: 40 }}>📈</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>What is Trading?</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                Trading is buying and selling more often to make money from price movement.
                              </div>
                            </>
                          )}

                          {beginnerTutorialStep === 3 && (
                            <>
                              <div style={{ fontSize: 40 }}>🎯</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>Win Rate</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                Win rate is the percent of your trades that were winners.
                              </div>
                            </>
                          )}

                          {beginnerTutorialStep === 4 && (
                            <>
                              <div style={{ fontSize: 40 }}>📊</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>Result</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                Result shows how much you made or lost on a trade.
                              </div>
                            </>
                          )}

                          {beginnerTutorialStep === 5 && (
                            <>
                              <div style={{ fontSize: 40 }}>⚠️</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>Risk</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                Risk is how much you could lose if a trade goes wrong.
                              </div>
                            </>
                          )}

                          {beginnerTutorialStep === 6 && (
                            <>
                              <div style={{ fontSize: 40 }}>🧠</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>The Real Goal</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                You do not need to be perfect.
                                <br /><br />
                                Focus on learning, staying consistent, and improving over time.
                              </div>
                            </>
                          )}


                          {beginnerTutorialStep === 7 && (
                            <>
                              <div style={{ fontSize: 40 }}>🔤</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>Tickers & Assets</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                A ticker is the short name for an asset.
                                <br /><br />
                                Examples:
                                <br />
                                AAPL = Apple
                                <br />
                                TSLA = Tesla
                                <br />
                                BTC = Bitcoin
                                <br /><br />
                                These are what you buy and sell.
                              </div>
                            </>
                          )}

                          {beginnerTutorialStep === 8 && (
                            <>
                              <div style={{ fontSize: 40 }}>📈</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>Reading the Market</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                When prices go up → buyers are stronger.
                                <br />
                                When prices go down → sellers are stronger.
                                <br /><br />
                                You’re watching movement and deciding when to enter and exit.
                              </div>
                            </>
                          )}

                          {beginnerTutorialStep === 9 && (
                            <>
                              <div style={{ fontSize: 40 }}>📊</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>Equity Curve</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                Your equity curve shows how your results are changing over time.
                                <br /><br />
                                Up = you're improving  
                                Down = something needs adjusting
                              </div>
                            </>
                          )}

                          {beginnerTutorialStep === 10 && (
                            <>
                              <div style={{ fontSize: 40 }}>🤝</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>You’re Not Alone</div>
                              <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
                                Rayla is here to answer all of your questions about investing and trading.
                              </div>
                            </>
                          )}

                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                            <button
                              type="button"
                              className="ghostButton"
                              onClick={() => {
                                if (beginnerTutorialStep === 0) {
                                  setBeginnerTutorialView("menu");
                                } else {
                                  setBeginnerTutorialStep(prev => prev - 1);
                                }
                              }}
                            >
                              Back
                            </button>

                            {beginnerTutorialStep < 10 ? (
                              <button
                                type="button"
                                className="ghostButton"
                                onClick={() => setBeginnerTutorialStep(prev => prev + 1)}
                              >
                                Next
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="ghostButton"
                                onClick={() => {
                                  setShowBeginnerTutorial(false);
                                  setActiveTab("ai");
                                }}
                              >
                                Go to Ask Rayla
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {beginnerTutorialView === "app" && (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
        Beginner Rayla Walkthrough
      </div>
      <div
        style={{
          width: "100%",
          height: 8,
          borderRadius: 999,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            width:
              beginnerTutorialStep === 0 ? "25%" :
              beginnerTutorialStep === 1 ? "50%" :
              beginnerTutorialStep === 2 ? "75%" :
              "100%",
            height: "100%",
            background: "#7CC4FF",
            borderRadius: 999,
            transition: "width 0.25s ease"
          }}
        />
      </div>
    </div>

    {beginnerTutorialStep === 0 && (
      <>
        <div style={{ fontSize: 40 }}>🏠</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Your Home Screen</div>
        <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
          This beginner version of Rayla is designed to keep things simple, clean, and easy to follow.
        </div>
      </>
    )}

    {beginnerTutorialStep === 1 && (
      <>
        <div style={{ fontSize: 40 }}>📊</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Your Main Numbers</div>
        <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
          <strong>Trades Taken:</strong> how many trades you have logged.
          <br />
          <strong>Trades Won:</strong> the percent of your trades that were positive.
          <br />
          <strong>Average Result:</strong> how your trades are doing on average.
          <br />
          <strong>Overall Progress:</strong> your total progress across all logged trades.
        </div>
      </>
    )}

    {beginnerTutorialStep === 2 && (
      <>
        <div style={{ fontSize: 40 }}>📈</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Your Tools</div>
        <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
          <strong>Equity Curve:</strong> shows how your results are moving over time.
          <br />
          <strong>Live Market:</strong> lets you quickly watch assets and charts.
          <br />
          <strong>Recent Trades:</strong> helps you track what you’ve been doing.
        </div>
      </>
    )}

    {beginnerTutorialStep === 3 && (
      <>
        <div style={{ fontSize: 40 }}>🚀</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>As You Improve</div>
        <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
          As you get more comfortable, you can switch to Intermediate or Experienced in your profile to unlock more detail.
        </div>
      </>
    )}

    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
      <button
        type="button"
        className="ghostButton"
        onClick={() => {
          if (beginnerTutorialStep === 0) {
            setBeginnerTutorialView("menu");
          } else {
            setBeginnerTutorialStep(prev => prev - 1);
          }
        }}
      >
        Back
      </button>

      {beginnerTutorialStep < 3 ? (
        <button
          type="button"
          className="ghostButton"
          onClick={() => setBeginnerTutorialStep(prev => prev + 1)}
        >
          Next
        </button>
      ) : (
        <button
          type="button"
          className="ghostButton"
          onClick={() => setBeginnerTutorialView("menu")}
        >
          Done
        </button>
      )}
    </div>

  </div>
)}
                    </div>
                  </div>
                </div>
              )}

      <nav className="desktopSidebar">
        <div className="desktopSidebarBrand">Rayla</div>
        <div className={`desktopSidebarTotalR ${parseFloat(totalR) >= 0 ? "positive" : "negative"}`}>
          {parseFloat(totalR) >= 0 ? "+" : ""}{totalR}R
        </div>
        {navTabs.map(tab => (
          <button key={tab.id} className={`desktopSidebarBtn ${activeTab === tab.id ? "active" : ""}`} onClick={() => { setActiveTab(tab.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            {tab.icon}{tab.label}
          </button>
        ))}
        <div className="desktopSidebarSpacer" />
        <div className="desktopSidebarDivider" />
        <button className={`desktopSidebarBtn ${activeTab === "profile" ? "active" : ""}`} onClick={() => { setActiveTab("profile"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
          <User size={18} />Profile
        </button>
      </nav>

      <div className="appShellInner">
        <div className="topbar">
          <div>
            <p className="eyebrow">Rayla</p>
            <div className={`portfolioValue ${parseFloat(totalR) >= 0 ? "positive" : "negative"}`}>
              {parseFloat(totalR) >= 0 ? "+" : ""}{totalR}R
            </div>
            <p className="subheading">Total Performance</p>
          </div>
        </div>

        {activeTab === "home" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 12, marginBottom: 18 }}>
                            {(isBeginner
                ? [
                    { label: "Trades Taken", value: trades.length },
                    {
                    label: "Trades Won",
                    value: trades.length
                      ? `${((trades.filter(t => parseFloat(t.result_r) > 0).length / trades.length) * 100).toFixed(1)}%`
                      : "0%",
                    tone:
                      trades.length &&
                      (trades.filter(t => parseFloat(t.result_r) > 0).length / trades.length) >= 0.5
                        ? "positive"
                        : "negative",
                    tooltipKey: "winrate"
                  },
                    {
                      label: "Average Result",
                      value: trades.length
                        ? `${(trades.reduce((s,t) => s + parseFloat(t.result_r||0), 0) / trades.length) >= 0 ? "+" : ""}${(trades.reduce((s,t) => s + parseFloat(t.result_r||0), 0) / trades.length).toFixed(2)}R`
                        : "0R",
                      tone:
                        trades.length &&
                        trades.reduce((s,t) => s + parseFloat(t.result_r||0), 0) / trades.length >= 0
                          ? "positive"
                          : "negative",
                      tooltipKey: "avgres"
                    },
                    {
                      label: "Overall Progress",
                      value: `${parseFloat(totalR) >= 0 ? "+" : ""}${totalR}R`,
                      tone: parseFloat(totalR) >= 0 ? "positive" : "negative",
                      tooltipKey: "totalr"
                    }
                  ]
                : [
                    { label: "Trades", value: trades.length },
                    {
                      label: "Win Rate",
                      value: trades.length
                        ? `${((trades.filter(t => parseFloat(t.result_r) > 0).length / trades.length) * 100).toFixed(1)}%`
                        : "0%",
                      tone:
                        trades.length &&
                        (trades.filter(t => parseFloat(t.result_r) > 0).length / trades.length) >= 0.5
                          ? "positive"
                          : "negative"
                    },
                    {
                      label: "Avg R",
                      value: trades.length
                        ? `${(trades.reduce((s,t) => s + parseFloat(t.result_r||0), 0) / trades.length) >= 0 ? "+" : ""}${(trades.reduce((s,t) => s + parseFloat(t.result_r||0), 0) / trades.length).toFixed(2)}R`
                        : "0R",
                      tone:
                        trades.length &&
                        trades.reduce((s,t) => s + parseFloat(t.result_r||0), 0) / trades.length >= 0
                          ? "positive"
                          : "negative"
                    },
                    {
                      label: "Total R",
                      value: `${parseFloat(totalR) >= 0 ? "+" : ""}${totalR}R`,
                      tone: parseFloat(totalR) >= 0 ? "positive" : "negative"
                    },
                    {
                      label: "Avg Win",
                      value: trades.filter(t => parseFloat(t.result_r) > 0).length
                        ? `+${(trades.filter(t => parseFloat(t.result_r) > 0).reduce((s,t) => s + parseFloat(t.result_r), 0) / trades.filter(t => parseFloat(t.result_r) > 0).length).toFixed(2)}R`
                        : "--",
                      tone: "positive"
                    },
                    {
                      label: "Avg Loss",
                      value: trades.filter(t => parseFloat(t.result_r) < 0).length
                        ? `-${Math.abs(trades.filter(t => parseFloat(t.result_r) < 0).reduce((s,t) => s + parseFloat(t.result_r), 0) / trades.filter(t => parseFloat(t.result_r) < 0).length).toFixed(2)}R`
                        : "--",
                      tone: "negative"
                    }
                  ]
              ).map(item => (
                <div
                  key={item.label}
                  onClick={() => {
                    if (isBeginner && item.tooltipKey) {
                      setShowTooltip(item.tooltipKey);
                    }
                  }}
                  style={{
                    background: "rgba(18,26,38,0.86)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    padding: "14px 16px",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
                    cursor: isBeginner && item.tooltipKey ? "pointer" : "default"
                  }}
                >
                  <div style={{ fontSize: 11, color: "#94a6bb", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: item.tone === "positive" ? "#4ade80" : item.tone === "negative" ? "#f87171" : "#f3f7fc" }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {showTooltip === "winrate" && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 9999
                }}
                onClick={() => setShowTooltip(null)}
              >
                <div
                  className="card"
                  style={{ maxWidth: 400 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="cardHeader">
                    <h2>Win Rate</h2>
                  </div>

                  <div className="cardBody" style={{ lineHeight: 1.7 }}>
                    Win rate is the percentage of your trades that were winners.
                    <br /><br />
                    Example:
                    <br />
                    If you took 10 trades and 6 were profitable, your win rate is 60%.
                    <br /><br />
                    Higher doesn’t always mean better — what matters is how much you make vs lose.
                  </div>

                  <button
                    className="ghostButton"
                    onClick={() => setShowTooltip(null)}
                    style={{ marginTop: 10 }}
                  >
                    Got it
                  </button>
                </div>
              </div>
            )}

            {showTooltip === "avgres" && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 9999
                  }}
                  onClick={() => setShowTooltip(null)}
                >
                  <div
                    className="card"
                    style={{ maxWidth: 400 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="cardHeader">
                      <h2>Average Result</h2>
                    </div>

                    <div className="cardBody" style={{ lineHeight: 1.7 }}>
                      Average Result shows how your trades are doing on average.
                      <br /><br />
                      Example:
                      <br />
                      If your trades average +0.50R, that means each trade is making half of your risk on average.
                      <br /><br />
                      A positive number is good. A negative number means your average trade is losing.
                    </div>

                    <button
                      className="ghostButton"
                      onClick={() => setShowTooltip(null)}
                      style={{ marginTop: 10 }}
                    >
                      Got it
                    </button>
                  </div>
                </div>
              )}

              {showTooltip === "totalr" && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 9999
                  }}
                  onClick={() => setShowTooltip(null)}
                >
                  <div
                    className="card"
                    style={{ maxWidth: 400 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="cardHeader">
                      <h2>Overall Progress</h2>
                    </div>

                    <div className="cardBody" style={{ lineHeight: 1.7 }}>
                      Overall Progress shows your total performance across all trades.
                      <br /><br />
                      It’s measured in R (risk units), not dollars.
                      <br /><br />
                      Example:
                      <br />
                      +5R means you’ve gained 5 times your risk.
                      <br />
                      -3R means you’ve lost 3 times your risk.
                      <br /><br />
                      This is one of the most important numbers to track your progress over time.
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                      <button
                        className="ghostButton"
                        onClick={() => setShowTooltip(null)}
                      >
                        Got it
                      </button>

                      <button
                        className="ghostButton"
                        onClick={() => {
                          setShowTooltip(null);
                          setActiveTab("ai");
                          setTimeout(() => {
                            setAiInput("Explain my win rate and how I can improve it");
                          }, 100);
                        }}
                      >
                        Ask Rayla
                      </button>
                    </div>
                  </div>
                </div>
              )}
                        {isBeginner && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
                          <button
                            type="button"
                            className="ghostButton"
                            onClick={() => {
                              setBeginnerTutorialView("menu");
                              setBeginnerTutorialStep(0);
                              setShowBeginnerTutorial(true);
                            }}
                          >
                            Beginner Help
                          </button>
                        </div>
                      )}
            <div className="mainGrid">
              <div className="span6">
                <EquityCurveCard equitySeries={filteredEquitySeries} sourceLabel={equitySourceLabel} chartRange={chartRange} setChartRange={setChartRange} />
              </div>
              <div className="span6">
                <MarketCard items={marketItems} selectedId={selectedMarketId} onSelect={setSelectedMarketId} onRemove={handleRemoveSymbol} newSymbol={newSymbol} setNewSymbol={setNewSymbol} onAddSymbol={handleAddSymbol} />
              </div>
              <div className="span4">
                <RecentTradesCard recentTrades={recentTrades} onDeleteTrade={handleDeleteTrade} />
              </div>
              <div className="span4">
                              {!isBeginner && (
                              <>
                                <div className="span4">
                                  <div className="card" style={{ height: "100%" }}>
                                    <div className="cardHeader"><h2>Top Edges</h2></div>
                                    <div className="cardBody">
                                      <div className="list">
                                        {topEdges.map((edge, index) => (
                                          <div className="listRow" key={edge.name}>
                                            <div>
                                              <div className="listTitle">{index + 1}. {edge.name}</div>
                                              <div className="listSubtext">{edge.trades} trades</div>
                                            </div>
                                            <div className="pill">{edge.avgR}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="span4">
                                  {(() => {
                                    const r = buildCoachReport(trades);
                                    if (!r) return (
                                      <div className="card" style={{ height: "100%" }}>
                                        <div className="cardHeader"><h2>Coach Insights</h2></div>
                                        <div className="cardBody"><div style={{ fontSize: 13, color: "#7f8ea3" }}>Log trades to unlock coach insights.</div></div>
                                      </div>
                                    );
                                    return (
                                      <div className="card" style={{ height: "100%", borderColor: "rgba(124,196,255,0.2)" }}>
                                        <div className="cardHeader"><h2>Coach Insights</h2></div>
                                        <div className="cardBody">
                                          <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.7 }}>
                                            {`Win Rate: ${r.winRate.toFixed(1)}% · Avg R: ${r.avgR >= 0 ? "+" : ""}${r.avgR.toFixed(2)}R · ${r.trades} trades`}
                                          </div>
                                          {r.bestCombo && (
                                            <div style={{ marginTop: 8, fontSize: 13, color: "#e2e8f0", lineHeight: 1.7 }}>
                                              {`Strongest edge: ${r.bestCombo.setup} on ${r.bestCombo.asset} — ${r.bestCombo.avgR.toFixed(2)}R avg`}
                                            </div>
                                          )}
                                          {r.warnings.length > 0 && (
                                            <div style={{ marginTop: 8, fontSize: 13, color: "#fbbf24", lineHeight: 1.7 }}>
                                              {r.warnings[0]}
                                            </div>
                                          )}
                                          {r.actions.length > 0 && (
                                            <div style={{ marginTop: 8, fontSize: 13, color: "#7CC4FF", lineHeight: 1.7 }}>
                                              {`Next: ${r.actions[0]}`}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </>
                            )}
              </div>
            </div>
          </>
        )}

        {activeTab === "trades" && (
          <div className="mainGrid">
            <div className="span12">
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button type="button" className="ghostButton" onClick={() => setTradeView("log")} style={{ opacity: tradeView === "log" ? 1 : 0.5 }}>Log Trade</button>
                <button type="button" className="ghostButton" onClick={() => setTradeView("recent")} style={{ opacity: tradeView === "recent" ? 1 : 0.5 }}>Recent Trades</button>
                <button type="button" className="ghostButton" onClick={() => setTradeView("all")} style={{ opacity: tradeView === "all" ? 1 : 0.5 }}>All Trades</button>
              </div>
              {tradeView === "log" && (
                <div className="card">
                  <h3>Log Trade</h3>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", background: "rgba(124,196,255,0.08)", border: "1px dashed rgba(124,196,255,0.3)", borderRadius: 10, cursor: "pointer", fontSize: 13, color: "#7CC4FF", fontWeight: 600 }}>
                      📸 Upload Trade Screenshot
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleScreenshotUpload} />
                    </label>
                  </div>
                  <form onSubmit={handleAddTrade} className="tradeEntryRow">
                    <input className="authInput" placeholder="Asset (BTC, AAPL)" value={tradeForm.asset} onChange={(e) => setTradeForm({ ...tradeForm, asset: e.target.value })} />
                    <input className="authInput" placeholder="Entry Price" value={tradeForm.entryPrice} onChange={(e) => setTradeForm({ ...tradeForm, entryPrice: e.target.value })} />
                    <input className="authInput" placeholder="Size ($)" value={tradeForm.size} onChange={(e) => setTradeForm({ ...tradeForm, size: e.target.value })} />
                    <input className="authInput" type="datetime-local" value={tradeForm.entryTime} onChange={(e) => setTradeForm({ ...tradeForm, entryTime: e.target.value })} />
                    <select className="authInput" value={tradeForm.setup} onChange={(e) => setTradeForm({ ...tradeForm, setup: e.target.value })}>
                      <option value="">Select Setup (optional)</option>
                      {SETUP_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select className="authInput" value={tradeForm.session} onChange={(e) => setTradeForm({ ...tradeForm, session: e.target.value })}>
                      <option value="">Select Session (optional)</option>
                      {SESSION_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select className="authInput" value={tradeForm.direction} onChange={(e) => setTradeForm({ ...tradeForm, direction: e.target.value })}>
                      <option value="">Direction (optional)</option>
                      <option value="long">Long</option>
                      <option value="short">Short</option>
                    </select>
                    <select className="authInput" value={tradeForm.marketCondition} onChange={(e) => setTradeForm({ ...tradeForm, marketCondition: e.target.value })}>
                      <option value="">Market Condition (optional)</option>
                      <option value="trending">Trending</option>
                      <option value="ranging">Ranging</option>
                      <option value="volatile">Volatile</option>
                      <option value="weak_trend">Weak Trend</option>
                    </select>
                    <input className="authInput" placeholder="Result (R)" value={tradeForm.result} onChange={(e) => setTradeForm({ ...tradeForm, result: e.target.value })} />
                    <button type="submit" className="ghostButton">Save Trade</button>
                  </form>
                </div>
              )}
              {tradeView === "recent" && <RecentTradesCard recentTrades={recentTrades} onDeleteTrade={handleDeleteTrade} />}
              {tradeView === "all" && <RecentTradesCard recentTrades={trades} onDeleteTrade={handleDeleteTrade} />}
            </div>
          </div>
        )}

        {activeTab === "market" && (
          <div className="mainGrid">
            <div className="span12">
              <MarketCard items={marketItems} selectedId={selectedMarketId} onSelect={setSelectedMarketId} onRemove={handleRemoveSymbol} newSymbol={newSymbol} setNewSymbol={setNewSymbol} onAddSymbol={handleAddSymbol} fullPage={true} />
            </div>
          </div>
        )}

        {activeTab === "simulation" && (
          <div className="mainGrid">
            <div className="span12">
              <div className="card">
                <div className="cardHeader">
                  <h2>Simulation</h2>
                </div>
                <div className="cardBody" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div style={{ fontSize: 13, color: "#94a3b8" }}>
                    Practice trading with fake money and simulated outcomes.
                  </div>

                  <div style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7f8ea3" }}>
                        Trade Controls
                      </div>
                      {simulationPosition && (
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#4ade80", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 999, padding: "5px 10px" }}>
                          Position Open
                        </div>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, alignItems: "end" }}>
                      <select
                        className="authInput"
                        value={selectedMarketId}
                        onChange={(e) => setSelectedMarketId(e.target.value)}
                      >
                        {marketItems.map((item) => (
                          <option key={item.id} value={item.id}>{item.id}</option>
                        ))}
                      </select>
                      <select
                        className="authInput"
                        value={simulationDirection}
                        onChange={(e) => setSimulationDirection(e.target.value)}
                      >
                        <option value="long">Buy / Long</option>
                        <option value="short">Sell / Short</option>
                      </select>
                      <input
                        className="authInput"
                        placeholder="Amount ($)"
                        type="number"
                        step="0.01"
                        value={simulationAmount}
                        onChange={(e) => setSimulationAmount(e.target.value)}
                      />
                      <input
                        className="authInput"
                        placeholder="Stop loss"
                        type="number"
                        step="0.01"
                        value={simulationStopLoss}
                        onChange={(e) => setSimulationStopLoss(e.target.value)}
                      />
                      <input
                        className="authInput"
                        placeholder="Take profit"
                        type="number"
                        step="0.01"
                        value={simulationTakeProfit}
                        onChange={(e) => setSimulationTakeProfit(e.target.value)}
                      />
                      <button
                        type="button"
                        className="ghostButton"
                        onClick={handleOpenSimulationTrade}
                        disabled={!selectedSimulationItem || !!simulationPosition}
                        style={simulationPosition ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                      >
                        {simulationPosition ? "Trade Active" : "Open Trade"}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "0 2px" }}>
                    <div style={{ fontSize: 13, color: "#e2e8f0" }}>
                      {selectedSimulationItem ? `${selectedSimulationItem.label} (${selectedSimulationItem.id})` : "No asset selected"}
                    </div>
                    <div style={{ fontSize: 13, color: "#94a3b8" }}>
                      Current price: <span style={{ color: "#e2e8f0", fontWeight: 700 }}>
                        {selectedSimulationPrice != null ? `$${formatCompactPrice(selectedSimulationPrice)}` : "--"}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7f8ea3" }}>
                      Live Chart
                    </div>
                  <div className="tradingviewFrameWrapFull" style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, overflow: "hidden" }}>
                    {selectedSimulationItem ? (
                      <iframe
                        key={`${selectedSimulationItem.tvSymbol}-simulation`}
                        title={`${selectedSimulationItem.id} simulation chart`}
                        className="tradingviewFrame"
                        src={simulationChartSrc}
                      />
                    ) : null}
                  </div>
                  </div>

                  {simulationPosition && (
                    <div style={{ padding: 16, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7f8ea3" }}>
                          Open Position
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#4ade80", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 999, padding: "5px 10px" }}>
                            Live
                          </div>
                          <div style={{ fontSize: 12, color: "#94a3b8" }}>
                            Time in trade: <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{formatTimeInTrade(simulationPosition.openedAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Asset</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>
                            {simulationPosition.asset}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Direction</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", textTransform: "capitalize" }}>
                            {simulationPosition.direction}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Entry Price</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>
                            ${formatCompactPrice(simulationPosition.entryPrice)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Stop Loss</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#f87171" }}>
                            ${formatCompactPrice(simulationPosition.stopLoss)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Take Profit</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#4ade80" }}>
                            ${formatCompactPrice(simulationPosition.takeProfit)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Current Price</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>
                            {openPositionCurrentPrice != null ? `$${formatCompactPrice(openPositionCurrentPrice)}` : "--"}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Unrealized P/L</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: openPositionMetrics.profitLoss >= 0 ? "#4ade80" : "#f87171" }}>
                            {`${openPositionMetrics.profitLoss >= 0 ? "+" : ""}$${openPositionMetrics.profitLoss.toFixed(2)}`}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Unrealized R</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: openPositionMetrics.rMultiple >= 0 ? "#4ade80" : "#f87171" }}>
                            {`${openPositionMetrics.rMultiple >= 0 ? "+" : ""}${openPositionMetrics.rMultiple.toFixed(2)}R`}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Planned Risk</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>
                            ${simulationPosition.plannedRisk.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <div>
                        <button type="button" className="ghostButton" onClick={handleCloseSimulationTrade}>
                          Close Trade
                        </button>
                      </div>
                    </div>
                  )}

                  {simulationClosedTrade && (
                    <div style={{ padding: 16, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7f8ea3", marginBottom: 12 }}>
                        Closed Trade
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Asset</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>
                            {simulationClosedTrade.asset}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Exit</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: simulationClosedTrade.exitReason === "Target Hit" ? "#4ade80" : simulationClosedTrade.exitReason === "Stopped Out" ? "#f87171" : "#e2e8f0" }}>
                            {simulationClosedTrade.exitReason}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Realized P/L</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: simulationClosedTrade.profitLoss >= 0 ? "#4ade80" : "#f87171" }}>
                            {`${simulationClosedTrade.profitLoss >= 0 ? "+" : ""}$${simulationClosedTrade.profitLoss.toFixed(2)}`}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Realized R</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: simulationClosedTrade.rMultiple >= 0 ? "#4ade80" : "#f87171" }}>
                            {`${simulationClosedTrade.rMultiple >= 0 ? "+" : ""}${simulationClosedTrade.rMultiple.toFixed(2)}R`}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Exit Price</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>
                            ${formatCompactPrice(simulationClosedTrade.exitPrice)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 4 }}>Planned Risk</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>
                            ${simulationClosedTrade.plannedRisk.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: 14, fontSize: 13, color: "#e2e8f0", lineHeight: 1.6 }}>
                        {simulationClosedTrade.feedback}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "ai" && (
          <div className="mainGrid">
            <div className="span12" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <CoachAskBox trades={trades} onAskRayla={requestRaylaAnswer} isLoading={isRaylaLoading} />
              <AICoachTab trades={trades} onRunAnalysis={runAIAnalysis} showNoNewTrades={showNoNewTrades} coachSummary={coachSummary} />
            </div>
          </div>
        )}

        {activeTab === "ask" && (
          <div className="card">
            <div className="cardHeader">
              <h2>Ask Rayla</h2>
            </div>

            <div className="cardBody" style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              <div style={{ fontSize: 13, color: "#94a3b8" }}>
                Ask anything about trading, your performance, the market, or the Rayla app.
              </div>

              <textarea
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Ask Rayla anything..."
                style={{
                  width: "100%",
                  minHeight: 100,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(0,0,0,0.2)",
                  color: "#e2e8f0",
                  padding: 10,
                  fontSize: 14,
                  resize: "none"
                }}
              />

              {isRaylaLoading && (
                <div style={{ fontSize: 13, color: "#94a3b8" }}>
                  Rayla is thinking...
                </div>
              )}

              <button
                className="ghostButton"
                onClick={async () => {
                try {
                  await handleAskRaylaQuestion(aiInput, { clearInput: true });
                } catch (err) {
                  console.error("ASK RAYLA FETCH ERROR:", err);
                }
              }}
              >
                Ask Rayla
              </button>

              {raylaResponse && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 12,
                    borderRadius: 10,
                    background: "rgba(124,196,255,0.08)",
                    border: "1px solid rgba(124,196,255,0.2)",
                    fontSize: 14,
                    lineHeight: 1.6
                  }}
                >
                  {raylaResponse}
                </div>
              )}

            </div>
          </div>
        )}

        {activeTab === "intel" && (
          <div className="mainGrid">
            <div className="span12">
              <div className="card">
                <h3>Market Intel</h3>
                <div className="card" style={{ marginTop: 24 }}>
                  <h4>Ask Rayla About The Market</h4>
                  <form onSubmit={async e => {
                    e.preventDefault();
                    const question = e.target.elements.raylaq.value.trim();
                    if (!question) return;
                    try {
                      await handleAskRaylaQuestion(question);
                      e.target.reset();
                    } catch {
                      setRaylaResponse("API error.");
                    }
                  }} style={{ marginBottom: 16 }}>
                    <input name="raylaq" type="text" placeholder="e.g. Is NVDA hot or cold today? What's the signal on BTC?" style={{ flex: 1, marginRight: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#e2e8f0", outline: "none" }} autoComplete="off" disabled={isRaylaLoading} />
                    <button type="submit" disabled={isRaylaLoading} style={{ background: "#7CC4FF", color: "#0b1017", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Ask Rayla</button>
                  </form>
                  {isRaylaLoading && <div style={{ fontSize: 13, color: "#7f8ea3", marginTop: 8 }}>Thinking...</div>}
                  {raylaResponse && (
                    <div style={{ marginTop: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12 }}>
                      <div style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "#e2e8f0", lineHeight: 1.6 }}>{raylaResponse}</div>
                    </div>
                  )}
                </div>
                {(intelLoading || !hotColdReport) && <div className="listSubtext" style={{ marginTop: "10px" }}>Loading today's report...</div>}
                {hotColdReport && (
                  <>
                    {[["Hot Stocks", "#ef4444", hotColdReport.stockHot], ["Cold Stocks", "#7CC4FF", hotColdReport.stockCold]].map(([label, color, items]) => (
                      <div key={label} style={{ marginTop: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7f8ea3" }}>{label}</div>
                        </div>
                        {items?.slice(0, 3).map((item) => <IntelAssetCard key={`${label}-${item.symbol}`} item={item} />)}
                      </div>
                    ))}
                    {[["Hot Crypto", "#ef4444", hotColdReport.cryptoHot], ["Cold Crypto", "#7CC4FF", hotColdReport.cryptoCold]].map(([label, color, item]) => (
                      <div key={label} style={{ marginTop: "22px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "#7f8ea3" }}>{label}</div>
                        </div>
                        {item && <IntelAssetCard item={item} />}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

       {activeTab === "profile" && (
  <div className="mainGrid">
    <div className="span12">
      <div className="card profileCard">
        <h3>Profile</h3>
        <div className="list">
          <div className="listRow">
            <div>
              <input className="authInput" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              <div className="listSubtext">{user?.email || "No email found"}</div>
                            <div style={{ marginTop: 16 }}>
                <div className="listSubtext" style={{ marginBottom: 8 }}>
                  User Level
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="ghostButton"
                    onClick={() => handleUserLevelChange("beginner")}
                    style={{
                      border: userLevel === "beginner" ? "1px solid #7CC4FF" : undefined,
                      background: userLevel === "beginner" ? "rgba(124,196,255,0.12)" : undefined
                    }}
                  >
                    Beginner
                  </button>

                  <button
                    type="button"
                    className="ghostButton"
                    onClick={() => handleUserLevelChange("intermediate")}
                    style={{
                      border: userLevel === "intermediate" ? "1px solid #7CC4FF" : undefined,
                      background: userLevel === "intermediate" ? "rgba(124,196,255,0.12)" : undefined
                    }}
                  >
                    Intermediate
                  </button>

                  <button
                    type="button"
                    className="ghostButton"
                    onClick={() => handleUserLevelChange("experienced")}
                    style={{
                      border: userLevel === "experienced" ? "1px solid #7CC4FF" : undefined,
                      background: userLevel === "experienced" ? "rgba(124,196,255,0.12)" : undefined
                    }}
                  >
                    Experienced
                  </button>
                </div>
              </div>
            </div>
          </div>
          <button className="ghostButton" type="button" onClick={async () => {
            const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
            if (error) { showToast("Could not save name.", "error"); return; }
            showToast("Name updated.", "success");
            window.location.reload();
          }}>Save Name</button>
          <button className="ghostButton" type="button" onClick={() => setShowTutorial(true)}>View Tutorial</button>
          <button className="ghostButton" type="button" onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}>Sign Out</button>
          <button className="ghostButton" type="button" onClick={handleDeleteAccount}>
            Delete Account
          </button>
          <div className="listRow"><div><div className="listTitle">Trades Logged</div><div className="listSubtext">{trades.length}</div></div></div>
          <div className="listRow"><div><div className="listTitle">Win Rate</div><div className="listSubtext">{winRate}</div></div></div>
          <div className="listRow"><div><div className="listTitle">Average R</div><div className="listSubtext">{avgR}</div></div></div>
        </div>
      </div>
      <SubscriptionCard />
    </div>
  </div>
)}



        <div className="mobileNav">
          {navTabs.map(tab => (
            <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => { setActiveTab(tab.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              {tab.icon}<span>{tab.label}</span>
            </button>
          ))}
          <button className={activeTab === "profile" ? "active" : ""} onClick={() => { setActiveTab("profile"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <User size={18} /><span>Profile</span>
          </button>
        </div>
        {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
      </div>
    </div>
  );
}
