import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
  LineStyle,
} from "lightweight-charts";

export default function TradeChart({
  bars,
  mode,
  latestPrice,
  assetSymbol,
  assetName,
  height = "100%",
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const priceLineRef = useRef(null);
  const latestDataRef = useRef([]);
  const seriesModeRef = useRef(null);
  const [latestMarker, setLatestMarker] = useState(null);

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
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        textColor: "#7f8ea3",
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScale: { mouseWheel: false, pinch: false },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: false,
        horzTouchDrag: false,
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
        requestAnimationFrame(() => syncLatestMarker());
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
      seriesModeRef.current = null;
    };
  }, [latestPrice]);

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

    const shouldRecreateSeries = !seriesRef.current || seriesModeRef.current !== mode;
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
          top: 0.78,
          bottom: 0,
        },
        borderVisible: false,
      });
      seriesModeRef.current = mode;
    }

    volumeSeriesRef.current.setData(
      deduped.map((b, index) => {
        const open = Number(b.open ?? b.close);
        const close = Number(b.close);
        const prevClose = Number(deduped[index - 1]?.close ?? open);
        const isUp = mode === "candlestick" ? close >= open : close >= prevClose;
        return {
          time: b._t,
          value: Number(b.volume ?? 0),
          color: isUp ? "rgba(74,222,128,0.42)" : "rgba(248,113,113,0.42)",
        };
      })
    );

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
    chart.timeScale().fitContent();
    requestAnimationFrame(() => syncLatestMarker(deduped));
  }, [bars, mode]);

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
      color: "rgba(96,165,250,0.75)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: "",
    });
    requestAnimationFrame(() => syncLatestMarker());
  }, [latestPrice, bars, mode]);

  const assetLabel = String(assetName || assetSymbol || "").trim();
  const resolvedLabelPrice = Number.isFinite(latestPrice)
    ? Number(latestPrice)
    : Number(latestMarker?.price);

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
