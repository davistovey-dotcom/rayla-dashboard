import { useEffect, useId, useMemo, useRef, useState } from "react";

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeSeriesPoints(points) {
  const sorted = (Array.isArray(points) ? points : [])
    .map((point, index) => {
      const timeMs = Number(point?.timeMs);
      const value = Number(point?.value);
      if (!Number.isFinite(timeMs) || !Number.isFinite(value)) return null;
      return { timeMs, value, index };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
      return a.index - b.index;
    });

  let previousMs = null;
  return sorted.map((point) => {
    let nextMs = point.timeMs;
    if (previousMs != null && nextMs <= previousMs) {
      nextMs = previousMs + 1000;
    }
    previousMs = nextMs;
    return { timeMs: nextMs, value: point.value };
  });
}

function defaultValueFormatter(value) {
  if (!Number.isFinite(Number(value))) return "--";
  const numeric = Number(value);
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(2)}`;
}

function normalizeVisibleTimeRange(visibleTimeRange) {
  const fromMs = Number(visibleTimeRange?.fromMs);
  const toMs = Number(visibleTimeRange?.toMs);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return null;
  return { fromMs, toMs };
}

function getLocalTimeZone(preferredTimeZone) {
  if (preferredTimeZone && typeof preferredTimeZone === "string") return preferredTimeZone;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function formatLocalChartTime(timeMs, domain, preferredTimeZone = null) {
  if (!Number.isFinite(Number(timeMs))) return "";
  const date = new Date(Number(timeMs));
  const spanMs = domain ? domain.toMs - domain.fromMs : 0;
  const timeZone = getLocalTimeZone(preferredTimeZone);
  if (spanMs >= 300 * DAY_MS) {
    return new Intl.DateTimeFormat([], { month: "short", year: "numeric", timeZone }).format(date);
  }
  if (spanMs >= 45 * DAY_MS) {
    return new Intl.DateTimeFormat([], { month: "short", day: "numeric", timeZone }).format(date);
  }
  if (spanMs >= 2 * DAY_MS) {
    return new Intl.DateTimeFormat([], { month: "short", day: "numeric", timeZone }).format(date);
  }
  return new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit", hour12: true, timeZone }).format(date);
}

function getFallbackDomain(lines) {
  const times = lines.flatMap((line) => line.data.map((point) => point.timeMs));
  const min = Math.min(...times);
  const max = Math.max(...times);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min === max) return { fromMs: min - 60 * 60 * 1000, toMs: max + 60 * 60 * 1000 };
  return { fromMs: min, toMs: max };
}

function getVisiblePoints(lines, domain) {
  if (!domain) return [];
  return lines.flatMap((line) => line.data.filter((point) => (
    point.timeMs >= domain.fromMs && point.timeMs <= domain.toMs
  )));
}

function getValueDomain(points) {
  const values = points.map((point) => point.value).filter((value) => Number.isFinite(value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: -1, max: 1 };
  if (Math.abs(max - min) < 0.0001) {
    const pad = Math.max(Math.abs(max) * 0.08, 0.25);
    return { min: min - pad, max: max + pad };
  }
  const pad = Math.max((max - min) * 0.16, 0.08);
  return { min: min - pad, max: max + pad };
}

function makeLinePath(points) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const midX = (previous.x + current.x) / 2;
    path += ` C ${midX} ${previous.y}, ${midX} ${current.y}, ${current.x} ${current.y}`;
  }
  return path;
}

function dedupeLabels(labels, preferredTimeZone = null) {
  const used = new Set();
  return labels.map((label) => {
    let next = label;
    while (used.has(next.text) && next.index > 0) {
      const shifted = { ...next, timeMs: next.timeMs + 60 * 60 * 1000 };
      next = { ...shifted, text: formatLocalChartTime(shifted.timeMs, label.domain, preferredTimeZone) };
      break;
    }
    used.add(next.text);
    return next;
  });
}

function buildXAxisLabels(domain, width, preferredTimeZone = null) {
  if (!domain || width <= 0) return [];
  const span = domain.toMs - domain.fromMs;
  const count = width < 460 ? 3 : span >= 180 * DAY_MS ? 4 : 5;
  const raw = Array.from({ length: count }, (_, index) => {
    const ratio = count === 1 ? 0 : index / (count - 1);
    const timeMs = domain.fromMs + span * ratio;
    return { index, timeMs, domain, text: formatLocalChartTime(timeMs, domain, preferredTimeZone) };
  });
  return dedupeLabels(raw, preferredTimeZone).map((label, index, labels) => ({
    ...label,
    anchor: index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle",
  }));
}

function buildYAxisLabels(valueDomain) {
  const middle = (valueDomain.min + valueDomain.max) / 2;
  return [valueDomain.max, middle, valueDomain.min];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function InteractiveLineChart({
  lines,
  height = 360,
  valueFormatter = defaultValueFormatter,
  className = "",
  emptyMessage = "No chart data yet.",
  showLastPointPulse = false,
  minimal = false,
  visibleTimeRange = null,
  timeZone = null,
  debugLabel = "",
}) {
  const chartId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState(null);
  const [hover, setHover] = useState(null);

  const normalizedLines = useMemo(() => (
    (Array.isArray(lines) ? lines : [])
      .map((line) => ({
        symbol: String(line?.symbol || "").trim() || "Series",
        color: line?.color || "#7CC4FF",
        data: normalizeSeriesPoints(line?.points),
      }))
      .filter((line) => line.data.length > 0)
  ), [lines]);

  const baseDomain = useMemo(() => (
    normalizeVisibleTimeRange(visibleTimeRange) || getFallbackDomain(normalizedLines)
  ), [visibleTimeRange, normalizedLines]);

  useEffect(() => {
    setViewport(null);
  }, [baseDomain?.fromMs, baseDomain?.toMs, normalizedLines]);

  useEffect(() => {
    if (!rootRef.current) return undefined;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setSize({
        width: Math.max(0, rect.width),
        height: Math.max(0, rect.height),
      });
    });
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, []);

  const domain = viewport || baseDomain;
  const allVisiblePoints = useMemo(
    () => getVisiblePoints(normalizedLines, domain),
    [normalizedLines, domain]
  );
  const valueDomain = useMemo(() => getValueDomain(allVisiblePoints), [allVisiblePoints]);

  const dimensions = useMemo(() => {
    const width = size.width || 640;
    const rootHeight = size.height || (typeof height === "number" ? height : 340);
    const compact = width < 520;
    return {
      width,
      height: rootHeight,
      left: minimal ? 8 : compact ? 10 : 26,
      right: minimal ? 8 : compact ? 48 : 72,
      top: minimal ? 10 : compact ? 34 : 48,
      bottom: minimal ? 12 : compact ? 42 : 38,
    };
  }, [height, minimal, size.height, size.width]);

  const plot = {
    x: dimensions.left,
    y: dimensions.top,
    width: Math.max(1, dimensions.width - dimensions.left - dimensions.right),
    height: Math.max(1, dimensions.height - dimensions.top - dimensions.bottom),
  };

  const xForTime = (timeMs) => {
    if (!domain) return plot.x;
    const span = Math.max(1, domain.toMs - domain.fromMs);
    return plot.x + ((timeMs - domain.fromMs) / span) * plot.width;
  };
  const yForValue = (value) => {
    const span = Math.max(0.000001, valueDomain.max - valueDomain.min);
    return plot.y + (1 - ((value - valueDomain.min) / span)) * plot.height;
  };

  const renderedLines = useMemo(() => normalizedLines.map((line) => {
    const visibleData = domain
      ? line.data.filter((point) => point.timeMs >= domain.fromMs && point.timeMs <= domain.toMs)
      : line.data;
    const coords = visibleData.map((point) => ({
      ...point,
      x: xForTime(point.timeMs),
      y: yForValue(point.value),
    }));
    return {
      ...line,
      visibleData,
      coords,
      path: makeLinePath(coords),
    };
  }), [normalizedLines, domain, plot.width, plot.height, plot.x, plot.y, valueDomain.max, valueDomain.min]);

  const primaryLine = renderedLines[0];
  const primaryCoords = primaryLine?.coords || [];
  const lastCoord = primaryCoords[primaryCoords.length - 1] || null;
  const xAxisLabels = buildXAxisLabels(domain, plot.width, timeZone);
  const yAxisLabels = buildYAxisLabels(valueDomain);

  useEffect(() => {
    if (typeof window === "undefined" || !domain) return;
    const stats = {
      rawPoints: normalizedLines[0]?.data?.length || 0,
      renderedPoints: primaryLine?.visibleData?.length || 0,
      firstTimestamp: primaryLine?.visibleData?.[0]?.timeMs ? new Date(primaryLine.visibleData[0].timeMs).toISOString() : null,
      lastTimestamp: primaryLine?.visibleData?.length ? new Date(primaryLine.visibleData[primaryLine.visibleData.length - 1].timeMs).toISOString() : null,
      minValue: allVisiblePoints.length ? Math.min(...allVisiblePoints.map((point) => point.value)) : null,
      maxValue: allVisiblePoints.length ? Math.max(...allVisiblePoints.map((point) => point.value)) : null,
      xAxisLabels: xAxisLabels.map((label) => label.text),
      timeZone: getLocalTimeZone(timeZone),
      firstRenderedX: primaryLine?.coords?.[0]?.x ?? null,
      lastRenderedX: primaryLine?.coords?.length ? primaryLine.coords[primaryLine.coords.length - 1].x : null,
      plotWidth: plot.width,
      domain: {
        from: new Date(domain.fromMs).toISOString(),
        to: new Date(domain.toMs).toISOString(),
      },
    };
    window.__raylaChartRenderStats = {
      ...(window.__raylaChartRenderStats || {}),
      [debugLabel || className || "InteractiveLineChart"]: stats,
    };
    console.log("[Rayla chart render stats]", { label: debugLabel || className || "InteractiveLineChart", className, ...stats });
  }, [allVisiblePoints, className, debugLabel, domain, normalizedLines, primaryLine, xAxisLabels]);

  const fitChart = () => {
    setViewport(null);
    setHover(null);
  };

  const handleWheel = (event) => {
    if (!baseDomain || !domain) return;
    const shouldZoom = event.ctrlKey || event.metaKey || Math.abs(event.deltaY) > Math.abs(event.deltaX);
    if (!shouldZoom) return;
    event.preventDefault();
    const rect = rootRef.current?.getBoundingClientRect();
    const focusRatio = rect ? clamp((event.clientX - rect.left - plot.x) / plot.width, 0, 1) : 0.5;
    const currentSpan = domain.toMs - domain.fromMs;
    const zoomFactor = event.deltaY > 0 ? 1.18 : 0.84;
    const minSpan = 15 * 60 * 1000;
    const maxSpan = baseDomain.toMs - baseDomain.fromMs;
    const nextSpan = clamp(currentSpan * zoomFactor, minSpan, maxSpan);
    const focusTime = domain.fromMs + currentSpan * focusRatio;
    let nextFrom = focusTime - nextSpan * focusRatio;
    let nextTo = nextFrom + nextSpan;
    if (nextFrom < baseDomain.fromMs) {
      nextFrom = baseDomain.fromMs;
      nextTo = nextFrom + nextSpan;
    }
    if (nextTo > baseDomain.toMs) {
      nextTo = baseDomain.toMs;
      nextFrom = nextTo - nextSpan;
    }
    setViewport({ fromMs: nextFrom, toMs: nextTo });
  };

  const handlePointerDown = (event) => {
    if (!domain) return;
    dragRef.current = { clientX: event.clientX, domain };
    rootRef.current?.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect && domain) {
      const x = clamp(event.clientX - rect.left, plot.x, plot.x + plot.width);
      const timeMs = domain.fromMs + ((x - plot.x) / plot.width) * (domain.toMs - domain.fromMs);
      const nearest = normalizedLines[0]?.data.reduce((best, point) => {
        if (point.timeMs < domain.fromMs || point.timeMs > domain.toMs) return best;
        const distance = Math.abs(point.timeMs - timeMs);
        return !best || distance < best.distance ? { point, distance } : best;
      }, null)?.point;
      setHover(nearest ? {
        x: xForTime(nearest.timeMs),
        y: yForValue(nearest.value),
        value: nearest.value,
        timeMs: nearest.timeMs,
      } : null);
    }
    if (!dragRef.current || !baseDomain || !domain) return;
    const deltaPx = event.clientX - dragRef.current.clientX;
    const span = dragRef.current.domain.toMs - dragRef.current.domain.fromMs;
    const deltaMs = -(deltaPx / plot.width) * span;
    let nextFrom = dragRef.current.domain.fromMs + deltaMs;
    let nextTo = dragRef.current.domain.toMs + deltaMs;
    if (nextFrom < baseDomain.fromMs) {
      nextFrom = baseDomain.fromMs;
      nextTo = nextFrom + span;
    }
    if (nextTo > baseDomain.toMs) {
      nextTo = baseDomain.toMs;
      nextFrom = nextTo - span;
    }
    setViewport({ fromMs: nextFrom, toMs: nextTo });
  };

  const handlePointerUp = (event) => {
    dragRef.current = null;
    rootRef.current?.releasePointerCapture?.(event.pointerId);
  };

  if (!normalizedLines.length || !domain) {
    return (
      <div ref={rootRef} className={`interactiveLineChart ${className}`} style={{ height }}>
        <div className="interactiveLineChartEmpty">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`interactiveLineChart ${className}`}
      style={{ height }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={fitChart}
      onPointerLeave={() => {
        dragRef.current = null;
        setHover(null);
      }}
    >
      <div className="interactiveLineChartLegend">
        {normalizedLines.map((line) => {
          const lastValue = line.data[line.data.length - 1]?.value;
          return (
            <div key={line.symbol} className="interactiveLineChartLegendItem">
              <span style={{ background: line.color }} />
              <strong>{line.symbol}</strong>
              <em>{valueFormatter(lastValue)}</em>
            </div>
          );
        })}
      </div>
      <button type="button" className="interactiveLineChartFit" onPointerDown={(event) => event.stopPropagation()} onClick={fitChart}>
        Fit
      </button>
      <svg className="interactiveLineChartSvg" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`${chartId}-raylaChartArea`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#7CC4FF" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#7CC4FF" stopOpacity="0" />
          </linearGradient>
          <filter id={`${chartId}-raylaLineGlow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {!minimal && yAxisLabels.map((value) => {
          const y = yForValue(value);
          return (
            <g key={`y-${value}`}>
              <line x1={plot.x} x2={plot.x + plot.width} y1={y} y2={y} className="interactiveLineChartGridLine" />
              <text x={plot.x + plot.width + 10} y={y + 4} className="interactiveLineChartYAxisLabel">
                {valueFormatter(value)}
              </text>
            </g>
          );
        })}
        {!minimal && xAxisLabels.map((label) => {
          const x = xForTime(label.timeMs);
          return (
            <g key={`${label.index}-${label.text}`}>
              <line x1={x} x2={x} y1={plot.y} y2={plot.y + plot.height} className="interactiveLineChartVerticalGridLine" />
              <text x={x} y={plot.y + plot.height + 23} textAnchor={label.anchor || "middle"} className="interactiveLineChartXAxisLabel">
                {label.text}
              </text>
            </g>
          );
        })}

        {renderedLines.map((line, index) => {
          if (line.coords.length < 2) return null;
          const areaPath = `${line.path} L ${line.coords[line.coords.length - 1].x} ${plot.y + plot.height} L ${line.coords[0].x} ${plot.y + plot.height} Z`;
          return (
            <g key={line.symbol}>
              {index === 0 ? <path d={areaPath} className="interactiveLineChartArea" fill={`url(#${chartId}-raylaChartArea)`} /> : null}
              <path d={line.path} className="interactiveLineChartLineGlow" stroke={line.color} filter={`url(#${chartId}-raylaLineGlow)`} />
              <path d={line.path} className="interactiveLineChartLine" stroke={line.color} />
            </g>
          );
        })}

        {lastCoord && !minimal ? (
          <g>
            <line x1={lastCoord.x} x2={plot.x + plot.width} y1={lastCoord.y} y2={lastCoord.y} className="interactiveLineChartLastGuide" />
            <rect x={plot.x + plot.width + 6} y={lastCoord.y - 11} width={54} height={20} rx={3} className="interactiveLineChartLastLabelBg" />
            <text x={plot.x + plot.width + 33} y={lastCoord.y + 4} textAnchor="middle" className="interactiveLineChartLastLabel">
              {valueFormatter(lastCoord.value)}
            </text>
          </g>
        ) : null}

        {hover && !minimal ? (
          <g>
            <line x1={hover.x} x2={hover.x} y1={plot.y} y2={plot.y + plot.height} className="interactiveLineChartHoverGuide" />
            <circle cx={hover.x} cy={hover.y} r="4" className="interactiveLineChartHoverPoint" />
          </g>
        ) : null}
      </svg>

      {hover && !minimal ? (
        <div
          className="interactiveLineChartTooltip"
          style={{
            left: clamp(hover.x, 72, Math.max(72, dimensions.width - 120)),
            top: clamp(hover.y - 62, 12, Math.max(12, dimensions.height - 90)),
          }}
        >
          <strong>{valueFormatter(hover.value)}</strong>
          <span>{formatLocalChartTime(hover.timeMs, domain, timeZone)}</span>
        </div>
      ) : null}

      {showLastPointPulse && lastCoord ? (
        <div
          className="interactiveLineChartPulsePoint"
          style={{
            left: lastCoord.x,
            top: lastCoord.y,
            background: primaryLine?.color || "#7CC4FF",
            boxShadow: `0 0 12px ${(primaryLine?.color || "#7CC4FF")}99`,
          }}
        />
      ) : null}
    </div>
  );
}
