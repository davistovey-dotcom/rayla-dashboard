import { useRef, useEffect, useCallback } from "react";

export default function AssetCarousel({ assets = [], selectedId, onSelect }) {
  const containerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isHoveredRef = useRef(false);
  const isLockedRef = useRef(false);
  const lastTimeRef = useRef(null);
  const cardRefs = useRef(new Map());
  const isSmoothScrollingRef = useRef(false);
  const visibleAssets = assets.filter((asset, index, list) => {
    const id = String(asset?.id || asset?.symbol || "").trim();
    return id && list.findIndex((candidate) => String(candidate?.id || candidate?.symbol || "").trim() === id) === index;
  });

  // Reset to the start when the asset list changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !visibleAssets.length) return;
    const frameId = requestAnimationFrame(() => {
      container.scrollLeft = 0;
    });
    return () => cancelAnimationFrame(frameId);
  }, [visibleAssets.length]);

  // Keep the ticker as a plain horizontal list so assets do not duplicate.
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Unlock auto-spin on click outside carousel
  useEffect(() => {
  const handleDocClick = (e) => {
    const container = containerRef.current;
    if (!container) return;

    if (!container.contains(e.target)) {
      isLockedRef.current = false;
      isHoveredRef.current = false;
      lastTimeRef.current = null;
    }
  };

  document.addEventListener("click", handleDocClick, true);
  return () => document.removeEventListener("click", handleDocClick, true);
}, []);

  const handleClick = useCallback((asset) => {
  isLockedRef.current = true;
  isHoveredRef.current = true;
  isSmoothScrollingRef.current = true;
  lastTimeRef.current = null;

  onSelect?.(asset);

  const cardEl = cardRefs.current.get(asset.id);
  const container = containerRef.current;

  if (cardEl && container) {
    const targetLeft =
      cardEl.offsetLeft - (container.clientWidth - cardEl.offsetWidth) / 2;

    container.scrollTo({
    left: targetLeft,
    behavior: "smooth",
  });
  }

  setTimeout(() => {
    isSmoothScrollingRef.current = false;
    // DO NOT unlock here. Click outside already unlocks.
  }, 500);
}, [onSelect]);

  if (!visibleAssets.length) return null;

  return (
    <div
        style={{ position: "relative", width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
      <style>{`.asset-carousel::-webkit-scrollbar { display: none; }`}</style>
      <div
        ref={containerRef}
        className="asset-carousel"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => { isHoveredRef.current = true; }}
        onMouseLeave={() => { isHoveredRef.current = false; }}
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
        {visibleAssets.map((asset, i) => {
          const isSelected = asset.id === selectedId;
          const change = Number(asset.change);
          const price = Number(asset.price);
          const isPositive = change >= 0;

          return (
            <div
              key={asset.id}
              ref={(el) => {
                if (el) cardRefs.current.set(asset.id, el);
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
                background: isSelected
                  ? "rgba(111,160,216,0.15)"
                  : "var(--rayla-blue)",
                border: isSelected
                  ? "1.5px solid rgba(96,165,250,0.7)"
                  : "1.5px solid rgba(255,255,255,0.07)",
                transition: "background 0.15s, border-color 0.15s",
                userSelect: "none",
              }}
            >
              <div style={{
                fontSize: 15,
                fontWeight: 700,
                color: isSelected ? "#93c5fd" : "#e2e8f0",
                letterSpacing: "0.01em",
                marginBottom: 2,
              }}>
                {asset.symbol}
              </div>
              <div style={{
                fontSize: 11,
                color: "#64748b",
                marginBottom: 8,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 100,
              }}>
                {asset.name || asset.symbol}
              </div>
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#e2e8f0",
                marginBottom: 2,
              }}>
                {Number.isFinite(price)
                  ? `$${price.toLocaleString(undefined, {
                      minimumFractionDigits: price >= 100 ? 2 : price >= 1 ? 3 : 5,
                      maximumFractionDigits: price >= 100 ? 2 : price >= 1 ? 3 : 5,
                    })}`
                  : "—"}
              </div>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: isPositive ? "#4ade80" : "#f87171",
              }}>
                {Number.isFinite(change)
                  ? `${isPositive ? "+" : ""}${change.toFixed(2)}%`
                  : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
