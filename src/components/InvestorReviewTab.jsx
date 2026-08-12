import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import * as tradeReflections from "../services/tradeReflections";

const INVESTOR_REVIEW_STRENGTH_META = {
  strong: { label: "Strong", color: "#4ade80", bg: "rgba(74,222,128,0.14)" },
  moderate: { label: "Moderate", color: "#7CC4FF", bg: "rgba(124,196,255,0.14)" },
  light: { label: "Light", color: "#facc15", bg: "rgba(250,204,21,0.14)" },
  insufficient: { label: "Insufficient", color: "#94a3b8", bg: "rgba(148,163,184,0.14)" },
};

const INVESTOR_REVIEW_ENTRY_TYPES = [
  { value: "plan", label: "Plan (pre-trade)" },
  { value: "trade", label: "Trade (execution note)" },
  { value: "reflection", label: "Reflection" },
  { value: "rule_check", label: "Rule check" },
  { value: "other", label: "Other" },
];

function investorReviewFormatWeek(startISO, endISO) {
  if (!startISO || !endISO) return "";
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  const endInclusive = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const opts = { month: "short", day: "numeric" };
  const startLabel = start.toLocaleDateString(undefined, opts);
  const endLabel = endInclusive.toLocaleDateString(undefined, { ...opts, year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

export default function InvestorReviewTab({ userId, getCoachProfile, requestedEntryType = null, onRequestConsumed = null }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [review, setReview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [reflections, setReflections] = useState([]);

  const [formOpen, setFormOpen] = useState(false);
  const [formEntryType, setFormEntryType] = useState("plan");
  const [formSymbol, setFormSymbol] = useState("");
  const [formDecision, setFormDecision] = useState("");
  const [formReasoning, setFormReasoning] = useState("");
  const [formConfidence, setFormConfidence] = useState("");
  const [formEmotion, setFormEmotion] = useState("");
  const [formRuleFollowed, setFormRuleFollowed] = useState("unset");
  const [formSource, setFormSource] = useState("manual");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

  const targetWeekStartISO = useMemo(() => {
    const now = new Date();
    const day = now.getUTCDay();
    const daysSinceMonday = (day + 6) % 7;
    const monday = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysSinceMonday + weekOffset * 7,
      0, 0, 0, 0,
    ));
    return monday.toISOString();
  }, [weekOffset]);

  const fetchReview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const coachProfile = typeof getCoachProfile === "function" ? (getCoachProfile() || null) : null;
      const { data, error: fnError } = await supabase.functions.invoke("weekly-investor-review", {
        body: { weekStartISO: targetWeekStartISO, coachProfile },
      });
      if (fnError) throw fnError;
      if (!data?.ok) throw new Error(data?.error || "Unable to load review.");
      setReview(data.review);
    } catch (err) {
      setError(err?.message || "Unable to load review.");
      setReview(null);
    } finally {
      setIsLoading(false);
    }
  }, [targetWeekStartISO, getCoachProfile]);

  const fetchEntries = useCallback(async () => {
    if (!userId) { setEntries([]); setReflections([]); return; }
    setEntriesLoading(true);
    // Fetch ledger entries and completed trade reflections in parallel;
    // the Decision Log merges both into a single chronological feed
    // grouped by day. Failures in either fetch don't block the other.
    try {
      const [ledgerRes, reflectionsRes] = await Promise.allSettled([
        supabase
          .from("decision_ledger_entries")
          .select("id, created_at, entry_type, symbol, decision, reasoning, confidence, emotion, rule_followed, source, outcome, lesson, metadata")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(30),
        tradeReflections.fetchCompletedReflections(supabase, userId, { limit: 30 }),
      ]);
      if (ledgerRes.status === "fulfilled") {
        if (ledgerRes.value.error) throw ledgerRes.value.error;
        setEntries(ledgerRes.value.data || []);
      } else {
        setEntries([]);
      }
      if (reflectionsRes.status === "fulfilled") {
        setReflections(Array.isArray(reflectionsRes.value) ? reflectionsRes.value : []);
      } else {
        setReflections([]);
      }
    } catch (err) {
      console.error("[investor-review] load entries failed", err);
      setEntries([]);
      setReflections([]);
    } finally {
      setEntriesLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchReview(); }, [fetchReview]);
  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Parent (App.jsx) drives the entry form open with a preselected type by
  // passing a requestedEntryType prop. Common trigger: the "Log a trade plan"
  // button on the Investor Score card when Preparation is Building.
  useEffect(() => {
    if (!requestedEntryType) return;
    const allowed = INVESTOR_REVIEW_ENTRY_TYPES.some((t) => t.value === requestedEntryType);
    if (!allowed) { if (typeof onRequestConsumed === "function") onRequestConsumed(); return; }
    setFormEntryType(requestedEntryType);
    setFormOpen(true);
    if (typeof onRequestConsumed === "function") onRequestConsumed();
  }, [requestedEntryType, onRequestConsumed]);

  // Merge ledger entries and completed trade reflections into a single
  // chronological feed. Reflections are normalized into the same shape
  // the existing entry renderer expects so we don't have to fork the UI.
  // Each merged row carries a `_source` tag ('ledger' | 'reflection') so
  // the renderer can badge them appropriately.
  const mergedEntries = useMemo(() => {
    const fromLedger = (Array.isArray(entries) ? entries : []).map((e) => ({ ...e, _source: "ledger" }));
    const fromReflections = (Array.isArray(reflections) ? reflections : []).map((r) => {
      const sym = r?.metadata?.symbol || null;
      const pl = r?.metadata?.pl;
      const plPct = r?.metadata?.pl_pct;
      const outcomeParts = [];
      if (Number.isFinite(Number(pl))) outcomeParts.push(`${Number(pl) >= 0 ? "+" : ""}$${Math.abs(Number(pl)).toFixed(2)}`);
      if (Number.isFinite(Number(plPct))) outcomeParts.push(`${Number(plPct) >= 0 ? "+" : ""}${Number(plPct).toFixed(2)}%`);
      return {
        id: `reflection:${r.id}`,
        created_at: r.answered_at || r.created_at,
        entry_type: "reflection",
        symbol: sym ? String(sym).toUpperCase() : null,
        decision: r.reflection_question || null,
        reasoning: r.user_response || null,
        confidence: null,
        emotion: null,
        rule_followed: null,
        source: "trade_reflection",
        outcome: outcomeParts.length ? outcomeParts.join(" / ") : null,
        lesson: null,
        metadata: r.metadata || {},
        _source: "reflection",
        _reflectionId: r.id,
      };
    });
    const merged = [...fromLedger, ...fromReflections];
    merged.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    return merged.slice(0, 50);
  }, [entries, reflections]);

  async function submitEntry(e) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    if (!userId) { setFormError("Sign in required."); return; }
    const decision = formDecision.trim();
    if (!decision) { setFormError("Decision is required."); return; }
    const payload = {
      user_id: userId,
      entry_type: formEntryType,
      symbol: formSymbol.trim() ? formSymbol.trim().toUpperCase() : null,
      decision,
      reasoning: formReasoning.trim() ? formReasoning.trim() : null,
      confidence: formConfidence !== "" && Number.isFinite(Number(formConfidence))
        ? Math.max(1, Math.min(10, Math.round(Number(formConfidence))))
        : null,
      emotion: formEmotion.trim() ? formEmotion.trim().toLowerCase() : null,
      rule_followed: formRuleFollowed === "yes" ? true : formRuleFollowed === "no" ? false : null,
      source: formSource.trim() ? formSource.trim() : null,
    };
    setFormSubmitting(true);
    try {
      const { error: insertError } = await supabase.from("decision_ledger_entries").insert(payload);
      if (insertError) throw insertError;
      setFormSuccess("Saved.");
      setFormDecision("");
      setFormReasoning("");
      setFormSymbol("");
      setFormConfidence("");
      setFormEmotion("");
      setFormRuleFollowed("unset");
      await Promise.all([fetchEntries(), fetchReview()]);
    } catch (err) {
      setFormError(err?.message || "Unable to save entry.");
    } finally {
      setFormSubmitting(false);
    }
  }

  const weekLabel = review ? investorReviewFormatWeek(review.weekStartISO, review.weekEndISO) : "";
  const isCurrentWeek = weekOffset === 0;

  const evidence = review?.evidence || [];
  const summary = review?.summary;
  const availability = review?.dataAvailability;

  const cardStyle = {
    background: "rgba(18,26,38,0.86)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };
  const subtleText = { color: "#94a3b8", fontSize: 13, lineHeight: 1.55 };
  const strongLabel = { color: "#e2f0ff", fontWeight: 600, fontSize: 14 };
  const eyebrowStyle = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#7f8ea3" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={eyebrowStyle}>Weekly Investor Review</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#e2f0ff" }}>
              {weekLabel || "Loading week…"}
            </div>
            <div style={subtleText}>
              Evidence-only summary of your investing behavior this week. Rayla never invents a conclusion — every observation ties back to a real trade, snapshot, or ledger entry.
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setWeekOffset((v) => v - 1)}
              style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", color: "#e2f0ff", cursor: "pointer", fontSize: 13 }}
            >
              ← Prev
            </button>
            <button
              type="button"
              disabled={isCurrentWeek}
              onClick={() => setWeekOffset((v) => Math.min(0, v + 1))}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                background: isCurrentWeek ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.07)",
                color: isCurrentWeek ? "#475569" : "#e2f0ff",
                cursor: isCurrentWeek ? "not-allowed" : "pointer",
                fontSize: 13,
              }}
            >
              Next →
            </button>
            <button
              type="button"
              onClick={fetchReview}
              disabled={isLoading}
              style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(124,196,255,0.14)", border: "1px solid rgba(124,196,255,0.28)", color: "#7CC4FF", cursor: isLoading ? "wait" : "pointer", fontSize: 13, fontWeight: 600 }}
            >
              {isLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
        {availability ? (
          <div style={{ ...subtleText, display: "flex", flexWrap: "wrap", gap: 12, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12 }}>
            <span>Trades this week: <b style={{ color: "#e2f0ff" }}>{availability.trades}</b></span>
            <span>Portfolio snapshots: <b style={{ color: "#e2f0ff" }}>{availability.portfolioSnapshots}</b></span>
            <span>Ledger entries: <b style={{ color: "#e2f0ff" }}>{availability.ledgerEntries}</b></span>
            <span>Prior-week ledger: <b style={{ color: "#e2f0ff" }}>{availability.ledgerEntriesPriorWeek}</b></span>
            <span title="Ask Rayla conversations are not persisted server-side in v1.">Ask Rayla history: <b style={{ color: "#7f8ea3" }}>unavailable (v1)</b></span>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="card" style={{ borderColor: "rgba(248,113,113,0.35)", color: "#fca5a5" }}>{error}</div>
      ) : null}

      {isLoading && !review ? (
        <div className="card" style={{ color: "#94a3b8" }}>Loading your week…</div>
      ) : null}

      {summary ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {[
            { key: "strongestBehavior", eyebrow: "Strongest behavior", data: summary.strongestBehavior, tone: "#4ade80" },
            { key: "biggestOpportunity", eyebrow: "Biggest opportunity", data: summary.biggestOpportunity, tone: "#facc15" },
            { key: "evidenceBackedLesson", eyebrow: "Evidence-backed lesson", data: summary.evidenceBackedLesson, tone: "#7CC4FF" },
            { key: "recommendedFocusNextWeek", eyebrow: "Focus next week", data: summary.recommendedFocusNextWeek, tone: "#c084fc" },
          ].map((item) => (
            <div key={item.key} style={cardStyle}>
              <div style={{ ...eyebrowStyle, color: item.tone }}>{item.eyebrow}</div>
              <div style={{ ...strongLabel, color: item.data.present ? "#e2f0ff" : "#94a3b8", fontStyle: item.data.present ? "normal" : "italic", lineHeight: 1.5 }}>
                {item.data.text}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {evidence.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={eyebrowStyle}>Evidence by domain</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {evidence.map((block) => {
              const meta = INVESTOR_REVIEW_STRENGTH_META[block.strength] || INVESTOR_REVIEW_STRENGTH_META.insufficient;
              return (
                <div key={block.domain} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={strongLabel}>{block.label}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: meta.color, background: meta.bg, padding: "4px 8px", borderRadius: 8 }}>
                      {meta.label}
                    </span>
                  </div>
                  <div style={{ ...subtleText, color: block.needsMoreHistory ? "#94a3b8" : "#cbd5e1", fontStyle: block.needsMoreHistory ? "italic" : "normal" }}>
                    {block.headline}
                  </div>
                  {block.observations && block.observations.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, ...subtleText }}>
                      {block.observations.map((obs, i) => (<li key={i}>{obs}</li>))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={eyebrowStyle}>Decision log</div>
          <div style={{ ...subtleText, marginTop: 2 }}>What Rayla and you have noted from your trades.</div>
        </div>

        {formOpen ? (
          <form onSubmit={submitEntry} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, background: "rgba(8,12,18,0.55)", padding: 14, borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#94a3b8" }}>
              Entry type
              <select value={formEntryType} onChange={(e) => setFormEntryType(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, background: "#0b1220", color: "#e2f0ff", border: "1px solid rgba(255,255,255,0.08)" }}>
                {INVESTOR_REVIEW_ENTRY_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#94a3b8" }}>
              Symbol (optional)
              <input value={formSymbol} onChange={(e) => setFormSymbol(e.target.value)} placeholder="e.g. NVDA" maxLength={16} style={{ padding: "8px 10px", borderRadius: 8, background: "#0b1220", color: "#e2f0ff", border: "1px solid rgba(255,255,255,0.08)" }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#94a3b8", gridColumn: "1 / -1" }}>
              Decision <span style={{ color: "#f87171" }}>*</span>
              <input value={formDecision} onChange={(e) => setFormDecision(e.target.value)} placeholder="e.g. Enter NVDA on breakout above 190" required maxLength={280} style={{ padding: "8px 10px", borderRadius: 8, background: "#0b1220", color: "#e2f0ff", border: "1px solid rgba(255,255,255,0.08)" }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#94a3b8", gridColumn: "1 / -1" }}>
              Reasoning (optional)
              <textarea value={formReasoning} onChange={(e) => setFormReasoning(e.target.value)} placeholder="Why now? What's the setup?" rows={3} maxLength={2000} style={{ padding: "8px 10px", borderRadius: 8, background: "#0b1220", color: "#e2f0ff", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "inherit", resize: "vertical" }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#94a3b8" }}>
              Confidence 1–10 (optional)
              <input type="number" min={1} max={10} value={formConfidence} onChange={(e) => setFormConfidence(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, background: "#0b1220", color: "#e2f0ff", border: "1px solid rgba(255,255,255,0.08)" }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#94a3b8" }}>
              Emotion (optional)
              <input value={formEmotion} onChange={(e) => setFormEmotion(e.target.value)} placeholder="e.g. calm, fomo, patient" maxLength={40} style={{ padding: "8px 10px", borderRadius: 8, background: "#0b1220", color: "#e2f0ff", border: "1px solid rgba(255,255,255,0.08)" }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#94a3b8" }}>
              Rule followed?
              <select value={formRuleFollowed} onChange={(e) => setFormRuleFollowed(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, background: "#0b1220", color: "#e2f0ff", border: "1px solid rgba(255,255,255,0.08)" }}>
                <option value="unset">Not tracked</option>
                <option value="yes">Yes — I followed my rule</option>
                <option value="no">No — I broke my rule</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#94a3b8" }}>
              Source (optional)
              <input value={formSource} onChange={(e) => setFormSource(e.target.value)} placeholder="manual, ask_rayla, journal…" maxLength={40} style={{ padding: "8px 10px", borderRadius: 8, background: "#0b1220", color: "#e2f0ff", border: "1px solid rgba(255,255,255,0.08)" }} />
            </label>
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "center" }}>
              {formError ? <span style={{ color: "#fca5a5", fontSize: 12 }}>{formError}</span> : null}
              {formSuccess ? <span style={{ color: "#4ade80", fontSize: 12 }}>{formSuccess}</span> : null}
              <button
                type="submit"
                disabled={formSubmitting}
                style={{ padding: "10px 18px", borderRadius: 10, background: "#7CC4FF", border: "none", color: "#0b1220", fontWeight: 700, cursor: formSubmitting ? "wait" : "pointer" }}
              >
                {formSubmitting ? "Saving…" : "Save entry"}
              </button>
            </div>
          </form>
        ) : null}

        {entriesLoading ? (
          <div style={subtleText}>Loading…</div>
        ) : mergedEntries.length === 0 ? (
          <div style={{ ...subtleText, fontStyle: "italic" }}>Rayla will start capturing moments from your trades — including a short reflection after each closed trade. You can also add a note yourself if something's on your mind.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {(() => {
              // Group by local calendar day. Newest first.
              const groups = new Map();
              for (const e of mergedEntries) {
                const d = e.created_at ? new Date(e.created_at) : new Date();
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, "0");
                const day = String(d.getDate()).padStart(2, "0");
                const ymd = `${y}-${m}-${day}`;
                if (!groups.has(ymd)) groups.set(ymd, []);
                groups.get(ymd).push(e);
              }
              const today = new Date();
              const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
              const todayYMD = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
              const yestYMD = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
              const labelFor = (ymd) => {
                if (ymd === todayYMD) return "Today";
                if (ymd === yestYMD) return "Yesterday";
                const [yy, mm, dd] = ymd.split("-").map(Number);
                return new Date(yy, mm - 1, dd).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
              };
              return Array.from(groups.entries()).map(([ymd, dayEntries]) => (
                <div key={ymd} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ ...eyebrowStyle, color: "#64748b" }}>{labelFor(ymd)}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {dayEntries.map((entry) => {
                      const created = entry.created_at ? new Date(entry.created_at) : null;
                      // Row source classification for the badge:
                      //   - trade reflection (Phase 2.1) → "Reflection" badge
                      //   - decision_ledger_entries captured by Rayla (Phase 1) → "Rayla" badge
                      //   - manually-added ledger row → "Manual" badge
                      const isReflection = entry._source === "reflection";
                      const capturedByRayla = !isReflection && (
                        entry?.metadata?.captured_via === "behavior_capture"
                        || String(entry?.source || "").startsWith("behavior_capture")
                      );
                      const badgeMeta = isReflection
                        ? { label: "↺ Reflection", color: "#c084fc", bg: "rgba(192,132,252,0.10)", border: "rgba(192,132,252,0.28)", title: "Automatic reflection captured after a closed trade" }
                        : capturedByRayla
                          ? { label: "↻ Rayla", color: "#7CC4FF", bg: "rgba(124,196,255,0.10)", border: "rgba(124,196,255,0.22)", title: "Captured by Rayla during a conversation" }
                          : { label: "✎ Manual", color: "#64748b", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.16)", title: "Added manually" };
                      return (
                        <div key={entry.id} style={{ padding: "12px 14px", background: "rgba(8,12,18,0.55)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#7CC4FF" }}>{entry.entry_type}</span>
                              {entry.symbol ? <span style={{ fontSize: 12, color: "#e2f0ff", fontWeight: 600 }}>{entry.symbol}</span> : null}
                              {entry.confidence != null ? <span style={{ fontSize: 11, color: "#94a3b8" }}>conf {entry.confidence}/10</span> : null}
                              {entry.rule_followed === true ? <span style={{ fontSize: 11, color: "#4ade80" }}>rule ✓</span> : entry.rule_followed === false ? <span style={{ fontSize: 11, color: "#f87171" }}>rule ✗</span> : null}
                              {entry.emotion ? <span style={{ fontSize: 11, color: "#c084fc" }}>{entry.emotion}</span> : null}
                              <span
                                title={badgeMeta.title}
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: "0.4px",
                                  textTransform: "uppercase",
                                  padding: "2px 6px",
                                  borderRadius: 6,
                                  color: badgeMeta.color,
                                  background: badgeMeta.bg,
                                  border: `1px solid ${badgeMeta.border}`,
                                }}
                              >
                                {badgeMeta.label}
                              </span>
                            </div>
                            <span style={{ fontSize: 11, color: "#7f8ea3" }}>{created ? created.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : ""}</span>
                          </div>
                          {/* For reflections, entry.decision is the question Rayla
                              asked; entry.reasoning is the user's answer. Render
                              them with clear labels. For ledger rows, decision +
                              lesson + reasoning are all optional prose fields. */}
                          {entry.decision ? (
                            isReflection ? (
                              <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.5, fontStyle: "italic" }}>Rayla asked: {entry.decision}</div>
                            ) : (
                              <div style={{ color: "#e2f0ff", fontSize: 14 }}>{entry.decision}</div>
                            )
                          ) : null}
                          {entry.lesson ? <div style={{ color: "#dbeafe", fontSize: 13, lineHeight: 1.5 }}><b style={{ color: "#7CC4FF" }}>Lesson:</b> {entry.lesson}</div> : null}
                          {entry.reasoning ? (
                            isReflection
                              ? <div style={{ color: "#e2f0ff", fontSize: 14, lineHeight: 1.5 }}>{entry.reasoning}</div>
                              : <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.5 }}>{entry.reasoning}</div>
                          ) : null}
                          {entry.outcome ? <div style={{ color: "#7f8ea3", fontSize: 12 }}>Outcome: {entry.outcome}</div> : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}

        {/* Manual-log escape hatch — deliberately downgraded from a prominent
            header button to a plain link at the bottom, per the Behavior
            Capture spec. Rayla is the primary capture surface now. */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            style={{ background: "none", border: "none", padding: 0, color: "#7f8ea3", fontSize: 12, cursor: "pointer", textDecoration: "underline dotted" }}
          >
            {formOpen ? "Close manual entry" : "Add a note manually"}
          </button>
        </div>
      </div>
    </div>
  );
}
