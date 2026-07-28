// @ts-nocheck
//
// weekly-investor-review — v1 (deterministic)
//
// Produces an evidence-only summary of the user's investing behavior for a given
// week. Never invents behavior: every observation is anchored to a real row in
// broker_trade_logs, portfolio_snapshots, or decision_ledger_entries. When a
// domain has too little evidence, the response explicitly says so instead of
// guessing.
//
// v1 is intentionally rule-based (no LLM). This keeps outputs auditable and
// avoids hallucinated behavioral conclusions before enough history exists to
// support them. Future versions may layer an LLM synthesis pass over the same
// evidence blocks — the response shape leaves room for that.
//
// A numerical Investor Score is deliberately NOT emitted. Each domain carries a
// `strength` field (insufficient | light | moderate | strong) which a future
// scoring model can weight once we have enough per-domain history to defend.

import { buildCorsHeaders, jsonResponse, requireSupabaseUser } from "../_shared/auth.ts";

type Strength = "insufficient" | "light" | "moderate" | "strong";

type EvidenceBlock = {
  domain: "discipline" | "decision_quality" | "concentration" | "emotion" | "growth";
  label: string;
  strength: Strength;
  headline: string;
  observations: string[];
  metrics: Record<string, number | string | null>;
  needsMoreHistory: boolean;
};

type ReviewOutput = {
  weekStartISO: string;
  weekEndISO: string;
  generatedAt: string;
  dataAvailability: {
    trades: number;
    tradesPriorWeek: number;
    portfolioSnapshots: number;
    ledgerEntries: number;
    ledgerEntriesPriorWeek: number;
    coachProfileProvided: boolean;
    aiConversations: "unavailable_v1";
  };
  evidence: EvidenceBlock[];
  summary: {
    strongestBehavior: { present: boolean; text: string };
    biggestOpportunity: { present: boolean; text: string };
    evidenceBackedLesson: { present: boolean; text: string };
    recommendedFocusNextWeek: { present: boolean; text: string };
  };
};

const INSUFFICIENT_MESSAGE = "Rayla needs more decision history before evaluating this area.";

function startOfWeekUTC(iso?: string) {
  // Weeks run Monday 00:00 UTC → the following Monday 00:00 UTC.
  const base = iso ? new Date(iso) : new Date();
  if (Number.isNaN(base.getTime())) {
    throw new Error("Invalid weekStartISO.");
  }
  const day = base.getUTCDay(); // 0=Sun ... 6=Sat
  const daysSinceMonday = (day + 6) % 7;
  const monday = new Date(Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate() - daysSinceMonday,
    0, 0, 0, 0,
  ));
  return monday;
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pctString(n: number, digits = 1) {
  return `${n >= 0 ? "" : "-"}${Math.abs(n).toFixed(digits)}%`;
}

function classifyStrengthByCount(count: number, lightAt: number, moderateAt: number, strongAt: number): Strength {
  if (count < lightAt) return "insufficient";
  if (count < moderateAt) return "light";
  if (count < strongAt) return "moderate";
  return "strong";
}

// ---------- Discipline ----------
// Evidence: (a) fraction of trades with a matching pre-trade `plan` entry in the
// decision ledger within the last 72h, and (b) fraction of `rule_check` entries
// with rule_followed=true. Both require raw rows to count as evidence.
function buildDisciplineBlock(trades: any[], ledger: any[]): EvidenceBlock {
  const plans = ledger.filter((e) => e.entry_type === "plan");
  const ruleChecks = ledger.filter((e) => e.entry_type === "rule_check");
  const ruleFollowedCount = ruleChecks.filter((e) => e.rule_followed === true).length;
  const ruleBrokenCount = ruleChecks.filter((e) => e.rule_followed === false).length;

  // Match plans → trades by (symbol, within 72h before trade submission).
  let plannedTrades = 0;
  for (const trade of trades) {
    const submittedAt = trade.submitted_at ? new Date(trade.submitted_at).getTime() : null;
    if (!submittedAt) continue;
    const symbol = String(trade.symbol || "").toUpperCase();
    if (!symbol) continue;
    const match = plans.find((p) => {
      const pSymbol = String(p.symbol || "").toUpperCase();
      if (pSymbol !== symbol) return false;
      const planTime = p.created_at ? new Date(p.created_at).getTime() : null;
      if (!planTime) return false;
      const dt = submittedAt - planTime;
      return dt >= 0 && dt <= 72 * 60 * 60 * 1000;
    });
    if (match) plannedTrades++;
  }

  const total = trades.length;
  const plannedPct = total > 0 ? (plannedTrades / total) * 100 : 0;
  const ruleTotal = ruleFollowedCount + ruleBrokenCount;
  const rulePct = ruleTotal > 0 ? (ruleFollowedCount / ruleTotal) * 100 : 0;

  const evidenceCount = total + ruleTotal;
  const strength = classifyStrengthByCount(evidenceCount, 1, 4, 10);

  const observations: string[] = [];
  if (total > 0) {
    observations.push(`${plannedTrades} of ${total} trade${total === 1 ? "" : "s"} matched a pre-trade plan logged within 72h.`);
  }
  if (ruleTotal > 0) {
    observations.push(`${ruleFollowedCount} of ${ruleTotal} logged rule check${ruleTotal === 1 ? "" : "s"} reported the rule was followed.`);
  }

  if (strength === "insufficient") {
    return {
      domain: "discipline",
      label: "Discipline",
      strength,
      headline: INSUFFICIENT_MESSAGE,
      observations: [],
      metrics: { trades: total, planned_trades: plannedTrades, rule_checks: ruleTotal },
      needsMoreHistory: true,
    };
  }

  const headline = total === 0 && ruleTotal > 0
    ? `Rule adherence: ${rulePct.toFixed(0)}% (${ruleFollowedCount}/${ruleTotal}).`
    : ruleTotal === 0
      ? `${plannedTrades}/${total} trades matched a logged plan (${plannedPct.toFixed(0)}%).`
      : `${plannedTrades}/${total} trades matched a logged plan; rule adherence ${rulePct.toFixed(0)}% across ${ruleTotal} check${ruleTotal === 1 ? "" : "s"}.`;

  return {
    domain: "discipline",
    label: "Discipline",
    strength,
    headline,
    observations,
    metrics: {
      trades: total,
      planned_trades: plannedTrades,
      planned_pct: Math.round(plannedPct),
      rule_checks: ruleTotal,
      rule_followed_pct: ruleTotal > 0 ? Math.round(rulePct) : null,
    },
    needsMoreHistory: false,
  };
}

// ---------- Decision Quality ----------
// Evidence: (a) confidence values on ledger entries, distribution, (b) presence
// of reasoning text (non-empty) on decisions this week. Both are raw
// user-provided facts, not judgments.
function buildDecisionQualityBlock(ledger: any[]): EvidenceBlock {
  const decisions = ledger.filter((e) => e.entry_type === "plan" || e.entry_type === "trade");
  const withReasoning = decisions.filter((e) => typeof e.reasoning === "string" && e.reasoning.trim().length >= 12);
  const confidences: number[] = decisions
    .map((e) => Number(e.confidence))
    .filter((v) => Number.isFinite(v) && v >= 1 && v <= 10);

  const strength = classifyStrengthByCount(decisions.length, 1, 4, 12);

  if (strength === "insufficient") {
    return {
      domain: "decision_quality",
      label: "Decision quality",
      strength,
      headline: INSUFFICIENT_MESSAGE,
      observations: [],
      metrics: { decisions: decisions.length },
      needsMoreHistory: true,
    };
  }

  const avgConfidence = confidences.length
    ? confidences.reduce((s, v) => s + v, 0) / confidences.length
    : null;

  const observations = [
    `${withReasoning.length} of ${decisions.length} decision${decisions.length === 1 ? "" : "s"} included written reasoning.`,
  ];
  if (avgConfidence != null) {
    observations.push(`Average logged confidence: ${avgConfidence.toFixed(1)}/10 across ${confidences.length} entr${confidences.length === 1 ? "y" : "ies"}.`);
  }

  return {
    domain: "decision_quality",
    label: "Decision quality",
    strength,
    headline: avgConfidence != null
      ? `${withReasoning.length}/${decisions.length} decisions have reasoning; avg confidence ${avgConfidence.toFixed(1)}/10.`
      : `${withReasoning.length}/${decisions.length} decisions have written reasoning.`,
    observations,
    metrics: {
      decisions: decisions.length,
      with_reasoning: withReasoning.length,
      with_reasoning_pct: decisions.length > 0 ? Math.round((withReasoning.length / decisions.length) * 100) : 0,
      avg_confidence: avgConfidence != null ? Number(avgConfidence.toFixed(2)) : null,
      confidence_samples: confidences.length,
    },
    needsMoreHistory: false,
  };
}

// ---------- Concentration / Diversification ----------
// Evidence: latest portfolio snapshot in the week — top-position share of
// equity, count of distinct positions.
function buildConcentrationBlock(latestSnapshot: any | null): EvidenceBlock {
  if (!latestSnapshot) {
    return {
      domain: "concentration",
      label: "Concentration & diversification",
      strength: "insufficient",
      headline: INSUFFICIENT_MESSAGE,
      observations: [],
      metrics: {},
      needsMoreHistory: true,
    };
  }

  const positions = Array.isArray(latestSnapshot.positions_json) ? latestSnapshot.positions_json : [];
  const total = positions.reduce((s: number, p: any) => s + Math.abs(safeNumber(p.market_value ?? p.marketValue)), 0);
  if (total <= 0 || positions.length === 0) {
    return {
      domain: "concentration",
      label: "Concentration & diversification",
      strength: "insufficient",
      headline: INSUFFICIENT_MESSAGE,
      observations: [],
      metrics: { positions: positions.length, total_market_value: total },
      needsMoreHistory: true,
    };
  }

  const sorted = [...positions].sort((a, b) =>
    Math.abs(safeNumber(b.market_value ?? b.marketValue)) - Math.abs(safeNumber(a.market_value ?? a.marketValue))
  );
  const top = sorted[0];
  const topSymbol = String(top?.symbol || "top position");
  const topValue = Math.abs(safeNumber(top?.market_value ?? top?.marketValue));
  const topPct = (topValue / total) * 100;
  const topThreePct = sorted.slice(0, 3).reduce((s, p) => s + Math.abs(safeNumber(p.market_value ?? p.marketValue)), 0) / total * 100;

  const strength: Strength = positions.length >= 8 ? "strong" : positions.length >= 4 ? "moderate" : "light";

  const observations = [
    `${positions.length} open position${positions.length === 1 ? "" : "s"} in the most recent snapshot.`,
    `Top position ${topSymbol} = ${pctString(topPct)} of portfolio value; top 3 = ${pctString(topThreePct)}.`,
  ];

  return {
    domain: "concentration",
    label: "Concentration & diversification",
    strength,
    headline: `Top holding ${topSymbol} is ${pctString(topPct)} of the book.`,
    observations,
    metrics: {
      positions: positions.length,
      top_symbol: topSymbol,
      top_pct: Number(topPct.toFixed(2)),
      top3_pct: Number(topThreePct.toFixed(2)),
    },
    needsMoreHistory: false,
  };
}

// ---------- Emotional Behavior ----------
// Evidence: emotion tags the user actually wrote on ledger entries this week.
// No inferred emotions — if the user didn't tag any, we don't guess.
function buildEmotionBlock(ledger: any[]): EvidenceBlock {
  const emotions = ledger
    .map((e) => String(e.emotion || "").trim().toLowerCase())
    .filter((v) => v.length > 0);

  if (emotions.length === 0) {
    return {
      domain: "emotion",
      label: "Emotional behavior",
      strength: "insufficient",
      headline: INSUFFICIENT_MESSAGE,
      observations: [],
      metrics: { emotion_tags: 0 },
      needsMoreHistory: true,
    };
  }

  const counts: Record<string, number> = {};
  for (const e of emotions) counts[e] = (counts[e] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [topEmotion, topCount] = sorted[0];
  const strength = classifyStrengthByCount(emotions.length, 1, 5, 12);

  const observations = [
    `${emotions.length} decision${emotions.length === 1 ? "" : "s"} carried an emotion tag; most common: ${topEmotion} (${topCount}).`,
  ];
  if (sorted.length > 1) {
    observations.push(`Distribution: ${sorted.slice(0, 4).map(([k, v]) => `${k}=${v}`).join(", ")}.`);
  }

  return {
    domain: "emotion",
    label: "Emotional behavior",
    strength,
    headline: `Most common emotion this week: ${topEmotion} (${topCount}/${emotions.length}).`,
    observations,
    metrics: {
      emotion_tags: emotions.length,
      top_emotion: topEmotion,
      top_emotion_count: topCount,
      distinct_emotions: sorted.length,
    },
    needsMoreHistory: false,
  };
}

// ---------- Investor Growth ----------
// Evidence: week-over-week change in (a) count of ledger entries with reasoning,
// (b) count of trades preceded by a logged plan. Growth is defined as the user
// producing more structured decision artifacts this week vs. last, not P&L.
function buildGrowthBlock(
  ledger: any[],
  ledgerPrior: any[],
  trades: any[],
  tradesPrior: any[],
): EvidenceBlock {
  const withReasoningNow = ledger.filter((e) => typeof e.reasoning === "string" && e.reasoning.trim().length >= 12).length;
  const withReasoningPrior = ledgerPrior.filter((e) => typeof e.reasoning === "string" && e.reasoning.trim().length >= 12).length;

  const now = ledger.length;
  const prior = ledgerPrior.length;

  const havePrior = prior > 0 || tradesPrior.length > 0;
  const haveCurrent = now > 0 || trades.length > 0;

  if (!havePrior || !haveCurrent) {
    return {
      domain: "growth",
      label: "Investor growth",
      strength: "insufficient",
      headline: INSUFFICIENT_MESSAGE,
      observations: [],
      metrics: {
        ledger_entries: now,
        ledger_entries_prior_week: prior,
      },
      needsMoreHistory: true,
    };
  }

  const strength: Strength = (now + prior) >= 12 ? "moderate" : "light";
  const delta = now - prior;
  const reasoningDelta = withReasoningNow - withReasoningPrior;

  const observations = [
    `Ledger entries: ${prior} last week → ${now} this week (${delta >= 0 ? "+" : ""}${delta}).`,
    `Entries with written reasoning: ${withReasoningPrior} → ${withReasoningNow} (${reasoningDelta >= 0 ? "+" : ""}${reasoningDelta}).`,
  ];

  return {
    domain: "growth",
    label: "Investor growth",
    strength,
    headline: delta > 0
      ? `More decisions logged this week (+${delta} vs. last).`
      : delta < 0
        ? `Fewer decisions logged this week (${delta} vs. last).`
        : "Same volume of logged decisions as last week.",
    observations,
    metrics: {
      ledger_entries: now,
      ledger_entries_prior_week: prior,
      ledger_delta: delta,
      with_reasoning: withReasoningNow,
      with_reasoning_prior_week: withReasoningPrior,
      reasoning_delta: reasoningDelta,
    },
    needsMoreHistory: false,
  };
}

// ---------- Summary outputs ----------
// Each output is derived from the evidence blocks. If no block has enough
// evidence to justify a claim, the corresponding output is marked present:false
// with the "needs more history" sentence.
function buildSummary(blocks: EvidenceBlock[]) {
  const byDomain = Object.fromEntries(blocks.map((b) => [b.domain, b])) as Record<string, EvidenceBlock>;
  const rank: Record<Strength, number> = { insufficient: 0, light: 1, moderate: 2, strong: 3 };
  const scored = blocks.filter((b) => !b.needsMoreHistory);

  const strongest = scored.length
    ? scored.reduce((best, b) => (rank[b.strength] > rank[best.strength] ? b : best))
    : null;

  const weakest = scored.length
    ? scored.reduce((worst, b) => (rank[b.strength] < rank[worst.strength] ? b : worst))
    : null;

  // Strongest behavior — pick the block with the highest strength.
  const strongestBehavior = strongest
    ? { present: true, text: `${strongest.label}: ${strongest.headline}` }
    : { present: false, text: INSUFFICIENT_MESSAGE };

  // Biggest opportunity — pick the weakest scored block, or the first
  // insufficient block if all scored blocks are strong.
  let opportunityText = INSUFFICIENT_MESSAGE;
  let opportunityPresent = false;
  const insufficientBlocks = blocks.filter((b) => b.needsMoreHistory);
  if (weakest && weakest !== strongest && rank[weakest.strength] < 2) {
    opportunityText = `${weakest.label}: ${weakest.headline}`;
    opportunityPresent = true;
  } else if (insufficientBlocks.length > 0) {
    opportunityText = `Start logging ${insufficientBlocks[0].label.toLowerCase()} evidence — Rayla needs more history there before it can evaluate this area.`;
    opportunityPresent = true;
  } else if (weakest) {
    opportunityText = `${weakest.label}: ${weakest.headline}`;
    opportunityPresent = true;
  }

  // Evidence-backed lesson — only emit if we have discipline OR decision-quality
  // evidence with concrete numbers. Otherwise say we need more history.
  let lessonText = INSUFFICIENT_MESSAGE;
  let lessonPresent = false;

  const disc = byDomain.discipline;
  const dq = byDomain.decision_quality;
  const conc = byDomain.concentration;

  if (disc && !disc.needsMoreHistory && typeof disc.metrics.planned_pct === "number" && (disc.metrics.trades as number) >= 3) {
    const plannedPct = disc.metrics.planned_pct as number;
    if (plannedPct >= 75) {
      lessonText = `You planned ${plannedPct}% of trades this week — evidence that pre-trade logging is sticking. Keep the streak.`;
      lessonPresent = true;
    } else if (plannedPct <= 25) {
      lessonText = `Only ${plannedPct}% of trades had a pre-logged plan. Writing the plan before entering is the smallest change with the biggest downstream signal.`;
      lessonPresent = true;
    } else {
      lessonText = `Roughly half your trades (${plannedPct}%) had a logged plan. Closing the gap on the unplanned half is where next week's improvement lives.`;
      lessonPresent = true;
    }
  } else if (dq && !dq.needsMoreHistory && typeof dq.metrics.with_reasoning_pct === "number" && (dq.metrics.decisions as number) >= 3) {
    const rp = dq.metrics.with_reasoning_pct as number;
    if (rp <= 25) {
      lessonText = `Only ${rp}% of your logged decisions this week included reasoning. A one-line "why" turns a log into a lesson.`;
      lessonPresent = true;
    } else if (rp >= 75) {
      lessonText = `${rp}% of your decisions this week carried written reasoning — that's the raw material future reviews learn from.`;
      lessonPresent = true;
    }
  } else if (conc && !conc.needsMoreHistory && typeof conc.metrics.top_pct === "number" && (conc.metrics.top_pct as number) >= 40) {
    lessonText = `${conc.metrics.top_symbol} is ${pctString(conc.metrics.top_pct as number)} of the book. Concentration this high is a decision — make sure it's a chosen one, not a drift.`;
    lessonPresent = true;
  }

  // Recommended focus next week — mirror opportunity but framed forward.
  let focusText = INSUFFICIENT_MESSAGE;
  let focusPresent = false;
  if (opportunityPresent) {
    const target = weakest && rank[weakest.strength] < 2 ? weakest : (insufficientBlocks[0] || weakest);
    if (target) {
      if (target.domain === "discipline") {
        focusText = "Log a plan entry before every trade next week — even one line.";
      } else if (target.domain === "decision_quality") {
        focusText = "Add a written reason and 1-10 confidence to every decision next week.";
      } else if (target.domain === "concentration") {
        focusText = "Review whether your largest position is a chosen concentration or unmanaged drift.";
      } else if (target.domain === "emotion") {
        focusText = "Tag an emotion on every decision next week — even one word is enough.";
      } else if (target.domain === "growth") {
        focusText = "Aim to log at least one more decision entry than you did this week.";
      }
      focusPresent = true;
    }
  }

  return {
    strongestBehavior,
    biggestOpportunity: { present: opportunityPresent, text: opportunityText },
    evidenceBackedLesson: { present: lessonPresent, text: lessonText },
    recommendedFocusNextWeek: { present: focusPresent, text: focusText },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: buildCorsHeaders() });
  }

  try {
    const { supabase, user } = await requireSupabaseUser(req);
    const body = await req.json().catch(() => ({}));

    const weekStart = startOfWeekUTC(body?.weekStartISO);
    const weekEnd = addDays(weekStart, 7);
    const priorWeekStart = addDays(weekStart, -7);
    const coachProfileProvided = Boolean(body?.coachProfile && typeof body.coachProfile === "object");

    // All reads filtered by user.id as defense-in-depth; RLS already enforces
    // this via auth.uid(), but the service-role client bypasses RLS, so the
    // explicit filter is required.
    const [tradesRes, tradesPriorRes, snapshotsRes, ledgerRes, ledgerPriorRes] = await Promise.all([
      supabase
        .from("broker_trade_logs")
        .select("id, symbol, side, qty, submitted_at, filled_at, status, trade_type")
        .eq("user_id", user.id)
        .gte("submitted_at", weekStart.toISOString())
        .lt("submitted_at", weekEnd.toISOString())
        .order("submitted_at", { ascending: false }),
      supabase
        .from("broker_trade_logs")
        .select("id, submitted_at")
        .eq("user_id", user.id)
        .gte("submitted_at", priorWeekStart.toISOString())
        .lt("submitted_at", weekStart.toISOString()),
      supabase
        .from("portfolio_snapshots")
        .select("id, timestamp, equity, positions_json, positions_count")
        .eq("user_id", user.id)
        .gte("timestamp", weekStart.toISOString())
        .lt("timestamp", weekEnd.toISOString())
        .order("timestamp", { ascending: false })
        .limit(50),
      supabase
        .from("decision_ledger_entries")
        .select("id, created_at, entry_type, symbol, decision, reasoning, confidence, emotion, rule_followed, source, outcome, lesson")
        .eq("user_id", user.id)
        .gte("created_at", weekStart.toISOString())
        .lt("created_at", weekEnd.toISOString())
        .order("created_at", { ascending: false }),
      supabase
        .from("decision_ledger_entries")
        .select("id, created_at, entry_type, reasoning")
        .eq("user_id", user.id)
        .gte("created_at", priorWeekStart.toISOString())
        .lt("created_at", weekStart.toISOString()),
    ]);

    for (const [name, res] of [
      ["broker_trade_logs (current)", tradesRes],
      ["broker_trade_logs (prior)", tradesPriorRes],
      ["portfolio_snapshots", snapshotsRes],
      ["decision_ledger_entries (current)", ledgerRes],
      ["decision_ledger_entries (prior)", ledgerPriorRes],
    ] as const) {
      if (res.error) throw new Error(`Read ${name} failed: ${res.error.message}`);
    }

    const trades = tradesRes.data || [];
    const tradesPrior = tradesPriorRes.data || [];
    const snapshots = snapshotsRes.data || [];
    const ledger = ledgerRes.data || [];
    const ledgerPrior = ledgerPriorRes.data || [];
    const latestSnapshot = snapshots[0] || null;

    const blocks: EvidenceBlock[] = [
      buildDisciplineBlock(trades, ledger),
      buildDecisionQualityBlock(ledger),
      buildConcentrationBlock(latestSnapshot),
      buildEmotionBlock(ledger),
      buildGrowthBlock(ledger, ledgerPrior, trades, tradesPrior),
    ];

    const summary = buildSummary(blocks);

    const output: ReviewOutput = {
      weekStartISO: weekStart.toISOString(),
      weekEndISO: weekEnd.toISOString(),
      generatedAt: new Date().toISOString(),
      dataAvailability: {
        trades: trades.length,
        tradesPriorWeek: tradesPrior.length,
        portfolioSnapshots: snapshots.length,
        ledgerEntries: ledger.length,
        ledgerEntriesPriorWeek: ledgerPrior.length,
        coachProfileProvided,
        aiConversations: "unavailable_v1",
      },
      evidence: blocks,
      summary,
    };

    return jsonResponse({ ok: true, review: output });
  } catch (error) {
    console.log("[weekly-investor-review error]", String((error as any)?.message || error), (error as any)?.stack);
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to build weekly review.",
      },
      400,
    );
  }
});
