import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import { deriveProfileFromData } from "../utils/adaptiveLearningProfile";
import { computeInvestorScore } from "../utils/investorScore";
import { computeInvestorProgress } from "../utils/investorProgress";
import * as tradeReflections from "../services/tradeReflections";
import {
  buildRaylaSummaryEvidence,
  evidenceSignature,
  fetchRaylaSummary,
  readSummaryCache,
  writeSummaryCache,
} from "../services/raylaSummary";

// Rayla's Summary — one grounded paragraph the coach writes about the
// current state of THIS investor, refreshed only when meaningful state
// changes. Not a diagnosis, not a "next action" prescription. A read.
//
// Refresh rules (implemented in useEffect below):
//   - On first mount for a user, if no cache exists → generate.
//   - When the evidence signature changes → regenerate.
//   - Manual Refresh button always regenerates.
//   - Elapsed time alone NEVER triggers regeneration.

export default function RaylaSummaryCard({
  userId,
  positions = [],
  alpacaAccount = null,
  portfolioSnapshots = [],
  brokerTradeLog = [],
  trades = [],
  title = "Portfolio",
}) {
  const [ledger, setLedger] = useState([]);
  const [reflections, setReflections] = useState([]);
  const [dataReady, setDataReady] = useState(!userId);
  const [summary, setSummary] = useState(null); // { text, generatedAt }
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [errorMessage, setErrorMessage] = useState("");
  const lastSignatureRef = useRef(null);

  // Load ledger + completed reflections in parallel. Same shape the
  // Investor Score and Decision Log already use — no new tables.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId) {
        setLedger([]);
        setReflections([]);
        setDataReady(true);
        return;
      }
      setDataReady(false);
      try {
        const [ledgerRes, reflectionsRes] = await Promise.allSettled([
          supabase
            .from("decision_ledger_entries")
            .select("id, created_at, entry_type, symbol, decision, reasoning, confidence, emotion, rule_followed, source, outcome, lesson, metadata")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(500),
          tradeReflections.fetchCompletedReflections(supabase, userId, { limit: 60 }),
        ]);
        if (cancelled) return;
        if (ledgerRes.status === "fulfilled" && !ledgerRes.value.error) {
          setLedger(Array.isArray(ledgerRes.value.data) ? ledgerRes.value.data : []);
        } else {
          setLedger([]);
        }
        if (reflectionsRes.status === "fulfilled") {
          setReflections(Array.isArray(reflectionsRes.value) ? reflectionsRes.value : []);
        } else {
          setReflections([]);
        }
      } finally {
        if (!cancelled) setDataReady(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  // Build the evidence packet + signature purely on the client so we
  // can detect meaningful changes without a network round-trip.
  const evidence = useMemo(() => {
    if (!dataReady) return null;
    const profile = deriveProfileFromData({ ledger, trades }, { userId });
    const investorScore = computeInvestorScore({ profile, positions });
    const investorProgress = computeInvestorProgress({ profile, portfolioSnapshots });
    return buildRaylaSummaryEvidence({
      positions,
      alpacaAccount,
      portfolioSnapshots,
      ledger,
      reflections,
      investorScore,
      investorProgress,
      brokerTradeLog,
    });
  }, [dataReady, ledger, trades, positions, portfolioSnapshots, alpacaAccount, reflections, brokerTradeLog, userId]);

  const signature = useMemo(() => (evidence ? evidenceSignature(evidence) : null), [evidence]);

  const generate = useCallback(async (currentEvidence, currentSignature) => {
    if (!userId || !currentEvidence || !currentSignature) return;
    setStatus("loading");
    setErrorMessage("");
    try {
      const result = await fetchRaylaSummary(supabase, currentEvidence, currentSignature);
      setSummary({ text: result.summary, generatedAt: result.generatedAt });
      lastSignatureRef.current = currentSignature;
      writeSummaryCache(userId, {
        signature: currentSignature,
        summary: result.summary,
        generatedAt: result.generatedAt,
      });
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMessage(String(err?.message || err || "Summary unavailable."));
    }
  }, [userId]);

  // Hydrate cached summary if the signature matches, otherwise generate.
  // This is the ONLY place time-does-not-trigger-regen is enforced.
  useEffect(() => {
    if (!signature || !evidence || !userId) return;
    const cached = readSummaryCache(userId);
    if (cached && cached.signature === signature) {
      setSummary({ text: cached.summary, generatedAt: cached.generatedAt || null });
      lastSignatureRef.current = signature;
      setStatus("idle");
      return;
    }
    if (lastSignatureRef.current === signature) return;
    generate(evidence, signature);
  }, [signature, evidence, userId, generate]);

  const cardBase = {
    background: "rgba(18,26,38,0.86)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
  };

  const generatedAtDisplay = useMemo(() => {
    if (!summary?.generatedAt) return null;
    const d = new Date(summary.generatedAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString();
  }, [summary?.generatedAt]);

  return (
    <div style={cardBase}>
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: "#7CC4FF" }}>Rayla's Summary</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 11, color: "#475569" }}>{title}</div>
          {generatedAtDisplay ? (
            <div style={{ fontSize: 10, color: "#475569" }}>Updated {generatedAtDisplay}</div>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (!evidence || !signature || status === "loading") return;
              // Force regenerate — bypass cache + signature match.
              lastSignatureRef.current = null;
              generate(evidence, signature);
            }}
            disabled={!evidence || status === "loading"}
            style={{
              background: status === "loading" ? "rgba(124,196,255,0.04)" : "rgba(124,196,255,0.1)",
              border: "1px solid rgba(124,196,255,0.25)",
              borderRadius: 8,
              padding: "6px 14px",
              color: "#7CC4FF",
              fontSize: 12,
              fontWeight: 600,
              cursor: !evidence || status === "loading" ? "not-allowed" : "pointer",
              opacity: !evidence || status === "loading" ? 0.5 : 1,
              minWidth: 84,
            }}
          >
            {status === "loading" ? "Thinking…" : "Refresh"}
          </button>
        </div>
      </div>
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        {status === "loading" && !summary ? (
          <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, fontStyle: "italic" }}>
            Rayla is reading through your recent activity…
          </div>
        ) : null}
        {status === "error" && !summary ? (
          <div
            style={{
              padding: "11px 14px",
              borderRadius: 10,
              background: "rgba(248,113,113,0.06)",
              border: "1px solid rgba(248,113,113,0.14)",
              fontSize: 13,
              color: "#fecaca",
              lineHeight: 1.6,
            }}
          >
            {errorMessage || "Rayla couldn't produce a summary right now. Try Refresh in a moment."}
          </div>
        ) : null}
        {summary?.text ? (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 10,
              background: "rgba(124,196,255,0.06)",
              border: "1px solid rgba(124,196,255,0.15)",
              fontSize: 14,
              color: "#e2e8f0",
              lineHeight: 1.65,
              whiteSpace: "pre-wrap",
            }}
          >
            {summary.text}
          </div>
        ) : null}
      </div>
    </div>
  );
}
