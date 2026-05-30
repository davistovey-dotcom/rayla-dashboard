import { useState, useEffect, useRef, useCallback } from "react";

const PAD = 10;
const POPUP_W = 340;
const POPUP_H_EST = 240; // conservative estimate for positioning math
const POPUP_MARGIN = 14;

function getTargetRect(tourId) {
  if (!tourId) return null;
  const el = document.querySelector(`[data-tour-id="${tourId}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  // Guard against display:contents or zero-size elements
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

export default function GuidedTour({ steps = [], onDone }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);

  // Stable refs — never trigger effect re-runs
  const timerRef = useRef(null);
  const skipForIndexRef = useRef(-1);
  const onDoneRef = useRef(onDone);
  const stepsRef = useRef(steps);
  onDoneRef.current = onDone;
  stepsRef.current = steps;

  const step = steps[index] || null;

  // Add body class so CSS can lower mobileNav z-index below the tour overlay
  useEffect(() => {
    document.body.classList.add("tour-active");
    return () => document.body.classList.remove("tour-active");
  }, []);

  // Cancel any pending auto-skip timer
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
      console.log(`[tour] action=done from=${fromIndex}`);
      onDoneRef.current();
    } else {
      const to = fromIndex + 1;
      console.log(`[tour] action=next from=${fromIndex} to=${to}`);
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

  // Measure target element after each step change, giving scroll time to settle.
  // If the element isn't found, auto-skip exactly one step.
  useEffect(() => {
    if (!step) return;
    scrollIntoViewIfNeeded(step.tourId);
    skipForIndexRef.current = index;

    const t = setTimeout(() => {
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

    timerRef.current = t;
    return () => {
      clearTimeout(t);
      timerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, step?.tourId]);

  // Re-measure on resize
  useEffect(() => {
    const handle = () => setRect(getTargetRect(step?.tourId));
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [step?.tourId]);

  // Escape closes the tour
  useEffect(() => {
    const handle = (e) => { if (e.key === "Escape") onDoneRef.current(); };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, []);

  if (!step) return null;

  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const isMobileVp = vw <= 480;
  const popupWidth = Math.min(POPUP_W, vw - 32);

  // Spotlight overlay via box-shadow on the highlight frame
  const highlight = rect ? {
    position: "fixed",
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
    borderRadius: 14,
    border: "2px solid rgba(124,196,255,0.65)",
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)",
    zIndex: 9991,
    pointerEvents: "none",
  } : null;

  const dimStyle = !rect ? {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.72)",
    zIndex: 9990,
  } : null;

  // Popup positioning strategy:
  // - Mobile (≤ 480px): always bottom-center so buttons are always reachable
  // - iPad/desktop: adjacent to target, above/below, with viewport clamping
  const topSafe = POPUP_MARGIN;
  const bottomSafe = POPUP_MARGIN;

  let popupTop;
  if (isMobileVp) {
    // Bottom of viewport with safe margin — overlay covers mobileNav so this is fully visible
    popupTop = clamp(vh - POPUP_H_EST - bottomSafe, topSafe, vh - POPUP_H_EST - bottomSafe);
  } else if (rect) {
    const spaceBelow = vh - (rect.bottom + PAD + POPUP_MARGIN);
    if (spaceBelow >= POPUP_H_EST) {
      popupTop = rect.bottom + PAD + POPUP_MARGIN;
    } else {
      const aboveTop = rect.top - PAD - POPUP_MARGIN - POPUP_H_EST;
      popupTop = aboveTop > POPUP_MARGIN
        ? aboveTop
        : Math.max(POPUP_MARGIN, vh / 2 - POPUP_H_EST / 2);
    }
    popupTop = clamp(popupTop, topSafe, vh - POPUP_H_EST - bottomSafe);
  } else {
    popupTop = clamp(vh / 2 - POPUP_H_EST / 2, topSafe, vh - POPUP_H_EST - bottomSafe);
  }

  const isLast = index === steps.length - 1;

  return (
    <>
      {/* Click-outside blocker — clicking the dark area closes the tour */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9990, cursor: "default", ...(dimStyle || {}) }}
        onClick={(e) => { e.stopPropagation(); onDoneRef.current(); }}
      />

      {/* Spotlight frame — box-shadow darkens everything outside the target */}
      {highlight && <div style={highlight} />}

      {/* Popup */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: popupTop,
          left: "50%",
          transform: "translateX(-50%)",
          width: popupWidth,
          zIndex: 9992,
          background: "#0c1526",
          border: "1px solid rgba(124,196,255,0.22)",
          borderRadius: 16,
          padding: "18px 20px 16px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
          pointerEvents: "all",
        }}
      >
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#7CC4FF" }}>
            Step {index + 1} / {steps.length}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDoneRef.current(); }}
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
              onClick={(e) => { e.stopPropagation(); goPrev(index); }}
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
            onClick={(e) => { e.stopPropagation(); goNext(index); }}
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
}
