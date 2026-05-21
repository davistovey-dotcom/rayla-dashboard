import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CrosshairMode,
  LineSeries,
  LineStyle,
} from "lightweight-charts";

function timeToSeconds(value) {
  const ms = Date.parse(String(value || ""));
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

function formatUsd(value) {
  if (!Number.isFinite(Number(value))) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatPct(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return "--";
  const numeric = Number(value);
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(digits)}%`;
}

function formatAxisPct(value) {
  if (!Number.isFinite(Number(value))) return "";
  const numeric = Number(value);
  const digits = Math.abs(numeric) >= 10 ? 0 : Math.abs(numeric) >= 1 ? 1 : 2;
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(digits)}%`;
}

function formatTimeTick(time, chartRange, spanMs) {
  const valueMs = typeof time === "number" ? time * 1000 : Date.parse(String(time || ""));
  if (!Number.isFinite(valueMs)) return "";
  const date = new Date(valueMs);

  if (chartRange === "1D") {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  if (chartRange === "1W") {
    return date.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  if (chartRange === "1M" || chartRange === "3M") {
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  }

  if (chartRange === "1Y") {
    return date.toLocaleDateString([], {
      month: "short",
    });
  }

  if (chartRange === "5Y") {
    return date.toLocaleDateString([], {
      month: "short",
      year: "2-digit",
    });
  }

  if (chartRange === "ALL") {
    if (spanMs > 5 * 365 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString([], { year: "numeric" });
    }
    if (spanMs > 365 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString([], {
        month: "short",
        year: "numeric",
      });
    }
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  }

  return date.toLocaleDateString([], {
    month: "short",
    year: "numeric",
  });
}

function findNearestPoint(points, targetSeconds) {
  if (!Array.isArray(points) || !points.length || !Number.isFinite(targetSeconds)) return null;
  let nearest = points[0];
  let nearestDistance = Math.abs((nearest?.time ?? 0) - targetSeconds);
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    const distance = Math.abs((point?.time ?? 0) - targetSeconds);
    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function normalizeLineSeriesData(points) {
  let previousTime = null;
  return (Array.isArray(points) ? points : [])
    .filter((point) => Number.isFinite(Number(point?.time)) && Number.isFinite(Number(point?.value)))
    .sort((a, b) => Number(a.time) - Number(b.time))
    .map((point) => {
      let nextTime = Number(point.time);
      if (previousTime != null && nextTime <= previousTime) {
        nextTime = previousTime + 1;
      }
      previousTime = nextTime;
      return {
        ...point,
        time: nextTime,
      };
    });
}

function readBenchmarkPointValue(point) {
  const value = Number(point?.equity ?? point?.value);
  return Number.isFinite(value) ? value : null;
}

function readBenchmarkPointPctChange(point, baselineValue = null) {
  const pctChange = Number(point?.pctChange);
  if (Number.isFinite(pctChange)) return pctChange;

  const value = readBenchmarkPointValue(point);
  if (!Number.isFinite(value) || !Number.isFinite(baselineValue) || baselineValue <= 0) {
    return null;
  }

  return ((value - baselineValue) / baselineValue) * 100;
}

export default function EquityComparisonChart({
  equityPoints,
  benchmarkPoints,
  benchmarkSymbol,
  benchmarkLabel,
  chartRange,
  benchmarkLoading,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const equitySeriesRef = useRef(null);
  const benchmarkSeriesRef = useRef(null);
  const anchorSeriesRef = useRef(null);
  const [hoveredData, setHoveredData] = useState(null);
  const rangeRef = useRef(chartRange);
  rangeRef.current = chartRange;

  const equityValues = useMemo(
    () => (Array.isArray(equityPoints) ? equityPoints : [])
      .map((point) => {
        const time = timeToSeconds(point?.time);
        const equityValue = Number(point?.equity ?? point?.value);
        return Number.isFinite(time) && Number.isFinite(equityValue)
          ? { time, equityValue, raw: point }
          : null;
      })
      .filter(Boolean),
    [equityPoints]
  );

  const equityBaseline = Number(equityValues[0]?.equityValue);
  const equityReturnData = useMemo(
    () => equityValues.map((point) => ({
      time: point.time,
      value: Number.isFinite(equityBaseline) && equityBaseline > 0
        ? ((point.equityValue - equityBaseline) / equityBaseline) * 100
        : 0,
      equityValue: point.equityValue,
      raw: point.raw,
    })),
    [equityValues, equityBaseline]
  );

  const rawBenchmarkValues = useMemo(
    () => (Array.isArray(benchmarkPoints) ? benchmarkPoints : [])
      .map((point) => {
        const time = timeToSeconds(point?.time);
        const benchmarkValue = readBenchmarkPointValue(point);
        return Number.isFinite(time) && Number.isFinite(benchmarkValue)
          ? { time, benchmarkValue, raw: point }
          : null;
      })
      .filter(Boolean),
    [benchmarkPoints]
  );

  const benchmarkBaseline = Number(rawBenchmarkValues[0]?.benchmarkValue);
  const benchmarkReturnData = useMemo(
    () => rawBenchmarkValues.map((point) => ({
      time: point.time,
      value: readBenchmarkPointPctChange(point.raw, benchmarkBaseline),
      benchmarkValue: point.benchmarkValue,
      raw: point.raw,
    })).filter((point) => Number.isFinite(point.value)),
    [rawBenchmarkValues, benchmarkBaseline]
  );

  const allTimes = [
    ...equityReturnData.map((point) => point.time),
    ...benchmarkReturnData.map((point) => point.time),
  ].filter(Number.isFinite);
  const spanMs = allTimes.length > 1
    ? Math.max(...allTimes) * 1000 - Math.min(...allTimes) * 1000
    : 0;

  const domainBounds = useMemo(() => {
    if (!allTimes.length) return null;
    const end = Math.max(...allTimes);
    const actualStart = Math.min(...allTimes);
    const day = 24 * 60 * 60;
    if (chartRange === "1D") return { start: end - day, end };
    if (chartRange === "1W") return { start: end - (7 * day), end };
    if (chartRange === "1M") return { start: end - (30 * day), end };
    if (chartRange === "3M") return { start: end - (90 * day), end };
    return { start: actualStart, end };
  }, [allTimes, chartRange]);

  const anchorData = useMemo(() => {
    if (!domainBounds) return [];
    const span = Math.max(1, domainBounds.end - domainBounds.start);
    const count = chartRange === "1D"
      ? 7
      : chartRange === "1W"
        ? 8
        : chartRange === "1M"
          ? 7
          : chartRange === "3M"
            ? 7
            : 6;
    return Array.from({ length: count }, (_, index) => ({
      time: Math.floor(domainBounds.start + ((span * index) / Math.max(1, count - 1))),
      value: 0,
    }));
  }, [chartRange, domainBounds]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#7f8ea3",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.045)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(124,196,255,0.22)",
          style: LineStyle.Dashed,
          width: 1,
          labelVisible: false,
        },
        horzLine: {
          color: "rgba(124,196,255,0.18)",
          style: LineStyle.Dashed,
          width: 1,
          labelVisible: false,
        },
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      rightPriceScale: {
        visible: true,
        borderColor: "rgba(255,255,255,0.08)",
        scaleMargins: { top: 0.14, bottom: 0.1 },
      },
      leftPriceScale: {
        visible: false,
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 0,
        barSpacing: 12,
        minBarSpacing: 6,
        tickMarkFormatter: (time) => formatTimeTick(time, rangeRef.current, spanMs),
      },
      localization: {
        priceFormatter: formatAxisPct,
      },
      handleScale: { mouseWheel: false, pinch: false },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: false,
        horzTouchDrag: false,
        vertTouchDrag: false,
      },
    });

    chartRef.current = chart;
    equitySeriesRef.current = chart.addSeries(LineSeries, {
      color: "#7CC4FF",
      lineWidth: 3,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      priceFormat: {
        type: "custom",
        minMove: 0.01,
        formatter: formatAxisPct,
      },
    });
    benchmarkSeriesRef.current = chart.addSeries(LineSeries, {
      color: "#A78BFA",
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      priceFormat: {
        type: "custom",
        minMove: 0.01,
        formatter: formatAxisPct,
      },
    });
    anchorSeriesRef.current = chart.addSeries(LineSeries, {
      color: "rgba(0,0,0,0)",
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });

    const handleCrosshairMove = (param) => {
      if (!param?.time || !param?.point) {
        setHoveredData(null);
        return;
      }

      const hoveredTime = typeof param.time === "number"
        ? param.time
        : timeToSeconds(param.time);
      if (!Number.isFinite(hoveredTime)) {
        setHoveredData(null);
        return;
      }

      const equityPoint = findNearestPoint(equityReturnData, hoveredTime);
      const benchmarkPoint = findNearestPoint(benchmarkReturnData, hoveredTime);
      if (!equityPoint && !benchmarkPoint) {
        setHoveredData(null);
        return;
      }

      const resolvedTime = equityPoint?.time || benchmarkPoint?.time || hoveredTime;
      const yourReturnPct = Number(equityPoint?.value);
      const benchmarkReturnPct = Number(benchmarkPoint?.value);
      setHoveredData({
        time: resolvedTime,
        dateLabel: new Date(resolvedTime * 1000).toLocaleString([], {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: chartRange === "1D" ? "numeric" : undefined,
          minute: chartRange === "1D" ? "2-digit" : undefined,
        }),
        yourReturnPct: Number.isFinite(yourReturnPct) ? yourReturnPct : null,
        benchmarkReturnPct: Number.isFinite(benchmarkReturnPct) ? benchmarkReturnPct : null,
        yourEquity: Number.isFinite(Number(equityPoint?.equityValue)) ? Number(equityPoint.equityValue) : null,
      });
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: rect.width,
        height: rect.height,
      });
      chartRef.current.timeScale().fitContent();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      try {
        chart.remove();
      } catch (_) {
        // no-op
      }
      chartRef.current = null;
      equitySeriesRef.current = null;
      benchmarkSeriesRef.current = null;
      anchorSeriesRef.current = null;
    };
  }, [benchmarkReturnData, chartRange, equityReturnData, spanMs]);

  useEffect(() => {
    if (!chartRef.current || !equitySeriesRef.current) return;

    equitySeriesRef.current.setData(normalizeLineSeriesData(equityReturnData.map((point) => ({
      time: point.time,
      value: point.value,
    }))));
    benchmarkSeriesRef.current?.setData(normalizeLineSeriesData(benchmarkReturnData.map((point) => ({
      time: point.time,
      value: point.value,
    }))));
    anchorSeriesRef.current?.setData(normalizeLineSeriesData(anchorData));

    chartRef.current.timeScale().fitContent();
    if (domainBounds) {
      chartRef.current.timeScale().setVisibleRange({
        from: domainBounds.start,
        to: domainBounds.end,
      });
    }
  }, [anchorData, benchmarkReturnData, domainBounds, equityReturnData]);

  const fallbackPoint = hoveredData || (() => {
    const lastEquity = equityReturnData[equityReturnData.length - 1] || null;
    const lastBenchmark = benchmarkReturnData[benchmarkReturnData.length - 1] || null;
    if (!lastEquity && !lastBenchmark) return null;
    const resolvedTime = lastEquity?.time || lastBenchmark?.time || null;
    if (!Number.isFinite(resolvedTime)) return null;
    return {
      time: resolvedTime,
      dateLabel: new Date(resolvedTime * 1000).toLocaleString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      yourReturnPct: Number(lastEquity?.value),
      benchmarkReturnPct: Number(lastBenchmark?.value),
      yourEquity: Number(lastEquity?.equityValue),
    };
  })();

  const differencePct = fallbackPoint
    && Number.isFinite(fallbackPoint.yourReturnPct)
    && Number.isFinite(fallbackPoint.benchmarkReturnPct)
      ? fallbackPoint.yourReturnPct - fallbackPoint.benchmarkReturnPct
      : null;
  const resolvedBenchmarkLabel = benchmarkLabel || benchmarkSymbol;
  const wrapStyle = {
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: 280,
    borderRadius: 14,
    overflow: "hidden",
    background:
      "radial-gradient(circle at top left, rgba(124,196,255,0.08), transparent 42%), linear-gradient(180deg, rgba(13,17,23,0.92), rgba(15,23,34,0.98))",
    border: "1px solid rgba(255,255,255,0.06)",
  };
  const canvasStyle = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  };
  const tooltipStyle = {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 3,
    maxWidth: "min(280px, calc(100% - 24px))",
    padding: "12px 14px",
    borderRadius: 14,
    background: "rgba(9,13,20,0.9)",
    border: "1px solid rgba(124,196,255,0.14)",
    boxShadow: "0 14px 34px rgba(2,6,23,0.22)",
    backdropFilter: "blur(10px)",
    display: "flex",
    flexDirection: "column",
    gap: 7,
    pointerEvents: "none",
  };
  const legendStyle = {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 10,
    zIndex: 2,
    display: "flex",
    flexWrap: "wrap",
    gap: "10px 14px",
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(8,12,18,0.72)",
    border: "1px solid rgba(255,255,255,0.06)",
    pointerEvents: "none",
  };
  const legendItemStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 11,
    fontWeight: 700,
    color: "#cbd5e1",
    letterSpacing: "0.03em",
    textTransform: "uppercase",
  };
  const legendLineBaseStyle = {
    width: 18,
    height: 0,
    borderTopWidth: 2,
    borderTopStyle: "solid",
    borderRadius: 999,
    flexShrink: 0,
  };

  return (
    <div style={wrapStyle}>
      <div ref={containerRef} style={canvasStyle} />
      {fallbackPoint ? (
        <div style={tooltipStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fbff" }}>{fallbackPoint.dateLabel}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#7cc4ff", letterSpacing: "-0.02em" }}>
            {fallbackPoint.yourReturnPct == null ? "--" : formatPct(fallbackPoint.yourReturnPct)}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 12, lineHeight: 1.5, color: "#cbd5e1" }}>
            <span style={{ color: "#8ea0b8" }}>Your return</span>
            <strong style={{ color: "#7cc4ff", fontWeight: 700, textAlign: "right" }}>{fallbackPoint.yourReturnPct == null ? "--" : formatPct(fallbackPoint.yourReturnPct)}</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 12, lineHeight: 1.5, color: "#cbd5e1" }}>
            <span style={{ color: "#8ea0b8" }}>{`${resolvedBenchmarkLabel} return`}</span>
            <strong style={{ color: "#a78bfa", fontWeight: 700, textAlign: "right" }}>{fallbackPoint.benchmarkReturnPct == null ? "--" : formatPct(fallbackPoint.benchmarkReturnPct)}</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 12, lineHeight: 1.5, color: "#cbd5e1" }}>
            <span style={{ color: "#8ea0b8" }}>Difference</span>
            <strong style={{ color: "#e2e8f0", fontWeight: 700, textAlign: "right" }}>{differencePct == null ? "--" : formatPct(differencePct)}</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 12, lineHeight: 1.5, color: "#cbd5e1" }}>
            <span style={{ color: "#8ea0b8" }}>Your equity</span>
            <strong style={{ color: "#7be495", fontWeight: 700, textAlign: "right" }}>{fallbackPoint.yourEquity == null ? "--" : formatUsd(fallbackPoint.yourEquity)}</strong>
          </div>
        </div>
      ) : null}
      <div style={legendStyle}>
        <span style={legendItemStyle}>
          <span style={{ ...legendLineBaseStyle, borderTopColor: "#7cc4ff" }} />
          Your Return %
        </span>
        <span style={legendItemStyle}>
          <span style={{ ...legendLineBaseStyle, borderTopColor: "#a78bfa", borderTopStyle: "dashed" }} />
          {`${resolvedBenchmarkLabel} Return %`}
        </span>
        {benchmarkLoading ? <span style={{ marginLeft: "auto", fontSize: 11, color: "#8ea0b8" }}>Loading benchmark...</span> : null}
      </div>
    </div>
  );
}
