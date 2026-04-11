import { useEffect, useMemo, useState } from "react";
import "./App.css";
import Login from "./Login";
import { supabase } from "./supabase";
import { LayoutDashboard, PlusSquare, Brain, User, ClipboardList } from "lucide-react";

const marketSeeds = [
  { id: "BTC", label: "Bitcoin", tvSymbol: "BINANCE:BTCUSDT", fallbackPrice: "64,210", fallbackChange: "+1.2%" },
  { id: "ETH", label: "Ethereum", tvSymbol: "BINANCE:ETHUSDT", fallbackPrice: "3,120", fallbackChange: "+0.9%" },
  { id: "SPY", label: "SPDR S&P 500 ETF", tvSymbol: "AMEX:SPY", fallbackPrice: "521.14", fallbackChange: "-0.4%" },
  { id: "NVDA", label: "NVIDIA", tvSymbol: "NASDAQ:NVDA", fallbackPrice: "908.55", fallbackChange: "+3.2%" },
  { id: "AAPL", label: "Apple", tvSymbol: "NASDAQ:AAPL", fallbackPrice: "212.44", fallbackChange: "-0.4%" },
];

const fallbackEquity = [100, 101.5, 100.7, 102.1, 103.4, 102.8, 104.6, 105.2];

const SETUP_OPTIONS = ["rejection","breakout","pullback","reversal","range"];
const SESSION_OPTIONS = ["Asia","London","New York","After Hours"];

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
  const selectedItem = items.find((item) => item.id === selectedId) || items[0];
  const iframeSrc = selectedItem
    ? `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(selectedItem.tvSymbol)}&interval=15&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&hideideas=1&studies=%5B%5D`
    : "";

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
  );

  return (
    <Card title="Live Market" className="marketCard">
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        <input
          type="text"
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value)}
          placeholder="e.g. AAPL, BTC, NRG"
          onKeyDown={(e) => {
            if (e.key === "Enter") onAddSymbol();
          }}
          className="authInput"
        />
        <button
            type="button"
            onClick={() => onAddSymbol()}
            className="ghostButton"
          >
  Add
</button>
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

function getAnswerFromReport(r, question) {
  const ql = question.toLowerCase();
  if (ql.includes("best setup") || ql.includes("strongest")) {
    return r.bestCombo ? `Your strongest edge is ${r.bestCombo.setup} on ${r.bestCombo.asset} — ${r.bestCombo.avgR.toFixed(2)}R avg with a ${r.bestCombo.winRate.toFixed(0)}% win rate across ${r.bestCombo.trades} trades.` : "Need at least 2 trades in the same setup.";
  } else if (ql.includes("win rate")) {
    return `Your win rate is ${r.winRate.toFixed(1)}% across ${r.trades} trades.`;
  } else if (ql.includes("avg r") || ql.includes("average r")) {
    return `Your average R is ${r.avgR >= 0 ? "+" : ""}${r.avgR.toFixed(2)}R per trade.`;
  } else if (ql.includes("overtrading")) {
    return r.trades >= 5 && r.winRate < 50 ? "Possibly — win rate under 50% with 5+ trades suggests you may be forcing setups. Be more selective." : "Not necessarily. Keep logging and stay disciplined.";
  } else if (ql.includes("worst") || ql.includes("weak")) {
    const worst = r.setupStats[r.setupStats.length - 1];
    return worst ? `Your weakest setup is ${worst.setup} — ${worst.avgR.toFixed(2)}R avg, ${worst.winRate.toFixed(0)}% win rate over ${worst.trades} trades.` : "Not enough data yet.";
  } else if (ql.includes("focus") || ql.includes("should i")) {
    return r.actions[0] || "Keep logging trades consistently and review your edge weekly.";
  }
  return `Win Rate: ${r.winRate.toFixed(1)}% · Avg R: ${r.avgR >= 0 ? "+" : ""}${r.avgR.toFixed(2)}R · Total R: ${r.totalR >= 0 ? "+" : ""}${r.totalR.toFixed(2)}R · ${r.trades} trades.${r.bestCombo ? " Best edge: " + r.bestCombo.setup + " on " + r.bestCombo.asset + " (" + r.bestCombo.avgR.toFixed(2) + "R avg)." : ""}${r.warnings.length > 0 ? " Watch: " + r.warnings[0] : ""}`;
}

function CoachAskBox({ trades }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  function handleAsk() {
    const q = question.trim();
    if (!q) return;
    const r = buildCoachReport(trades);
    if (!r) { setAnswer("No trades logged yet. Start logging trades first."); setQuestion(""); return; }
    setAnswer(getAnswerFromReport(r, q));
    setQuestion("");
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
          />
          <button type="button" style={{ background: "#7CC4FF", color: "#0b1017", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }} onClick={handleAsk}>Ask</button>
        </div>
        {answer && <div style={{ marginTop: 12, fontSize: 13, color: "#e2e8f0", lineHeight: 1.6 }}>{answer}</div>}
      </div>
    </div>
  );
}

export default function App() {
  const [selectedMarketId, setSelectedMarketId] = useState("BTC");
  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem("rayla-watchlist");
    return saved ? JSON.parse(saved) : marketSeeds;
  });
  useEffect(() => {
  localStorage.setItem("rayla-watchlist", JSON.stringify(watchlist));
}, [watchlist]);
  const [intelLoading, setIntelLoading] = useState(false);
  const [hotColdReport, setHotColdReport] = useState(null);
  const [isRaylaLoading, setIsRaylaLoading] = useState(false);
  const [raylaResponse, setRaylaResponse] = useState("");
  const [activeTab, setActiveTab] = useState("home");
  const [newSymbol, setNewSymbol] = useState("");
  const [user, setUser] = useState(null);
  const [chartRange, setChartRange] = useState("ALL");
  const [displayName, setDisplayName] = useState("");
  const [session, setSession] = useState(null);
  const [lastAnalyzedCount, setLastAnalyzedCount] = useState(-1);
  const [showNoNewTrades, setShowNoNewTrades] = useState(false);
  const [coachSummary, setCoachSummary] = useState(null);
  const [equitySourceLabel, setEquitySourceLabel] = useState("No trades yet. Add your first trade.");
  const [trades, setTrades] = useState([]);
  const [raylaUserCount, setRaylaUserCount] = useState(0);
  const [toast, setToast] = useState(null);
  const [tradeView, setTradeView] = useState("recent");
  const [tradeForm, setTradeForm] = useState({
    asset: "", entryPrice: "", size: "", entryTime: "", setup: "", session: "", marketCondition: "", direction: "", result: "", exitPrice: "", exitTime: "",
  });

  function showToast(message, type = "success") { setToast({ message, type }); setTimeout(() => setToast(null), 3500); }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sessionData) => { setSession(sessionData); });
    return () => { listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { fetchRaylaUserCount(); }, []);

  useEffect(() => {
    if (activeTab !== "intel" || hotColdReport !== null) return;
    setIntelLoading(true);
    fetch("https://uoxzzhtnzmsolvcykynu.functions.supabase.co/daily-intel")
      .then(r => r.json())
      .then(data => {
        setHotColdReport({ stockHot: data.stockHot || [], stockCold: data.stockCold || [], cryptoHot: data.cryptoHot || null, cryptoCold: data.cryptoCold || null });
        setIntelLoading(false);
      })
      .catch(() => {
        setHotColdReport({ stockHot: [], stockCold: [], cryptoHot: null, cryptoCold: null });
        setIntelLoading(false);
      });
  }, [activeTab]);

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
      setEquitySourceLabel("Equity based on logged trades");
    }
    loadUserAndTrades();
  }, []);

  const recentTrades = trades.slice(0, 5);

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

  async function handleScreenshotUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(",")[1];
      const key = window.__OPENAI_KEY__;
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
        body: JSON.stringify({ model: "gpt-4o", max_tokens: 500, messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "data:image/jpeg;base64," + base64 } }, { type: "text", text: "Extract trade details and return ONLY JSON: { asset, entryPrice, size, direction, result, setup, session }" }] }] }),
      });
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || "{}";
      try {
        const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
        setTradeForm({ asset: parsed.asset || "", entryPrice: parsed.entryPrice || "", size: parsed.size || "", entryTime: "", setup: parsed.setup || "", session: parsed.session || "", marketCondition: "", direction: parsed.direction || "", result: parsed.result?.toString() || "", exitPrice: "", exitTime: "" });
        const missing = [];
        if (!parsed.asset) missing.push("asset");
        if (!parsed.entryPrice) missing.push("entry price");
        if (!parsed.size) missing.push("size");
        if (!parsed.direction) missing.push("direction");
        if (!parsed.result) missing.push("result");
        missing.push("entry time (fill in manually)");
        showToast("Screenshot accepted — missing: " + missing.join(", ") + ". Fill in manually.", "warning");
      } catch { showToast("Screenshot could not be parsed — fill in manually.", "error"); }
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

  function handleAddSymbol(overrideSymbol) {
    alert(`handleAddSymbol fired: ${overrideSymbol || newSymbol}`);
  const raw = (overrideSymbol || newSymbol).trim();
  if (!raw) return;

  const upper = raw.toUpperCase();

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

  setWatchlist((prev) => [
    ...prev,
    {
      id,
      label: id,
      tvSymbol,
      fallbackPrice: "0.00",
      fallbackChange: "0.0%",
    },
  ]);

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
    return { ...item, priceValue: fallbackPrice, changeValue: fallbackChange, priceText: formatCompactPrice(fallbackPrice), changeText: formatPctChange(fallbackChange) };
  });

  if (!session) return <Login onLogin={() => window.location.reload()} />;

  const navTabs = [
    { id: "home", icon: <LayoutDashboard size={18} />, label: "Home" },
    { id: "trades", icon: <PlusSquare size={18} />, label: "Trades" },
    { id: "market", icon: <ClipboardList size={18} />, label: "Market" },
    { id: "ai", icon: <Brain size={18} />, label: "AI Coach" },
    { id: "intel", icon: <Brain size={18} />, label: "Intel" },
  ];

  return (
    <div className="appShell">
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
            {user?.email === "davis.tovey@gmail.com" && <div style={{ fontSize: "12px", opacity: 0.7 }}>Users: {raylaUserCount}</div>}
            <div className={`portfolioValue ${parseFloat(totalR) >= 0 ? "positive" : "negative"}`}>
              {parseFloat(totalR) >= 0 ? "+" : ""}{totalR}R
            </div>
            <p className="subheading">Total Performance</p>
          </div>
        </div>

        {activeTab === "home" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 12, marginBottom: 18 }}>
              {[
                { label: "Trades", value: trades.length },
                { label: "Win Rate", value: trades.length ? `${((trades.filter(t => parseFloat(t.result_r) > 0).length / trades.length) * 100).toFixed(1)}%` : "0%", tone: trades.length && (trades.filter(t => parseFloat(t.result_r) > 0).length / trades.length) >= 0.5 ? "positive" : "negative" },
                { label: "Avg R", value: trades.length ? `${(trades.reduce((s,t) => s + parseFloat(t.result_r||0), 0) / trades.length) >= 0 ? "+" : ""}${(trades.reduce((s,t) => s + parseFloat(t.result_r||0), 0) / trades.length).toFixed(2)}R` : "0R", tone: trades.length && trades.reduce((s,t) => s + parseFloat(t.result_r||0), 0) / trades.length >= 0 ? "positive" : "negative" },
                { label: "Total R", value: `${parseFloat(totalR) >= 0 ? "+" : ""}${totalR}R`, tone: parseFloat(totalR) >= 0 ? "positive" : "negative" },
                { label: "Avg Win", value: trades.filter(t => parseFloat(t.result_r) > 0).length ? `+${(trades.filter(t => parseFloat(t.result_r) > 0).reduce((s,t) => s + parseFloat(t.result_r), 0) / trades.filter(t => parseFloat(t.result_r) > 0).length).toFixed(2)}R` : "--", tone: "positive" },
                { label: "Avg Loss", value: trades.filter(t => parseFloat(t.result_r) < 0).length ? `-${Math.abs(trades.filter(t => parseFloat(t.result_r) < 0).reduce((s,t) => s + parseFloat(t.result_r), 0) / trades.filter(t => parseFloat(t.result_r) < 0).length).toFixed(2)}R` : "--", tone: "negative" },
              ].map(item => (
                <div key={item.label} style={{ background: "rgba(18,26,38,0.86)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "14px 16px", boxShadow: "0 8px 30px rgba(0,0,0,0.18)" }}>
                  <div style={{ fontSize: 11, color: "#94a6bb", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>{item.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: item.tone === "positive" ? "#4ade80" : item.tone === "negative" ? "#f87171" : "#f3f7fc" }}>{item.value}</div>
                </div>
              ))}
            </div>
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
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 16, paddingTop: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#7f8ea3", marginBottom: 12 }}>Quick Log</div>
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        if (!user) { showToast("No user loaded.", "error"); return; }
                        const fd = new FormData(e.target);
                        const asset = fd.get("ql_asset")?.trim();
                        const result = fd.get("ql_result")?.trim();
                        const setup = fd.get("ql_setup")?.trim();
                        if (!asset || !result) { showToast("Asset and result are required.", "warning"); return; }
                        const { data, error } = await supabase.from("trades").insert([{ user_id: user.id, asset, result_r: Number(result), setup: setup || "", entry_price: 0, entry_size: 0, entry_time: new Date().toISOString() }]).select().single();
                        if (error) { showToast(error.message, "error"); return; }
                        setTrades((prev) => [data, ...prev]);
                        e.target.reset();
                        showToast("Trade logged.", "success");
                      }} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <input name="ql_asset" className="authInput" placeholder="Asset (BTC, AAPL)" />
                        <input name="ql_result" className="authInput" placeholder="Result (R)" type="number" step="0.1" />
                        <select name="ql_setup" className="authInput">
                          <option value="">Setup (optional)</option>
                          {SETUP_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button type="submit" className="ghostButton">Log Trade</button>
                      </form>
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
                        <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.7 }}>{`Win Rate: ${r.winRate.toFixed(1)}% · Avg R: ${r.avgR >= 0 ? "+" : ""}${r.avgR.toFixed(2)}R · ${r.trades} trades`}</div>
                        {r.bestCombo && <div style={{ marginTop: 8, fontSize: 13, color: "#e2e8f0", lineHeight: 1.7 }}>{`Strongest edge: ${r.bestCombo.setup} on ${r.bestCombo.asset} — ${r.bestCombo.avgR.toFixed(2)}R avg`}</div>}
                        {r.warnings.length > 0 && <div style={{ marginTop: 8, fontSize: 13, color: "#fbbf24", lineHeight: 1.7 }}>{r.warnings[0]}</div>}
                        {r.actions.length > 0 && <div style={{ marginTop: 8, fontSize: 13, color: "#7CC4FF", lineHeight: 1.7 }}>{`Next: ${r.actions[0]}`}</div>}
                      </div>
                    </div>
                  );
                })()}
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

        {activeTab === "ai" && (
          <div className="mainGrid">
            <div className="span12" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <CoachAskBox trades={trades} />
              <AICoachTab trades={trades} onRunAnalysis={runAIAnalysis} showNoNewTrades={showNoNewTrades} coachSummary={coachSummary} />
            </div>
          </div>
        )}

        {activeTab === "intel" && (
          <div className="mainGrid">
            <div className="span12">
              <div className="card">
                <h3>Market Intel</h3>
                <div className="card" style={{ marginTop: 24 }}>
                  <h4>Ask Rayla about any stock or crypto</h4>
                  <form onSubmit={async e => {
                    e.preventDefault();
                    const question = e.target.elements.raylaq.value.trim();
                    if (!question) return;
                    setIsRaylaLoading(true);
                    setRaylaResponse("");
                    try {
                      const res = await fetch("https://uoxzzhtnzmsolvcykynu.functions.supabase.co/daily-intel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
                      const data = await res.json();
                      setIsRaylaLoading(false);
                      setRaylaResponse(data.error ? data.error : data.answer || "No response.");
                    } catch { setIsRaylaLoading(false); setRaylaResponse("API error."); }
                  }} style={{ marginBottom: 16 }}>
                    <input name="raylaq" type="text" placeholder="e.g. Is NVDA a good buy? Should I short AAPL?" style={{ flex: 1, marginRight: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#e2e8f0", outline: "none" }} autoComplete="off" disabled={isRaylaLoading} />
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
                    </div>
                  </div>
                  <button className="ghostButton" type="button" onClick={async () => {
                    const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
                    if (error) { showToast("Could not save name.", "error"); return; }
                    showToast("Name updated.", "success");
                    window.location.reload();
                  }}>Save Name</button>
                  <button className="ghostButton" type="button" onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}>Sign Out</button>
                  <div className="listRow"><div><div className="listTitle">Trades Logged</div><div className="listSubtext">{trades.length}</div></div></div>
                  <div className="listRow"><div><div className="listTitle">Win Rate</div><div className="listSubtext">{winRate}</div></div></div>
                  <div className="listRow"><div><div className="listTitle">Average R</div><div className="listSubtext">{avgR}</div></div></div>
                </div>
              </div>
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
