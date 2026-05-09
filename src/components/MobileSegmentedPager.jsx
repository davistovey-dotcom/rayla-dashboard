import { useEffect, useRef, useState } from "react";

// segments: [{ label: string, content: ReactNode, badge?: string }]
// Desktop (>600px): renders all segment content sequentially (no pager)
// Mobile (<=600px): segmented control + horizontal snap-scroll pager
export default function MobileSegmentedPager({ segments, defaultIndex = 0 }) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 600px)").matches : false
  );
  const [activeIndex, setActiveIndex] = useState(defaultIndex);
  const scrollRef = useRef(null);
  const programmaticScrollRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 600px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  function goToIndex(index) {
    setActiveIndex(index);
    if (scrollRef.current) {
      programmaticScrollRef.current = true;
      scrollRef.current.scrollTo({
        left: index * scrollRef.current.clientWidth,
        behavior: "smooth",
      });
      setTimeout(() => { programmaticScrollRef.current = false; }, 400);
    }
  }

  function handleScroll() {
    if (!scrollRef.current || programmaticScrollRef.current) return;
    const container = scrollRef.current;
    const index = Math.round(container.scrollLeft / container.clientWidth);
    if (index >= 0 && index < segments.length && index !== activeIndex) {
      setActiveIndex(index);
    }
  }

  if (!isMobile) {
    return <>{segments.map((seg) => seg.content)}</>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      {/* Segmented control */}
      <div style={{
        display: "flex",
        background: "rgba(255,255,255,0.05)",
        borderRadius: 12,
        padding: 4,
        marginBottom: 16,
        gap: 2,
        flexShrink: 0,
      }}>
        {segments.map((seg, i) => (
          <button
            key={seg.label}
            type="button"
            onClick={() => goToIndex(i)}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: 9,
              border: "none",
              background: activeIndex === i ? "rgba(124,196,255,0.14)" : "transparent",
              color: activeIndex === i ? "#7CC4FF" : "#64748b",
              fontWeight: activeIndex === i ? 600 : 400,
              fontSize: 13,
              cursor: "pointer",
              transition: "color 0.15s ease, background 0.15s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {seg.label}
            {seg.badge && (
              <span style={{
                background: "#7CC4FF",
                color: "#050d1f",
                borderRadius: 8,
                fontSize: 10,
                fontWeight: 700,
                padding: "1px 5px",
                lineHeight: 1.4,
              }}>{seg.badge}</span>
            )}
          </button>
        ))}
      </div>
      {/* Snap-scroll pager */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          display: "flex",
          overflowX: "scroll",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
          width: "100%",
        }}
      >
        {segments.map((seg) => (
          <div
            key={seg.label}
            style={{
              minWidth: "100%",
              flexShrink: 0,
              scrollSnapAlign: "start",
            }}
          >
            {seg.content}
          </div>
        ))}
      </div>
    </div>
  );
}
