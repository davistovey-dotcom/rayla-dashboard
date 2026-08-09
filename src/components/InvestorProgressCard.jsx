import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { deriveProfileFromData } from "../utils/adaptiveLearningProfile";
import { computeInvestorProgress } from "../utils/investorProgress";

export default function InvestorProgressCard({
  userId,
  trades = [],
  portfolioSnapshots = [],
}) {
  const [ledger, setLedger] = useState([]);
  // ledgerReady stays false until the first fetch settles, so we never render
  // progress cards computed against an unloaded ledger (would flash opportunity
  // copy at users who actually have improvement data).
  const [ledgerReady, setLedgerReady] = useState(!userId);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId) { setLedger([]); setLedgerReady(true); return; }
      setLedgerReady(false);
      try {
        // Pull 60 days so we can compare current vs prior 30-day windows.
        const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from("decision_ledger_entries")
          .select("id, created_at, entry_type, symbol, emotion, rule_followed, lesson, outcome")
          .eq("user_id", userId)
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .limit(1000);
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

  // Derive the Adaptive Learning Profile from raw data, then let Investor
  // Progress present it. The profile is the canonical source of behavioral
  // interpretation; this card is a thin presenter.
  const progress = useMemo(() => {
    const profile = deriveProfileFromData(
      { ledger, trades, portfolioSnapshots },
      { userId },
    );
    return computeInvestorProgress({ profile, portfolioSnapshots });
  }, [ledger, trades, portfolioSnapshots, userId]);

  const eyebrowStyle = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#7f8ea3" };
  const subtitleStyle = { fontSize: 15, color: "#94a3b8", lineHeight: 1.55 };

  if (!ledgerReady) {
    return (
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={eyebrowStyle}>Investor Progress</div>
        <div style={subtitleStyle}>How you&apos;ve grown over the last 30 days.</div>
        <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>Looking at your recent decisions…</div>
      </div>
    );
  }

  if (progress.empty) {
    return (
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={eyebrowStyle}>Investor Progress</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#e2f0ff", lineHeight: 1.4 }}>
          You&apos;re just getting started.
        </div>
        <div style={subtitleStyle}>
          As you invest and Rayla learns from your trades, patterns start showing up in how you decide. This is where you&apos;ll see them.
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={eyebrowStyle}>Investor Progress</div>
        <div style={subtitleStyle}>How you&apos;ve grown over the last 30 days.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {progress.cards.map((card, idx) => {
          const isImprovement = card.type === "improvement";
          const iconChar = isImprovement ? "↑" : "○";
          const iconColor = isImprovement ? "#7CC4FF" : "#7f8ea3";
          const iconBg = isImprovement ? "rgba(124,196,255,0.14)" : "rgba(148,163,184,0.08)";
          const iconBorder = isImprovement ? "1px solid rgba(124,196,255,0.28)" : "1px solid rgba(148,163,184,0.20)";
          const statementColor = isImprovement ? "#cbd5e1" : "#94a3b8";
          return (
            <div
              key={`${card.category}-${idx}`}
              style={{
                background: "rgba(18,26,38,0.86)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: iconBg,
                    border: iconBorder,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: iconColor,
                    fontSize: 15,
                    fontWeight: 800,
                    lineHeight: 1,
                  }}
                  aria-hidden="true"
                >
                  {iconChar}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e2f0ff", letterSpacing: "0.2px" }}>
                  {card.category}
                </div>
              </div>
              <div
                style={{
                  color: statementColor,
                  fontSize: 13,
                  lineHeight: 1.55,
                  fontStyle: isImprovement ? "normal" : "italic",
                }}
              >
                {card.statement}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
