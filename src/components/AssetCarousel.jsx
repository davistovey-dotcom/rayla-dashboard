import { useRef, useEffect, useCallback } from "react";

const MIN_LOOP_CARDS = 8;
const SCROLL_SPEED = 0.5; // px per frame at ~60fps ≈ 30px/s
const TOUCH_RESUME_MS = 2000; // ms after touch before auto-scroll resumes

function buildLoopedAssets(visibleAssets) {
  if (!visibleAssets.length) return [];
  const result = [];
  while (result.length < MIN_LOOP_CARDS) {
    result.push(...visibleAssets);
  }
  return result;
}

export default function AssetCarousel({ assets = [], selectedId, onSelect }) {
  const containerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isPausedRef = useRef(false);       // unified pause: hover OR touch interaction
  const isSmoothScrollingRef = useRef(false);
  const resumeTimerRef = useRef(null);
  const cardRefs = useRef(new Map());

  // Deduplicate by id/symbol
  const visibleAssets = [];
  const seen = new Set();
  for (const asset of assets) {
    const id = String(asset?.id || asset?.symbol || "").trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      visibleAssets.push(asset);
    }
  }

  // First copy: repeated until MIN_LOOP_CARDS. Second copy for seamless wrap.
  const loopedAssets = buildLoopedAssets(visibleAssets);
  const renderList = [...loopedAssets, ...loopedAssets];

  // Schedule auto-scroll resume after interaction
  const scheduleResume = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      isPausedRef.current = false;
    }, TOUCH_RESUME_MS);
  }, []);

  // Reset scroll position when the asset list changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !renderList.length) return;
    const id = requestAnimationFrame(() => { container.scrollLeft = 0; });
    return () => cancelAnimationFrame(id);
  }, [renderList.length]);

  // Diagnostic log — reports scroll geometry 400ms after mount for debugging
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const t = setTimeout(() => {
      console.log("[AssetCarousel] diagnostics", {
        scrollWidth: container.scrollWidth,
        clientWidth: container.clientWidth,
        maxScroll: container.scrollWidth - container.clientWidth,
        hasOverflow: container.scrollWidth > container.clientWidth,
        assetCount: visibleAssets.length,
        renderedCardCount: renderList.length,
        scrollLeft: container.scrollLeft,
        isPointerFine: window.matchMedia("(pointer: fine)").matches,
        hasTouchScreen: navigator.maxTouchPoints > 0,
        isPaused: isPausedRef.current,
      });
    }, 400);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll rAF loop. Resets at the halfway point for seamless infinite wrap.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function tick() {
      if (!isSmoothScrollingRef.current && !isPausedRef.current) {
        const halfWidth = container.scrollWidth / 2;
        if (halfWidth > 0 && container.clientWidth < container.scrollWidth) {
          const next = container.scrollLeft + SCROLL_SPEED;
          container.scrollLeft = next >= halfWidth ? 0 : next;
        }
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    }

    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  // Hover pause — fine (mouse) pointers only. Touch devices skip this entirely
  // to prevent onMouseEnter from locking the carousel on tap.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const pause = () => { isPausedRef.current = true; };
    const resume = () => { isPausedRef.current = false; };
    container.addEventListener("mouseenter", pause);
    container.addEventListener("mouseleave", resume);
    return () => {
      container.removeEventListener("mouseenter", pause);
      container.removeEventListener("mouseleave", resume);
    };
  }, []);

  // Touch pause/auto-resume — mobile and touch tablets
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onTouchStart = () => {
      isPausedRef.current = true;
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
    const onTouchEnd = () => { scheduleResume(); };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchend", onTouchEnd, { passive: true });
    container.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [scheduleResume]);

  // Resume when clicking/tapping outside carousel
  useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) {
        if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
        isPausedRef.current = false;
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  const handleClick = useCallback((asset) => {
    isPausedRef.current = true;
    isSmoothScrollingRef.current = true;
    onSelect?.(asset);

    // Scroll to center on the first-copy card element for this asset
    const cardEl = cardRefs.current.get(asset.id);
    const container = containerRef.current;
    if (cardEl && container) {
      const targetLeft = cardEl.offsetLeft - (container.clientWidth - cardEl.offsetWidth) / 2;
      container.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
    }

    setTimeout(() => {
      isSmoothScrollingRef.current = false;
      scheduleResume();
    }, 500);
  }, [onSelect, scheduleResume]);

  if (!visibleAssets.length) return null;

  return (
    <div style={{ position: "relative", width: "100%" }} onClick={(e) => e.stopPropagation()}>
      <style>{`.asset-carousel::-webkit-scrollbar { display: none; }`}</style>
      <div
        ref={containerRef}
        className="asset-carousel"
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
          gap: 12,
          padding: "4px 0 8px",
          boxSizing: "border-box",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {renderList.map((asset, globalIndex) => {
          const isSelected = asset.id === selectedId;
          const change = Number(asset.change);
          const price = Number(asset.price);
          const isPositive = change >= 0;
          const inFirstCopy = globalIndex < loopedAssets.length;

          return (
            <div
              key={`${asset.id}-${globalIndex}`}
              ref={(el) => {
                // Only track refs within the first copy so handleClick always
                // centers on an element near scrollLeft=0
                if (el && inFirstCopy) {
                  cardRefs.current.set(asset.id, el);
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleClick(asset);
              }}
              style={{
                flexShrink: 0,
                minWidth: 120,
                padding: "14px 16px",
                borderRadius: 12,
                cursor: "pointer",
                background: isSelected ? "rgba(111,160,216,0.15)" : "var(--rayla-blue)",
                border: isSelected ? "1.5px solid rgba(96,165,250,0.7)" : "1.5px solid rgba(255,255,255,0.07)",
                transition: "background 0.15s, border-color 0.15s",
                userSelect: "none",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: isSelected ? "#93c5fd" : "#e2e8f0", letterSpacing: "0.01em", marginBottom: 2 }}>
                {asset.symbol}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100 }}>
                {asset.name || asset.symbol}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 2 }}>
                {Number.isFinite(price)
                  ? `$${price.toLocaleString(undefined, {
                      minimumFractionDigits: price >= 100 ? 2 : price >= 1 ? 3 : 5,
                      maximumFractionDigits: price >= 100 ? 2 : price >= 1 ? 3 : 5,
                    })}`
                  : "—"}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: isPositive ? "#4ade80" : "#f87171" }}>
                {Number.isFinite(change) ? `${isPositive ? "+" : ""}${change.toFixed(2)}%` : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
