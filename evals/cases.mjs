// Rayla eval test cases
// context shape mirrors what App.jsx sends to ask-rayla:
//   { activeReviewedTrade?, recentTrades?, stats?, edgeSummary?, simulationContext?, ... }
// recentConversation is merged into context by the runner

const dotAnchorTrade = {
  symbol: "DOT",
  sourceType: "scenario_sim_trade",
  sourceLabel: "Scenario sim trade",
  direction: "long",
  resultR: 1.4,
  rMultiple: 1.4,
  executionGrade: "A",
  executionGradeLabel: "Strong execution",
  exitReason: "take profit",
};

const dotConv = [
  { role: "user", content: "review my last scenario sim trade" },
  { role: "assistant", content: "DOT closed at +1.4R. Execution was clean — entry held, stop wasn't tested, and the exit was disciplined. Solid rep." },
];

// ─── A: Conversational Anchoring ────────────────────────────────────────────

export const anchoringCases = [
  {
    id: "anchor_1",
    category: "conversational_anchoring",
    priority: 1,
    description: "Follow-up result question after DOT review",
    prompt: "how much did it make",
    context: {
      activeReviewedTrade: dotAnchorTrade,
      // 2 BTC recentTrades to give Rayla competing context — tests anchor holds over other data
      recentTrades: [
        { asset: "BTC", resultR: 1.2, direction: "long", setup: "breakout" },
        { asset: "BTC", resultR: -0.5, direction: "long", setup: "breakout" },
      ],
    },
    recentConversation: dotConv,
    checks: [
      {
        property: "anchor_holds",
        judgePrompt:
          "The prior conversation reviewed a DOT scenario sim trade that made +1.4R. The user asked 'how much did it make'. Does the response answer specifically about the DOT trade result (approximately +1.4R)? PASS if yes. FAIL if it drifts to BTC stats, win rates, average R, or broader statistics instead of the DOT result.",
        forbiddenPatterns: ["win rate", "61%", "18 trades"],
      },
    ],
  },
  {
    id: "anchor_2",
    category: "conversational_anchoring",
    priority: 1,
    description: "Management question anchors to last trade not general habits",
    prompt: "did I manage it well",
    context: { activeReviewedTrade: dotAnchorTrade },
    recentConversation: dotConv,
    checks: [
      {
        property: "anchor_holds",
        judgePrompt:
          "The prior turn reviewed a DOT scenario sim trade with strong execution (A grade). The user asked 'did I manage it well'. Does the response address management of the DOT trade specifically (mentioning execution quality, grade, or DOT)? PASS if it references the DOT trade. FAIL if it gives only general advice with no reference to the anchor trade.",
      },
    ],
  },
  {
    id: "anchor_3",
    category: "conversational_anchoring",
    priority: 1,
    description: "No clarification question when anchor is clear",
    prompt: "what setup was that",
    context: { activeReviewedTrade: { ...dotAnchorTrade, setupType: "range" } },
    recentConversation: dotConv,
    checks: [
      {
        property: "no_clarification_on_clear_anchor",
        judgePrompt:
          "The prior turn reviewed a DOT trade with setup type 'range'. The user asks 'what setup was that'. Does the response answer directly without asking 'which trade are you referring to?' or similar clarification? PASS if it answers directly. FAIL if it asks a clarification question.",
        forbiddenPatterns: ["which trade", "are you referring to", "could you clarify", "which one"],
      },
    ],
  },
  {
    id: "anchor_4",
    category: "conversational_anchoring",
    priority: 1,
    description: "Hold question stays on anchor trade",
    prompt: "should I have held longer",
    context: { activeReviewedTrade: dotAnchorTrade },
    recentConversation: dotConv,
    checks: [
      {
        property: "anchor_holds",
        judgePrompt:
          "The prior turn reviewed a DOT trade that hit take profit. The user asks 'should I have held longer'. Does the response address the DOT trade exit specifically? PASS if it responds about DOT's exit or holding decision. FAIL if it gives only a generic hold-time lecture with no reference to the DOT trade.",
      },
    ],
  },
  {
    id: "anchor_5",
    category: "conversational_anchoring",
    priority: 1,
    description: "Explicit scope shift recognized — broadens to overall stats",
    prompt: "how am I doing overall this week",
    context: {
      activeReviewedTrade: dotAnchorTrade,
      recentTrades: [
        { asset: "BTC", resultR: 0.9 },
        { asset: "ETH", resultR: -0.3 },
      ],
    },
    recentConversation: dotConv,
    checks: [
      {
        property: "scope_shift_recognized",
        judgePrompt:
          "After reviewing a DOT trade, the user asks 'how am I doing overall this week' — a scope shift to aggregate performance. Does the response broaden to overall/session stats rather than staying locked on the DOT trade? PASS if it addresses overall or weekly performance. FAIL if it only talks about DOT.",
      },
    ],
  },
];

// ─── B: Grounding and Hallucination Prevention ──────────────────────────────

export const groundingCases = [
  {
    id: "ground_1",
    category: "grounding",
    priority: 1,
    description: "No win rate invented when no trades in context",
    prompt: "what's my win rate on breakouts",
    context: { recentTrades: [], stats: { totalTrades: 0 } },
    recentConversation: [],
    checks: [
      {
        property: "no_invented_stats",
        judgePrompt:
          "The context has zero trades. The user asks for their breakout win rate. Does the response correctly say there are no breakout trades or not enough data — without stating any specific win rate percentage? PASS if it declines to give a rate due to missing data. FAIL if it states any specific win rate number.",
        forbiddenPatterns: ["72%", "61%", "50%", "80%", "win rate is"],
      },
    ],
  },
  {
    id: "ground_2",
    category: "grounding",
    priority: 1,
    description: "No NIO stats invented when NIO not in history",
    prompt: "how am I doing on NIO",
    context: {
      recentTrades: [
        { asset: "AAPL", resultR: 0.8, direction: "long" },
        { asset: "TSLA", resultR: -0.5, direction: "long" },
      ],
      stats: { totalTrades: 2 },
    },
    recentConversation: [],
    checks: [
      {
        property: "no_hallucinated_asset_stats",
        judgePrompt:
          "NIO does not appear in the trade history. The user asks how they're doing on NIO. Does the response correctly say NIO isn't in the trade history, rather than inventing NIO performance stats? PASS if it notes NIO is absent or not enough data. FAIL if it states any NIO-specific performance numbers.",
      },
    ],
  },
  {
    id: "ground_3",
    category: "grounding",
    priority: 1,
    description: "No expectancy claimed under 8 trades",
    prompt: "what's my expectancy",
    context: {
      recentTrades: [
        { asset: "BTC", resultR: 1.2, direction: "long" },
        { asset: "ETH", resultR: -0.5, direction: "long" },
        { asset: "BTC", resultR: 0.8, direction: "long" },
      ],
      stats: { totalTrades: 0 },
    },
    recentConversation: [],
    checks: [
      {
        property: "no_expectancy_under_threshold",
        judgePrompt:
          "Only 3 trades in context. The user asks for their expectancy. Does the response decline to state a meaningful expectancy due to too few trades? PASS if it says it's too early or the sample is too small. FAIL if it states a specific expectancy figure as meaningful.",
      },
    ],
  },
  {
    id: "ground_4",
    category: "grounding",
    priority: 1,
    description: "No catalyst invented when no market intel present",
    prompt: "why did DOT dump this morning",
    context: { recentTrades: [], marketIntelContext: null },
    recentConversation: [],
    checks: [
      {
        property: "no_invented_catalyst",
        judgePrompt:
          "No market intel context is present. The user asks why DOT dumped this morning. Does the response avoid inventing a specific cause? PASS if it acknowledges lacking catalyst data and offers general framing. FAIL if it invents a specific reason (names a specific driver or macro event as definite cause).",
        forbiddenPatterns: ["definitely caused by", "the dump was caused by"],
      },
    ],
  },
];

// ─── C: Uncertainty Handling ─────────────────────────────────────────────────

export const uncertaintyCases = [
  {
    id: "uncertainty_1",
    category: "uncertainty_handling",
    priority: 1,
    description: "No technical mechanism language for missing data",
    prompt: "what's the news on TSLA today",
    context: { marketIntelContext: null },
    recentConversation: [],
    checks: [
      {
        property: "no_technical_mechanism_language",
        judgePrompt:
          "No market intel is in context. The user asks for TSLA news. Does the response avoid forbidden mechanism phrases? PASS if it acknowledges the gap in natural language and pivots to useful coaching. FAIL if it uses technical mechanism language.",
        forbiddenPatterns: [
          "I don't have access to",
          "my data feed",
          "isn't loaded",
          "I apologize",
          "Unfortunately",
          "feed",
          "connector",
          "not wired",
        ],
      },
    ],
  },
  {
    id: "uncertainty_2",
    category: "uncertainty_handling",
    priority: 1,
    description: "Early read acknowledged and given, not refused",
    prompt: "am I profitable overall",
    context: {
      recentTrades: [
        { asset: "BTC", resultR: 0.8 },
        { asset: "ETH", resultR: -0.3 },
      ],
      stats: { totalTrades: 2, wins: 1, winRate: 50, avgR: 0.25 },
    },
    recentConversation: [],
    checks: [
      {
        property: "early_read_given_with_caveat",
        judgePrompt:
          "Only 2 trades in context. The user asks if they're profitable overall. Does the response give a directional read with a caveat about the small sample? PASS if it states what's there (up, breakeven, or close) while noting it's too early to conclude. FAIL if it refuses to give any directional read at all.",
      },
    ],
  },
];

// ─── D: Trade-Source Awareness ───────────────────────────────────────────────

export const tradeSourceCases = [
  {
    id: "source_1",
    category: "trade_source_awareness",
    priority: 1,
    description: "Scenario sim trade reviewed correctly, not real trade",
    prompt: "review my last scenario sim trade",
    context: {
      activeReviewedTrade: {
        symbol: "SOL",
        sourceType: "scenario_sim_trade",
        sourceLabel: "Scenario sim trade",
        resultR: 2.1,
        rMultiple: 2.1,
        direction: "short",
        executionGrade: "A",
        executionGradeLabel: "Strong execution",
      },
      recentTrades: [
        { asset: "AAPL", resultR: -0.4, direction: "long", sourceType: "real_trade" },
      ],
    },
    recentConversation: [],
    checks: [
      {
        property: "correct_source_identified",
        judgePrompt:
          "Context has a scenario sim trade (SOL, +2.1R, short) and a real trade (AAPL, -0.4R). The user asks to review the last scenario sim trade. Does the response focus on the SOL scenario sim trade rather than the AAPL real trade? PASS if it addresses SOL or +2.1R. FAIL if it reviews AAPL or blends both without distinguishing.",
      },
    ],
  },
];

// ─── E: Execution Label Interpretation ──────────────────────────────────────

export const executionLabelCases = [
  {
    id: "exec_1",
    category: "execution_label_interpretation",
    priority: 2,
    description: "D grade with no label — no causal speculation",
    prompt: "review that trade",
    context: {
      activeReviewedTrade: {
        symbol: "BTC",
        resultR: -0.7,
        rMultiple: -0.7,
        direction: "long",
        executionGrade: "D",
        executionGradeLabel: "Poor management",
        feedback: "",
      },
    },
    recentConversation: [
      { role: "user", content: "I just closed a BTC trade" },
      { role: "assistant", content: "BTC closed at -0.7R with a D execution grade." },
    ],
    checks: [
      {
        property: "no_causal_speculation_on_unlabeled_grade",
        judgePrompt:
          "The trade has a D execution grade with no feedback label. Does the response describe the poor management grade without speculating on the specific cause? PASS if it names the grade without inventing a specific mistake. FAIL if it says things like 'likely exited too early', 'probably moved the stop', 'suggests you didn't follow the plan'.",
        forbiddenPatterns: [
          "likely exited",
          "probably moved",
          "suggests you",
          "may have exited",
          "possibly cut",
          "likely holding",
        ],
      },
    ],
  },
  {
    id: "exec_2",
    category: "execution_label_interpretation",
    priority: 2,
    description: "A grade win — no manufactured lesson",
    prompt: "review that trade",
    context: {
      activeReviewedTrade: {
        symbol: "ETH",
        resultR: 1.6,
        rMultiple: 1.6,
        direction: "long",
        executionGrade: "A",
        executionGradeLabel: "Strong execution",
        feedback: "",
      },
    },
    recentConversation: [
      { role: "user", content: "I just closed an ETH trade" },
      { role: "assistant", content: "ETH closed at +1.6R." },
    ],
    checks: [
      {
        property: "clean_rep_no_manufactured_lesson",
        judgePrompt:
          "ETH closed at +1.6R with an A execution grade (clean). Does the response acknowledge the clean result without forcing a coaching lesson or finding something to improve? PASS if the response is brief and does not invent a lesson on a clean trade. FAIL if it forces a 'one thing to work on' or 'next time consider' when the trade was clean.",
        forbiddenPatterns: [
          "one thing to tighten",
          "something to work on",
          "next time consider",
          "watch out for",
        ],
      },
    ],
  },
  {
    id: "exec_3",
    category: "execution_label_interpretation",
    priority: 2,
    description: "A grade loss — process named before outcome",
    prompt: "review that trade",
    context: {
      activeReviewedTrade: {
        symbol: "AAPL",
        resultR: -0.5,
        rMultiple: -0.5,
        direction: "short",
        executionGrade: "A",
        executionGradeLabel: "Strong execution",
        feedback: "",
      },
    },
    recentConversation: [
      { role: "user", content: "I just closed an AAPL short" },
      { role: "assistant", content: "AAPL short closed at -0.5R." },
    ],
    checks: [
      {
        property: "clean_process_named_before_loss",
        judgePrompt:
          "AAPL closed at -0.5R but execution was graded A (clean). Does the response acknowledge the clean process either first or prominently — not burying it after leading entirely with the loss? PASS if execution quality is mentioned alongside or before the loss result. FAIL if the response leads with the loss and barely acknowledges the clean execution.",
      },
    ],
  },
];

// ─── F: Setup/Session Sample Thresholds ──────────────────────────────────────

export const thresholdCases = [
  {
    id: "threshold_1",
    category: "setup_session_thresholds",
    priority: 2,
    description: "No pattern declared below 5 trades in setup",
    prompt: "how am I doing on range setups",
    context: {
      recentTrades: [
        { asset: "BTC", resultR: 0.8, setupType: "range" },
        { asset: "ETH", resultR: -0.3, setupType: "range" },
        { asset: "SOL", resultR: 1.1, setupType: "range" },
      ],
      stats: { totalTrades: 0 },
    },
    recentConversation: [],
    checks: [
      {
        property: "below_threshold_no_pattern_declared",
        judgePrompt:
          "Only 3 range trades are in history (below the 5-trade threshold). Does the response decline to state a meaningful range pattern, noting it's still early? PASS if it says too few trades / still early / not enough to read. FAIL if it declares a win rate or trend from only 3 trades.",
        forbiddenPatterns: ["your edge is in range", "range setups are working", "range is your best"],
      },
    ],
  },
  {
    id: "threshold_2",
    category: "setup_session_thresholds",
    priority: 2,
    description: "Session observation never declared as a rule",
    prompt: "do I trade better in the morning",
    context: {
      recentTrades: [
        ...Array.from({ length: 5 }, (_, i) => ({ asset: "AAPL", resultR: 0.9, sessionSlot: "early", direction: "long" })),
        ...Array.from({ length: 4 }, (_, i) => ({ asset: "AAPL", resultR: -0.4, sessionSlot: "late", direction: "long" })),
      ],
      stats: { totalTrades: 0 },
    },
    recentConversation: [],
    checks: [
      {
        property: "session_always_hedged",
        judgePrompt:
          "9 trades: 5 early session (positive), 4 late session (negative). The user asks if they trade better in the morning. Does the response give a directional observation while hedging as a live read — NOT declaring a hard time-of-day rule? PASS if observational and hedged. FAIL if it declares 'you trade better in the morning' as a fact or rule.",
        forbiddenPatterns: ["you trade better in the morning", "avoid late session", "always trade early"],
      },
    ],
  },
  {
    id: "threshold_3",
    category: "setup_session_thresholds",
    priority: 2,
    description: "Count cited alongside or before rate",
    prompt: "what's my best setup",
    context: {
      recentTrades: [
        ...Array.from({ length: 8 }, () => ({ asset: "BTC", resultR: 0.9, setupType: "range", direction: "long" })),
        ...Array.from({ length: 6 }, () => ({ asset: "ETH", resultR: -0.4, setupType: "breakout", direction: "long" })),
      ],
      stats: { totalTrades: 0 },
    },
    recentConversation: [],
    checks: [
      {
        property: "count_cited_with_pattern",
        judgePrompt:
          "Range: 8 trades (mostly positive). Breakout: 6 trades (mostly negative). Does the response include the count alongside any pattern observation (e.g. '8 range trades', 'across 8 reps', '6 of 8')? PASS if count is present. FAIL if it states only a percentage without any count.",
      },
    ],
  },
];

// ─── G: Premium Restraint and Tone ───────────────────────────────────────────

export const restraintCases = [
  {
    id: "restraint_1",
    category: "premium_restraint",
    priority: 2,
    description: "No forbidden opener on any question",
    prompt: "what should I be working on",
    context: {
      recentTrades: [{ asset: "BTC", resultR: 0.9 }, { asset: "ETH", resultR: -0.4 }],
      stats: { totalTrades: 2 },
    },
    recentConversation: [],
    checks: [
      {
        property: "no_forbidden_opener",
        judgePrompt:
          "Does the response start with any of these forbidden openers: 'Great question', 'Absolutely', 'I notice that', 'I've noticed', 'Based on your', 'As we've discussed', 'Of course'? PASS if none present. FAIL if any are present.",
        forbiddenPatterns: [
          "Great question",
          "Absolutely",
          "I notice that",
          "I've noticed",
          "Based on your",
          "As we've discussed",
          "Of course,",
        ],
      },
    ],
  },
  {
    id: "restraint_2",
    category: "premium_restraint",
    priority: 2,
    description: "No congratulation on a green day",
    prompt: "I just had my best trading day ever, made 3R",
    context: { recentTrades: [], stats: { totalTrades: 0 } },
    recentConversation: [],
    checks: [
      {
        property: "no_congratulation",
        judgePrompt:
          "The user reports a big green day. Does the response avoid hollow congratulation ('Congratulations', 'Amazing', 'Great job', 'That's fantastic', 'Well done', 'Awesome', 'Impressive')? PASS if it responds without leading with congratulatory language. FAIL if it opens with or leads with congratulation.",
        forbiddenPatterns: ["Congratulations", "Amazing!", "Great job", "That's fantastic", "Well done", "Awesome", "Impressive"],
      },
    ],
  },
  {
    id: "restraint_3",
    category: "premium_restraint",
    priority: 2,
    description: "Word 'journey' never used",
    prompt: "tell me about my progress as a trader",
    context: {
      recentTrades: [
        { asset: "BTC", resultR: 0.8 },
        { asset: "ETH", resultR: 1.2 },
        { asset: "SOL", resultR: -0.3 },
      ],
      stats: { totalTrades: 0 },
    },
    recentConversation: [],
    checks: [
      {
        property: "no_journey_word",
        judgePrompt: "Does the response use the word 'journey' anywhere? PASS if it does not. FAIL if it does.",
        forbiddenPatterns: ["journey"],
      },
    ],
  },
];

// ─── All Cases ────────────────────────────────────────────────────────────────

export const allCases = [
  ...anchoringCases,
  ...groundingCases,
  ...uncertaintyCases,
  ...tradeSourceCases,
  ...executionLabelCases,
  ...thresholdCases,
  ...restraintCases,
];
