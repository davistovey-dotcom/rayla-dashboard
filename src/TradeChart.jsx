import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
  LineStyle,
} from "lightweight-charts";

function timeToMs(time) {
  if (typeof time === "number") return time * 1000;
  if (typeof time === "string") return new Date(time).getTime();
  if (time && typeof time === "object" && "year" in time) {
    return Date.UTC(time.year, time.month - 1, time.day);
  }
  return NaN;
}

function formatChartTick(time, range, timeZone) {
  const valueMs = timeToMs(time);
  if (!Number.isFinite(valueMs)) return "";
  const date = new Date(valueMs);
  const baseOptions = timeZone ? { timeZone } : {};

  if (range === "15s" || range === "30s") {
    return "";
  }

  if (range === "1m" || range === "5m" || range === "15m" || range === "30m" || range === "1h" || range === "12h") {
    return date.toLocaleTimeString([], {
      ...baseOptions,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  if (range === "1D") {
    return date.toLocaleTimeString([], {
      ...baseOptions,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  if (range === "1W") {
    return date.toLocaleString([], {
      ...baseOptions,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  if (range === "1M" || range === "3M") {
    return date.toLocaleDateString([], {
      ...baseOptions,
      month: "short",
      day: "numeric",
    });
  }

  if (range === "1Y") {
    return date.toLocaleDateString([], {
      ...baseOptions,
      month: "short",
    });
  }

  if (range === "5Y") {
    return date.toLocaleDateString([], {
      ...baseOptions,
      year: "numeric",
      month: "short",
    });
  }

  return date.toLocaleDateString([], {
    ...baseOptions,
    year: "numeric",
  });
}

function formatCrosshairTime(time, range, timeZone) {
  const valueMs = timeToMs(time);
  if (!Number.isFinite(valueMs)) return "";
  const date = new Date(valueMs);
  const baseOptions = timeZone ? { timeZone } : {};

  if (range === "15s" || range === "30s") {
    return date.toLocaleString([], {
      ...baseOptions,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }

  if (range === "1m" || range === "5m" || range === "15m" || range === "30m" || range === "1h" || range === "12h" || range === "1D") {
    return date.toLocaleString([], {
      ...baseOptions,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  return date.toLocaleDateString([], {
    ...baseOptions,
    month: "short",
    day: "numeric",
    year: range === "MAX" || range === "5Y" || range === "1Y" ? "numeric" : undefined,
  });
}

export default function TradeChart({
  bars,
  mode,
  latestPrice,
  assetSymbol,
  assetName,
  height = "100%",
  chartRange = "1D",
  timeZone = undefined,
  interactive = false,
  zoomEnabled = false,
  autoFitOnDataChange = true,
  resetViewKey = "",
  visibleBarCount = null,
  rightOffsetBars = 0,
  minBarSpacing = null,
  showVolume = true,
  overlayLevels = [],
  annotations = [],
  drawingMode = "none",
  onChartClick = null,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const priceLineRef = useRef(null);
  const overlayLineRefs = useRef([]);
  const latestDataRef = useRef([]);
  const seriesModeRef = useRef(null);
  const volumeVisibilityRef = useRef(undefined);
  const lastResetViewKeyRef = useRef(undefined);
  const clickHandlerRef = useRef(onChartClick);
  const rangeRef = useRef(chartRange);
  rangeRef.current = chartRange;
  const [latestMarker, setLatestMarker] = useState(null);
  const [annotationLayout, setAnnotationLayout] = useState([]);
  clickHandlerRef.current = onChartClick;

  function syncAnnotationLayout(nextBars = latestDataRef.current) {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const container = containerRef.current;
    if (!chart || !series || !container || !Array.isArray(nextBars) || nextBars.length < 1) {
      setAnnotationLayout([]);
      return;
    }

    const nextLayout = (Array.isArray(annotations) ? annotations : [])
      .map((annotation) => {
        if (!annotation || !annotation.type) return null;
        const annotationType = annotation.type === "text" ? "note" : annotation.type;
        if (annotationType === "horizontal") {
          const y = series.priceToCoordinate(Number(annotation.price ?? annotation.points?.[0]?.price));
          if (!Number.isFinite(y)) return null;
          return { ...annotation, y };
        }

        if (annotationType === "trendline") {
          const startPoint = annotation.points?.[0] || {};
          const endPoint = annotation.points?.[1] || {};
          const x1 = chart.timeScale().timeToCoordinate(Number(annotation.startTime ?? startPoint.time));
          const y1 = series.priceToCoordinate(Number(annotation.startPrice ?? startPoint.price));
          const x2 = chart.timeScale().timeToCoordinate(Number(annotation.endTime ?? endPoint.time));
          const y2 = series.priceToCoordinate(Number(annotation.endPrice ?? endPoint.price));
          if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
          return { ...annotation, x1, y1, x2, y2 };
        }

        if (annotationType === "note") {
          const anchorPoint = annotation.points?.[0] || {};
          const x = chart.timeScale().timeToCoordinate(Number(annotation.time ?? anchorPoint.time));
          const y = series.priceToCoordinate(Number(annotation.price ?? anchorPoint.price));
          if (![x, y].every(Number.isFinite)) return null;
          return { ...annotation, x, y };
        }

        return null;
      })
      .filter(Boolean);

    setAnnotationLayout(nextLayout);
  }

  function syncLatestMarker(nextBars = latestDataRef.current) {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series || !Array.isArray(nextBars) || nextBars.length < 1) {
      setLatestMarker(null);
      return;
    }

    const lastBar = nextBars[nextBars.length - 1];
    const x = chart.timeScale().timeToCoordinate(lastBar._t);
    const resolvedPrice = Number.isFinite(latestPrice)
      ? Number(latestPrice)
      : Number(lastBar.close);
    const fallbackClosePrice = Number(lastBar.close);
    let y = series.priceToCoordinate(resolvedPrice);

    // In candlestick mode the live quote can sit slightly outside the visible
    // candle range, so keep the pulsing marker anchored to the latest candle
    // instead of disappearing.
    if (!Number.isFinite(y) && Number.isFinite(fallbackClosePrice)) {
      y = series.priceToCoordinate(fallbackClosePrice);
    }

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      setLatestMarker(null);
      return;
    }

    setLatestMarker({
      x,
      y,
      price: resolvedPrice,
    });
  }

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#7f8ea3",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(124,196,255,0.35)",
          style: LineStyle.Dashed,
          labelBackgroundColor: "#1e293b",
        },
        horzLine: {
          color: "rgba(124,196,255,0.35)",
          style: LineStyle.Dashed,
          labelBackgroundColor: "#1e293b",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        textColor: "#7f8ea3",
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      leftPriceScale: { visible: false },
      localization: {
        timeFormatter: (timestamp) => formatCrosshairTime(timestamp, rangeRef.current, timeZone),
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        textColor: "#7f8ea3",
        timeVisible: true,
        secondsVisible: rangeRef.current === "15s" || rangeRef.current === "30s",
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: Number.isFinite(rightOffsetBars) ? rightOffsetBars : 0,
        ...(Number.isFinite(minBarSpacing) && minBarSpacing > 0 ? { minBarSpacing, barSpacing: minBarSpacing } : {}),
        tickMarkFormatter: (time) => formatChartTick(time, rangeRef.current, timeZone),
      },
      handleScale: { mouseWheel: interactive || zoomEnabled, pinch: interactive || zoomEnabled },
      handleScroll: {
        mouseWheel: interactive,
        pressedMouseMove: interactive,
        horzTouchDrag: interactive,
        vertTouchDrag: false,
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    chartRef.current = chart;

    const ro = new ResizeObserver((entries) => {
      if (chartRef.current && entries[0]) {
        chartRef.current.applyOptions({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height,
        });
        requestAnimationFrame(() => {
          syncLatestMarker();
          syncAnnotationLayout();
        });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      try { chart.remove(); } catch (_) {}
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLineRef.current = null;
      overlayLineRefs.current = [];
      seriesModeRef.current = null;
      setAnnotationLayout([]);
    };
  }, [timeZone, interactive]);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      localization: {
        timeFormatter: (timestamp) => formatCrosshairTime(timestamp, rangeRef.current, timeZone),
      },
      timeScale: {
        secondsVisible: rangeRef.current === "15s" || rangeRef.current === "30s",
        rightOffset: Number.isFinite(rightOffsetBars) ? rightOffsetBars : 0,
        ...(Number.isFinite(minBarSpacing) && minBarSpacing > 0 ? { minBarSpacing, barSpacing: minBarSpacing } : {}),
        tickMarkFormatter: (time) => formatChartTick(time, rangeRef.current, timeZone),
      },
    });
  }, [chartRange, timeZone, rightOffsetBars, minBarSpacing]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !Array.isArray(bars) || bars.length < 2) return;

    const seen = new Set();
    const deduped = bars
      .map((b) => ({ ...b, _t: Math.floor(new Date(b.time).getTime() / 1000) }))
      .filter((b) => {
        if (!Number.isFinite(b._t) || !Number.isFinite(Number(b.close))) return false;
        if (seen.has(b._t)) return false;
        seen.add(b._t);
        return true;
      })
      .sort((a, b) => a._t - b._t);

    if (deduped.length < 2) {
      latestDataRef.current = [];
      setLatestMarker(null);
      return;
    }

    const shouldRecreateSeries = !seriesRef.current || seriesModeRef.current !== mode || volumeVisibilityRef.current !== showVolume;
    if (shouldRecreateSeries && seriesRef.current) {
      try { chart.removeSeries(seriesRef.current); } catch (_) {}
      try { chart.removeSeries(volumeSeriesRef.current); } catch (_) {}
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLineRef.current = null;
    }

    if (shouldRecreateSeries) {
      if (mode === "candlestick") {
        seriesRef.current = chart.addSeries(CandlestickSeries, {
          upColor: "#26a69a",
          downColor: "#ef5350",
          borderUpColor: "#26a69a",
          borderDownColor: "#ef5350",
          wickUpColor: "#26a69a",
          wickDownColor: "#ef5350",
          priceLineVisible: false,
          lastValueVisible: false,
        });
      } else {
        seriesRef.current = chart.addSeries(LineSeries, {
          color: "#60a5fa",
          lineWidth: 2,
          lineType: 2,
          lastPriceAnimation: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
      }

      if (showVolume) {
        volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
          priceFormat: {
            type: "volume",
          },
          priceScaleId: "volume",
          lastValueVisible: false,
          priceLineVisible: false,
        });
        chart.priceScale("volume").applyOptions({
          scaleMargins: {
            top: 0.82,
            bottom: 0,
          },
          borderVisible: false,
        });
      } else {
        volumeSeriesRef.current = null;
      }
      seriesModeRef.current = mode;
      volumeVisibilityRef.current = showVolume;
    }

    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(
        deduped.map((b, index) => {
          const open = Number(b.open ?? b.close);
          const close = Number(b.close);
          const prevClose = Number(deduped[index - 1]?.close ?? open);
          const isUp = mode === "candlestick" ? close >= open : close >= prevClose;
          return {
            time: b._t,
            value: Number(b.volume ?? 0),
            color: isUp ? "rgba(74,222,128,0.24)" : "rgba(248,113,113,0.24)",
          };
        })
      );
    }

    if (mode === "candlestick") {
      seriesRef.current.setData(
        deduped.map((b) => ({
          time: b._t,
          open: Number(b.open ?? b.close),
          high: Number(b.high ?? b.close),
          low: Number(b.low ?? b.close),
          close: Number(b.close),
        }))
      );
    } else {
      seriesRef.current.setData(
        deduped.map((b) => ({ time: b._t, value: Number(b.close) }))
      );
    }

    latestDataRef.current = deduped;
    const shouldResetView = lastResetViewKeyRef.current !== resetViewKey;
    if (Number.isFinite(visibleBarCount) && visibleBarCount > 0) {
      const from = Math.max(-0.5, deduped.length - visibleBarCount);
      const to = Math.max(from + 1, deduped.length - 1 + Math.max(0, rightOffsetBars));
      chart.timeScale().setVisibleLogicalRange({ from, to });
      lastResetViewKeyRef.current = resetViewKey;
    } else if (autoFitOnDataChange || shouldResetView) {
      chart.timeScale().fitContent();
      lastResetViewKeyRef.current = resetViewKey;
    }
    requestAnimationFrame(() => {
      syncLatestMarker(deduped);
      syncAnnotationLayout(deduped);
    });
  }, [bars, mode, chartRange, autoFitOnDataChange, resetViewKey, visibleBarCount, rightOffsetBars, showVolume]);

  useEffect(() => {
    const series = seriesRef.current;
    const resolvedPrice = Number.isFinite(latestPrice)
      ? latestPrice
      : Number(latestDataRef.current[latestDataRef.current.length - 1]?.close);
    if (!series || !Number.isFinite(resolvedPrice)) return;

    if (priceLineRef.current) {
      try { series.removePriceLine(priceLineRef.current); } catch (_) {}
    }

    priceLineRef.current = series.createPriceLine({
      price: resolvedPrice,
      color: "var(--rayla-blue)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: "",
    });
    requestAnimationFrame(() => {
      syncLatestMarker();
      syncAnnotationLayout();
    });
  }, [latestPrice, bars, mode]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    overlayLineRefs.current.forEach((line) => {
      try { series.removePriceLine(line); } catch (_) {}
    });
    overlayLineRefs.current = [];

    const validLevels = Array.isArray(overlayLevels)
      ? overlayLevels.filter((level) => Number.isFinite(Number(level?.price)))
      : [];

    validLevels.forEach((level) => {
      const line = series.createPriceLine({
        price: Number(level.price),
        color: level.color || "rgba(226,232,240,0.72)",
        lineWidth: Number(level.lineWidth) || 1,
        lineStyle: Number.isFinite(level.lineStyle) ? level.lineStyle : LineStyle.Dashed,
        axisLabelVisible: true,
        title: String(level.label || ""),
      });
      overlayLineRefs.current.push(line);
    });

    return () => {
      overlayLineRefs.current.forEach((line) => {
        try { series.removePriceLine(line); } catch (_) {}
      });
      overlayLineRefs.current = [];
    };
  }, [overlayLevels, bars, mode]);

  useEffect(() => {
    requestAnimationFrame(() => syncAnnotationLayout());
  }, [annotations, bars, mode, latestPrice, chartRange, drawingMode]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return undefined;

    const handleClick = (param) => {
      const callback = clickHandlerRef.current;
      if (!callback || !param?.point || !Number.isFinite(param.point.x) || !Number.isFinite(param.point.y) || param.time == null) {
        return;
      }

      const price = series.coordinateToPrice(param.point.y);
      const timeMs = timeToMs(param.time);
      const time = Number.isFinite(timeMs) ? Math.floor(timeMs / 1000) : Number(param.time);
      if (!Number.isFinite(price) || !Number.isFinite(time)) return;

      callback({
        time,
        price: Number(price),
        point: { x: Number(param.point.x), y: Number(param.point.y) },
      });
    };

    chart.subscribeClick(handleClick);
    return () => {
      chart.unsubscribeClick(handleClick);
    };
  }, [bars, mode]);

  const assetLabel = String(assetName || assetSymbol || "").trim();
  const resolvedLabelPrice = Number.isFinite(latestPrice)
    ? Number(latestPrice)
    : Number(latestMarker?.price);

  return (
    <div ref={containerRef} style={{ width: "100%", height, position: "relative" }}>
      {annotationLayout.length > 0 ? (
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 2 }}
          viewBox={`0 0 ${Math.max(1, containerRef.current?.clientWidth || 1)} ${Math.max(1, containerRef.current?.clientHeight || 1)}`}
          preserveAspectRatio="none"
        >
          {annotationLayout.map((annotation) => {
            const annotationType = annotation.type === "text" ? "note" : annotation.type;
            if (annotationType === "horizontal") {
              return (
                <g key={annotation.id}>
                  <line
                    x1="0"
                    y1={annotation.y}
                    x2={Math.max(1, containerRef.current?.clientWidth || 1)}
                    y2={annotation.y}
                    stroke={annotation.color || "rgba(248,250,252,0.7)"}
                    strokeWidth="1"
                    strokeDasharray="5 4"
                  />
                  <text
                    x="12"
                    y={Math.max(14, annotation.y - 6)}
                    fill={annotation.color || "#e2e8f0"}
                    fontSize="11"
                    fontWeight="700"
                  >
                    {annotation.label || annotation.text || "Line"}
                  </text>
                </g>
              );
            }

            if (annotationType === "trendline") {
              return (
                <g key={annotation.id}>
                  <line
                    x1={annotation.x1}
                    y1={annotation.y1}
                    x2={annotation.x2}
                    y2={annotation.y2}
                    stroke="rgba(124,196,255,0.82)"
                    strokeWidth="1.5"
                  />
                  <text
                    x={annotation.x2 + 8}
                    y={annotation.y2 - 6}
                    fill="#dbeafe"
                    fontSize="11"
                    fontWeight="700"
                  >
                    Trendline
                  </text>
                </g>
              );
            }

            if (annotationType === "note") {
              return (
                <g key={annotation.id}>
                  <circle cx={annotation.x} cy={annotation.y} r="4" fill="rgba(250,204,21,0.95)" />
                  <rect
                    x={annotation.x + 10}
                    y={Math.max(12, annotation.y - 28)}
                    width={Math.max(76, String(annotation.text || "").length * 7.2)}
                    height="22"
                    rx="8"
                    fill="rgba(15,23,42,0.94)"
                    stroke="rgba(250,204,21,0.38)"
                  />
                  <text
                    x={annotation.x + 18}
                    y={Math.max(26, annotation.y - 13)}
                    fill="#fef3c7"
                    fontSize="11"
                    fontWeight="600"
                  >
                    {annotation.text}
                  </text>
                </g>
              );
            }

            return null;
          })}
        </svg>
      ) : null}
      {assetLabel ? (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 12,
            zIndex: 4,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#e2e8f0",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.01em",
            pointerEvents: "none",
          }}
        >
          <span>{assetLabel}</span>
          {Number.isFinite(resolvedLabelPrice) ? (
            <span style={{ color: "#93c5fd", fontWeight: 700 }}>
              ${resolvedLabelPrice.toLocaleString(undefined, {
                minimumFractionDigits: resolvedLabelPrice >= 100 ? 2 : resolvedLabelPrice >= 1 ? 3 : 5,
                maximumFractionDigits: resolvedLabelPrice >= 100 ? 2 : resolvedLabelPrice >= 1 ? 3 : 5,
              })}
            </span>
          ) : null}
        </div>
      ) : null}
      {latestMarker ? (
        <>
          <div
            className="tradeChartPulse"
            style={{
              left: latestMarker.x,
              top: latestMarker.y,
              zIndex: 3,
            }}
          />
          <div
            className="tradeChartDot"
            style={{
              left: latestMarker.x,
              top: latestMarker.y,
              zIndex: 4,
            }}
          />
          <div
            className="tradeChartPriceTag"
            style={{
              top: latestMarker.y,
            }}
          >
            ${latestMarker.price.toFixed(latestMarker.price >= 100 ? 2 : latestMarker.price >= 1 ? 3 : 5)}
          </div>
        </>
      ) : null}
    </div>
  );
}
