import { useEffect, useState } from "react";

// segments: [{ label: string, content: ReactNode, badge?: string }]
// Desktop (>600px): renders all segment content sequentially (no pager)
// Mobile (<=600px): segmented control + renders only the active segment (unmounts inactive)
export default function MobileSegmentedPager({ segments, defaultIndex = 0 }) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 600px)").matches : false
  );
  const [activeIndex, setActiveIndex] = useState(defaultIndex);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 600px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

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
            onClick={() => setActiveIndex(i)}
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
      {/* Only render the active segment — inactive segments are unmounted */}
      <div key={activeIndex}>
        {segments[activeIndex]?.content}
      </div>
    </div>
  );
}
