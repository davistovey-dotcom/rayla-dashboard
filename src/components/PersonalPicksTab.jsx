import React, { useState, useEffect } from "react";

const PROFILE_STORAGE_KEY = "rayla-picks-profile-v1";
const PICKS_CACHE_KEY = "rayla-picks-cache-v1";
const PICKS_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

// ─── Questions ──────────────────────────────────────────────────────────────

const Q1 = {
  key: "marketApproach",
  question: "How do you approach the market?",
  options: [
    { value: "trader", label: "Active Trader", desc: "I buy and sell regularly. Hours, days, weeks." },
    { value: "investor", label: "Long-Term Investor", desc: "I buy and hold. Months to years." },
    { value: "both", label: "Both", desc: "I do both depending on the opportunity." },
  ],
};

const Q2 = {
  key: "riskComfort",
  question: "How do you feel about losing 10% on a trade?",
  options: [
    { value: "tight", label: "I cut it fast", desc: "Losses above 5% bother me." },
    { value: "moderate", label: "I can handle it", desc: "10–15% is part of the game." },
    { value: "aggressive", label: "Doesn't faze me", desc: "I'm comfortable with big swings for bigger upside." },
  ],
};

const Q3_TRADER = {
  key: "setup",
  question: "What kind of trades excite you most?",
  options: [
    { value: "momentum", label: "Momentum", desc: "Riding strong trends." },
    { value: "breakout", label: "Breakouts", desc: "Catching the move when price clears a key level." },
    { value: "reversal", label: "Reversals", desc: "Buying dips, shorting peaks." },
    { value: "range", label: "Range / Mean Revert", desc: "Trading between support and resistance." },
  ],
};

const Q3_INVESTOR = {
  key: "setup",
  question: "What guides your investing decisions?",
  options: [
    { value: "growth", label: "Growth", desc: "Companies growing fast." },
    { value: "value", label: "Value", desc: "Undervalued companies with room to rise." },
    { value: "dividends", label: "Dividends", desc: "Income and stability." },
    { value: "thematic", label: "Thematic", desc: "Big ideas: AI, clean energy, biotech." },
  ],
};

const Q4 = {
  key: "sectors",
  question: "Which sectors do you follow most?",
  multi: true,
  options: [
    { value: "tech", label: "Tech" },
    { value: "health", label: "Healthcare" },
    { value: "finance", label: "Finance" },
    { value: "energy", label: "Energy" },
    { value: "consumer", label: "Consumer" },
    { value: "industrial", label: "Industrial" },
    { value: "all", label: "All of them" },
  ],
};

const Q5 = {
  key: "goal",
  question: "What are you building toward?",
  options: [
    { value: "income", label: "Extra income", desc: "Supplementing my salary." },
    { value: "wealth", label: "Long-term wealth", desc: "Growing serious money over time." },
    { value: "learning", label: "Learning to trade well", desc: "Building skills and confidence." },
    { value: "alpha", label: "Beat the market", desc: "Alpha. Consistent edge." },
  ],
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
  try { localStorage.setItem(PICKS_CACHE_KEY, JSON.stringify({ ...data, timestamp: Date.now() })); } catch {}
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
  const hasProfile = !!(profile?.marketApproach);
  const hasBroker = Array.isArray(brokerPositions) && brokerPositions.length > 0;

  const profileLines = [];
  if (profile?.marketApproach) profileLines.push(`Market approach: ${profile.marketApproach}`);
  if (profile?.riskComfort) profileLines.push(`Risk tolerance: ${profile.riskComfort}`);
  if (profile?.setup) profileLines.push(`Preferred style: ${profile.setup}`);
  if (profile?.sectors?.length) profileLines.push(`Sectors of interest: ${profile.sectors.join(", ")}`);
  if (profile?.goal) profileLines.push(`Goal: ${profile.goal}`);
  if (tradeCount > 0) profileLines.push(`Trades logged: ${tradeCount}`);
  if (hasBroker) {
    const list = brokerPositions.slice(0, 6).map((p) => p.symbol || p.ticker || "").filter(Boolean).join(", ");
    if (list) profileLines.push(`Current holdings: ${list}`);
  }
  if (alpacaAccount?.equity) {
    profileLines.push(`Portfolio value: $${Number(alpacaAccount.equity).toLocaleString()}`);
  }

  const confidenceInstruction = hasProfile
    ? "Use MEDIUM or HIGH confidence for picks that clearly match their profile. Use LOW only for picks where data is sparse."
    : "Use LOW confidence for all picks — no profile has been provided yet.";

  return `You are Rayla's Personal Picks engine. Generate exactly 3 stock picks for this user based on current market conditions and their profile.

${confidenceInstruction}

IMPORTANT: Format your response EXACTLY as follows, with no extra text outside these blocks:

===PICK1===
Ticker: [SYMBOL]
FitScore: [50-99]
Confidence: [LOW|MEDIUM|HIGH]
Why: [2-3 sentences — be specific about why this pick matches their profile or current market setup. Reference their style if known.]
WatchOut: [1 specific risk or thing to watch for this pick]
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
    ? `User profile:\n${profileLines.map((l) => `- ${l}`).join("\n")}`
    : "No profile provided — use current market conditions only."}

Rules: Pick liquid US equities (stocks/ETFs) only. No crypto. No OTC stocks. Make the 3 picks diverse across different companies. Do not pick any stock already in the user's current holdings.`;
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
}) {
  const [profile, setProfileState] = useState(() => loadProfile());

  // Derive initial phase from saved profile
  const [phase, setPhase] = useState(() => {
    const saved = loadProfile();
    if (saved?.completed) return "output";
    if (saved && Object.keys(saved).length > 0) return "questionnaire";
    return "landing";
  });

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(() => loadProfile() || {});
  const [selectedSectors, setSelectedSectors] = useState(() => loadProfile()?.sectors || []);

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

  // Questions are order-dependent on Q1 answer
  function getQuestions(currentAnswers) {
    const q3 = currentAnswers.marketApproach === "investor" ? Q3_INVESTOR : Q3_TRADER;
    return [Q1, Q2, q3, Q4, Q5];
  }

  const questions = getQuestions(answers);
  const totalSteps = questions.length;
  const currentQ = questions[step];

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
      if (step + 1 < totalSteps) {
        setStep((s) => s + 1);
      } else {
        completeQuestionnaire({ ...nextAnswers, sectors: selectedSectors });
      }
    }, 160);
  }

  function handleSectorToggle(value) {
    setSelectedSectors((prev) => {
      if (value === "all") return ["all"];
      const without = prev.filter((s) => s !== "all");
      return without.includes(value) ? without.filter((s) => s !== value) : [...without, value];
    });
  }

  function handleSectorContinue() {
    const nextAnswers = { ...answers, sectors: selectedSectors };
    setAnswers(nextAnswers);
    saveProfile(nextAnswers);
    if (step + 1 < totalSteps) {
      setStep((s) => s + 1);
    } else {
      completeQuestionnaire(nextAnswers);
    }
  }

  function completeQuestionnaire(finalAnswers) {
    const completed = { ...finalAnswers, completed: true };
    setProfileState(completed);
    saveProfile(completed);
    localStorage.removeItem(PICKS_CACHE_KEY);
    setPhase("output");
  }

  function handleRetune() {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    localStorage.removeItem(PICKS_CACHE_KEY);
    setProfileState(null);
    setAnswers({});
    setSelectedSectors([]);
    setStep(0);
    setParsedPicks([]);
    setPicksStatus("idle");
    setPhase("questionnaire");
  }

  function handleRefresh() {
    localStorage.removeItem(PICKS_CACHE_KEY);
    doGeneratePicks();
  }

  // ─── LANDING ───────────────────────────────────────────────────────────────

  if (phase === "landing") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "58vh", padding: "48px 20px", textAlign: "center", gap: 28 }}>
        <div style={{ fontSize: 42, lineHeight: 1 }}>✦</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#f3f7fc", letterSpacing: "-0.3px", lineHeight: 1.25 }}>
            Your AI trading partner<br />learns how you trade.
          </div>
          <div style={{ fontSize: 15, color: "#94a6bb", lineHeight: 1.7, maxWidth: 360, margin: "0 auto" }}>
            Every pick is built around your setups, your style, your portfolio. Not generic signals. Yours.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 320 }}>
          <button
            onClick={() => setPhase("questionnaire")}
            style={{
              background: "linear-gradient(135deg, rgba(124,196,255,0.18) 0%, rgba(124,196,255,0.09) 100%)",
              border: "1px solid rgba(124,196,255,0.5)",
              borderRadius: 14, color: "#d7efff",
              padding: "15px 24px", fontSize: 15, fontWeight: 700,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: "0 8px 24px rgba(124,196,255,0.10)",
            }}
          >
            Get My First Picks →
          </button>
          <div style={{ fontSize: 13, color: "#475569" }}>Takes about 2 minutes.</div>
          <button
            onClick={() => {
              const blankProfile = { completed: true };
              setProfileState(blankProfile);
              saveProfile(blankProfile);
              setPhase("output");
            }}
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 13, padding: 0, textDecoration: "underline" }}
          >
            Skip and show picks now
          </button>
        </div>
      </div>
    );
  }

  // ─── QUESTIONNAIRE ─────────────────────────────────────────────────────────

  if (phase === "questionnaire") {
    const isMulti = !!currentQ.multi;

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
            const isSelected = isMulti
              ? selectedSectors.includes(opt.value)
              : answers[currentQ.key] === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => isMulti ? handleSectorToggle(opt.value) : handleSingleSelect(opt.value)}
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
        {isMulti && selectedSectors.length > 0 && (
          <button
            onClick={handleSectorContinue}
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

  const hasProfile = !!(profile?.completed && profile?.marketApproach);
  const engineLabel = tradeCount >= 200 ? "Mature" : tradeCount >= 50 ? "Growing" : tradeCount >= 10 ? "Building" : "Seed";
  const engineDots = tradeCount >= 200 ? 4 : tradeCount >= 50 ? 3 : tradeCount >= 10 ? 2 : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f3f7fc", letterSpacing: "-0.3px" }}>Rayla Picks</div>
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

      {/* Questionnaire callout — if profile incomplete */}
      {!hasProfile && (
        <div style={{ background: "rgba(124,196,255,0.06)", border: "1px solid rgba(124,196,255,0.2)", borderRadius: 14, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>✦</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#7CC4FF" }}>Get personalized picks in 2 minutes</div>
            <div style={{ fontSize: 13, color: "#94a6bb", lineHeight: 1.55 }}>
              Ask Rayla for the Personal Picks Questionnaire for best results. Picks below are based on general market conditions until your profile is complete.
            </div>
            <button
              onClick={() => { setStep(0); setPhase("questionnaire"); }}
              style={{ marginTop: 6, background: "rgba(124,196,255,0.1)", border: "1px solid rgba(124,196,255,0.3)", borderRadius: 9, color: "#7CC4FF", padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", alignSelf: "flex-start" }}
            >
              Take the Questionnaire →
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
