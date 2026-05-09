// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const RAYLA_CLASSIFIER_MODEL = "anthropic/claude-haiku-4.5";
const RAYLA_DEFAULT_ANSWER_MODEL = "anthropic/claude-sonnet-4.6";
const RAYLA_HIGH_STAKES_ANSWER_MODEL = "anthropic/claude-opus-4.7";
const OPENROUTER_CLASSIFIER_TIMEOUT_MS = 6000;
const OPENROUTER_ANSWER_TIMEOUT_MS = 25000;
const GROQ_FALLBACK_TIMEOUT_MS = 8000;

// Prefer Supabase secret GEMINI_API_KEY
// For local testing only, paste key in the placeholder
// Do not commit a real key
const GEMINI_API_KEY =
  Deno.env.get("GEMINI_API_KEY") ||
  "PASTE_GEMINI_API_KEY_HERE";

const OPENROUTER_API_KEY =
  Deno.env.get("OPENROUTER_API_KEY") || "";
const GROQ_API_KEY =
  Deno.env.get("GROQ_API_KEY") || "";

const TECHNICAL_FALLBACK_ANSWER = "Rayla is temporarily unavailable right now. Please try again.";

const RAYLA_SYSTEM_PROMPT = `You are Rayla, the AI intelligence layer of the Rayla trading app.

You are:
- a trading coach
- a trade analysis assistant
- an app-native intelligence layer that understands the Rayla product

You understand Rayla workflows including:
- Market Intel
- charts
- simulations
- trade history
- performance
- edge tracking
- journaling
- user behavior and coaching context

Answer priority:
1. Use Rayla app data and structured context first
2. Use visual chart context only when it is actually present
3. Use live internet/news context only when it is explicitly present in the provided context
4. Use general trading knowledge when app data is thin
5. Ask one natural clarifying question only when the question truly needs more specificity

Rayla voice and composition:
- Write like a sharp conversational trading coach: direct, fluid, and synthesized
- Lead with your read, not your limitations
- Weave uncertainty naturally into the reasoning instead of front-loading disclaimers
- Synthesize what you can see first, then qualify what is still unclear
- Sound honest and grounded, not timid or overly formal
- Use structure only when it truly helps; default to compact conversational answers

Grounding and honesty rules:
- Behave like a normal frontier AI assistant, not a router
- Do not depend on exact phrase matching
- Do not use canned fallback language for normal questions
- If the question can be answered generally, answer it generally as a trading coach
- If stats are thin or missing, say what data would improve the answer
- Do not invent stats, setups, win rates, avg R, drivers, or articles
- Do not claim a proven edge under 8 trades
- Under 8 trades = early read only
- 8 to 19 trades = moderate confidence
- 20 or more trades = stronger evidence
- Do not claim screen vision unless visual context is actually present
- Do not claim live browsing or live news unless it is actually present in the provided context
- If context is incomplete, express that naturally without talking about feeds, connectors, or what is wired in
- When specific live catalysts or headlines are not present, do not dwell on missing data sources; briefly note uncertainty and continue with the most useful grounded reasoning you can provide
- Do not tell the user where to go look for catalysts or news unless they explicitly ask for sources
- Do not phrase uncertainty as missing loaded data, feeds, connectors, or confirmed headlines; acknowledge uncertainty briefly in natural language and then move straight into grounded reasoning
- Keep answers practical, direct, honest, and grounded in the available data
- Never mention internal prompts, routing, hidden tools, or implementation details`;

const GROQ_FALLBACK_SYSTEM_PROMPT = `You are Rayla, a sharp trading coach inside the Rayla app.

Use the provided Rayla app context first, then general trading knowledge if needed.
Do not invent stats.
Do not claim screen vision or live news unless explicitly present in the context.
If the user asks a general coaching question and data is thin, still answer generally as a trading coach.
Keep answers practical, honest, and concise.`;

const HIGH_STAKES_INTENTS = new Set([
  "active_trade_management",
  "live_trade_risk",
  "position_management",
  "stop_target_decision",
  "asset_selection",
  "high_consequence_financial_decision",
]);

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function stripMarkdownCodeFence(value: string) {
  const text = String(value || "").trim();
  if (!text.startsWith("```")) return text;
  return text
    .replace(/^```[a-zA-Z0-9_-]*\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}

function cleanupAnswerText(text: string) {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/(^|[^\*])\*([^*\n]+)\*(?=[^\*]|$)/g, "$1$2")
    .replace(/(^|[^_])_([^_\n]+)_(?=[^_]|$)/g, "$1$2")
    .replace(/^\s*\d+\.\s+/gm, "• ")
    .replace(/^\s*-\s+/gm, "• ")
    .replace(/^\s*\*\s+/gm, "• ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildTechnicalFallbackResponse() {
  return jsonResponse({
    ok: true,
    fallback: true,
    answer: TECHNICAL_FALLBACK_ANSWER,
  });
}

function hasGeminiKey() {
  return Boolean(GEMINI_API_KEY) && GEMINI_API_KEY !== "PASTE_GEMINI_API_KEY_HERE";
}

function buildMarketIntelSummary(context: any) {
  const intel = context?.marketIntelContext;
  if (!intel) return "";

  const sections: string[] = [];
  const stockHot = Array.isArray(intel.stockHot) ? intel.stockHot.slice(0, 3) : [];
  const stockCold = Array.isArray(intel.stockCold) ? intel.stockCold.slice(0, 3) : [];
  const cryptoHot = intel.cryptoHot ? [intel.cryptoHot] : [];
  const cryptoCold = intel.cryptoCold ? [intel.cryptoCold] : [];
  const driverLabels: Record<string, string> = {
    demand: "demand",
    costMargin: "margin pressure",
    guidance: "guidance",
    narrative: "narrative",
    priceConfirmation: "price confirmation",
    liquidity: "liquidity",
    sentiment: "sentiment",
    momentum: "momentum",
    catalyst: "catalyst",
    relativeStrength: "relative strength",
  };

  const formatIntelAsset = (item: any) => {
    if (!item) return "";
    const summary = String(item.summary || "").trim();
    const topDrivers = item?.breakdown && typeof item.breakdown === "object"
      ? Object.entries(item.breakdown)
        .filter(([key, value]) => key !== "total" && Number.isFinite(Number(value)) && Number(value) !== 0)
        .sort((a, b) => Math.abs(Number(b[1]) || 0) - Math.abs(Number(a[1]) || 0))
        .slice(0, 2)
        .map(([key, value]) => {
          const numericValue = Number(value) || 0;
          const direction = numericValue > 0 ? "positive" : "negative";
          return `${direction} ${driverLabels[key] || key}`;
        })
      : [];
    const driversLine = topDrivers.length ? ` Drivers: ${topDrivers.join(", ")}.` : "";
    return `${item.symbol || item.name || "Asset"} (${item.change || "n/a"}, score ${item.score ?? "n/a"})${summary ? ` — ${summary}` : ""}${driversLine}`;
  };

  if (stockHot.length) sections.push(`Hot stocks/ETFs: ${stockHot.map(formatIntelAsset).filter(Boolean).join(" | ")}`);
  if (stockCold.length) sections.push(`Cold stocks/ETFs: ${stockCold.map(formatIntelAsset).filter(Boolean).join(" | ")}`);
  if (cryptoHot.length) sections.push(`Hot crypto: ${cryptoHot.map(formatIntelAsset).filter(Boolean).join(" | ")}`);
  if (cryptoCold.length) sections.push(`Cold crypto: ${cryptoCold.map(formatIntelAsset).filter(Boolean).join(" | ")}`);

  // Derive market state from breadth, score spread, and dominant driver
  const allHot = [...stockHot, ...cryptoHot];
  const allCold = [...stockCold, ...cryptoCold];
  const hotCount = allHot.length;
  const coldCount = allCold.length;
  const totalCount = hotCount + coldCount;

  if (totalCount >= 2) {
    const avgHotScore = hotCount > 0
      ? allHot.reduce((sum, item) => sum + (Number(item?.score) || 0), 0) / hotCount
      : 0;
    const avgColdScore = coldCount > 0
      ? allCold.reduce((sum, item) => sum + Math.abs(Number(item?.score) || 0), 0) / coldCount
      : 0;
    const scoreSpread = avgHotScore + avgColdScore;

    // Most common top driver across hot assets
    const driverCounts: Record<string, number> = {};
    allHot.forEach((item) => {
      if (!item?.breakdown || typeof item.breakdown !== "object") return;
      const topDriver = Object.entries(item.breakdown)
        .filter(([k, v]) => k !== "total" && Number(v) > 0)
        .sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0];
      if (topDriver) driverCounts[topDriver] = (driverCounts[topDriver] || 0) + 1;
    });
    const dominantDriver = Object.entries(driverCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const driverLabel = dominantDriver ? (driverLabels[dominantDriver] || dominantDriver) : null;

    const narrativeLabel = hotCount > coldCount && scoreSpread >= 5
      ? "directional"
      : coldCount > hotCount && scoreSpread >= 5
        ? "risk-off"
        : Math.abs(hotCount - coldCount) <= 1
          ? "rotational"
          : "mixed";

    const narrativeLine = narrativeLabel === "directional"
      ? `Market state (today's intel): directional — hot names (${hotCount}) outnumber cold (${coldCount}), score spread ${scoreSpread.toFixed(1)}${driverLabel ? `, dominant driver: ${driverLabel}` : ""}. Conditions lean breakout-friendly but confirm before chasing.`
      : narrativeLabel === "risk-off"
        ? `Market state (today's intel): risk-off — cold names (${coldCount}) outnumber hot (${hotCount}), score spread ${scoreSpread.toFixed(1)}. Patience environment; quality setups over aggression.`
        : narrativeLabel === "rotational"
          ? `Market state (today's intel): rotational — hot (${hotCount}) and cold (${coldCount}) roughly balanced${driverLabel ? `, mixed drivers (${driverLabel} leading)` : ""}. Selectivity matters; breakouts need extra confirmation.`
          : `Market state (today's intel): mixed — hot (${hotCount}), cold (${coldCount}), spread ${scoreSpread.toFixed(1)}. No clear session lean; treat each setup on its own merit.`;

    sections.push(narrativeLine);
  }

  return sections.join("\n");
}

function buildPerformanceSummary(context: any) {
  const stats = context?.stats ?? {};
  const performanceStats = context?.performanceStats ?? null;
  const tradeHistorySummary = context?.tradeHistorySummary ?? null;
  const parts: string[] = [];

  if (Number.isFinite(Number(stats?.totalTrades))) {
    parts.push(
      `Trade stats: totalTrades=${Number(stats.totalTrades || 0)}, winRate=${Number(stats.winRate || 0).toFixed(1)}%, avgR=${Number(stats.avgR || 0).toFixed(2)}, recentLossStreak=${Number(stats.recentLossStreak || 0)}`
    );
  }

  if (stats?.bestSetup?.name) {
    parts.push(`Best setup so far: ${stats.bestSetup.name}`);
  }
  if (stats?.worstSetup?.name) {
    parts.push(`Weakest setup so far: ${stats.worstSetup.name}`);
  }
  if (stats?.bestAsset?.name) {
    parts.push(`Best asset so far: ${stats.bestAsset.name}`);
  }

  if (performanceStats) {
    parts.push(`Performance context: ${JSON.stringify(performanceStats)}`);
  }
  if (tradeHistorySummary) {
    parts.push(`Trade history summary: ${JSON.stringify(tradeHistorySummary)}`);
  }

  return parts.join("\n");
}

function buildEdgeSummaryBlock(context: any) {
  const edgeSummary = String(context?.edgeSummary || "").trim();
  if (!edgeSummary) return "";
  return `Trader edge context:\n${edgeSummary}`;
}

function buildChartSummary(context: any) {
  const chartContext = context?.chartContext ?? null;
  if (!chartContext) return "";
  const recentBars = Array.isArray(chartContext?.recentBars) ? chartContext.recentBars : [];
  const numericBars = recentBars
    .map((bar: any) => ({
      open: Number(bar?.open),
      high: Number(bar?.high),
      low: Number(bar?.low),
      close: Number(bar?.close),
    }))
    .filter((bar) => [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite));

  const parts: string[] = [
    `Chart context: symbol=${chartContext.symbol || chartContext.assetName || "unknown"}, type=${chartContext.assetType || "unknown"}, timeframe=${chartContext.range || chartContext.timeframe || "unknown"}, currentPrice=${chartContext.currentPrice ?? "n/a"}, bars=${recentBars.length}.`,
  ];

  if (numericBars.length >= 2) {
    const firstBar = numericBars[0];
    const lastBar = numericBars[numericBars.length - 1];
    const visibleHigh = Math.max(...numericBars.map((b) => b.high));
    const visibleLow = Math.min(...numericBars.map((b) => b.low));
    const netMove = lastBar.close - firstBar.close;
    const netMovePct = firstBar.close ? (netMove / firstBar.close) * 100 : null;

    const highs = numericBars.map((b) => b.high);
    const lows = numericBars.map((b) => b.low);
    const higherHighs = highs[highs.length - 1] > highs[0];
    const higherLows = lows[lows.length - 1] > lows[0];
    const lowerHighs = highs[highs.length - 1] < highs[0];
    const lowerLows = lows[lows.length - 1] < lows[0];
    const trendLabel = higherHighs && higherLows ? "uptrend"
      : lowerHighs && lowerLows ? "downtrend"
      : "range/chop";

    const tailBars = numericBars.slice(-3);
    const tailMove = tailBars.length >= 2 ? tailBars[tailBars.length - 1].close - tailBars[0].close : 0;
    const behaviorLabel = trendLabel === "uptrend"
      ? (tailMove > 0 ? "continuation" : tailMove < 0 ? "pullback" : "stall")
      : trendLabel === "downtrend"
        ? (tailMove < 0 ? "continuation" : tailMove > 0 ? "bounce/pullback" : "stall")
        : "consolidating";

    parts.push(`Trend: ${trendLabel}. Recent behavior: ${behaviorLabel}.`);
    parts.push(`Visible range: ${visibleLow.toFixed(2)} to ${visibleHigh.toFixed(2)}. Net move: ${netMove >= 0 ? "+" : ""}${netMove.toFixed(2)}${Number.isFinite(netMovePct) ? ` (${netMovePct >= 0 ? "+" : ""}${netMovePct.toFixed(2)}%)` : ""}.`);
    parts.push(`Swing high: ~${visibleHigh.toFixed(2)}. Swing low: ~${visibleLow.toFixed(2)}.`);

    if (behaviorLabel === "pullback" && trendLabel === "uptrend" && visibleHigh > 0) {
      const pullbackPct = ((visibleHigh - lastBar.close) / visibleHigh) * 100;
      if (pullbackPct > 0.1) {
        parts.push(`Pullback depth: ~${pullbackPct.toFixed(1)}% off the recent swing high.`);
      }
    }
    if (behaviorLabel === "bounce/pullback" && trendLabel === "downtrend" && visibleLow > 0) {
      const bouncePct = ((lastBar.close - visibleLow) / visibleLow) * 100;
      if (bouncePct > 0.1) {
        parts.push(`Bounce depth: ~${bouncePct.toFixed(1)}% off the recent swing low.`);
      }
    }

    if (numericBars.length >= 6) {
      const third = Math.max(2, Math.floor(numericBars.length / 3));
      const earlyBodies = numericBars.slice(0, third).map((b) => Math.abs(b.close - b.open));
      const lateBodies = numericBars.slice(-third).map((b) => Math.abs(b.close - b.open));
      const avgEarly = earlyBodies.reduce((a, b) => a + b, 0) / earlyBodies.length;
      const avgLate = lateBodies.reduce((a, b) => a + b, 0) / lateBodies.length;
      if (avgEarly > 0) {
        const ratio = avgLate / avgEarly;
        const momentumLabel = ratio > 1.25
          ? "expanding (bars getting larger)"
          : ratio < 0.75
            ? "contracting (bars getting smaller, energy fading)"
            : "steady";
        parts.push(`Momentum: ${momentumLabel}.`);
      }
    }
  }

  const tappedBar = chartContext?.tappedBar ?? null;
  if (tappedBar) {
    parts.push(`Tapped bar: direction=${tappedBar.direction}, price=~${Number(tappedBar.price).toFixed(2)}, open=${Number(tappedBar.open).toFixed(2)}, high=${Number(tappedBar.high).toFixed(2)}, low=${Number(tappedBar.low).toFixed(2)}, close=${Number(tappedBar.close).toFixed(2)}, position=${tappedBar.relativePosition}. Focus your response on what's happening at or near this specific price level.`);
  }

  return parts.join("\n");
}

function buildSelectedAssetSummary(context: any) {
  const asset = context?.selectedAssetContext ?? null;
  if (!asset?.symbol) return "";

  const parts = [
    `Selected asset: ${asset.symbol}`,
    `type=${asset.assetType || "unknown"}`,
  ];

  if (asset.assetName && asset.assetName !== asset.symbol) {
    parts.push(`name=${asset.assetName}`);
  }
  if (asset.currentPrice != null) {
    parts.push(`currentPrice=${asset.currentPrice}`);
  }
  if (asset.change != null) {
    parts.push(`change=${asset.change}`);
  }
  if (asset.intelScore != null) {
    parts.push(`intelScore=${asset.intelScore}`);
  }
  if (asset.hotColdBucket) {
    parts.push(`bucket=${asset.hotColdBucket}`);
  }
  if (asset.raylaPickBucket) {
    parts.push(`raylaPick=${asset.raylaPickBucket}`);
  }

  const extra: string[] = [];
  if (asset.intelSummary) {
    extra.push(`Intel summary: ${asset.intelSummary}`);
  }
  if (Array.isArray(asset.topBreakdownDrivers) && asset.topBreakdownDrivers.length) {
    extra.push(`Drivers: ${asset.topBreakdownDrivers.slice(0, 2).join(", ")}`);
  }
  if (asset.articleTitle || asset.articleSource || asset.articleSummary) {
    extra.push(
      `Article context: ${[
        asset.articleTitle || null,
        asset.articleSource ? `source ${asset.articleSource}` : null,
        asset.articleSummary || null,
      ].filter(Boolean).join(" — ")}`
    );
  }
  if (asset.chartSummary) {
    const chartBits = [
      asset.chartSummary.timeframe ? `timeframe=${asset.chartSummary.timeframe}` : null,
      Number.isFinite(Number(asset.chartSummary.barCount)) ? `bars=${asset.chartSummary.barCount}` : null,
      Number.isFinite(Number(asset.chartSummary.firstClose)) ? `firstClose=${asset.chartSummary.firstClose}` : null,
      Number.isFinite(Number(asset.chartSummary.lastClose)) ? `lastClose=${asset.chartSummary.lastClose}` : null,
      Number.isFinite(Number(asset.chartSummary.netChange)) ? `netChange=${asset.chartSummary.netChange}` : null,
      Number.isFinite(Number(asset.chartSummary.netChangePct)) ? `netChangePct=${asset.chartSummary.netChangePct}` : null,
    ].filter(Boolean);
    if (chartBits.length) {
      extra.push(`Selected asset chart summary: ${chartBits.join(", ")}`);
    }
  }

  return [parts.join(", "), ...extra].join("\n");
}

function buildPostTradeReviewBlock(context: any) {
  const ct = context?.simulationContext?.closedTrade ?? null;
  if (!ct) return "";
  const symbol = context?.simulationContext?.symbol || context?.simulationContext?.assetName || "unknown";
  const direction = ct.direction || context?.simulationContext?.direction || "unknown";
  const parts = [
    `Closed simulation trade: ${symbol} ${direction}`,
    Number.isFinite(Number(ct.rMultiple)) ? `R-multiple: ${Number(ct.rMultiple).toFixed(2)}R` : "",
    Number.isFinite(Number(ct.profitLoss)) ? `P&L: $${Number(ct.profitLoss).toFixed(2)}` : "",
    ct.exitReason ? `Exit reason: ${ct.exitReason}` : "",
    ct.executionGradeLabel ? `Execution: ${ct.executionGradeLabel}` : "",
    ct.outcomeLabel ? `Outcome: ${ct.outcomeLabel}` : "",
    ct.coachingInsight ? `Coaching insight: ${ct.coachingInsight}` : "",
    ct.feedback ? `Feedback: ${ct.feedback}` : "",
  ].filter(Boolean).join("\n");
  return parts;
}

function buildSimulationSummary(context: any) {
  const simulationContext = context?.simulationContext ?? null;
  if (!simulationContext) return "";
  const activeTrade = simulationContext?.activeTrade ?? null;
  const parts = [
    `Simulation context: mode=${simulationContext.mode || simulationContext.contextType || "simulation"}, symbol=${simulationContext.symbol || simulationContext.assetName || "unknown"}, direction=${simulationContext.direction || "unknown"}, currentPrice=${simulationContext.currentPrice ?? "n/a"}`,
  ];
  if (activeTrade) {
    parts.push(`Active simulation trade: ${JSON.stringify(activeTrade)}`);
  }
  return parts.join("\n");
}

function buildRaylaPicksSummary(context: any) {
  const picks = context?.raylaPicksContext;
  if (!picks) return "";
  return `Rayla picks context: ${JSON.stringify(picks)}`;
}

function buildBehavioralPatternBlock(context: any) {
  const bp = context?.behavioralPatternContext;
  if (!bp || !bp.patternThresholdMet) return "";

  const parts = [`Behavioral pattern data (last ${bp.sampleSize} sim trades):`];
  parts.push(`- Win rate: ${bp.winRate}%`);

  if (bp.longWinRate !== null && bp.longTradeCount >= 4) {
    parts.push(`- Long win rate: ${bp.longWinRate}% (${bp.longTradeCount} trades)`);
  }
  if (bp.shortWinRate !== null && bp.shortTradeCount >= 4) {
    parts.push(`- Short win rate: ${bp.shortWinRate}% (${bp.shortTradeCount} trades)`);
  }
  if (bp.currentStreak && bp.currentStreak.count >= 2) {
    parts.push(`- Current streak: ${bp.currentStreak.count} consecutive ${bp.currentStreak.type}s`);
  }
  if (bp.cutEarlyCount >= 2) {
    parts.push(`- Cut winners early: ${bp.cutEarlyCount} of last ${bp.sampleSize} trades`);
  }
  if (bp.heldTooLongCount >= 2) {
    parts.push(`- Held losers too long: ${bp.heldTooLongCount} of last ${bp.sampleSize} trades`);
  }
  if (bp.strongExecCount >= 2) {
    parts.push(`- Strong execution (A/B grade): ${bp.strongExecCount} trades`);
  }
  if (bp.poorExecCount >= 2) {
    parts.push(`- Poor execution (D grade): ${bp.poorExecCount} trades`);
  }

  return parts.join("\n");
}

function derivePressureLevel(bp: any): "firm" | "neutral" | "light" {
  if (!bp || !bp.patternThresholdMet || bp.sampleSize < 5) return "neutral";

  let firmSignals = 0;
  let lightSignals = 0;

  // Primary: execution behavior (not outcomes — these reflect what the trader actually did)
  if (bp.cutEarlyCount >= 3) firmSignals++;
  if (bp.poorExecCount >= 3) firmSignals++;
  if (bp.strongExecCount === 0 && bp.sampleSize >= 6) firmSignals++;
  // Secondary: outcome signals (require primary signals to reach threshold)
  if (bp.currentStreak?.type === "loss" && bp.currentStreak.count >= 3) firmSignals++;
  if (bp.winRate < 35 && bp.sampleSize >= 10) firmSignals++;

  // Primary: clean execution signals
  if (bp.strongExecCount >= Math.ceil(bp.sampleSize * 0.6)) lightSignals++;
  if (bp.cutEarlyCount === 0 && bp.poorExecCount === 0 && bp.sampleSize >= 5) lightSignals++;
  // Secondary: outcome signals
  if (bp.currentStreak?.type === "win" && bp.currentStreak.count >= 3) lightSignals++;
  if (bp.winRate >= 60 && bp.sampleSize >= 10) lightSignals++;

  if (firmSignals >= 2) return "firm";
  if (lightSignals >= 2) return "light";
  return "neutral";
}

function buildRecentTradesSummary(context: any) {
  const recentTrades = Array.isArray(context?.recentTrades) ? context.recentTrades.slice(0, 8) : [];
  if (!recentTrades.length) return "";
  return `Recent trades: ${JSON.stringify(recentTrades)}`;
}

function buildRecentConversationSummary(context: any) {
  const recentConversation = Array.isArray(context?.recentConversation) ? context.recentConversation.slice(-8) : [];
  if (!recentConversation.length) return "";
  return `Recent conversation: ${JSON.stringify(recentConversation)}`;
}

function buildAppContextSummary(context: any) {
  if (!context?.appContext) return "";
  return `App context: ${JSON.stringify(context.appContext)}`;
}

function buildMetaContextBlock(context: any) {
  const parts: string[] = [];
  const raylaMode = String(context?.raylaMode || "").trim();
  const sourceTab = String(context?.sourceTab || "").trim();
  const adaptive = context?.adaptiveProfile ?? null;

  if (raylaMode) parts.push(`mode=${raylaMode}`);
  if (sourceTab) parts.push(`tab=${sourceTab}`);
  if (adaptive?.explanationDepth) parts.push(`explanationDepth=${adaptive.explanationDepth}`);
  if (adaptive?.preferredStyle) parts.push(`preferredStyle=${adaptive.preferredStyle}`);
  if (Number.isFinite(Number(adaptive?.interactions?.questionCount))) {
    parts.push(`questionCount=${adaptive.interactions.questionCount}`);
  }

  if (!parts.length) return "";
  return `Session context: ${parts.join(" | ")}`;
}

function buildBackgroundReferenceBlock(context: any) {
  const parts = [
    buildEdgeSummaryBlock(context),
    buildPerformanceSummary(context),
    buildRecentTradesSummary(context),
  ].filter(Boolean);

  if (!parts.length) return "";
  return [
    "Background reference — use when directly relevant to the user's performance, edge, or setup selection:",
    ...parts,
  ].join("\n");
}

function buildVisualChartContextBlock(visualRead: any) {
  if (!visualRead) return "";
  return [
    "Visual Chart Context:",
    `- Trend: ${visualRead.trend || "Not clear"}`,
    `- Structure: ${visualRead.structure || "Not clear"}`,
    `- Momentum: ${visualRead.momentum || "Not clear"}`,
    `- Key Areas: ${visualRead.keyAreas || visualRead.visibleLevels || "Not clear"}`,
    `- Trade Markers: ${visualRead.tradeMarkers || visualRead.visibleTradeMarkers || "None visible"}`,
    `- Notes: ${visualRead.notes || visualRead.uncertainty || "No additional notes"}`,
  ].join("\n");
}

function buildUnifiedRaylaContext(question: string, rawContext: any, visualChartContext = "") {
  const context = rawContext ?? {};
  return {
    question,
    stats: context.stats ?? null,
    edgeSummary: context.edgeSummary ?? null,
    recentTrades: context.recentTrades ?? [],
    tradeHistorySummary: context.tradeHistorySummary ?? null,
    performanceStats: context.performanceStats ?? null,
    chartContext: context.chartContext ?? null,
    visualContext: context.visualContext ?? null,
    visualChartContext: visualChartContext || context.visualChartContext || "",
    simulationContext: context.simulationContext ?? null,
    marketIntelContext: context.marketIntelContext ?? null,
    raylaPicksContext: context.raylaPicksContext ?? null,
    behavioralPatternContext: context.behavioralPatternContext ?? null,
    selectedAssetContext: context.selectedAssetContext ?? null,
    appContext: context.appContext ?? null,
    recentConversation: context.recentConversation ?? [],
    adaptiveProfile: context.adaptiveProfile ?? null,
    raylaMode: context.raylaMode ?? "beginner",
    sourceTab: context.sourceTab ?? null,
    sampleSize: Number(
      context?.performanceStats?.sampleSize
      ?? context?.tradeHistorySummary?.sampleSize
      ?? context?.stats?.totalTrades
      ?? 0
    ),
  };
}

function buildSystemPrompt(context: any, intent: string) {
  const sampleSize = Number(context?.sampleSize || 0);
  const confidenceLine = sampleSize < 8
    ? "Sample confidence: early read only."
    : sampleSize < 20
      ? "Sample confidence: moderate."
      : "Sample confidence: stronger evidence.";

  const visualAvailability = context?.visualChartContext
    ? "Visual chart context is available and may be used."
    : "No visual chart context is available. Do not imply that you can see the screen; speak naturally about uncertainty instead.";

  const liveDataAvailability = context?.marketIntelContext
    ? "Market Intel context is available from the app."
    : "Specific catalyst or news context may be limited here. Do not pretend to have specific live catalysts or news you were not given; speak naturally about uncertainty instead.";

  const compositionRules = [
    "Composition rules:",
    "- Rayla leads with her read, not her limitations.",
    "- Uncertainty should be woven naturally into the reasoning, not front-loaded as a disclaimer.",
    "- Rayla synthesizes what she can see before qualifying what remains unclear.",
    "- Uncertainty acknowledgements should be proportional: do not announce missing data when the reasoning already meaningfully answers the question, and only call it out when precision truly depends on it.",
    "- Rayla sounds honest, grounded, and conversational, not like a support article or cautious explainer.",
    "- Prefer compact natural prose over bullet-heavy teaching unless structure clearly helps.",
  ].join("\n");

  const compositionFewShots = [
    "Composition examples:",
    'User: "what was moving btc this afternoon?"',
    'Rayla: "Honestly this looks more like normal afternoon crypto weakness than some huge single catalyst move. If there was a headline behind it I\'m not seeing it in the current context, so the cleaner read is broad risk sentiment, dollar strength, ETF flow chatter, or a leverage flush."',
    'User: "why did rayla pick lrcx?"',
    'Rayla: "LRCX usually earns a bullish read when the semi group is acting well and the stock is showing relative strength. I\'m not seeing a richer Rayla-specific catalyst stack here, so I\'d treat this as a quality semi with industry momentum behind it rather than some one-off news event."',
    'User: "what should i watch on nvda here?"',
    'Rayla: "First thing I\'d watch is whether buyers are still defending the recent push or if this is starting to stall out. I\'m not seeing enough chart detail to call exact levels confidently, but the real question is whether momentum is still expanding or rolling into a pullback."',
    'User: "does this btc move feel news-driven?"',
    'Rayla: "Not obviously. It reads more like normal crypto rotation or risk-off pressure unless price is reacting to a very specific headline, and nothing in the current context points cleanly to that kind of event."',
    'User: "explain this chart"',
    'Rayla: "This is pulling back inside an uptrend — price has come off the recent swing high and the question is whether buyers step back in here or this fade keeps going. The trend structure is still intact as long as the lower end of the visible range holds. If buyers defend that area and momentum picks back up, that\'s the setup. If that level gives way cleanly, the short-term bullish read is off."',
    'User: "where\'s support on this?"',
    'Rayla: "The swing low from the visible range is your structural anchor — that\'s where the setup either holds or breaks down. If price comes back to that area and reacts, buyers are still in control. If it loses that level cleanly and closes below it, the trade thesis is done for now and you wait for a new read."',
  ].join("\n");

  const evidenceGroundingRules = [
    "Evidence grounding rules:",
    "- If the recent conversation shows an ongoing topic or lesson, continue that thread as the primary response for referential follow-ups such as 'show me an example', 'what does that look like', or 'how would I trade it'. Switch immediately and fully if the user clearly changes topics or asks about something new.",
    "- If the most recent assistant message asked a direct continuation question or offered to explain, show, or walk through something, and the user replies with a short affirmative such as 'yeah', 'sure', 'ok', 'yes', 'please do', or 'go ahead', treat it as confirmation and immediately continue the offered topic. Do not ask the user to restate themselves. Only ask for clarification if the user's reply is genuinely ambiguous and there is no obvious active thread.",
    "- For questions about what is moving them, why this pick, best crypto or stock, intel, or watchlist names, use marketIntelContext and raylaPicksContext before general market knowledge.",
    "- For chart or current setup questions, use chartContext and visualChartContext before general market knowledge.",
    "- For edge, performance, or stats questions, use performanceStats, stats, recentTrades, and tradeHistorySummary before general trading knowledge.",
    "- For general coaching or strategy questions, answer the question directly first, then connect to Rayla context if it adds something useful. Do not pivot the answer to edge or performance data unless the user is explicitly asking about their own results.",
    "- If Rayla context is partial or thin, anchor to what is available first, then clearly supplement with broader market or trading knowledge while labeling it as general reasoning rather than Rayla-specific context.",
    "- If the supplied context does not contain the needed driver, reason, catalyst, level, stat, or chart detail, briefly note that uncertainty in natural language and then continue with the most relevant grounded reasoning you can provide.",
    "- Do not invent market movers, news, catalysts, levels, trade stats, or chart structure that are not present in the supplied context.",
    "- General trading knowledge is allowed only after you clearly anchor to the supplied context, or when the relevant supplied context is absent.",
  ].join("\n");

  const chartGroundedCoachingGuidance = (context?.chartContext || context?.visualChartContext)
    ? [
      "Chart coaching guidance:",
      "- Anchor chart responses to what the data actually shows. Do not invent levels, candle patterns, or price action details not present in the context.",
      "- Frame structure in plain language: 'buyers have been defending around X', 'this is a pullback into the breakout level', 'the range is tightening'.",
      "- Use invalidation language when it fits: 'if price loses X, the setup no longer makes sense', 'that level breaking changes the read entirely'.",
      "- Distinguish trend from range before discussing setups — a pullback play only makes sense in a trend; a range fade needs clear boundaries.",
      "- Describe momentum in terms of energy: 'momentum is still expanding' vs 'this move is stalling and losing conviction'.",
      "- Keep chart reads short: one clear observation, one level or condition to watch, one implication. Do not produce a full TA report.",
      "- When a specific bar was tapped (tappedBar is present in context), limit to 2–3 sentences focused only on that price level. Do not expand into a full chart read.",
      "- If chart context is thin or absent, say so briefly and give general framing — do not pretend to see details that are not there.",
    ].join("\n")
    : "";

  const preTradeSetupGuidance = (context?.simulationContext && !context?.simulationContext?.activeTrade && !context?.simulationContext?.closedTrade)
    ? [
      "Pre-trade setup guidance (no open trade yet):",
      "- Help the user build a thesis BEFORE they open the trade. Do not skip to mechanics.",
      "- Ask or prompt one question at a time: is this trending or ranging? What's the entry rationale? Where would this trade be wrong (invalidation level)?",
      "- For beginners, frame each concept briefly in plain language: 'trending means price is making higher highs and higher lows', 'invalidation is the price level where your reason for the trade no longer makes sense'.",
      "- Do not just send them to open the trade. Build the reasoning together first.",
      "- If the user has already described their thesis clearly, acknowledge it and move to the next step rather than repeating the question.",
    ].join("\n")
    : "";

  const postTradeReviewGuidance = context?.simulationContext?.closedTrade
    ? [
      "Post-trade review guidance:",
      "- The user just closed a simulation trade. Give a natural, conversational mentor-style review.",
      "- Cover briefly: whether the setup made sense, whether execution was disciplined, whether risk/reward was appropriate, and how this fits their developing edge.",
      "- Keep it to 2-3 short paragraphs. No bullet grading. No fake certainty. No robotic scoring.",
      "- Use the closed trade data (rMultiple, executionGrade, feedback, coachingInsight) as raw material — do not quote the grade directly or make it feel like a report card.",
      "- Connect to sessionStats or edgeSummary if they add something useful. Do not force it.",
      "- End naturally with one thing worth repeating and one thing to tighten next time.",
      ...(context?.simulationContext?.closedTrade?.isFirstSimTrade ? [
        "- This is the user's first simulation trade. Acknowledge the milestone briefly and without fanfare — mentor tone, not celebration.",
        "- Frame the review around: did they have a thesis, did they hold to their plan. The goal wasn't to win — it was to have structure.",
        "- End with one specific thing that would make the next rep better. Keep it encouraging but direct.",
      ] : []),
    ].join("\n")
    : "";

  const behaviorPatternGuidance = context?.behavioralPatternContext?.patternThresholdMet
    ? [
      "Behavioral pattern guidance:",
      "- Behavioral pattern data from the user's recent simulation trades is available below.",
      "- Reference a behavioral observation only when directly relevant to the current trade setup, post-trade review, or a direct question about performance.",
      "- Ground every observation in the specific count: '4 of your last 8 trades' — never 'you always' or 'you never'.",
      "- Surface at most one behavioral observation per response. Do not stack multiple pattern callouts.",
      "- Do not repeat a behavioral observation that was already made in the immediately prior response.",
      "- Permitted framing: 'tends to', 'has been', 'recently', 'in the last N trades'.",
      "- Forbidden framing: 'you always', 'you never', 'you are', 'you struggle with', anything inferring emotion, motivation, or personality.",
      "- Do not surface behavioral patterns in chart-only questions or general trading knowledge questions.",
      "- Do not infer cause — only describe what the numbers show.",
    ].join("\n")
    : "";

  const pressureLevel = derivePressureLevel(context?.behavioralPatternContext);

  const coachingPressureGuidance = pressureLevel === "firm"
    ? [
      "Coaching firmness: high",
      "- Recent execution data shows a recurring pattern worth addressing (see behavioral data below).",
      "- In setup coaching: lead with the invalidation level question before discussing entry.",
      "- In post-trade reviews: end with one direct, specific corrective note — named, not hedged.",
      "- Be slightly more deliberate before giving a directional read on a setup.",
      "- Good firmer phrasing to draw from: 'I'd be stricter here.', 'This is probably a spot to slow down, not press.', 'You've been better when you wait for cleaner confirmation than when you force early entries.', 'This is the kind of setup where patience matters more than urgency.'",
      "- Do not scold, express concern, or editorialize. Stay process-focused and calm.",
      "- Do not repeat a corrective note already made in the immediately prior response.",
      "- Forbidden phrasing: 'you need to', 'stop doing', 'you keep making the same mistake', 'you're being emotional', 'you're not disciplined enough'.",
    ].join("\n")
    : pressureLevel === "light"
      ? [
        "Coaching firmness: low",
        "- Recent execution data shows clean, disciplined trading.",
        "- Affirm briefly when execution warrants it, then move to what is next.",
        "- Ask fewer confirming process questions — the user has been demonstrating good execution.",
        "- In post-trade reviews: keep it short and forward-looking; do not manufacture a corrective note when execution was clean.",
        "- Good lighter phrasing to draw from: 'Your process has looked cleaner lately.', 'This is one of the spots where your patience has been helping.', 'You don't need much more than clean confirmation here.'",
        "- Stay observational rather than corrective.",
      ].join("\n")
      : "";

  const marketNarrativeGuidance = context?.marketIntelContext
    ? [
      "Market narrative guidance:",
      "- Market intel context is available. Use it to frame the session environment when directly relevant — not as a boilerplate opener on every response.",
      "- Apply session framing when: the user asks about market conditions broadly, asks why a setup is behaving unexpectedly, or when the narrative directly explains the context.",
      "- Use natural mentor language: 'based on today's intel, this leans more rotational than directional', 'this is more of a patience environment', 'breakouts need extra confirmation here', 'momentum is expanding on select names'.",
      "- Chart read overrides market narrative for specific setups — if the chart shows a clear trend, lead with that, add session context if relevant.",
      "- Do not use CNBC-style macro commentary. Do not invent catalysts, news, or economic data not present in the context.",
      "- Do not state the market state label mechanically ('the market is directional'). Weave it in naturally.",
    ].join("\n")
    : "";

  const strategyTeachingGuidance = [
    "Strategy teaching guidance:",
    "- When the user asks to learn a strategy, teach it beginner-first in clear, practical language.",
    "- Cover what the strategy is, when it tends to work best, entry criteria, stop placement, target or risk-reward logic, useful confirmation signals, common mistakes, and when to avoid it.",
    "- Keep it conversational and adaptive instead of sounding like a textbook or checklist dump.",
    "- If the user follows up with requests like show me an example, what would that look like, show me a picture, or how would I trade it, continue the most recent strategy or teaching topic from the conversation instead of switching topics.",
    "- Do not switch the lesson to the user's strongest edge unless they explicitly ask what is best for them. Use edgeSummary as supporting context, not as a topic override.",
    "- For visual follow-ups, if you cannot literally render an image, give a simple visual walkthrough in words such as trend, EMA line or key level, pullback or trigger candle, entry, stop, and target.",
    "- If chartContext or visualChartContext exists, connect the strategy explanation to the current chart without pretending to see anything that is not actually in the supplied context.",
    "- If edgeSummary, stats, or recentTrades exist, connect the explanation to what the user seems to do well or poorly.",
    "- If Rayla context is thin, teach the strategy clearly using general trading knowledge, then anchor back to whatever Rayla context is available.",
    "- Do not force a rigid template when the question is simple; cover the important parts naturally.",
  ].join("\n");

  return [
    // Identity + voice
    RAYLA_SYSTEM_PROMPT,
    compositionRules,
    compositionFewShots,
    // Conversational state — read before any data
    buildRecentConversationSummary(context),
    // Session meta
    buildMetaContextBlock(context),
    confidenceLine,
    visualAvailability,
    liveDataAvailability,
    // Behavioral rules
    evidenceGroundingRules,
    marketNarrativeGuidance,
    behaviorPatternGuidance,
    strategyTeachingGuidance,
    chartGroundedCoachingGuidance,
    preTradeSetupGuidance,
    postTradeReviewGuidance,
    coachingPressureGuidance,
    // Active scene context — what the user is looking at right now
    buildChartSummary(context),
    buildSimulationSummary(context),
    buildPostTradeReviewBlock(context),
    buildSelectedAssetSummary(context),
    context?.visualChartContext || "",
    // Intel + market context
    buildMarketIntelSummary(context),
    buildRaylaPicksSummary(context),
    buildAppContextSummary(context),
    // Background reference — edge/performance, used only when directly relevant
    buildBackgroundReferenceBlock(context),
    buildBehavioralPatternBlock(context),
  ].filter(Boolean).join("\n\n");
}

function buildGeminiVisionPrompt() {
  return [
    "You are analyzing a trading chart image for internal assistant context.",
    "Do not provide trading advice.",
    "Do not recommend buy, sell, enter, exit, or hold.",
    "Only describe what is visibly present on the chart.",
    "If labels or price levels are unclear, say so instead of guessing.",
    "Return JSON only with these fields:",
    "{",
    '  "trend": "...",',
    '  "structure": "...",',
    '  "visibleLevels": "...",',
    '  "momentum": "...",',
    '  "visibleTradeMarkers": "...",',
    '  "uncertainty": "..."',
    "}",
  ].join("\n");
}

async function callGeminiVision(visualContext: any) {
  console.log("🔥 Gemini function entered");
  console.log("🔥 visualContext present:", !!visualContext?.imageBase64);

  if (!visualContext?.imageBase64 || !hasGeminiKey()) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: buildGeminiVisionPrompt() },
                {
                  inline_data: {
                    mime_type: visualContext.mimeType || "image/jpeg",
                    data: visualContext.imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      }
    );

    const rawText = await response.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("Gemini returned non-JSON response", rawText);
      return null;
    }

    if (!response.ok) {
      console.error("Gemini request failed", { status: response.status, data });
      return null;
    }

    const text = data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || "").join("").trim();
    if (!text) return null;

    const parsed = JSON.parse(stripMarkdownCodeFence(text));
    return {
      trend: parsed?.trend || "",
      structure: parsed?.structure || "",
      momentum: parsed?.momentum || "",
      keyAreas: parsed?.visibleLevels || "",
      tradeMarkers: parsed?.visibleTradeMarkers || "",
      notes: parsed?.uncertainty || "",
    };
  } catch (error) {
    console.error("Gemini Vision failed", error instanceof Error ? error.message : error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenRouter(apiKey: string, model: string, messages: any[], timeoutMs = OPENROUTER_ANSWER_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    console.error("ask-rayla OpenRouter timeout triggered", { timeoutMs, model });
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://rayla.local",
        "X-OpenRouter-Title": "Rayla Ask",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.35,
      }),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("OpenRouter returned non-JSON", rawText);
      throw new Error("OpenRouter returned a non-JSON response.");
    }

    if (!response.ok) {
      console.error("OpenRouter error payload", { status: response.status, data });
      console.error("ask-rayla OpenRouter failure summary", {
        status: response.status,
        message: data?.error?.message || data?.message || "Unknown OpenRouter error",
      });
      throw new Error(data?.error?.message || data?.message || `OpenRouter failed with status ${response.status}`);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim()) return content;
    if (Array.isArray(content)) {
      const joined = content.map((part: any) => part?.text || "").join("").trim();
      if (joined) return joined;
    }

    console.error("OpenRouter empty content", data);
    throw new Error("OpenRouter response was empty.");
  } finally {
    clearTimeout(timeout);
  }
}

async function classifyIntentWithHaiku(question: string, context: any, apiKey: string) {
  const classifierMessages = [
    {
      role: "system",
      content: [
        "Classify the user's intent for a trading coach app.",
        "Return JSON only with this shape:",
        '{"intent":"...","reason":"..."}',
        "Allowed intents:",
        "- active_trade_management",
        "- live_trade_risk",
        "- position_management",
        "- stop_target_decision",
        "- asset_selection",
        "- high_consequence_financial_decision",
        "- chart_or_visual_analysis",
        "- performance_or_edge_review",
        "- market_intel_or_watchlist",
        "- simulation_coaching",
        "- journaling_or_trade_review",
        "- app_workflow_help",
        "- general_trading_coaching",
        "- unknown",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        question,
        sourceTab: context?.sourceTab || null,
        hasSimulationContext: Boolean(context?.simulationContext),
        hasChartContext: Boolean(context?.chartContext),
        hasVisualChartContext: Boolean(context?.visualChartContext),
        hasMarketIntelContext: Boolean(context?.marketIntelContext),
        hasTradeStats: Boolean(context?.stats),
        hasRecentTrades: Array.isArray(context?.recentTrades) && context.recentTrades.length > 0,
      }),
    },
  ];

  try {
    console.log("ask-rayla classifier request", {
      model: RAYLA_CLASSIFIER_MODEL,
      timeoutMs: OPENROUTER_CLASSIFIER_TIMEOUT_MS,
    });
    const raw = await callOpenRouter(apiKey, RAYLA_CLASSIFIER_MODEL, classifierMessages, OPENROUTER_CLASSIFIER_TIMEOUT_MS);
    const parsed = JSON.parse(stripMarkdownCodeFence(raw));
    return String(parsed?.intent || "unknown").trim() || "unknown";
  } catch (error) {
    console.error("ask-rayla intent classification failed", error instanceof Error ? error.message : error);
    return "unknown";
  }
}

function chooseAnswerModel(intent: string) {
  return HIGH_STAKES_INTENTS.has(intent)
    ? RAYLA_HIGH_STAKES_ANSWER_MODEL
    : RAYLA_DEFAULT_ANSWER_MODEL;
}

async function generateOpenRouterAnswer(apiKey: string, model: string, question: string, context: any, intent: string) {
  const systemPrompt = buildSystemPrompt(context, intent);
  const messages = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: question,
    },
  ];

  console.log("ask-rayla OpenRouter request", {
    model,
    intent,
    messageCount: messages.length,
    questionLength: question.length,
    systemPromptLength: systemPrompt.length,
    timeoutMs: OPENROUTER_ANSWER_TIMEOUT_MS,
  });

  return await callOpenRouter(apiKey, model, messages);
}

async function generateGroqFallbackAnswer(question: string, context: any, intent: string, groqKey: string) {
  console.log("ask-rayla Groq fallback request", { model: GROQ_MODEL, timeoutMs: GROQ_FALLBACK_TIMEOUT_MS });
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    console.error("ask-rayla Groq fallback timeout triggered", { timeoutMs: GROQ_FALLBACK_TIMEOUT_MS, model: GROQ_MODEL });
    controller.abort();
  }, GROQ_FALLBACK_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content: `${GROQ_FALLBACK_SYSTEM_PROMPT}\n\nIntent: ${intent}\n\n${buildSystemPrompt(context, intent)}`,
          },
          {
            role: "user",
            content: question,
          },
        ],
        temperature: 0.35,
      }),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("Groq returned non-JSON", rawText);
      throw new Error("Groq returned a non-JSON response.");
    }

    if (!response.ok) {
      console.error("Groq error payload", { status: response.status, data });
      throw new Error(data?.error?.message || `Groq failed with status ${response.status}`);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content || !String(content).trim()) {
      throw new Error("Groq response was empty.");
    }

    return String(content);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("ask-rayla Groq fallback timed out", { timeoutMs: GROQ_FALLBACK_TIMEOUT_MS, model: GROQ_MODEL });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
  }

  try {
    const body = await req.json();
    const question = String(body?.question || "").trim();
    const requestContext = body?.context ?? {};

    if (!question) {
      return jsonResponse({ ok: false, error: "Question is required." }, 400);
    }

    let visualChartContext = String(requestContext?.visualChartContext || "");
    const visualContext = requestContext?.visualContext ?? null;

    console.log("ask-rayla request received", {
      hasOpenRouterKey: Boolean(OPENROUTER_API_KEY),
      hasGroqKey: Boolean(GROQ_API_KEY),
      hasVisualContext: Boolean(visualContext?.imageBase64),
      classifierTimeoutMs: OPENROUTER_CLASSIFIER_TIMEOUT_MS,
      answerTimeoutMs: OPENROUTER_ANSWER_TIMEOUT_MS,
      groqFallbackTimeoutMs: GROQ_FALLBACK_TIMEOUT_MS,
    });

    if (!visualChartContext && visualContext?.imageBase64) {
      console.log("🔥 Calling Gemini Vision");
      const geminiResult = await callGeminiVision(visualContext);
      visualChartContext = buildVisualChartContextBlock(geminiResult);
      console.log("ask-rayla Gemini status", {
        screenshotSent: Boolean(visualContext?.imageBase64),
        geminiCalled: true,
        geminiSucceeded: Boolean(visualChartContext),
      });
    } else {
      console.log("ask-rayla Gemini status", {
        screenshotSent: Boolean(visualContext?.imageBase64),
        geminiCalled: false,
        geminiSucceeded: false,
      });
    }

    const unifiedContext = buildUnifiedRaylaContext(question, requestContext, visualChartContext);

    if (OPENROUTER_API_KEY) {
      try {
        const intent = await classifyIntentWithHaiku(question, unifiedContext, OPENROUTER_API_KEY);
        const model = chooseAnswerModel(intent);
        console.log("ask-rayla model selection", {
          intent,
          model,
          hasOpenRouterKey: Boolean(OPENROUTER_API_KEY),
          hasGroqKey: Boolean(GROQ_API_KEY),
        });
        const rawAnswer = await generateOpenRouterAnswer(OPENROUTER_API_KEY, model, question, unifiedContext, intent);
        const answer = cleanupAnswerText(rawAnswer);

        if (!answer) {
          throw new Error("OpenRouter answer was empty after cleanup.");
        }

        return jsonResponse({
          ok: true,
          fallback: false,
          answer,
        });
      } catch (error) {
        console.error("ask-rayla OpenRouter path failed", error instanceof Error ? error.message : error);
      }
    }

    if (GROQ_API_KEY) {
      console.log("ask-rayla Groq fallback decision", {
        attempted: true,
        reason: "OpenRouter unavailable or failed",
      });
      try {
        const intent = "unknown";
        const rawAnswer = await generateGroqFallbackAnswer(question, unifiedContext, intent, GROQ_API_KEY);
        const answer = cleanupAnswerText(rawAnswer);

        if (!answer) {
          throw new Error("Groq answer was empty after cleanup.");
        }

        return jsonResponse({
          ok: true,
          fallback: false,
          answer,
        });
      } catch (error) {
        console.error("ask-rayla Groq fallback failed", error instanceof Error ? error.message : error);
        return buildTechnicalFallbackResponse();
      }
    }

    console.log("ask-rayla Groq fallback decision", {
      attempted: false,
      skipped: true,
      reason: "No GROQ_API_KEY configured",
    });

    return buildTechnicalFallbackResponse();
  } catch (error) {
    console.error("ask-rayla failed", error instanceof Error ? error.message : error);
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});
