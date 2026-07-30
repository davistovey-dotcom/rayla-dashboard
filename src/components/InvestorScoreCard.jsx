import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { CATEGORY_ORDER, computeInvestorScore, STATUS_BUILDING } from "../utils/investorScore";

const STATUS_COLOR = {
  Excellent: "#4ade80",
  Strong: "#7CC4FF",
  Improving: "#facc15",
  Developing: "#fb923c",
  [STATUS_BUILDING]: "#94a3b8",
};

function scoreColor(score) {
  if (typeof score !== "number") return "#94a3b8";
  if (score >= 81) return "#4ade80";
  if (score >= 61) return "#7CC4FF";
  if (score >= 41) return "#facc15";
  return "#fb923c";
}

export default function InvestorScoreCard({ userId, trades = [], positions = [] }) {
  const [ledger, setLedger] = useState([]);
  // ledgerReady stays false until the first fetch settles, so we never render
  // a score computed against an unloaded ledger (would flash a wrong number).
  const [ledgerReady, setLedgerReady] = useState(!userId);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId) { setLedger([]); setLedgerReady(true); return; }
      setLedgerReady(false);
      try {
        const { data, error } = await supabase
          .from("decision_ledger_entries")
          .select("id, created_at, entry_type, symbol, decision, reasoning, confidence, emotion, rule_followed, outcome, lesson")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        if (!cancelled) setLedger(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setLedger([]);
      } finally {
        if (!cancelled) setLedgerReady(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const result = useMemo(
    () => computeInvestorScore({ ledger, trades, positions }),
    [ledger, trades, positions],
  );

  const overallDisplay = !ledgerReady ? "—" : (result.overall == null ? "—" : String(result.overall));
  const overallColor = !ledgerReady ? "#94a3b8" : (result.overall == null ? "#94a3b8" : scoreColor(result.overall));
  const displayedStatus = !ledgerReady ? "Loading" : result.status;
  const statusColor = STATUS_COLOR[displayedStatus] || "#94a3b8";

  const subtleText = { color: "#94a3b8", fontSize: 13, lineHeight: 1.55 };
  const eyebrowStyle = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#7f8ea3" };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 180 }}>
          <div style={eyebrowStyle}>Investor Score</div>
          <div style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.5, maxWidth: 480 }}>
            How well you invest — measured by behavior, not returns. Every score below is drawn from your own recorded decisions and positions.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <div style={{ fontSize: 44, fontWeight: 800, color: overallColor, lineHeight: 1 }}>
            {overallDisplay}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: statusColor }}>
            {displayedStatus}
          </div>
        </div>
      </div>

      {!ledgerReady ? (
        <div style={subtleText}>Loading your recorded decisions…</div>
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {CATEGORY_ORDER.map(({ key, label }) => {
          const cat = result.categories[key];
          const isBuilding = cat.score == null;
          const barColor = scoreColor(cat.score);
          const barWidth = isBuilding ? 0 : Math.max(2, cat.score);
          return (
            <div
              key={key}
              style={{
                background: "rgba(18,26,38,0.86)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e2f0ff" }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: isBuilding ? "#94a3b8" : barColor }}>
                  {isBuilding ? "Building" : cat.score}
                </div>
              </div>
              <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${barWidth}%`,
                    height: "100%",
                    background: isBuilding ? "rgba(148,163,184,0.35)" : barColor,
                    borderRadius: 999,
                    transition: "width 240ms ease",
                  }}
                />
              </div>
              <div style={{ ...subtleText, color: isBuilding ? "#7f8ea3" : "#cbd5e1", fontStyle: isBuilding ? "italic" : "normal" }}>
                {cat.reason}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
