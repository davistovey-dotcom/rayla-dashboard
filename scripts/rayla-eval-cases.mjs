const globalForbiddenPhrases = [
  "great question",
  "absolutely",
  "i notice",
  "well done",
  "nice trade",
  "journey",
  "in this session's context",
  "pulled through",
  "i apologize",
  "i'm sorry",
];

function makeTrade({
  symbol,
  sourceType,
  sourceLabel,
  direction = "long",
  resultR = null,
  closedAt = "2026-05-09T14:30:00.000Z",
  setupType = null,
  sessionSlot = null,
  executionGradeLabel = "",
  feedback = null,
  entryPrice = null,
  exitPrice = null,
}) {
  return {
    symbol,
    sourceType,
    sourceLabel,
    direction,
    resultR,
    closedAt,
    setupType,
    sessionSlot,
    executionGradeLabel,
    feedback,
    entryPrice,
    exitPrice,
  };
}

function anchorContext(activeReviewedTrade, extra = {}) {
  return {
    raylaMode: "beginner",
    activeReviewedTrade,
    tradeSourceSummary: extra.tradeSourceSummary || null,
    recentConversation: extra.recentConversation || [],
    simulationContext: extra.simulationContext || null,
    edgeSummary: extra.edgeSummary || null,
    edgeFacets: extra.edgeFacets || null,
    performanceStats: extra.performanceStats || null,
    recentTrades: extra.recentTrades || [],
  };
}

const lastScenarioTrade = makeTrade({
  symbol: "DOT",
  sourceType: "scenario_sim_trade",
  sourceLabel: "Scenario sim trade",
  direction: "short",
  resultR: null,
  closedAt: "2026-05-09T13:55:00.000Z",
  setupType: "breakout",
  sessionSlot: "mid",
  executionGradeLabel: "Poor management",
  entryPrice: 7.18,
  exitPrice: 6.92,
});

const lastLiveTrade = makeTrade({
  symbol: "BTC",
  sourceType: "live_sim_trade",
  sourceLabel: "Live sim trade",
  direction: "long",
  resultR: 1.4,
  closedAt: "2026-05-09T12:15:00.000Z",
  setupType: "pullback",
  sessionSlot: "early",
  executionGradeLabel: "Strong execution",
  feedback: "Held to the plan and let the target do the work.",
  entryPrice: 64000,
  exitPrice: 64680,
});

const lastRealTrade = makeTrade({
  symbol: "HOOD",
  sourceType: "real_trade",
  sourceLabel: "Real trade",
  direction: "long",
  resultR: 3.2,
  closedAt: "2026-05-08T19:30:00.000Z",
  setupType: "range",
  sessionSlot: "late",
  entryPrice: 18.2,
  exitPrice: 19.4,
});

const sourceSummary = {
  lastRealTrade,
  lastLiveSimTrade: lastLiveTrade,
  lastScenarioSimTrade: lastScenarioTrade,
};

const setupFacetThin = {
  overallSampleSize: 9,
  bySetup: [
    { name: "range", count: 4, wins: 3, winRate: 0.75, avgR: 1.1 },
    { name: "breakout", count: 5, wins: 2, winRate: 0.4, avgR: -0.2 },
  ],
  bySession: [
    { name: "early", count: 4, wins: 3, winRate: 0.75, avgR: 0.9 },
    { name: "late", count: 3, wins: 1, winRate: 0.33, avgR: -0.4 },
  ],
};

const setupFacetMature = {
  overallSampleSize: 28,
  bySetup: [
    { name: "range", count: 11, wins: 8, winRate: 0.73, avgR: 1.15 },
    { name: "breakout", count: 7, wins: 2, winRate: 0.29, avgR: -0.35 },
    { name: "pullback", count: 10, wins: 5, winRate: 0.5, avgR: 0.25 },
  ],
  bySession: [
    { name: "early", count: 9, wins: 6, winRate: 0.67, avgR: 0.8 },
    { name: "mid", count: 8, wins: 4, winRate: 0.5, avgR: 0.1 },
    { name: "late", count: 6, wins: 2, winRate: 0.33, avgR: -0.3 },
  ],
};

const edgeSummaryEarly = {
  currentEdge: "Range setups are the clearest read so far, but this is still early.",
  confidence: "Low",
  biggestStrength: "Cleaner results have been coming from range trades.",
  biggestLeak: "Breakout entries are still inconsistent.",
  bestSetup: "range",
  bestAsset: "BTC",
  worstSetup: "breakout",
  winRate: 0.56,
  avgR: 0.34,
  sampleSize: 9,
};

const edgeSummaryMature = {
  currentEdge: "Range setups have been the cleaner read recently.",
  confidence: "High",
  biggestStrength: "The cleaner results have come from range setups.",
  biggestLeak: "Breakout entries continue underperforming.",
  bestSetup: "range",
  bestAsset: "BTC",
  worstSetup: "breakout",
  winRate: 0.61,
  avgR: 0.52,
  sampleSize: 28,
};

const activeTradeContext = {
  contextType: "simulation",
  mode: "live",
  symbol: "ETH",
  assetName: "ETH",
  direction: "long",
  currentPrice: 3125,
  activeTrade: {
    asset: "ETH",
    label: "ETH",
    direction: "long",
    entryPrice: 3090,
    currentPrice: 3125,
    unrealizedR: 0.8,
    stopPrice: 3060,
    targetPrice: 3175,
    exitMode: "price",
    nearestLevel: "target",
    nearestLevelKey: "target",
    isInsidePlan: true,
  },
};

export const raylaEvalCases = [
  {
    name: "anchor-profit-scenario-trade",
    category: "Conversational anchoring",
    prompt: "how much did it make",
    context: anchorContext({ ...lastScenarioTrade, profitLoss: 25.59 }, {
      tradeSourceSummary: sourceSummary,
      recentConversation: [
        { role: "user", content: "review my last scenario sim trade" },
        { role: "assistant", content: "DOT short closed green. Management was graded poorly, but the exact mistake isn't labeled." },
      ],
    }),
    mustContain: ["dot", "$25.59"],
    forbidden: ["btc", "strongest crypto edge", "range setups"],
    notes: "Short follow-up should stay on the reviewed DOT trade, not pivot to edge stats.",
  },
  {
    name: "anchor-was-that-good",
    category: "Conversational anchoring",
    prompt: "was that good",
    context: anchorContext(lastLiveTrade, {
      tradeSourceSummary: sourceSummary,
      recentConversation: [
        { role: "user", content: "review my last live sim trade" },
        { role: "assistant", content: "BTC long closed +1.4R with strong execution." },
      ],
    }),
    mustContain: ["btc", "strong execution"],
    forbidden: ["hood", "your edge is", "btc edge"],
    notes: "Should judge the active reviewed trade first.",
  },
  {
    name: "anchor-what-went-wrong",
    category: "Conversational anchoring",
    prompt: "what went wrong",
    context: anchorContext(lastScenarioTrade, {
      tradeSourceSummary: sourceSummary,
      recentConversation: [
        { role: "user", content: "review my last scenario sim trade" },
        { role: "assistant", content: "DOT short closed with a poor management grade. The exact mistake isn't labeled." },
      ],
    }),
    mustContain: ["dot", "exact mistake", "isn't labeled"],
    forbidden: ["btc", "likely", "probably"],
    notes: "Should stay anchored to the reviewed trade and preserve execution-label restraint.",
  },
  {
    name: "anchor-should-have-held",
    category: "Conversational anchoring",
    prompt: "should i have held",
    context: anchorContext({ ...lastScenarioTrade, feedback: "Cut too early once price started working." }, {
      tradeSourceSummary: sourceSummary,
      recentConversation: [
        { role: "user", content: "review my last scenario sim trade" },
        { role: "assistant", content: "DOT short closed green, but the trade was cut too early." },
      ],
    }),
    mustContain: ["dot", "cut too early"],
    forbidden: ["btc", "range setups", "edge"],
    notes: "If feedback exists, it can answer directly from that trade.",
  },
  {
    name: "anchor-what-setup-was-that",
    category: "Conversational anchoring",
    prompt: "what setup was that",
    context: anchorContext(lastLiveTrade, {
      tradeSourceSummary: sourceSummary,
      recentConversation: [
        { role: "user", content: "review my last live sim trade" },
        { role: "assistant", content: "BTC long closed +1.4R with strong execution." },
      ],
    }),
    mustContain: ["pullback"],
    forbidden: ["hood", "range setups have been cleaner"],
    notes: "Short referential setup question should resolve from the active reviewed trade.",
  },
  {
    name: "anchor-explicit-switch-beats-anchor",
    category: "Conversational anchoring",
    prompt: "what about my real trade instead",
    context: anchorContext(lastScenarioTrade, {
      tradeSourceSummary: sourceSummary,
      recentConversation: [
        { role: "user", content: "review my last scenario sim trade" },
        { role: "assistant", content: "DOT short closed green." },
      ],
    }),
    mustContain: ["hood", "+3.20r"],
    forbidden: ["dot short", "$25.59"],
    notes: "Explicit topic switch should override the anchor.",
  },
  {
    name: "anchor-how-much-with-real-trade",
    category: "Conversational anchoring",
    prompt: "how much did it make",
    context: anchorContext(lastRealTrade, {
      tradeSourceSummary: sourceSummary,
      recentConversation: [
        { role: "user", content: "review my last real trade" },
        { role: "assistant", content: "HOOD long closed +3.2R." },
      ],
    }),
    mustContain: ["hood", "+3.20r"],
    forbidden: ["btc", "dot", "edge"],
    notes: "Real-trade follow-up should stay local too.",
  },
  {
    name: "anchor-no-fake-setup",
    category: "Conversational anchoring",
    prompt: "what setup was that",
    context: anchorContext({ ...lastRealTrade, setupType: null }, {
      tradeSourceSummary: sourceSummary,
      recentConversation: [
        { role: "user", content: "review my last real trade" },
        { role: "assistant", content: "HOOD long closed +3.2R." },
      ],
    }),
    mustContain: ["don't", "labeled"],
    forbidden: ["range", "breakout", "pullback", "likely"],
    notes: "If setup is missing, Rayla should say so plainly.",
  },

  {
    name: "trade-source-three-way-review",
    category: "Trade-source awareness",
    prompt: "review my last real trade, live sim trade, and scenario sim trade",
    context: {
      raylaMode: "beginner",
      tradeSourceSummary: sourceSummary,
    },
    mustContain: ["hood", "btc", "dot"],
    forbidden: ["can't distinguish", "all the same"],
    notes: "All three categories should be separated clearly.",
  },
  {
    name: "trade-source-last-real-only",
    category: "Trade-source awareness",
    prompt: "review my last real trade",
    context: { raylaMode: "beginner", tradeSourceSummary: sourceSummary },
    mustContain: ["hood", "+3.20r"],
    forbidden: ["btc", "dot"],
  },
  {
    name: "trade-source-last-live-only",
    category: "Trade-source awareness",
    prompt: "review my last live sim trade",
    context: { raylaMode: "beginner", tradeSourceSummary: sourceSummary },
    mustContain: ["btc", "+1.40r"],
    forbidden: ["hood", "dot"],
  },
  {
    name: "trade-source-last-scenario-only",
    category: "Trade-source awareness",
    prompt: "review my last scenario sim trade",
    context: { raylaMode: "beginner", tradeSourceSummary: sourceSummary },
    mustContain: ["dot"],
    forbidden: ["hood", "btc"],
  },
  {
    name: "trade-source-missing-category",
    category: "Trade-source awareness",
    prompt: "review my last scenario sim trade",
    context: {
      raylaMode: "beginner",
      tradeSourceSummary: {
        lastRealTrade,
        lastLiveSimTrade: lastLiveTrade,
        lastScenarioSimTrade: null,
      },
    },
    mustContain: ["don't have", "scenario sim trade"],
    forbidden: ["btc short", "dot"],
  },
  {
    name: "trade-source-sim-vs-real-thin",
    category: "Trade-source awareness",
    prompt: "what am i doing differently in sim vs real?",
    context: {
      raylaMode: "beginner",
      tradeSourceSummary: sourceSummary,
      performanceStats: { sampleSize: 6 },
      recentTrades: [lastRealTrade, lastLiveTrade, lastScenarioTrade],
    },
    mustContain: ["sample", "review"],
    forbidden: ["definitely", "proven"],
    notes: "Thin sample should not become a strong sim-vs-real diagnosis.",
  },

  {
    name: "execution-poor-management-no-feedback",
    category: "Execution-label grounding",
    prompt: "what went wrong",
    context: {
      raylaMode: "beginner",
      simulationContext: {
        symbol: "DOT",
        direction: "short",
        closedTrade: {
          rMultiple: null,
          profitLoss: 25.59,
          executionGrade: "D",
          executionGradeLabel: "Poor management",
          outcomeLabel: "Cut too early",
          feedback: "",
          coachingInsight: "",
        },
      },
    },
    mustContain: ["after entry", "exact mistake", "isn't labeled"],
    forbidden: ["likely", "probably", "moved the stop", "exited early"],
  },
  {
    name: "execution-poor-entry-no-feedback",
    category: "Execution-label grounding",
    prompt: "what went wrong with this trade",
    context: {
      raylaMode: "beginner",
      simulationContext: {
        symbol: "SOL",
        direction: "long",
        closedTrade: {
          rMultiple: -0.6,
          executionGrade: "D",
          executionGradeLabel: "Poor entry",
          feedback: "",
          coachingInsight: "",
        },
      },
    },
    mustContain: ["exact mistake", "isn't labeled"],
    forbidden: ["likely", "probably", "chased", "entered too early"],
  },
  {
    name: "execution-poor-management-with-feedback",
    category: "Execution-label grounding",
    prompt: "what went wrong",
    context: {
      raylaMode: "beginner",
      simulationContext: {
        symbol: "DOT",
        direction: "short",
        closedTrade: {
          rMultiple: 0.4,
          executionGrade: "D",
          executionGradeLabel: "Poor management",
          feedback: "Moved the stop wider after entry instead of leaving risk where it was.",
        },
      },
    },
    mustContain: ["moved the stop wider"],
    forbidden: ["exact mistake isn't labeled"],
  },
  {
    name: "execution-with-coaching-insight",
    category: "Execution-label grounding",
    prompt: "what was weak here",
    context: {
      raylaMode: "beginner",
      simulationContext: {
        symbol: "ETH",
        direction: "long",
        closedTrade: {
          rMultiple: -0.8,
          executionGrade: "D",
          executionGradeLabel: "Poor exit",
          coachingInsight: "Took the exit before price actually broke the structure.",
        },
      },
    },
    mustContain: ["before price actually broke the structure"],
    forbidden: ["likely", "probably"],
  },
  {
    name: "execution-win-poor-process",
    category: "Execution-label grounding",
    prompt: "review that trade",
    context: {
      raylaMode: "beginner",
      simulationContext: {
        symbol: "BTC",
        direction: "long",
        closedTrade: {
          rMultiple: 1.4,
          executionGrade: "D",
          executionGradeLabel: "Poor management",
          feedback: "",
          coachingInsight: "",
        },
      },
    },
    mustContain: ["positive", "process"],
    forbidden: ["great trade", "well done"],
  },
  {
    name: "execution-loss-clean-process",
    category: "Execution-label grounding",
    prompt: "review that trade",
    context: {
      raylaMode: "beginner",
      simulationContext: {
        symbol: "ETH",
        direction: "long",
        closedTrade: {
          rMultiple: -1.0,
          executionGrade: "A",
          executionGradeLabel: "Strong execution",
          feedback: "",
          coachingInsight: "",
        },
      },
    },
    mustContain: ["execution was clean"],
    forbidden: ["you should have", "likely"],
  },

  {
    name: "flat-strong-clean-rep",
    category: "Flat result + strong execution",
    prompt: "review that trade",
    context: {
      raylaMode: "beginner",
      simulationContext: {
        symbol: "AVAX",
        direction: "long",
        closedTrade: {
          rMultiple: 0,
          executionGrade: "A",
          executionGradeLabel: "Strong execution",
        },
      },
    },
    mustContain: ["clean", "didn't follow through"],
    forbidden: ["big lesson", "major issue", "what went wrong was"],
  },
  {
    name: "flat-strong-no-manufactured-lesson",
    category: "Flat result + strong execution",
    prompt: "was that a bad trade",
    context: {
      raylaMode: "beginner",
      simulationContext: {
        symbol: "LINK",
        direction: "short",
        closedTrade: {
          rMultiple: 0,
          executionGrade: "A",
          executionGradeLabel: "Strong execution",
        },
      },
    },
    mustContain: ["process", "didn't follow through"],
    forbidden: ["you should have", "mistake was"],
  },
  {
    name: "flat-strong-short-answer",
    category: "Flat result + strong execution",
    prompt: "good rep?",
    context: {
      raylaMode: "beginner",
      simulationContext: {
        symbol: "SOL",
        direction: "long",
        closedTrade: {
          rMultiple: 0,
          executionGrade: "A",
          executionGradeLabel: "Strong execution",
        },
      },
    },
    mustContain: ["clean"],
    forbidden: ["great job", "well done"],
  },

  {
    name: "missing-data-no-scenario-trade",
    category: "Missing data honesty",
    prompt: "review my last scenario sim trade",
    context: {
      raylaMode: "beginner",
      tradeSourceSummary: { lastRealTrade, lastLiveSimTrade: lastLiveTrade, lastScenarioSimTrade: null },
    },
    mustContain: ["don't have", "scenario sim trade"],
    forbidden: ["sorry", "session context", "pulled through"],
  },
  {
    name: "missing-data-no-setup-labeled",
    category: "Missing data honesty",
    prompt: "what setup was that",
    context: anchorContext({ ...lastScenarioTrade, setupType: null }, {
      tradeSourceSummary: sourceSummary,
      recentConversation: [{ role: "user", content: "review my last scenario sim trade" }],
    }),
    mustContain: ["setup", "isn't labeled"],
    forbidden: ["probably", "looks like a", "likely a"],
  },
  {
    name: "missing-data-no-session-labeled",
    category: "Missing data honesty",
    prompt: "what session was that",
    context: anchorContext({ ...lastScenarioTrade, sessionSlot: null }, {
      recentConversation: [{ role: "user", content: "review my last scenario sim trade" }],
    }),
    mustContain: ["session", "don't have"],
    forbidden: ["session context", "pulled through", "probably midday"],
  },
  {
    name: "missing-data-no-apology",
    category: "Missing data honesty",
    prompt: "compare my real trades vs sim trades",
    context: {
      raylaMode: "beginner",
      tradeSourceSummary: { lastRealTrade, lastLiveSimTrade: null, lastScenarioSimTrade: null },
      performanceStats: { sampleSize: 1 },
    },
    mustContain: ["don't have", "sim"],
    forbidden: ["sorry", "unfortunately", "session's context"],
  },

  {
    name: "setup-threshold-under-5",
    category: "Setup/session thresholds",
    prompt: "what setup has been best for me",
    context: {
      raylaMode: "beginner",
      edgeFacets: setupFacetThin,
      edgeSummary: edgeSummaryEarly,
    },
    mustContain: ["still early"],
    forbidden: ["your edge is", "statistical advantage", "proven"],
  },
  {
    name: "setup-threshold-five-to-eight",
    category: "Setup/session thresholds",
    prompt: "what setup has been working lately",
    context: {
      raylaMode: "beginner",
      edgeFacets: setupFacetThin,
      edgeSummary: edgeSummaryEarly,
    },
    mustContain: ["5", "still early"],
    forbidden: ["system", "your edge is"],
  },
  {
    name: "setup-threshold-mature-pattern",
    category: "Setup/session thresholds",
    prompt: "what setup has been best lately",
    context: {
      raylaMode: "beginner",
      edgeFacets: setupFacetMature,
      edgeSummary: edgeSummaryMature,
    },
    mustContain: ["range", "cleaner"],
    forbidden: ["proven system", "statistical advantage"],
  },
  {
    name: "session-threshold-under-4",
    category: "Setup/session thresholds",
    prompt: "when do i trade best",
    context: {
      raylaMode: "beginner",
      edgeFacets: {
        overallSampleSize: 8,
        bySession: [{ name: "late", count: 3, wins: 1, winRate: 0.33, avgR: -0.4 }],
      },
    },
    mustContain: ["not enough"],
    forbidden: ["avoid late-session trading", "you trade better in the morning"],
  },
  {
    name: "session-soft-language",
    category: "Setup/session thresholds",
    prompt: "what about late session",
    context: {
      raylaMode: "beginner",
      edgeFacets: setupFacetMature,
      edgeSummary: edgeSummaryMature,
    },
    mustContain: ["late-session", "worth watching"],
    forbidden: ["avoid late-session trading", "never trade late"],
  },

  {
    name: "tone-no-hype-review",
    category: "Premium tone",
    prompt: "review my last live sim trade",
    context: { raylaMode: "beginner", tradeSourceSummary: sourceSummary },
    mustContain: ["btc"],
    forbidden: ["great question", "absolutely", "well done", "nice trade"],
  },
  {
    name: "tone-no-journey-language",
    category: "Premium tone",
    prompt: "how am i doing overall",
    context: {
      raylaMode: "beginner",
      edgeSummary: edgeSummaryMature,
      edgeFacets: setupFacetMature,
      performanceStats: { sampleSize: 28 },
    },
    mustContain: ["range"],
    forbidden: ["journey", "well done"],
  },
  {
    name: "tone-no-i-notice",
    category: "Premium tone",
    prompt: "what am i doing wrong",
    context: {
      raylaMode: "beginner",
      behavioralPatternContext: {
        strongestPattern: "You tend to force breakout entries before confirmation.",
      },
    },
    mustContain: ["breakout"],
    forbidden: ["i notice", "i've noticed"],
  },

  {
    name: "active-trade-what-should-i-look-for",
    category: "Active trade coaching",
    prompt: "what should i be looking for",
    context: {
      raylaMode: "beginner",
      simulationContext: activeTradeContext,
      marketIntelContext: { summary: "Broad market still mixed." },
    },
    mustContain: ["eth", "target", "trade"],
    forbidden: ["btc edge", "range setups continue"],
  },
  {
    name: "active-trade-what-now",
    category: "Active trade coaching",
    prompt: "what should i do next",
    context: {
      raylaMode: "beginner",
      simulationContext: activeTradeContext,
    },
    mustContain: ["wait", "inside plan"],
    forbidden: ["review your last", "edge"],
  },
  {
    name: "active-trade-stop-question",
    category: "Active trade coaching",
    prompt: "where is my stop",
    context: {
      raylaMode: "beginner",
      simulationContext: activeTradeContext,
    },
    mustContain: ["stop", "3060"],
    forbidden: ["btc", "edge"],
  },
  {
    name: "active-trade-status-question",
    category: "Active trade coaching",
    prompt: "how is the trade",
    context: {
      raylaMode: "beginner",
      simulationContext: activeTradeContext,
    },
    mustContain: ["0.80r", "inside your plan"],
    forbidden: ["strongest setup", "overall stats"],
  },
];

export const defaultRaylaEvalPolicy = {
  globalForbiddenPhrases,
};
