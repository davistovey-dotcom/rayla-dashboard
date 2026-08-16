// @ts-nocheck
//
// Rayla's Summary — narrative synthesis edge function with MEMORY.
//
// Every generation:
//   1. Reads the last few prior summaries for this user (RLS-scoped).
//   2. Computes concrete deltas between the current evidence and the
//      most recent prior evidence.
//   3. Builds a prompt that includes: current evidence, previous
//      evidence, previous summary text, and the deltas.
//   4. Calls the LLM to produce ONE grounded paragraph (75-150 words)
//      that compares who the investor is now vs who they were before.
//   5. INSERTs the new summary + evidence + signature into rayla_summaries
//      so the next generation has one more data point to compare against.
//
// The client-side signature cache prevents unnecessary generations. When
// the client DOES hit this endpoint, it wants a fresh generation — either
// because the state genuinely changed or the user tapped Refresh.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const OPENROUTER_TIMEOUT_MS = 22000;
const GROQ_TIMEOUT_MS = 8000;
const MAX_TOKENS = 400;

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

const HISTORY_FETCH_LIMIT = 5; // Read last 5; deltas only vs most recent.

const SYSTEM_PROMPT = `You are Rayla — an experienced investing coach who has been observing this specific investor for weeks or months. You have MEMORY. You remember what the investor's state used to look like and you remember what you wrote about them last time.

WHAT YOU ARE PRODUCING:
- ONE paragraph, 75–150 words, natural prose.
- NOT a snapshot of today. A comparison: who is this investor now vs who they were before?
- Answer: What changed since the last summary? What stayed consistent? What trend is developing? What habit is improving? What habit is slipping?
- If nothing meaningful has changed since the last summary, SAY SO plainly. That is a valid, honest summary.
  Example valid output: "Nothing significant has changed since your last review. Your discipline remains consistent despite today's volatility. The portfolio shape from earlier this week is still the shape this week."

STRICT GROUNDING RULES:
- You may only reference facts that appear in one of these three inputs: CURRENT_EVIDENCE, PREVIOUS_EVIDENCE, or DELTAS.
- The PREVIOUS_SUMMARY is what you wrote last time. Read it. Do NOT repeat it word-for-word or phrase-for-phrase.
- Numeric values, when you do include them, must be exactly as provided. Do not round, rebucket, or reword.

TRANSLATE METRICS INTO OBSERVATIONS (this is central to the voice):
- The reader must feel that you understand them — not that you are reading a dashboard aloud.
- BAD: "Your Diversification score is 81." GOOD: "Your portfolio has become more balanced over the last several weeks."
- BAD: "You completed 4 reflections." GOOD: "Reflection has become a genuine habit instead of something you occasionally do."
- BAD: "Your Preparation score dropped from 65 to 52." GOOD: "Preparation has slipped a little this month; the plans that used to come before your trades have been coming after."
- Only mention a raw metric when the exact number is the interesting fact (e.g., a score crossing a category boundary the reader will notice).

CONTINUITY LANGUAGE:
- Prefer time-continuity phrasing that references the past: "for the third week in a row", "less concentrated than it was", "more consistent than a month ago", "still", "again", "unchanged since", "since your last review".
- When a habit is IMPROVING, name it as improvement over the prior period, not as an absolute state.
- When a habit is SLIPPING, name it plainly but calmly. Never dramatic.
- When something is CONSISTENT, name that too — consistency during volatility is worth acknowledging.

VOICE:
- Calm, intelligent, objective, encouraging, confident.
- Never dramatic, never robotic, never generic, never repetitive across summaries.
- Speak with confidence: "Your position sizing has become noticeably more consistent."
- FORBIDDEN phrases anywhere in the paragraph: "Consider…", "You may want to…", "Reconsider…", "Think about…", "It might be beneficial…", "Perhaps you could…", "It could be worth…", "Here is your summary", "Here's a summary".
- Never make specific buy/sell/hold recommendations on any security. Never suggest deploying or holding cash.
- Never treat red positions as behavioral failure. Drawdowns are data, not moral evidence.

OUTPUT:
- Only the paragraph itself.
- No headings. No bullets. No preamble. No sign-off.`;

// ---------------------------------------------------------------------------
// Delta computation
// ---------------------------------------------------------------------------
//
// Given the current evidence packet and the most recent prior evidence
// packet, compute concrete change indicators. Every field is either a
// number, a small string, or a short array. The LLM reads this JSON and
// uses it as the ONLY source of allowed "what changed since last time"
// commentary. Nothing computed here is aesthetic — every field is a real
// arithmetic delta over real data.

function safeNumber(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function bucketedMove(delta: number, thresholds: number[]): string {
  const abs = Math.abs(delta);
  if (abs < thresholds[0]) return "unchanged";
  if (abs < thresholds[1]) return delta > 0 ? "up_slight" : "down_slight";
  if (abs < thresholds[2]) return delta > 0 ? "up_moderate" : "down_moderate";
  return delta > 0 ? "up_significant" : "down_significant";
}

function computeDeltas(current: any, previous: any, previousTimestamp: string | null) {
  if (!previous) return null;

  const cPortfolio = current?.portfolio || {};
  const pPortfolio = previous?.portfolio || {};

  const daysSinceMs = previousTimestamp ? (Date.now() - Date.parse(previousTimestamp)) : null;
  const daysSince = Number.isFinite(daysSinceMs) && daysSinceMs !== null
    ? Math.round(daysSinceMs / (24 * 60 * 60 * 1000))
    : null;

  const cPc = safeNumber(cPortfolio.position_count) ?? 0;
  const pPc = safeNumber(pPortfolio.position_count) ?? 0;
  const cTopPct = safeNumber(cPortfolio.top_allocation_pct);
  const pTopPct = safeNumber(pPortfolio.top_allocation_pct);
  const cMv = safeNumber(cPortfolio.total_market_value);
  const pMv = safeNumber(pPortfolio.total_market_value);
  const cPl = safeNumber(cPortfolio.total_unrealized_pl);
  const pPl = safeNumber(pPortfolio.total_unrealized_pl);
  const cWin = safeNumber(cPortfolio.winners) ?? 0;
  const pWin = safeNumber(pPortfolio.winners) ?? 0;
  const cLose = safeNumber(cPortfolio.losers) ?? 0;
  const pLose = safeNumber(pPortfolio.losers) ?? 0;

  // Investor Score category deltas.
  const cCats = Array.isArray(current?.investor_score?.categories)
    ? current.investor_score.categories : [];
  const pCats = Array.isArray(previous?.investor_score?.categories)
    ? previous.investor_score.categories : [];
  const pCatMap = new Map(pCats.map((c: any) => [c.key, c]));
  const catDeltas = cCats.map((c: any) => {
    const p = pCatMap.get(c.key) || {};
    const cur = safeNumber(c?.score);
    const pri = safeNumber(p?.score);
    let scoreMove: string = "unchanged";
    let scoreChange: number | null = null;
    if (cur !== null && pri !== null) {
      scoreChange = cur - pri;
      scoreMove = bucketedMove(scoreChange, [1, 5, 10]);
    } else if (cur !== null && pri === null) {
      scoreMove = "newly_scored";
    } else if (cur === null && pri !== null) {
      scoreMove = "no_longer_scored";
    }
    return {
      key: c.key,
      score_change: scoreChange,
      score_move: scoreMove,
      status_now: c?.status || null,
      status_before: p?.status || null,
    };
  });

  // Investor Progress card diffs — which categories entered improvement,
  // which fell out of it, and same for opportunity cards.
  const cProg = Array.isArray(current?.investor_progress) ? current.investor_progress : [];
  const pProg = Array.isArray(previous?.investor_progress) ? previous.investor_progress : [];
  const cImp = new Set(cProg.filter((c: any) => c?.type === "improvement").map((c: any) => c.category));
  const pImp = new Set(pProg.filter((c: any) => c?.type === "improvement").map((c: any) => c.category));
  const cOpp = new Set(cProg.filter((c: any) => c?.type === "opportunity").map((c: any) => c.category));
  const pOpp = new Set(pProg.filter((c: any) => c?.type === "opportunity").map((c: any) => c.category));
  const newImprovements = [...cImp].filter((k) => !pImp.has(k));
  const droppedImprovements = [...pImp].filter((k) => !cImp.has(k));
  const consistentImprovements = [...cImp].filter((k) => pImp.has(k));
  const newOpportunities = [...cOpp].filter((k) => !pOpp.has(k));
  const droppedOpportunities = [...pOpp].filter((k) => !cOpp.has(k));

  // Ledger + reflection deltas.
  const cLedTotal = safeNumber(current?.ledger_30d?.total) ?? 0;
  const pLedTotal = safeNumber(previous?.ledger_30d?.total) ?? 0;
  const cRulFol = safeNumber(current?.ledger_30d?.rule_followed_count) ?? 0;
  const pRulFol = safeNumber(previous?.ledger_30d?.rule_followed_count) ?? 0;
  const cRulBrk = safeNumber(current?.ledger_30d?.rule_broken_count) ?? 0;
  const pRulBrk = safeNumber(previous?.ledger_30d?.rule_broken_count) ?? 0;
  const cRefC = safeNumber(current?.reflections?.completed) ?? 0;
  const pRefC = safeNumber(previous?.reflections?.completed) ?? 0;

  // Overall investor score movement.
  const cIso = safeNumber(current?.investor_score?.overall);
  const pIso = safeNumber(previous?.investor_score?.overall);
  const overallChange = cIso !== null && pIso !== null ? cIso - pIso : null;
  const overallMove = overallChange !== null ? bucketedMove(overallChange, [1, 4, 10]) : (
    cIso !== null && pIso === null ? "newly_scored" :
    cIso === null && pIso !== null ? "no_longer_scored" : "unchanged"
  );

  // Significance rollup — used by the LLM to know whether "nothing
  // meaningful has changed" is honest. Counts non-trivial buckets.
  let significantMoves = 0;
  if (cPc !== pPc) significantMoves += 1;
  if (cPortfolio.top_symbol !== pPortfolio.top_symbol) significantMoves += 1;
  if (cTopPct !== null && pTopPct !== null && Math.abs(cTopPct - pTopPct) >= 5) significantMoves += 1;
  if (cMv !== null && pMv !== null && pMv > 0 && Math.abs((cMv - pMv) / pMv) >= 0.05) significantMoves += 1;
  if (overallMove.startsWith("up_") || overallMove.startsWith("down_")) {
    if (overallMove.includes("moderate") || overallMove.includes("significant")) significantMoves += 1;
  }
  for (const cd of catDeltas) {
    if (cd.score_move === "up_moderate" || cd.score_move === "down_moderate"
        || cd.score_move === "up_significant" || cd.score_move === "down_significant") {
      significantMoves += 1;
      break;
    }
  }
  if (newImprovements.length || droppedImprovements.length || newOpportunities.length || droppedOpportunities.length) {
    significantMoves += 1;
  }
  if (cLedTotal - pLedTotal >= 3) significantMoves += 1;
  if (cRefC - pRefC >= 1) significantMoves += 1;
  const significance = significantMoves === 0 ? "none"
    : significantMoves === 1 ? "minor"
    : significantMoves <= 3 ? "moderate"
    : "major";

  return {
    days_since_last_summary: daysSince,
    significance,
    portfolio: {
      position_count_change: cPc - pPc,
      top_symbol_now: cPortfolio.top_symbol || null,
      top_symbol_before: pPortfolio.top_symbol || null,
      top_symbol_changed: (cPortfolio.top_symbol || null) !== (pPortfolio.top_symbol || null),
      top_allocation_pct_change: (cTopPct !== null && pTopPct !== null) ? Number((cTopPct - pTopPct).toFixed(1)) : null,
      total_market_value_change: (cMv !== null && pMv !== null) ? Number((cMv - pMv).toFixed(2)) : null,
      total_market_value_pct_change: (cMv !== null && pMv !== null && pMv > 0)
        ? Number((((cMv - pMv) / pMv) * 100).toFixed(1)) : null,
      unrealized_pl_change: (cPl !== null && pPl !== null) ? Number((cPl - pPl).toFixed(2)) : null,
      winners_change: cWin - pWin,
      losers_change: cLose - pLose,
    },
    investor_score: {
      overall_change: overallChange,
      overall_move: overallMove,
      category_deltas: catDeltas,
    },
    ledger_30d: {
      total_change: cLedTotal - pLedTotal,
      rule_followed_change: cRulFol - pRulFol,
      rule_broken_change: cRulBrk - pRulBrk,
    },
    reflections: {
      completed_change: cRefC - pRefC,
    },
    investor_progress: {
      new_improvements: newImprovements,
      dropped_improvements: droppedImprovements,
      consistent_improvements: consistentImprovements,
      new_opportunities: newOpportunities,
      dropped_opportunities: droppedOpportunities,
    },
  };
}

// ---------------------------------------------------------------------------
// LLM callers
// ---------------------------------------------------------------------------

function buildUserMessage(payload: any) {
  return `You are writing about a specific investor. All of the inputs below are the entire truth you may reference — no external knowledge about this user exists in your context.

CURRENT_EVIDENCE (the investor right now):
${JSON.stringify(payload.currentEvidence, null, 2)}

${payload.previousEvidence ? `PREVIOUS_EVIDENCE (the investor at your last generation, ${payload.deltas?.days_since_last_summary ?? "?"} days ago):
${JSON.stringify(payload.previousEvidence, null, 2)}

DELTAS (what actually changed between then and now — significance: ${payload.deltas?.significance ?? "unknown"}):
${JSON.stringify(payload.deltas, null, 2)}

PREVIOUS_SUMMARY (what you wrote last time — do NOT repeat this):
"""
${payload.previousSummary}
"""

${payload.olderSummaries?.length ? `OLDER_SUMMARIES (context about how you've been writing about this investor — do NOT reference these directly, but let them inform the arc):
${payload.olderSummaries.map((s: string, i: number) => `[${i + 2} generations ago]\n"""\n${s}\n"""`).join("\n\n")}
` : ""}` : `PREVIOUS_EVIDENCE: none — this is your FIRST summary about this investor. Write a grounded read of who they are today; you'll be comparing against this next time.
`}

Write the summary paragraph now.`;
}

async function callOpenRouter({ payload, timeoutMs }: { payload: any; timeoutMs: number }) {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY unset");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.5,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(payload) },
        ],
      }),
      signal: controller.signal,
    });
    const bodyText = await res.text();
    if (!res.ok) throw new Error(`openrouter ${res.status}: ${bodyText.slice(0, 300)}`);
    const parsed = JSON.parse(bodyText);
    const content = parsed?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("openrouter: empty content");
    return { text: content.trim(), model: OPENROUTER_MODEL };
  } finally {
    clearTimeout(timer);
  }
}

async function callGroq({ payload, timeoutMs }: { payload: any; timeoutMs: number }) {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY unset");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.5,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(payload) },
        ],
      }),
      signal: controller.signal,
    });
    const bodyText = await res.text();
    if (!res.ok) throw new Error(`groq ${res.status}: ${bodyText.slice(0, 300)}`);
    const parsed = JSON.parse(bodyText);
    const content = parsed?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("groq: empty content");
    return { text: content.trim(), model: GROQ_MODEL };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Auth + Supabase client
// ---------------------------------------------------------------------------

function decodeJwtSub(token: string): string | null {
  // Supabase Gateway with verify_jwt=true already verified the signature
  // before this function runs, so decoding the payload here is safe.
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
    const payload = JSON.parse(atob(padded));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const userId = token ? decodeJwtSub(token) : null;
  if (!userId) {
    return new Response(JSON.stringify({ ok: false, error: "Missing or invalid auth" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = null;
  try { body = await req.json(); } catch { body = null; }
  const currentEvidence = body?.evidence;
  const signature = String(body?.signature || "");
  if (!currentEvidence || typeof currentEvidence !== "object") {
    return new Response(JSON.stringify({ ok: false, error: "Missing evidence packet" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Empty-state short circuit — no LLM call, no history write.
  const positionCount = Number(currentEvidence?.portfolio?.position_count || 0);
  const ledgerCount = Number(currentEvidence?.ledger_30d?.total || 0);
  const reflectionCount = Number(currentEvidence?.reflections?.completed || 0);
  if (positionCount === 0 && ledgerCount === 0 && reflectionCount === 0) {
    return new Response(JSON.stringify({
      ok: true,
      summary: "This is where Rayla's read of your investing state will live. It fills in as you build a portfolio and Rayla observes how you decide — positions, journal entries, reflections after trades, and the patterns that emerge from them. No summary yet because there is nothing recorded to summarize.",
      generatedAt: new Date().toISOString(),
      model: "empty_state",
      priorSummaryCount: 0,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // RLS-scoped client so history reads and the eventual insert respect
  // the user_id boundary automatically. If SUPABASE_URL / ANON_KEY are
  // unset the function still runs — we just skip memory for this call.
  let priorRows: any[] = [];
  let supabase: any = null;
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await supabase
        .from("rayla_summaries")
        .select("id, created_at, signature, summary, evidence, model")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(HISTORY_FETCH_LIMIT);
      if (error) {
        console.warn("[rayla-summary] history fetch failed", error.message || error);
      } else if (Array.isArray(data)) {
        priorRows = data;
      }
    } catch (err) {
      console.warn("[rayla-summary] supabase client init failed", err?.message || err);
    }
  }

  const mostRecent = priorRows[0] || null;
  const olderSummaries = priorRows.slice(1, 4).map((r) => r?.summary).filter(Boolean);
  const deltas = mostRecent ? computeDeltas(currentEvidence, mostRecent.evidence, mostRecent.created_at) : null;

  // If the signature matches the most recent history row exactly, the
  // client is asking us to regenerate over unchanged state (manual
  // Refresh). We still call the LLM so the paragraph can honestly say
  // "nothing significant has changed" in fresh phrasing.
  const signatureMatchesRecent = Boolean(
    mostRecent && signature && String(mostRecent.signature || "") === signature
  );

  const payload = {
    currentEvidence,
    previousEvidence: mostRecent?.evidence || null,
    previousSummary: mostRecent?.summary || null,
    olderSummaries,
    deltas,
    signatureMatchesRecent,
  };

  let result: any = null;
  let lastError: any = null;
  try {
    result = await callOpenRouter({ payload, timeoutMs: OPENROUTER_TIMEOUT_MS });
  } catch (err) {
    lastError = err;
    console.warn("[rayla-summary] openrouter failed, trying groq", err?.message || err);
    try {
      result = await callGroq({ payload, timeoutMs: GROQ_TIMEOUT_MS });
    } catch (err2) {
      lastError = err2;
      console.error("[rayla-summary] all providers failed", err2?.message || err2);
    }
  }

  if (!result) {
    return new Response(JSON.stringify({
      ok: false,
      error: "Summary generation unavailable right now. Please try again.",
      detail: String(lastError?.message || lastError || "unknown"),
    }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Persist the generation so the next call can compare against this
  // one. Best-effort: if the insert fails we still return the summary
  // to the client — the user experience shouldn't hinge on history.
  const generatedAtIso = new Date().toISOString();
  if (supabase) {
    try {
      const { error: insertErr } = await supabase
        .from("rayla_summaries")
        .insert({
          user_id: userId,
          signature: signature || "",
          summary: result.text,
          evidence: currentEvidence,
          model: result.model,
        });
      if (insertErr) {
        console.warn("[rayla-summary] history insert failed", insertErr.message || insertErr);
      }
    } catch (err) {
      console.warn("[rayla-summary] history insert threw", err?.message || err);
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    summary: result.text,
    model: result.model,
    generatedAt: generatedAtIso,
    priorSummaryCount: priorRows.length,
    significance: deltas?.significance || (mostRecent ? "minor" : "first"),
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
