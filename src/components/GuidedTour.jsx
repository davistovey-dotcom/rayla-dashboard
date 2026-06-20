import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

const PAD = 10;
const POPUP_W = 340;
const POPUP_H_EST = 240;
const POPUP_MARGIN = 14;

function getTargetRect(tourId) {
  if (!tourId) return null;
  const el = document.querySelector(`[data-tour-id="${tourId}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return r;
}

function scrollIntoViewIfNeeded(tourId) {
  if (!tourId) return;
  const el = document.querySelector(`[data-tour-id="${tourId}"]`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export default function GuidedTour({ steps = [], onDone, onStepChange }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);

  const timerRef = useRef(null);
  const skipForIndexRef = useRef(-1);
  const onDoneRef = useRef(onDone);
  const onStepChangeRef = useRef(onStepChange);
  const stepsRef = useRef(steps);
  onDoneRef.current = onDone;
  onStepChangeRef.current = onStepChange;
  stepsRef.current = steps;

  const step = steps[index] || null;

  // Block ALL pointer/touch/click events on non-tour elements at the document
  // capture phase — fires before any element's handler, before React's delegation,
  // before z-index is consulted. Works regardless of position:fixed, stacking
  // contexts, or CSS pointer-events inheritance quirks on iOS Safari.
  useEffect(() => {
    document.body.classList.add("tour-active");

    const blockNonTour = (e) => {
      // Use parentElement fallback for text nodes (nodeType 3)
      const el = e.target?.nodeType === 1 ? e.target : e.target?.parentElement;
      const inPortal = el?.closest?.("[data-tour-portal]");
      if (inPortal) {
        console.log(`[tour-capture] ALLOW type=${e.type} tag=${el?.tagName}`);
        return;
      }
      console.log(`[tour-block] type=${e.type} tag=${el?.tagName} class="${el?.className}"`);
      e.stopImmediatePropagation();
      if (e.cancelable) e.preventDefault();
    };

    const opts = { capture: true, passive: false };
    document.addEventListener("touchstart", blockNonTour, opts);
    document.addEventListener("touchend", blockNonTour, opts);
    document.addEventListener("touchmove", blockNonTour, opts);
    document.addEventListener("pointerdown", blockNonTour, opts);
    document.addEventListener("pointerup", blockNonTour, opts);
    document.addEventListener("click", blockNonTour, { capture: true });

    return () => {
      document.body.classList.remove("tour-active");
      document.removeEventListener("touchstart", blockNonTour, { capture: true });
      document.removeEventListener("touchend", blockNonTour, { capture: true });
      document.removeEventListener("touchmove", blockNonTour, { capture: true });
      document.removeEventListener("pointerdown", blockNonTour, { capture: true });
      document.removeEventListener("pointerup", blockNonTour, { capture: true });
      document.removeEventListener("click", blockNonTour, { capture: true });
    };
  }, []);

  const cancelSkip = useCallback(() => {
    skipForIndexRef.current = -1;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const goNext = useCallback((fromIndex) => {
    const total = stepsRef.current.length;
    cancelSkip();
    if (fromIndex >= total - 1) {
      console.log(`[tour-step] action=done from=${fromIndex}`);
      onDoneRef.current();
    } else {
      const to = fromIndex + 1;
      console.log(`[tour-step] from=${fromIndex} to=${to}`);
      setIndex(to);
    }
  }, [cancelSkip]);

  const goPrev = useCallback((fromIndex) => {
    cancelSkip();
    if (fromIndex > 0) {
      const to = fromIndex - 1;
      console.log(`[tour] action=prev from=${fromIndex} to=${to}`);
      setIndex(to);
    }
  }, [cancelSkip]);

  useEffect(() => {
    if (!step) return;
    skipForIndexRef.current = index;

    // Let the host (e.g. App.jsx) react to step changes — e.g. switch a mobile
    // tab so the anchor's DOM exists before we measure. Done synchronously so
    // any setState fires immediately; the two rAFs below wait for React to
    // commit and the browser to lay out before we scroll + measure.
    try { onStepChangeRef.current?.(step, index); } catch (err) {
      console.error("[tour] onStepChange handler threw", err);
    }

    let timer = null;
    let raf2 = null;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        scrollIntoViewIfNeeded(step.tourId);
        timer = setTimeout(() => {
          timerRef.current = null;
          if (skipForIndexRef.current !== index) return;

          const measured = getTargetRect(step.tourId);
          setRect(measured);

          if (!measured && step.tourId) {
            skipForIndexRef.current = -1;
            const total = stepsRef.current.length;
            if (index < total - 1) {
              console.log(`[tour] action=skip from=${index} to=${index + 1} (target not found: ${step.tourId})`);
              setIndex(index + 1);
            } else {
              onDoneRef.current();
            }
          }
        }, 350);
        timerRef.current = timer;
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      if (raf2 != null) cancelAnimationFrame(raf2);
      if (timer != null) clearTimeout(timer);
      timerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, step?.tourId]);

  useEffect(() => {
    const handle = () => setRect(getTargetRect(step?.tourId));
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [step?.tourId]);

  useEffect(() => {
    const handle = (e) => { if (e.key === "Escape") onDoneRef.current(); };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, []);

  if (!step) return null;

  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const popupWidth = Math.min(POPUP_W, vw - 32);

  const highlight = rect ? {
    position: "fixed",
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
    borderRadius: 14,
    border: "2px solid rgba(124,196,255,0.65)",
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)",
    zIndex: 2147483644,
    pointerEvents: "none", // let clicks pass through the spotlight to the overlay
  } : null;

  const dimStyle = !rect ? {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.72)",
    zIndex: 2147483643,
  } : null;

  // Same placement on every viewport: prefer below, then above, then pin to
  // whichever side has more room. Never centers the popup over the target.
  let popupTop;
  if (rect) {
    const spaceBelow = vh - (rect.bottom + PAD + POPUP_MARGIN);
    if (spaceBelow >= POPUP_H_EST) {
      popupTop = rect.bottom + PAD + POPUP_MARGIN;
    } else {
      const aboveTop = rect.top - PAD - POPUP_MARGIN - POPUP_H_EST;
      if (aboveTop > POPUP_MARGIN) {
        popupTop = aboveTop;
      } else if (spaceBelow >= rect.top - PAD - POPUP_MARGIN) {
        // Below has more room — pin to viewport bottom (rare: rect spans most of vh)
        popupTop = vh - POPUP_H_EST - POPUP_MARGIN;
      } else {
        // Above has more room — pin to viewport top
        popupTop = POPUP_MARGIN;
      }
    }
  } else {
    popupTop = vh / 2 - POPUP_H_EST / 2;
  }
  popupTop = clamp(popupTop, POPUP_MARGIN, Math.max(POPUP_MARGIN, vh - POPUP_H_EST - POPUP_MARGIN));

  const isLast = index === steps.length - 1;

  // Render via portal directly at document.body — this guarantees the overlay
  // and popup are outside any parent stacking context (transform, will-change,
  // isolation) that could cap their effective z-index below app UI elements.
  const content = (
    <>
      {/* Full-screen overlay — data-tour-portal exempts it from the capture blocker */}
      <div
        data-tour-portal
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2147483643,
          cursor: "default",
          pointerEvents: "all",
          ...(dimStyle || {}),
        }}
        onTouchEnd={(e) => { console.log("[overlay] onTouchEnd — closing tour (overlay was tapped)"); e.stopPropagation(); e.preventDefault(); onDoneRef.current(); }}
        onClick={(e) => { console.log("[overlay] onClick — closing tour"); e.stopPropagation(); e.preventDefault(); onDoneRef.current(); }}
      />

      {/* Spotlight frame — visual only */}
      {highlight && <div data-tour-portal style={highlight} />}

      {/* Popup — data-tour-portal exempts it from the capture blocker.
          Container onTouchEnd does NOT call preventDefault — that would suppress
          the synthetic click for child buttons. Buttons handle their own actions. */}
      <div
        data-tour-portal
        style={{
          position: "fixed",
          top: popupTop,
          left: "50%",
          transform: "translateX(-50%)",
          width: popupWidth,
          zIndex: 2147483645,
          background: "#0c1526",
          border: "1px solid rgba(124,196,255,0.22)",
          borderRadius: 16,
          padding: "18px 20px 16px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
          pointerEvents: "all",
        }}
        onTouchEnd={(e) => { e.stopPropagation(); }}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
      >
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#7CC4FF" }}>
            Step {index + 1} / {steps.length}
          </div>
          <button
            type="button"
            onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); onDoneRef.current(); }}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDoneRef.current(); }}
            aria-label="Close walkthrough"
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "2px 4px", borderRadius: 4 }}
          >
            ×
          </button>
        </div>

        {/* Title */}
        <div style={{ fontSize: 15, fontWeight: 700, color: "#f3f7fc", marginBottom: 8, lineHeight: 1.3 }}>
          {step.title}
        </div>

        {/* Description */}
        <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.65, marginBottom: 18 }}>
          {step.description}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
          {index > 0 && (
            <button
              type="button"
              onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); goPrev(index); }}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); goPrev(index); }}
              style={{
                padding: "7px 16px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color: "#94a3b8",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Back
            </button>
          )}
          <button
            type="button"
            onTouchStart={(e) => { console.log("[tour-click] next touchstart"); e.stopPropagation(); }}
            onTouchEnd={(e) => { console.log("[tour-click] next touchend"); e.stopPropagation(); e.preventDefault(); goNext(index); }}
            onClick={(e) => { console.log("[tour-click] next click"); e.stopPropagation(); e.preventDefault(); goNext(index); }}
            style={{
              padding: "7px 20px",
              borderRadius: 8,
              border: "none",
              background: isLast ? "rgba(124,196,255,0.18)" : "#1d4ed8",
              color: isLast ? "#7CC4FF" : "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.2px",
            }}
          >
            {isLast ? "Done" : "Next →"}
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}
