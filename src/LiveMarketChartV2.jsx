import { useEffect, useRef } from "react";
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

function formatTick(time, range, timeZone) {
  const valueMs = timeToMs(time);
  if (!Number.isFinite(valueMs)) return "";
  const date = new Date(valueMs);
  const baseOptions = timeZone ? { timeZone } : {};

  if (range === "15s" || range === "30s") {
    return "";
  }

  if (range === "1m" || range === "5m" || range === "15m" || range === "30m" || range === "1h" || range === "12h" || range === "1D") {
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
      month: "short",
      year: "numeric",
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

function normalizeBars(bars) {
  if (!Array.isArray(bars)) return [];
  const seen = new Set();
  return bars
    .map((bar) => {
      const time = Math.floor(new Date(bar.time).getTime() / 1000);
      const open = Number(bar.open ?? bar.close);
      const high = Number(bar.high ?? bar.close);
      const low = Number(bar.low ?? bar.close);
      const close = Number(bar.close);
      const volume = Number(bar.volume ?? 0);
      if (!Number.isFinite(time) || !Number.isFinite(close)) return null;
      return {
        time,
        open,
        high,
        low,
        close,
        volume: Number.isFinite(volume) ? volume : 0,
      };
    })
    .filter(Boolean)
    .filter((bar) => {
      if (seen.has(bar.time)) return false;
      seen.add(bar.time);
      return true;
    })
    .sort((a, b) => a.time - b.time);
}

function sameBar(a, b) {
  return a
    && b
    && a.time === b.time
    && a.open === b.open
    && a.high === b.high
    && a.low === b.low
    && a.close === b.close
    && a.volume === b.volume;
}

function buildVolumePoint(bar, previousClose, mode) {
  const isUp = mode === "candlestick" ? bar.close >= bar.open : bar.close >= previousClose;
  return {
    time: bar.time,
    value: bar.volume,
    color: isUp ? "rgba(74,222,128,0.42)" : "rgba(248,113,113,0.42)",
  };
}

export default function LiveMarketChartV2({
  bars,
  mode = "candlestick",
  latestPrice,
  assetSymbol,
  assetName,
  height = "100%",
  chartRange = "1D",
  timeZone = "America/Denver",
  interactive = true,
  resetViewKey = "",
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const priceSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const seriesModeRef = useRef(null);
  const lastBarsRef = useRef([]);
  const priceLineRef = useRef(null);
  const lastResetViewKeyRef = useRef("");
  const latestPriceRef = useRef(latestPrice);
  latestPriceRef.current = latestPrice;

  const assetLabel = String(assetName || assetSymbol || "").trim();

  function rebuildSeries(nextMode) {
    const chart = chartRef.current;
    if (!chart) return;

    if (priceSeriesRef.current) {
      try { chart.removeSeries(priceSeriesRef.current); } catch (_) {}
    }
    if (volumeSeriesRef.current) {
      try { chart.removeSeries(volumeSeriesRef.current); } catch (_) {}
    }
    priceSeriesRef.current = null;
    volumeSeriesRef.current = null;
    priceLineRef.current = null;

    if (nextMode === "candlestick") {
      priceSeriesRef.current = chart.addSeries(CandlestickSeries, {
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
      priceSeriesRef.current = chart.addSeries(LineSeries, {
        color: "#60a5fa",
        lineWidth: 2,
        lineType: 2,
        lastPriceAnimation: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
    }

    volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: {
        top: 0.78,
        bottom: 0,
      },
      borderVisible: false,
    });
    seriesModeRef.current = nextMode;
  }

  function setLatestPriceLine() {
    const series = priceSeriesRef.current;
    const normalized = lastBarsRef.current;
    const resolved = Number.isFinite(latestPriceRef.current)
      ? Number(latestPriceRef.current)
      : Number(normalized[normalized.length - 1]?.close);
    if (!series || !Number.isFinite(resolved)) return;

    if (priceLineRef.current) {
      try { series.removePriceLine(priceLineRef.current); } catch (_) {}
    }

    priceLineRef.current = series.createPriceLine({
      price: resolved,
      color: "var(--rayla-blue)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: "",
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
        timeFormatter: (timestamp) => formatCrosshairTime(timestamp, chartRange, timeZone),
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        textColor: "#7f8ea3",
        timeVisible: true,
        secondsVisible: chartRange === "15s" || chartRange === "30s",
        fixLeftEdge: true,
        fixRightEdge: true,
        tickMarkFormatter: (time) => formatTick(time, chartRange, timeZone),
      },
      handleScale: false,
      handleScroll: false,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    chartRef.current = chart;
    rebuildSeries(mode);

    const ro = new ResizeObserver((entries) => {
      if (chartRef.current && entries[0]) {
        chartRef.current.applyOptions({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height,
        });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      try { chart.remove(); } catch (_) {}
      chartRef.current = null;
      priceSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLineRef.current = null;
      lastBarsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      localization: {
        timeFormatter: (timestamp) => formatCrosshairTime(timestamp, chartRange, timeZone),
      },
      timeScale: {
        secondsVisible: chartRange === "15s" || chartRange === "30s",
        tickMarkFormatter: (time) => formatTick(time, chartRange, timeZone),
      },
    });
  }, [chartRange, timeZone]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const normalized = normalizeBars(bars);
    if (normalized.length < 2) return;

    if (!priceSeriesRef.current || !volumeSeriesRef.current || seriesModeRef.current !== mode) {
      rebuildSeries(mode);
      lastBarsRef.current = [];
    }

    const series = priceSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const previous = lastBarsRef.current;
    const shouldResetView = lastResetViewKeyRef.current !== resetViewKey;
    const scopeChanged = previous.length === 0;

    let canIncrementallyUpdate = previous.length >= 1 && normalized.length >= previous.length;
    if (canIncrementallyUpdate) {
      for (let index = 0; index < previous.length - 1; index += 1) {
        if (!sameBar(previous[index], normalized[index])) {
          canIncrementallyUpdate = false;
          break;
        }
      }
    }

    if (!canIncrementallyUpdate || scopeChanged || shouldResetView) {
      if (mode === "candlestick") {
        series.setData(normalized.map((bar) => ({
          time: bar.time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        })));
      } else {
        series.setData(normalized.map((bar) => ({
          time: bar.time,
          value: bar.close,
        })));
      }

      volumeSeries.setData(normalized.map((bar, index) => buildVolumePoint(bar, Number(normalized[index - 1]?.close ?? bar.open), mode)));
      chart.timeScale().fitContent();
    } else {
      const startIndex = Math.max(0, previous.length - 1);
      for (let index = startIndex; index < normalized.length; index += 1) {
        const bar = normalized[index];
        if (mode === "candlestick") {
          series.update({
            time: bar.time,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
          });
        } else {
          series.update({
            time: bar.time,
            value: bar.close,
          });
        }
        volumeSeries.update(buildVolumePoint(bar, Number(normalized[index - 1]?.close ?? bar.open), mode));
      }
    }

    lastBarsRef.current = normalized;
    lastResetViewKeyRef.current = resetViewKey;
    setLatestPriceLine();
  }, [bars, mode, resetViewKey]);

  useEffect(() => {
    setLatestPriceLine();
  }, [latestPrice]);

  const resolvedLabelPrice = Number.isFinite(latestPrice)
    ? Number(latestPrice)
    : Number(lastBarsRef.current[lastBarsRef.current.length - 1]?.close);

  return (
    <div ref={containerRef} style={{ width: "100%", height, position: "relative" }}>
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
    </div>
  );
}
