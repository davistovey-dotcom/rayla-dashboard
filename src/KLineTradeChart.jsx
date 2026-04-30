import { useEffect, useRef, useState } from "react";
import { dispose, init } from "klinecharts";

function formatTick(timestamp, range, timeZone) {
  if (!Number.isFinite(timestamp)) return "";
  const date = new Date(timestamp);
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

function formatCrosshair(timestamp, range, timeZone) {
  if (!Number.isFinite(timestamp)) return "";
  const date = new Date(timestamp);
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
      const timestamp = Date.parse(String(bar?.time || ""));
      const open = Number(bar?.open);
      const high = Number(bar?.high);
      const low = Number(bar?.low);
      const close = Number(bar?.close);
      const volume = Number(bar?.volume ?? 0);
      if (!Number.isFinite(timestamp) || !Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
        return null;
      }
      return {
        timestamp,
        open,
        high,
        low,
        close,
        volume: Number.isFinite(volume) ? volume : 0,
      };
    })
    .filter(Boolean)
    .filter((bar) => {
      if (seen.has(bar.timestamp)) return false;
      seen.add(bar.timestamp);
      return true;
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

function sameBar(a, b) {
  return a
    && b
    && a.timestamp === b.timestamp
    && a.open === b.open
    && a.high === b.high
    && a.low === b.low
    && a.close === b.close
    && a.volume === b.volume;
}

function applyNewData(chart, bars) {
  const store = chart?.getChartStore?.();
  if (!store?._addData) return false;
  store._addData(bars, "init");
  return true;
}

function updateData(chart, bar) {
  const store = chart?.getChartStore?.();
  if (!store?._addData) return false;
  store._addData(bar);
  return true;
}

export default function KLineTradeChart({
  bars,
  mode,
  latestPrice,
  assetSymbol,
  assetName,
  height = "100%",
  chartRange = "1D",
  timeZone = "America/Denver",
  resetViewKey = "",
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const lastBarsRef = useRef([]);
  const lastResetViewKeyRef = useRef("");
  const [priceMarker, setPriceMarker] = useState(null);

  const assetLabel = String(assetName || assetSymbol || "").trim();
  const resolvedDisplayPrice = Number.isFinite(latestPrice)
    ? Number(latestPrice)
    : Number(lastBarsRef.current[lastBarsRef.current.length - 1]?.close);

  function syncPriceMarker() {
    const chart = chartRef.current;
    const normalized = lastBarsRef.current;
    const lastBar = normalized[normalized.length - 1];
    const displayPrice = Number.isFinite(latestPrice)
      ? Number(latestPrice)
      : Number(lastBar?.close);

    if (!chart || !lastBar || !Number.isFinite(displayPrice)) {
      setPriceMarker(null);
      return;
    }

    const coordinate = chart.convertToPixel({ timestamp: lastBar.timestamp, value: displayPrice });
    const y = Number(coordinate?.y);
    if (!Number.isFinite(y)) {
      setPriceMarker(null);
      return;
    }

    setPriceMarker({
      y,
      price: displayPrice,
    });
  }

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = init(containerRef.current, {
      locale: "en-US",
      styles: {
        grid: {
          horizontal: { show: true, size: 1, color: "rgba(255,255,255,0.04)", style: "solid", dashedValue: [2, 2] },
          vertical: { show: true, size: 1, color: "rgba(255,255,255,0.04)", style: "solid", dashedValue: [2, 2] },
        },
        candle: {
          type: mode === "line" ? "area" : "candle_solid",
          priceMark: {
            last: {
              show: false,
            },
          },
          bar: {
            upColor: "#26a69a",
            downColor: "#ef5350",
            noChangeColor: "#60a5fa",
            compareRule: "previous_close",
            upBorderColor: "#26a69a",
            downBorderColor: "#ef5350",
            noChangeBorderColor: "#60a5fa",
            upWickColor: "#26a69a",
            downWickColor: "#ef5350",
            noChangeWickColor: "#60a5fa",
          },
          area: {
            lineSize: 2,
            lineColor: "#60a5fa",
            value: "close",
            smooth: false,
            backgroundColor: [
              { offset: 0, color: "rgba(96,165,250,0.18)" },
              { offset: 1, color: "rgba(96,165,250,0.02)" },
            ],
            point: {
              show: false,
              color: "#60a5fa",
              radius: 3,
              rippleColor: "rgba(96,165,250,0.2)",
              rippleRadius: 6,
              animation: false,
              animationDuration: 0,
            },
          },
        },
        xAxis: {
          axisLine: { show: true, color: "rgba(255,255,255,0.08)", size: 1 },
          tickLine: { show: false, color: "rgba(255,255,255,0.08)", size: 1, length: 4 },
          tickText: { show: true, color: "#7f8ea3", size: 11, family: "inherit", weight: 400, marginStart: 6, marginEnd: 6 },
        },
        yAxis: {
          axisLine: { show: true, color: "rgba(255,255,255,0.08)", size: 1 },
          tickLine: { show: false, color: "rgba(255,255,255,0.08)", size: 1, length: 4 },
          tickText: { show: true, color: "#7f8ea3", size: 11, family: "inherit", weight: 400, marginStart: 6, marginEnd: 6 },
        },
        separator: {
          size: 1,
          color: "rgba(255,255,255,0.04)",
          fill: true,
          activeBackgroundColor: "rgba(255,255,255,0.04)",
        },
        crosshair: {
          show: true,
          horizontal: {
            show: true,
            line: { show: true, style: "dashed", size: 1, color: "rgba(124,196,255,0.35)", dashedValue: [4, 4] },
            text: {
              show: true,
              color: "#e2e8f0",
              size: 11,
              family: "inherit",
              weight: 500,
              borderStyle: "solid",
              borderDashedValue: [2, 2],
              borderSize: 1,
              borderColor: "#1e293b",
              borderRadius: 6,
              backgroundColor: "#1e293b",
              paddingLeft: 6,
              paddingTop: 4,
              paddingRight: 6,
              paddingBottom: 4,
            },
            features: [],
          },
          vertical: {
            show: true,
            line: { show: true, style: "dashed", size: 1, color: "rgba(124,196,255,0.35)", dashedValue: [4, 4] },
            text: {
              show: true,
              color: "#e2e8f0",
              size: 11,
              family: "inherit",
              weight: 500,
              borderStyle: "solid",
              borderDashedValue: [2, 2],
              borderSize: 1,
              borderColor: "#1e293b",
              borderRadius: 6,
              backgroundColor: "#1e293b",
              paddingLeft: 6,
              paddingTop: 4,
              paddingRight: 6,
              paddingBottom: 4,
            },
          },
        },
      },
    });

    chartRef.current = chart;
    chart.setTimezone(timeZone);
    chart.setZoomEnabled(true);
    chart.setScrollEnabled(true);
    chart.setRightMinVisibleBarCount(2);
    chart.setLeftMinVisibleBarCount(2);
    chart.setOffsetRightDistance(12);
    chart.setFormatter({
      formatDate: ({ timestamp, type }) => {
        if (type === "xAxis") {
          return formatTick(timestamp, chartRange, timeZone);
        }
        return formatCrosshair(timestamp, chartRange, timeZone);
      },
    });

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
      requestAnimationFrame(() => syncPriceMarker());
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (containerRef.current) {
        dispose(containerRef.current);
      }
      chartRef.current = null;
      lastBarsRef.current = [];
      lastResetViewKeyRef.current = "";
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setTimezone(timeZone);
    chart.setFormatter({
      formatDate: ({ timestamp, type }) => {
        if (type === "xAxis") {
          return formatTick(timestamp, chartRange, timeZone);
        }
        return formatCrosshair(timestamp, chartRange, timeZone);
      },
    });
  }, [chartRange, timeZone]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setStyles({
      candle: {
        type: mode === "line" ? "area" : "candle_solid",
      },
    });
  }, [mode]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const normalized = normalizeBars(bars);
    if (normalized.length < 2) return;

    const previous = lastBarsRef.current;
    const shouldResetView = lastResetViewKeyRef.current !== resetViewKey;
    const shouldApplyNewData = previous.length < 2 || shouldResetView || normalized.length < previous.length;

    if (shouldApplyNewData) {
      applyNewData(chart, normalized);
      chart.scrollToRealTime();
    } else {
      let canIncrementallyUpdate = normalized.length >= previous.length;
      if (canIncrementallyUpdate) {
        for (let index = 0; index < previous.length - 1; index += 1) {
          if (!sameBar(previous[index], normalized[index])) {
            canIncrementallyUpdate = false;
            break;
          }
        }
      }

      if (!canIncrementallyUpdate) {
        applyNewData(chart, normalized);
        chart.scrollToRealTime();
      } else {
        for (let index = Math.max(0, previous.length - 1); index < normalized.length; index += 1) {
          updateData(chart, normalized[index]);
        }
      }
    }

    if (Number.isFinite(latestPrice)) {
      chart.setSymbol({ ticker: assetSymbol, shortName: assetName || assetSymbol, pricePrecision: latestPrice >= 100 ? 2 : latestPrice >= 1 ? 3 : 5, volumePrecision: 2 });
    }

    lastBarsRef.current = normalized;
    lastResetViewKeyRef.current = resetViewKey;
    requestAnimationFrame(() => syncPriceMarker());
  }, [bars, latestPrice, assetSymbol, assetName, resetViewKey]);

  useEffect(() => {
    requestAnimationFrame(() => syncPriceMarker());
  }, [latestPrice]);

  return (
    <div style={{ width: "100%", height, position: "relative" }}>
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
          {Number.isFinite(resolvedDisplayPrice) ? (
            <span style={{ color: "#93c5fd", fontWeight: 700 }}>
              ${resolvedDisplayPrice.toLocaleString(undefined, {
                minimumFractionDigits: resolvedDisplayPrice >= 100 ? 2 : resolvedDisplayPrice >= 1 ? 3 : 5,
                maximumFractionDigits: resolvedDisplayPrice >= 100 ? 2 : resolvedDisplayPrice >= 1 ? 3 : 5,
              })}
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 12,
          overflow: "hidden",
        }}
        ref={containerRef}
      />
      {priceMarker ? (
        <div
          style={{
            position: "absolute",
            right: 10,
            top: priceMarker.y,
            transform: "translateY(-50%)",
            zIndex: 5,
            padding: "4px 8px",
            borderRadius: 999,
            background: "rgba(11,16,23,0.92)",
            border: "1px solid rgba(124,196,255,0.24)",
            color: "#d7efff",
            fontSize: 11,
            fontWeight: 700,
            pointerEvents: "none",
            boxShadow: "0 6px 18px rgba(0,0,0,0.22)",
          }}
        >
          ${priceMarker.price.toLocaleString(undefined, {
            minimumFractionDigits: priceMarker.price >= 100 ? 2 : priceMarker.price >= 1 ? 3 : 5,
            maximumFractionDigits: priceMarker.price >= 100 ? 2 : priceMarker.price >= 1 ? 3 : 5,
          })}
        </div>
      ) : null}
    </div>
  );
}
