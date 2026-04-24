import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  CrosshairMode,
  LineStyle,
} from "lightweight-charts";

export default function TradeChart({ bars, mode, latestPrice }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const priceLineRef = useRef(null);

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
      }
    });
    ro.observe(containerRef.current);

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
    if (!chart || !Array.isArray(bars) || bars.length < 2) return;

    if (seriesRef.current) {
      try { chart.removeSeries(seriesRef.current); } catch (_) {}
      seriesRef.current = null;
      priceLineRef.current = null;
    }

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

    if (deduped.length < 2) return;

    if (mode === "candlestick") {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderUpColor: "#26a69a",
        borderDownColor: "#ef5350",
        wickUpColor: "#26a69a",
        wickDownColor: "#ef5350",
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
      seriesRef.current = series;
    } else {
      const series = chart.addSeries(LineSeries, {
        color: "#60a5fa",
        lineWidth: 2,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBackgroundColor: "#60a5fa",
        crosshairMarkerBorderColor: "#1e293b",
      });
      series.setData(
        deduped.map((b) => ({ time: b._t, value: Number(b.close) }))
      );
      seriesRef.current = series;
    }

    chart.timeScale().fitContent();
  }, [bars, mode]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !Number.isFinite(latestPrice)) return;

    if (priceLineRef.current) {
      try { series.removePriceLine(priceLineRef.current); } catch (_) {}
    }

    priceLineRef.current = series.createPriceLine({
      price: latestPrice,
      color: "rgba(96,165,250,0.75)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "",
    });
  }, [latestPrice]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
