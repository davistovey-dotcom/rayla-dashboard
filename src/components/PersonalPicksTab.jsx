import React, { useState, useEffect } from "react";

const PROFILE_STORAGE_KEY = "rayla-picks-profile-v1";
const PICKS_CACHE_KEY = "rayla-picks-cache-v1";
const PICKS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Question definitions ────────────────────────────────────────────────────

const QUESTIONS = {
  experience: {
    key: "experience",
    question: "How much investing or trading experience do you have?",
    options: [
      { value: "brand_new", label: "Brand New", desc: "I've never bought a stock or crypto." },
      { value: "less_1yr", label: "Less than 1 year", desc: "I've made a few trades." },
      { value: "1_3yr", label: "1–3 years", desc: "I know the basics and have some history." },
      { value: "3_10yr", label: "3–10 years", desc: "I've seen a few market cycles." },
      { value: "10plus", label: "10+ years", desc: "I've been through it all." },
    ],
  },
  newIntent: {
    key: "newIntent",
    question: "What are you trying to do first?",
    options: [
      { value: "learn", label: "Learn investing", desc: "I want to understand how markets work." },
      { value: "money", label: "Make money", desc: "I want to grow my capital." },
    ],
  },
  newRisk: {
    key: "newRisk",
    question: "Your portfolio drops 20%. What do you do?",
    options: [
      { value: "sell", label: "Sell", desc: "I'd want to protect what's left." },
      { value: "hold", label: "Hold", desc: "I'd wait for recovery." },
      { value: "buy_more", label: "Buy More", desc: "I'd see it as a buying opportunity." },
    ],
  },
  newComplexity: {
    key: "newComplexity",
    question: "What kind of ideas do you want?",
    options: [
      { value: "simple", label: "Keep it simple", desc: "ETFs, blue chips, easy to understand." },
      { value: "upside", label: "Higher upside", desc: "I'm okay with more risk for bigger gains." },
    ],
  },
  style: {
    key: "style",
    question: "Which best describes how you trade?",
    options: [
      { value: "day_trader", label: "Day Trader", desc: "I open and close positions within a day." },
      { value: "swing_trader", label: "Swing Trader", desc: "I hold for days to weeks." },
      { value: "long_term", label: "Long-Term Investor", desc: "I hold for months to years." },
      { value: "options", label: "Options Trader", desc: "I use calls, puts, or spreads." },
      { value: "mixed", label: "Mixed", desc: "I do a bit of everything." },
    ],
  },
  riskScenario: {
    key: "riskScenario",
    question: "You invest $10,000. Six months later it's worth $7,000. What do you do?",
    options: [
      { value: "sell", label: "Sell", desc: "A 30% loss is too much — cut it." },
      { value: "hold", label: "Hold", desc: "Stay the course and wait for recovery." },
      { value: "buy_more", label: "Buy More", desc: "Double down — I believe in the thesis." },
    ],
  },
  portfolioSize: {
    key: "portfolioSize",
    question: "How large is your portfolio?",
    options: [
      { value: "under_1k", label: "Under $1k" },
      { value: "1k_10k", label: "$1k – $10k" },
      { value: "10k_50k", label: "$10k – $50k" },
      { value: "50k_250k", label: "$50k – $250k" },
      { value: "250k_plus", label: "$250k+" },
    ],
  },
  assetTypes: {
    key: "assetTypes",
    question: "What assets do you want Rayla to focus on?",
    options: [
      { value: "stocks", label: "Stocks", desc: "Individual U.S. equities." },
      { value: "etfs", label: "ETFs", desc: "Index funds and sector ETFs." },
      { value: "crypto", label: "Crypto", desc: "Bitcoin, Ethereum, and altcoins." },
      { value: "mix", label: "Mix", desc: "Stocks, ETFs, and crypto together." },
    ],
  },
  cryptoFocus: {
    key: "cryptoFocus",
    question: "What interests you most in crypto?",
    multi: true,
    options: [
      { value: "btc", label: "Bitcoin" },
      { value: "large_caps", label: "Large Caps (ETH, SOL)" },
      { value: "ai_coins", label: "AI Coins" },
      { value: "defi", label: "DeFi" },
      { value: "memecoins", label: "Memecoins" },
      { value: "everything", label: "Everything" },
    ],
  },
  horizon: {
    key: "horizon",
    question: "When you buy an asset, how long do you expect to hold it?",
    options: [
      { value: "same_day", label: "Same Day" },
      { value: "days", label: "Days" },
      { value: "weeks", label: "Weeks" },
      { value: "months", label: "Months" },
      { value: "years", label: "Years" },
    ],
  },
  activityFrequency: {
    key: "activityFrequency",
    question: "How active do you want to be?",
    options: [
      { value: "daily", label: "Daily", desc: "I check and trade every day." },
      { value: "few_week", label: "Few times per week", desc: "A few sessions per week." },
      { value: "monthly", label: "Monthly", desc: "I make moves once a month or so." },
      { value: "set_forget", label: "Set it and forget it", desc: "Long-term, low-maintenance ideas." },
    ],
  },
  goal: {
    key: "goal",
    question: "What is your primary objective?",
    options: [
      { value: "build_wealth", label: "Build Wealth", desc: "Grow my net worth over time." },
      { value: "generate_income", label: "Generate Income", desc: "Dividends, yield, consistent returns." },
      { value: "preserve_capital", label: "Preserve Capital", desc: "Don't lose money — grow slowly." },
      { value: "learn_investing", label: "Learn Investing", desc: "Build skills and confidence." },
      { value: "beat_market", label: "Beat the Market", desc: "Outperform SPY consistently." },
    ],
  },
  themes: {
    key: "themes",
    question: "Which themes or sectors interest you?",
    multi: true,
    options: [
      { value: "ai", label: "AI" },
      { value: "semiconductors", label: "Semiconductors" },
      { value: "energy", label: "Energy" },
      { value: "healthcare", label: "Healthcare" },
      { value: "defense", label: "Defense" },
      { value: "space", label: "Space" },
      { value: "crypto", label: "Crypto" },
      { value: "consumer", label: "Consumer" },
      { value: "financials", label: "Financials" },
      { value: "real_estate", label: "Real Estate" },
    ],
  },
};

// Returns the ordered question-key sequence for the current answers state.
// Branching occurs after "experience" and after "assetTypes".
function computeSequence(answers) {
  const seq = ["experience"];
  if (!answers.experience) return seq;

  if (answers.experience === "brand_new") {
    seq.push("newIntent", "newRisk", "newComplexity");
  } else {
    seq.push("style", "riskScenario");
  }

  seq.push("portfolioSize", "assetTypes");

  if (answers.assetTypes === "crypto") {
    seq.push("cryptoFocus");
  }

  seq.push("horizon", "activityFrequency", "goal", "themes");
  return seq;
}

// ─── Label maps for prompt rendering ────────────────────────────────────────

const EXPERIENCE_LABELS = {
  brand_new: "Brand New",
  less_1yr: "Beginner (< 1 year)",
  "1_3yr": "Intermediate (1–3 years)",
  "3_10yr": "Experienced (3–10 years)",
  "10plus": "Expert (10+ years)",
};

const STYLE_LABELS = {
  day_trader: "Day Trader",
  swing_trader: "Swing Trader",
  long_term: "Long-Term Investor",
  options: "Options Trader",
  mixed: "Mixed",
};

const PORTFOLIO_LABELS = {
  under_1k: "Under $1k",
  "1k_10k": "$1k–$10k",
  "10k_50k": "$10k–$50k",
  "50k_250k": "$50k–$250k",
  "250k_plus": "$250k+",
};

const HORIZON_LABELS = {
  same_day: "Same Day",
  days: "Days",
  weeks: "Weeks",
  months: "Months",
  years: "Years",
};

const GOAL_LABELS = {
  build_wealth: "Build Wealth",
  generate_income: "Generate Income",
  preserve_capital: "Preserve Capital",
  learn_investing: "Learn Investing",
  beat_market: "Beat the Market",
};

const ACTIVITY_LABELS = {
  daily: "Daily",
  few_week: "Few times per week",
  monthly: "Monthly",
  set_forget: "Set it and forget it",
};

// ─── Local storage helpers ───────────────────────────────────────────────────

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveProfile(profile) {
  try { localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile)); } catch {}
}

function loadPicksCache() {
  try {
    const raw = localStorage.getItem(PICKS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed.timestamp || 0) > PICKS_CACHE_TTL_MS) return null;
    return parsed;
  } catch { return null; }
}

function savePicksCache(data) {
  try {
    const now = Date.now();
    localStorage.setItem(PICKS_CACHE_KEY, JSON.stringify({ ...data, timestamp: now, generatedAt: now }));
  } catch {}
}

// ─── Picks helpers ───────────────────────────────────────────────────────────

function parsePicks(text) {
  const picks = [];
  const pattern = /===PICK(\d+)===([\s\S]*?)===END\1===/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const block = match[2];
    const ticker = (block.match(/Ticker:\s*([A-Z]{1,6})/)?.[1] || "").trim();
    const fitScore = parseInt(block.match(/FitScore:\s*(\d+)/)?.[1] || "0", 10);
    const rawConf = (block.match(/Confidence:\s*(LOW|MEDIUM|HIGH)/i)?.[1] || "LOW").toUpperCase();
    const confidence = ["LOW", "MEDIUM", "HIGH"].includes(rawConf) ? rawConf : "LOW";
    const why = (block.match(/Why:\s*([\s\S]*?)(?=WatchOut:|$)/)?.[1] || "").trim();
    const watchOut = (block.match(/WatchOut:\s*([\s\S]*?)$/)?.[1] || "").trim();
    if (ticker) picks.push({ ticker, fitScore, confidence, why, watchOut });
  }
  return picks;
}

function buildPicksPrompt({ profile, brokerPositions, alpacaAccount, tradeCount }) {
  const hasProfile = !!(profile?.experience);
  const hasBroker = Array.isArray(brokerPositions) && brokerPositions.length > 0;

  const riskResponse = profile?.riskScenario || profile?.newRisk;
  const riskLevel = profile?.riskLevel || (riskResponse === "sell" ? "low" : riskResponse === "buy_more" ? "high" : riskResponse === "hold" ? "medium" : null);
  const riskLabel = riskLevel === "high" ? "High (buys more on dips)" : riskLevel === "medium" ? "Medium (holds through drops)" : riskLevel === "low" ? "Low (sells to protect capital)" : null;

  const profileLines = [];
  if (profile?.experience) profileLines.push(`Experience: ${EXPERIENCE_LABELS[profile.experience] || profile.experience}`);
  if (profile?.style) profileLines.push(`Style: ${STYLE_LABELS[profile.style] || profile.style}`);
  if (profile?.experience === "brand_new") {
    if (profile?.newIntent) profileLines.push(`Primary intent: ${profile.newIntent === "learn" ? "Learn investing" : "Make money"}`);
    if (profile?.newComplexity) profileLines.push(`Idea preference: ${profile.newComplexity === "simple" ? "Simple, low-risk ideas" : "Higher-upside opportunities"}`);
  }
  if (riskLabel) profileLines.push(`Risk tolerance: ${riskLabel}`);
  if (profile?.portfolioSize) profileLines.push(`Portfolio size: ${PORTFOLIO_LABELS[profile.portfolioSize] || profile.portfolioSize}`);
  if (profile?.assetTypes) profileLines.push(`Preferred assets: ${profile.assetTypes}`);
  if (Array.isArray(profile?.cryptoFocus) && profile.cryptoFocus.length) {
    profileLines.push(`Crypto focus: ${profile.cryptoFocus.join(", ")}`);
  }
  if (profile?.horizon) profileLines.push(`Holding period: ${HORIZON_LABELS[profile.horizon] || profile.horizon}`);
  if (profile?.activityFrequency) profileLines.push(`Activity level: ${ACTIVITY_LABELS[profile.activityFrequency] || profile.activityFrequency}`);
  if (profile?.goal) profileLines.push(`Goal: ${GOAL_LABELS[profile.goal] || profile.goal}`);
  if (Array.isArray(profile?.themes) && profile.themes.length) {
    profileLines.push(`Themes of interest: ${profile.themes.join(", ")}`);
  }
  if (tradeCount > 0) profileLines.push(`Trades logged: ${tradeCount}`);
  if (hasBroker) {
    const list = brokerPositions.slice(0, 6).map((p) => p.symbol || p.ticker || "").filter(Boolean).join(", ");
    if (list) profileLines.push(`Current holdings: ${list}`);
  }
  if (alpacaAccount?.equity) {
    profileLines.push(`Portfolio value: $${Number(alpacaAccount.equity).toLocaleString()}`);
  }

  const confidenceInstruction = hasProfile
    ? "Use MEDIUM or HIGH confidence for picks that clearly match their profile. Use LOW only where data is sparse."
    : "Use LOW confidence for all picks — no profile has been provided yet.";

  const allowCrypto = profile?.assetTypes === "crypto" || profile?.assetTypes === "mix";

  return `You are Rayla's Personal Picks engine. Generate exactly 3 picks for this user based on current market conditions and their investor profile.

${confidenceInstruction}

IMPORTANT: Format your response EXACTLY as follows, with no extra text outside these blocks:

===PICK1===
Ticker: [SYMBOL]
FitScore: [50-99]
Confidence: [LOW|MEDIUM|HIGH]
Why: [2-3 sentences — be specific about why this pick matches their profile or current market setup.]
WatchOut: [1 specific risk or thing to watch]
===END1===

===PICK2===
Ticker: [SYMBOL]
FitScore: [50-99]
Confidence: [LOW|MEDIUM|HIGH]
Why: [explanation]
WatchOut: [risk]
===END2===

===PICK3===
Ticker: [SYMBOL]
FitScore: [50-99]
Confidence: [LOW|MEDIUM|HIGH]
Why: [explanation]
WatchOut: [risk]
===END3===

${profileLines.length > 0
    ? `Investor profile:\n${profileLines.map((l) => `- ${l}`).join("\n")}`
    : "No profile provided — generate picks based on current market conditions only."}

Rules: ${allowCrypto ? "You may include crypto picks (BTC, ETH, SOL) alongside equities when appropriate for the profile." : "Pick liquid US equities (stocks/ETFs) only. No crypto."} No OTC stocks. Make the 3 picks diverse. Match holding period and activity level to pick style — a daily active trader needs short-term setups; a set-it-and-forget-it investor needs ETFs or long-term growth names. Do not pick any asset already in the user's current holdings.`;
}

// ─── Small UI pieces ─────────────────────────────────────────────────────────

function ConfidenceDots({ level }) {
  const filled = level === "HIGH" ? 4 : level === "MEDIUM" ? 3 : 2;
  const color = level === "HIGH" ? "#4ade80" : level === "MEDIUM" ? "#7CC4FF" : "#fbbf24";
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            width: 7, height: 7, borderRadius: "50%",
            background: i <= filled ? color : "rgba(255,255,255,0.12)",
          }}
        />
      ))}
      <span style={{ fontSize: 11, fontWeight: 700, color, marginLeft: 5, letterSpacing: "0.5px" }}>
        {level}
      </span>
    </div>
  );
}

function FitBar({ score }) {
  const pct = Math.max(0, Math.min(100, score || 0));
  const color = pct >= 85 ? "#4ade80" : pct >= 70 ? "#7CC4FF" : "#fbbf24";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.1)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color, minWidth: 44, textAlign: "right" }}>{pct}/100</span>
    </div>
  );
}

// ─── Pick Card ───────────────────────────────────────────────────────────────

function PickCard({ pick, rank, isTop, onAskRayla }) {
  const [expanded, setExpanded] = useState(isTop);

  return (
    <div
      style={{
        background: isTop ? "rgba(18,26,38,0.97)" : "rgba(18,26,38,0.78)",
        border: `1px solid ${isTop ? "rgba(124,196,255,0.25)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: isTop ? "0 16px 48px rgba(0,0,0,0.22), 0 0 0 1px rgba(124,196,255,0.06)" : "none",
        transition: "box-shadow 0.2s ease",
      }}
    >
      {/* Card top — always visible */}
      <div
        style={{ padding: "20px 20px 0 20px", cursor: isTop ? "default" : "pointer" }}
        onClick={() => !isTop && setExpanded((e) => !e)}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.3px", textTransform: "uppercase", color: isTop ? "#7CC4FF" : "#475569" }}>
              {isTop ? "Rayla's Top Pick" : `Pick #${rank}`}
            </div>
            <div style={{ fontSize: isTop ? 30 : 22, fontWeight: 800, color: "#f3f7fc", letterSpacing: "-0.5px", lineHeight: 1.1 }}>
              {pick.ticker}
            </div>
          </div>
          {!isTop && (
            <div style={{ fontSize: 16, color: "#475569", marginTop: 10, userSelect: "none" }}>
              {expanded ? "▲" : "▼"}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14, paddingBottom: isTop || expanded ? 0 : 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase" }}>Fit Score</div>
            <FitBar score={pick.fitScore} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase" }}>Confidence</div>
            <ConfidenceDots level={pick.confidence} />
          </div>
        </div>
      </div>

      {/* Expanded body */}
      {(isTop || expanded) && (
        <div style={{ padding: "16px 20px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

          {pick.why && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: "#64748b" }}>Why this pick</div>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}>{pick.why}</div>
            </div>
          )}

          {pick.watchOut && (
            <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1 }}>⚠</span>
              <div style={{ fontSize: 12, color: "#fde68a", lineHeight: 1.6 }}>{pick.watchOut}</div>
            </div>
          )}

          <button
            onClick={() => {
              if (onAskRayla) {
                onAskRayla(
                  `About ${pick.ticker}`,
                  `Tell me more about ${pick.ticker} as a pick right now. Why does it look interesting, what are the key levels to watch, and what would invalidate the setup?`
                );
              }
            }}
            style={{
              background: "rgba(124,196,255,0.08)",
              border: "1px solid rgba(124,196,255,0.28)",
              borderRadius: 12, color: "#7CC4FF",
              padding: "10px 16px", fontSize: 13, fontWeight: 700,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              transition: "background 0.15s ease",
            }}
          >
            Ask Rayla about {pick.ticker} →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton loader ─────────────────────────────────────────────────────────

function PickSkeleton() {
  return (
    <div style={{ background: "rgba(18,26,38,0.86)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="picksSkeleton" style={{ height: 12, width: "28%", borderRadius: 6 }} />
      <div className="picksSkeleton" style={{ height: 30, width: "40%", borderRadius: 8 }} />
      <div className="picksSkeleton" style={{ height: 6, width: "100%", borderRadius: 99 }} />
      <div className="picksSkeleton" style={{ height: 6, width: "70%", borderRadius: 99 }} />
      <div className="picksSkeleton" style={{ height: 44, width: "100%", borderRadius: 10 }} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PersonalPicksTab({
  askRaylaUrl,
  supabaseAnonKey,
  onAskRayla,
  brokerPositions,
  alpacaAccount,
  tradeCount = 0,
  onProfileComplete,
}) {
  const [profile, setProfileState] = useState(() => loadProfile());

  const [phase, setPhase] = useState(() => {
    const saved = loadProfile();
    if (saved?.completed) return "output";
    return "landing";
  });

  const [answers, setAnswers] = useState(() => loadProfile() || {});
  const [step, setStep] = useState(0);

  // Generic multi-select state keyed by question key
  const [selectedMulti, setSelectedMulti] = useState(() => {
    const saved = loadProfile() || {};
    const result = {};
    if (Array.isArray(saved.themes)) result.themes = saved.themes;
    if (Array.isArray(saved.cryptoFocus)) result.cryptoFocus = saved.cryptoFocus;
    return result;
  });

  const [picksStatus, setPicksStatus] = useState("idle");
  const [parsedPicks, setParsedPicks] = useState([]);

  // On entering output phase: load cache or generate
  useEffect(() => {
    if (phase !== "output") return;
    const cached = loadPicksCache();
    if (cached?.picks?.length) {
      setParsedPicks(cached.picks);
      setPicksStatus("ready");
    } else {
      doGeneratePicks();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const sequence = computeSequence(answers);
  const totalSteps = sequence.length;
  const currentKey = sequence[step];
  const currentQ = QUESTIONS[currentKey];

  async function doGeneratePicks(overrideProfile) {
    setPicksStatus("loading");
    try {
      const activeProfile = overrideProfile || loadProfile();
      const prompt = buildPicksPrompt({ profile: activeProfile, brokerPositions, alpacaAccount, tradeCount });

      const resp = await fetch(askRaylaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ question: prompt }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const text = data?.answer || "";
      const picks = parsePicks(text);

      setParsedPicks(picks);
      setPicksStatus(picks.length > 0 ? "ready" : "error");
      if (picks.length > 0) savePicksCache({ picks });
    } catch (err) {
      console.error("[PersonalPicks] generate error:", err);
      setPicksStatus("error");
    }
  }

  function handleSingleSelect(value) {
    const key = currentQ.key;
    const nextAnswers = { ...answers, [key]: value };
    setAnswers(nextAnswers);
    saveProfile(nextAnswers);
    setTimeout(() => {
      const nextSeq = computeSequence(nextAnswers);
      if (step + 1 < nextSeq.length) {
        setStep(step + 1);
      } else {
        completeQuestionnaire(nextAnswers);
      }
    }, 160);
  }

  function handleMultiToggle(value) {
    const key = currentQ.key;
    setSelectedMulti((prev) => {
      const current = prev[key] || [];
      if (value === "everything") {
        return { ...prev, [key]: current.includes("everything") ? [] : ["everything"] };
      }
      const withoutEverything = current.filter((v) => v !== "everything");
      return {
        ...prev,
        [key]: withoutEverything.includes(value)
          ? withoutEverything.filter((v) => v !== value)
          : [...withoutEverything, value],
      };
    });
  }

  function handleMultiContinue() {
    const key = currentQ.key;
    const values = selectedMulti[key] || [];
    const nextAnswers = { ...answers, [key]: values };
    setAnswers(nextAnswers);
    saveProfile(nextAnswers);
    const nextSeq = computeSequence(nextAnswers);
    if (step + 1 < nextSeq.length) {
      setStep(step + 1);
    } else {
      completeQuestionnaire(nextAnswers);
    }
  }

  function completeQuestionnaire(finalAnswers) {
    const riskResponse = finalAnswers.riskScenario || finalAnswers.newRisk;
    const riskLevel = riskResponse === "sell" ? "low" : riskResponse === "buy_more" ? "high" : riskResponse === "hold" ? "medium" : null;
    const completed = { ...finalAnswers, riskLevel, completed: true };
    setProfileState(completed);
    saveProfile(completed);
    localStorage.removeItem(PICKS_CACHE_KEY);
    if (typeof onProfileComplete === "function") onProfileComplete(completed);
    setPhase("output");
  }

  function handleRetune() {
    setStep(0);
    setParsedPicks([]);
    setPicksStatus("idle");
    setPhase("landing");
  }

  function handleRefresh() {
    localStorage.removeItem(PICKS_CACHE_KEY);
    doGeneratePicks();
  }

  // ─── LANDING ───────────────────────────────────────────────────────────────

  if (phase === "landing") {
    const hasCompletedProfile = !!(profile?.completed && profile?.experience);

    // ── Profile exists: show summary + update option ─────────────────────────
    if (hasCompletedProfile) {
      const riskResponse = profile.riskScenario || profile.newRisk;
      const riskLevel = profile.riskLevel || (riskResponse === "sell" ? "low" : riskResponse === "buy_more" ? "high" : riskResponse === "hold" ? "medium" : null);
      const summaryItems = [
        profile.experience && { label: "Experience", value: EXPERIENCE_LABELS[profile.experience] || profile.experience },
        profile.style && { label: "Style", value: STYLE_LABELS[profile.style] || profile.style },
        profile.experience === "brand_new" && profile.newComplexity && { label: "Approach", value: profile.newComplexity === "simple" ? "Simple ideas" : "High upside" },
        riskLevel && { label: "Risk", value: riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1) },
        profile.portfolioSize && { label: "Portfolio", value: PORTFOLIO_LABELS[profile.portfolioSize] || profile.portfolioSize },
        profile.assetTypes && { label: "Assets", value: profile.assetTypes.charAt(0).toUpperCase() + profile.assetTypes.slice(1) },
        profile.horizon && { label: "Hold", value: HORIZON_LABELS[profile.horizon] || profile.horizon },
        profile.activityFrequency && { label: "Activity", value: ACTIVITY_LABELS[profile.activityFrequency] || profile.activityFrequency },
        profile.goal && { label: "Goal", value: GOAL_LABELS[profile.goal] || profile.goal },
      ].filter(Boolean);

      return (
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "40px 20px", display: "flex", flexDirection: "column", gap: 28 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#f3f7fc", letterSpacing: "-0.3px", marginBottom: 4 }}>Rayla's Picks</div>
            <div style={{ fontSize: 13, color: "#7f8ea3" }}>Your Investor Profile</div>
          </div>

          <div style={{ background: "rgba(18,26,38,0.7)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {summaryItems.map(({ label, value }) => (
                <div key={label} style={{ background: "rgba(124,196,255,0.06)", border: "1px solid rgba(124,196,255,0.12)", borderRadius: 10, padding: "8px 12px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>{value}</div>
                </div>
              ))}
            </div>
            {Array.isArray(profile.themes) && profile.themes.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>Themes</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {profile.themes.map((t) => (
                    <div key={t} style={{ fontSize: 12, color: "#7CC4FF", background: "rgba(124,196,255,0.07)", border: "1px solid rgba(124,196,255,0.15)", borderRadius: 8, padding: "3px 9px", fontWeight: 600 }}>{t}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={() => {
                localStorage.removeItem(PROFILE_STORAGE_KEY);
                localStorage.removeItem(PICKS_CACHE_KEY);
                setProfileState(null);
                setAnswers({});
                setSelectedMulti({});
                setStep(0);
                setParsedPicks([]);
                setPicksStatus("idle");
                setPhase("questionnaire");
              }}
              style={{
                background: "rgba(124,196,255,0.08)",
                border: "1px solid rgba(124,196,255,0.3)",
                borderRadius: 14, color: "#7CC4FF",
                padding: "13px 20px", fontSize: 14, fontWeight: 700,
                cursor: "pointer", textAlign: "center",
              }}
            >
              Update Investor Profile
            </button>
            <button
              onClick={() => setPhase("output")}
              style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 13, padding: "6px 0", textDecoration: "underline", textAlign: "center" }}
            >
              Back to My Picks →
            </button>
          </div>
        </div>
      );
    }

    // ── No profile: onboarding landing ───────────────────────────────────────
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "40px 20px", display: "flex", flexDirection: "column", gap: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#f3f7fc", letterSpacing: "-0.5px", lineHeight: 1.2 }}>
            Rayla's Picks
          </div>
          <div style={{ fontSize: 15, color: "#94a6bb", lineHeight: 1.7 }}>
            Build your investor profile and Rayla will generate personalized investment ideas tailored to your goals, experience, risk tolerance, and interests.
          </div>
          <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65 }}>
            New users complete a quick onboarding profile. As your trading and simulation history grows, Rayla gradually replaces assumptions with real behavioral data.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { icon: "◈", title: "Experience & Risk", desc: "Your background and how you handle drawdowns." },
            { icon: "◎", title: "Goals & Time Horizon", desc: "What you're building and how long you'll hold." },
            { icon: "✦", title: "Sectors & Interests", desc: "Themes and asset classes you care about." },
          ].map(({ icon, title, desc }) => (
            <div
              key={title}
              style={{
                background: "rgba(18,26,38,0.7)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 14,
                padding: "16px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ fontSize: 20, color: "#7CC4FF", lineHeight: 1 }}>{icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", lineHeight: 1.3 }}>{title}</div>
              <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.55 }}>{desc}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => { setAnswers({}); setSelectedMulti({}); setStep(0); setPhase("questionnaire"); }}
            style={{
              background: "linear-gradient(135deg, rgba(124,196,255,0.20) 0%, rgba(124,196,255,0.10) 100%)",
              border: "1px solid rgba(124,196,255,0.5)",
              borderRadius: 14, color: "#d7efff",
              padding: "15px 24px", fontSize: 15, fontWeight: 700,
              cursor: "pointer", textAlign: "center",
              boxShadow: "0 8px 24px rgba(124,196,255,0.10)",
            }}
          >
            Start Investor Profile →
          </button>
          <div style={{ fontSize: 12, color: "#475569", textAlign: "center" }}>Takes about 2 minutes.</div>
          <button
            onClick={() => {
              const blankProfile = { completed: true };
              setProfileState(blankProfile);
              saveProfile(blankProfile);
              setPhase("output");
            }}
            style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 13, padding: "4px 0", textDecoration: "underline", textAlign: "center" }}
          >
            Skip — show picks now
          </button>
        </div>
      </div>
    );
  }

  // ─── QUESTIONNAIRE ─────────────────────────────────────────────────────────

  if (phase === "questionnaire") {
    if (!currentQ) return null;

    const isMulti = !!currentQ.multi;
    const multiValues = selectedMulti[currentKey] || [];

    return (
      <div style={{ maxWidth: 500, margin: "0 auto", padding: "36px 20px", display: "flex", flexDirection: "column", gap: 28 }}>
        {/* Progress dots */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                style={{
                  width: i <= step ? 20 : 7,
                  height: 7,
                  borderRadius: 99,
                  background: i < step ? "#7CC4FF" : i === step ? "rgba(124,196,255,0.85)" : "rgba(255,255,255,0.1)",
                  transition: "all 0.3s ease",
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#475569" }}>{step + 1} / {totalSteps}</div>
        </div>

        {/* Question text */}
        <div style={{ fontSize: 21, fontWeight: 700, color: "#f3f7fc", lineHeight: 1.35 }}>
          {currentQ.question}
        </div>
        {isMulti && (
          <div style={{ fontSize: 13, color: "#64748b", marginTop: -18 }}>Pick all that apply.</div>
        )}

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {currentQ.options.map((opt) => {
            const isSelected = isMulti ? multiValues.includes(opt.value) : answers[currentKey] === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => isMulti ? handleMultiToggle(opt.value) : handleSingleSelect(opt.value)}
                style={{
                  background: isSelected ? "rgba(124,196,255,0.11)" : "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${isSelected ? "rgba(124,196,255,0.55)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 14, padding: "14px 16px",
                  textAlign: "left", cursor: "pointer",
                  display: "flex", flexDirection: "column", gap: 3,
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: isSelected ? "#7CC4FF" : "#f3f7fc" }}>
                  {isMulti && isSelected && <span style={{ marginRight: 6 }}>✓</span>}
                  {opt.label}
                </div>
                {opt.desc && (
                  <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{opt.desc}</div>
                )}
              </button>
            );
          })}
        </div>

        {/* Multi-select continue */}
        {isMulti && multiValues.length > 0 && (
          <button
            onClick={handleMultiContinue}
            style={{
              background: "rgba(124,196,255,0.14)",
              border: "1px solid rgba(124,196,255,0.38)",
              borderRadius: 12, color: "#7CC4FF",
              padding: "12px 20px", fontSize: 14, fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Continue →
          </button>
        )}

        {/* Back */}
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 13, alignSelf: "flex-start", padding: 0 }}
          >
            ← Back
          </button>
        )}
      </div>
    );
  }

  // ─── OUTPUT ────────────────────────────────────────────────────────────────

  const hasProfile = !!(profile?.completed && profile?.experience);
  const engineLabel = tradeCount >= 200 ? "Mature" : tradeCount >= 50 ? "Growing" : tradeCount >= 10 ? "Building" : "Seed";
  const engineDots = tradeCount >= 200 ? 4 : tradeCount >= 50 ? 3 : tradeCount >= 10 ? 2 : 1;

  let cacheInfo = null;
  try {
    const raw = localStorage.getItem(PICKS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const savedAt = parsed.generatedAt || parsed.timestamp;
      if (savedAt) {
        const fmtDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        cacheInfo = {
          generated: fmtDate(new Date(savedAt)),
          next: fmtDate(new Date(savedAt + PICKS_CACHE_TTL_MS)),
        };
      }
    }
  } catch {}

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f3f7fc", letterSpacing: "-0.3px" }}>Rayla Picks</div>
          {cacheInfo && (
            <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>
              Generated {cacheInfo.generated} · Next refresh {cacheInfo.next}
            </div>
          )}
          {tradeCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5 }}>
              <span style={{ fontSize: 12, color: "#7f8ea3" }}>Engine: {engineLabel}</span>
              <div style={{ display: "flex", gap: 2 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i <= engineDots ? "#7CC4FF" : "rgba(255,255,255,0.1)" }} />
                ))}
              </div>
              <span style={{ fontSize: 12, color: "#475569" }}>{tradeCount} trades</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleRefresh}
            disabled={picksStatus === "loading"}
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, color: "#64748b", padding: "7px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            ↺ Refresh
          </button>
          <button
            onClick={handleRetune}
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, color: "#64748b", padding: "7px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            ⚙ Retune
          </button>
        </div>
      </div>

      {/* Profile incomplete callout */}
      {!hasProfile && (
        <div style={{ background: "rgba(124,196,255,0.06)", border: "1px solid rgba(124,196,255,0.2)", borderRadius: 14, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>✦</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#7CC4FF" }}>Get personalized picks in 2 minutes</div>
            <div style={{ fontSize: 13, color: "#94a6bb", lineHeight: 1.55 }}>
              Complete your Investor Profile for best results. Picks below are based on general market conditions until your profile is complete.
            </div>
            <button
              onClick={() => setPhase("landing")}
              style={{ marginTop: 6, background: "rgba(124,196,255,0.1)", border: "1px solid rgba(124,196,255,0.3)", borderRadius: 9, color: "#7CC4FF", padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", alignSelf: "flex-start" }}
            >
              Build Investor Profile →
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {picksStatus === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <PickSkeleton />
          <PickSkeleton />
          <PickSkeleton />
          <div style={{ textAlign: "center", fontSize: 13, color: "#475569", marginTop: 4 }}>
            Rayla is analyzing market conditions for you...
          </div>
        </div>
      )}

      {/* Error */}
      {picksStatus === "error" && (
        <div style={{ background: "rgba(251,113,133,0.06)", border: "1px solid rgba(251,113,133,0.2)", borderRadius: 16, padding: 24, textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fb7185" }}>Couldn't generate picks right now</div>
          <div style={{ fontSize: 13, color: "#94a6bb" }}>Check your connection and try again.</div>
          <button
            onClick={handleRefresh}
            style={{ background: "rgba(251,113,133,0.1)", border: "1px solid rgba(251,113,133,0.25)", borderRadius: 10, color: "#fb7185", padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Picks */}
      {picksStatus === "ready" && parsedPicks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {parsedPicks.map((pick, idx) => (
            <PickCard
              key={`${pick.ticker}-${idx}`}
              pick={pick}
              rank={idx + 1}
              isTop={idx === 0}
              onAskRayla={onAskRayla}
            />
          ))}
        </div>
      )}

      {/* Engine maturity progress */}
      {picksStatus === "ready" && tradeCount < 200 && (
        <div style={{ background: "rgba(18,26,38,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f3f7fc", marginBottom: 10 }}>Picks sharpen as you trade</div>
          <div style={{ position: "relative", height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden", marginBottom: 8 }}>
            <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(100, (tradeCount / 200) * 100)}%`, background: "linear-gradient(90deg, #7CC4FF 0%, #4ade80 100%)", borderRadius: 99 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginBottom: 10 }}>
            <span>Now</span><span>10</span><span>50</span><span>200 trades</span>
          </div>
          <div style={{ fontSize: 12, color: "#7f8ea3", lineHeight: 1.6 }}>
            {tradeCount < 10
              ? `Make ${10 - tradeCount} more trade${10 - tradeCount === 1 ? "" : "s"} to unlock behavioral personalization.`
              : tradeCount < 50
              ? `${50 - tradeCount} more trades to unlock MEDIUM confidence picks.`
              : `${200 - tradeCount} more trades to unlock your full edge summary.`}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div style={{ fontSize: 11, color: "#334155", lineHeight: 1.5, textAlign: "center", paddingBottom: 8 }}>
        Picks are AI-generated ideas, not financial advice. Always do your own research before trading.
      </div>
    </div>
  );
}
