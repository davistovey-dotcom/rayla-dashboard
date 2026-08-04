import React from "react";

// Standalone overlay that walks a beginner through building a simulation
// trade one field at a time. Extracted from the old floating Ask Rayla popup
// because the checklist has nothing to do with chat — it's a trading-flow
// guide. Two states: the initial prompt asking whether to walk through it,
// and the step-by-step checklist itself. Parent owns all state.

const PANEL_STYLE = {
  position: "fixed",
  right: 16,
  bottom: 16,
  zIndex: 12000,
  width: "min(360px, calc(100vw - 32px))",
  background: "linear-gradient(180deg, rgba(10,16,28,0.98), rgba(7,12,22,0.98))",
  border: "1px solid rgba(124,196,255,0.28)",
  borderRadius: 16,
  boxShadow: "0 24px 60px rgba(0,0,0,0.48)",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const EYEBROW_STYLE = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "1.1px",
  textTransform: "uppercase",
  color: "#7CC4FF",
};

const PRIMARY_BUTTON = {
  border: "1px solid rgba(124,196,255,0.35)",
  background: "#7CC4FF",
  color: "#0b1017",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const SECONDARY_BUTTON = {
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
  color: "#cbd5e1",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

// prompt: { assetSymbol, directionLabel, ... } — asks user if they want the walkthrough.
// checklist: { steps: [{title, body}], currentStep } — active walkthrough.
// Only one of the two is active at a time; parent flips prompt → checklist
// when the user accepts.
export default function IntelSimulationSetupOverlay({
  prompt,
  checklist,
  onAccept,
  onDismissPrompt,
  onAdvance,
  onSkipChecklist,
}) {
  if (prompt) {
    const symbol = prompt.assetSymbol || "this trade";
    const direction = prompt.directionLabel || "";
    return (
      <div style={PANEL_STYLE} role="dialog" aria-label="Intel simulation setup">
        <div style={EYEBROW_STYLE}>Guided setup</div>
        <div style={{ fontSize: 14, color: "#e2f0ff", lineHeight: 1.55 }}>
          Want me to walk you through setting up the {direction ? `${direction} ` : ""}{symbol} simulation one field at a time?
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={onAccept} style={PRIMARY_BUTTON}>
            Yes, walk me through it
          </button>
          <button type="button" onClick={onDismissPrompt} style={SECONDARY_BUTTON}>
            No, I&apos;ll set it up
          </button>
        </div>
      </div>
    );
  }

  if (checklist) {
    const step = checklist.steps?.[checklist.currentStep];
    if (!step) return null;
    const isLastStep = checklist.currentStep >= checklist.steps.length - 1;
    const progressLabel = `Step ${checklist.currentStep + 1} of ${checklist.steps.length}`;
    return (
      <div style={PANEL_STYLE} role="dialog" aria-label="Intel simulation setup walkthrough">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <div style={EYEBROW_STYLE}>Guided setup</div>
          <div style={{ fontSize: 11, color: "#7f8ea3" }}>{progressLabel}</div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#e2f0ff", lineHeight: 1.5 }}>
          {step.title}
        </div>
        {step.body ? (
          <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {step.body}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={onAdvance} style={PRIMARY_BUTTON}>
            {isLastStep ? "Done" : "Next step"}
          </button>
          <button type="button" onClick={onSkipChecklist} style={SECONDARY_BUTTON}>
            Skip
          </button>
        </div>
      </div>
    );
  }

  return null;
}
