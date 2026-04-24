import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  CrosshairMode,
  LineStyle,
} from "lightweight-charts";

const DARK_THEME = {
  background: "transparent",
  text: "#7f8ea3",
  grid: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.08)",
  crosshair: "rgba(124,196,255,0.35)",
  labelBg: "#1e293b",
  lineColor: "#60a5fa",
  candleUp: "#26a69a",
  candleDown: "#ef5350",
  priceLineColor: "rgba(96,165,250,0.75)",
};

function parseBars(bars) {
  const seen = new Set();
  return (bars || [])
    .map((b) => ({ ...b, _t: Math.floor(new Date(b.time).getTime() / 1000) }))
    .filter((b) => {
      if (!Number.isFinite(b._t) || !Number.isFinite(Number(b.close))) return false;
      if (seen.has(b._t)) return false;
      seen.add(b._t);
      return true;
    })
    .sort((a, z) => a._t - z._t);
}

export default function RaylaChart({
  bars,
  mode = "line",
  height = 260,
  currentPrice,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const priceLineRef = useRef(null);
  const t = DARK_THEME;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { color: t.background },
        textColor: t.text,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: t.grid },
        horzLines: { color: t.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: t.crosshair, style: LineStyle.Dashed, labelBackgroundColor: t.labelBg },
        horzLine: { color: t.crosshair, style: LineStyle.Dashed, labelBackgroundColor: t.labelBg },
      },
      rightPriceScale: {
        borderColor: t.border,
        textColor: t.text,
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      leftPriceScale: { visible: false },
      timeScale: {
        borderColor: t.border,
        textColor: t.text,
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
      width: el.clientWidth,
      height: el.clientHeight,
    });

    chartRef.current = chart;

    const ro = new ResizeObserver((entries) => {
      if (chartRef.current && entries[0]) {
        chartRef.current.applyOptions({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height,
        });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      try { chart.remove(); } catch (_) {}
      chartRef.current = null;
      seriesRef.current = null;
      priceLineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (seriesRef.current) {
      try { chart.removeSeries(seriesRef.current); } catch (_) {}
      seriesRef.current = null;
      priceLineRef.current = null;
    }

    const deduped = parseBars(bars);
    if (deduped.length < 2) return;

    let series;
    if (mode === "candlestick") {
      series = chart.addSeries(CandlestickSeries, {
        upColor: t.candleUp,
        downColor: t.candleDown,
        borderUpColor: t.candleUp,
        borderDownColor: t.candleDown,
        wickUpColor: t.candleUp,
        wickDownColor: t.candleDown,
        priceLineVisible: false,
      });
      series.setData(
        deduped.map((b) => ({
          time: b._t,
          open: Number(b.open ?? b.close),
          high: Number(b.high ?? b.close),
          low: Number(b.low ?? b.close),
          close: Number(b.close),
        }))
      );
    } else {
      series = chart.addSeries(LineSeries, {
        color: t.lineColor,
        lineWidth: 2,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBackgroundColor: t.lineColor,
        crosshairMarkerBorderColor: t.labelBg,
      });
      series.setData(deduped.map((b) => ({ time: b._t, value: Number(b.close) })));
    }

    seriesRef.current = series;
    chart.timeScale().fitContent();
  }, [bars, mode]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !Number.isFinite(currentPrice)) return;

    if (priceLineRef.current) {
      try { series.removePriceLine(priceLineRef.current); } catch (_) {}
    }

    priceLineRef.current = series.createPriceLine({
      price: currentPrice,
      color: t.priceLineColor,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "",
    });
  }, [currentPrice]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
