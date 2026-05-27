import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CrosshairMode,
  LineSeries,
  LineStyle,
} from "lightweight-charts";

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

  let previousSecond = null;
  return sorted.map((point) => {
    let nextSecond = Math.floor(point.timeMs / 1000);
    if (previousSecond != null && nextSecond <= previousSecond) {
      nextSecond = previousSecond + 1;
    }
    previousSecond = nextSecond;
    return { time: nextSecond, value: point.value };
  });
}

function defaultValueFormatter(value) {
  if (!Number.isFinite(Number(value))) return "--";
  const numeric = Number(value);
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(2)}`;
}

export default function InteractiveLineChart({
  lines,
  height = 360,
  valueFormatter = defaultValueFormatter,
  className = "",
  emptyMessage = "No chart data yet.",
  showLastPointPulse = false,
  minimal = false,
}) {
  const rootRef = useRef(null);
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRefs = useRef([]);
  const normalizedLinesRef = useRef([]);
  const [lastPointMarker, setLastPointMarker] = useState(null);

  const normalizedLines = useMemo(() => (
    (Array.isArray(lines) ? lines : [])
      .map((line) => ({
        symbol: String(line?.symbol || "").trim() || "Series",
        color: line?.color || "#7CC4FF",
        data: normalizeSeriesPoints(line?.points),
      }))
      .filter((line) => line.data.length > 0)
  ), [lines]);

  useEffect(() => {
    normalizedLinesRef.current = normalizedLines;
  }, [normalizedLines]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { color: "transparent" },
        textColor: "#7f8ea3",
        fontFamily: '"Satoshi", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: minimal ? "transparent" : "rgba(255,255,255,0.035)" },
        horzLines: { color: minimal ? "transparent" : "rgba(255,255,255,0.045)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(124,196,255,0.22)",
          style: LineStyle.Dashed,
          labelVisible: false,
        },
        horzLine: {
          color: "rgba(124,196,255,0.18)",
          style: LineStyle.Dashed,
          labelVisible: true,
        },
      },
      rightPriceScale: {
        visible: !minimal,
        borderColor: minimal ? "transparent" : "rgba(255,255,255,0.08)",
        scaleMargins: { top: 0.18, bottom: 0.14 },
      },
      leftPriceScale: { visible: false },
      timeScale: {
        visible: !minimal,
        borderColor: minimal ? "transparent" : "rgba(255,255,255,0.08)",
        timeVisible: !minimal,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 10,
        minBarSpacing: 2,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      localization: {
        priceFormatter: valueFormatter,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
      handleScroll: {
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
        mouseWheel: true,
      },
    });

    chartRef.current = chart;
    const chartElement = containerRef.current;
    const handleWheelIntent = (event) => {
      const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const pinchZoomIntent = event.ctrlKey || event.metaKey;
      if (horizontalIntent || pinchZoomIntent) {
        event.preventDefault();
      }
    };
    chartElement.addEventListener("wheel", handleWheelIntent, { passive: false });

    const updateLastPointMarker = () => {
      const currentLines = normalizedLinesRef.current;
      if (!showLastPointPulse || !chartRef.current || !seriesRefs.current[0] || !currentLines[0]?.data?.length) {
        setLastPointMarker(null);
        return;
      }
      const lastPoint = currentLines[0].data[currentLines[0].data.length - 1];
      const x = chartRef.current.timeScale().timeToCoordinate(lastPoint.time);
      const y = seriesRefs.current[0].priceToCoordinate(lastPoint.value);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        setLastPointMarker(null);
        return;
      }
      const canvasRect = containerRef.current?.getBoundingClientRect();
      const rootRect = rootRef.current?.getBoundingClientRect();
      const offsetX = canvasRect && rootRect ? canvasRect.left - rootRect.left : 0;
      const offsetY = canvasRect && rootRect ? canvasRect.top - rootRect.top : 0;
      setLastPointMarker({ x: x + offsetX, y: y + offsetY, color: currentLines[0].color });
    };

    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || !chartRef.current) return;
      chartRef.current.applyOptions({ width: rect.width, height: rect.height });
      window.requestAnimationFrame(updateLastPointMarker);
    });
    resizeObserver.observe(containerRef.current);
    chart.timeScale().subscribeVisibleTimeRangeChange(updateLastPointMarker);

    return () => {
      resizeObserver.disconnect();
      chart.timeScale().unsubscribeVisibleTimeRangeChange(updateLastPointMarker);
      chartElement.removeEventListener("wheel", handleWheelIntent);
      try {
        chart.remove();
      } catch {
        // Ignore chart cleanup failures during hot reload.
      }
      chartRef.current = null;
      seriesRefs.current = [];
      setLastPointMarker(null);
    };
  }, [valueFormatter, showLastPointPulse, minimal]);

  useEffect(() => {
    if (!chartRef.current) return;

    seriesRefs.current.forEach((series) => {
      try {
        chartRef.current.removeSeries(series);
      } catch {
        // Series may already be disposed during hot reload.
      }
    });
    seriesRefs.current = [];

    normalizedLines.forEach((line, index) => {
      const series = chartRef.current.addSeries(LineSeries, {
        color: line.color,
        lineWidth: index === 0 ? 3 : 2,
        lastValueVisible: true,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
        priceFormat: {
          type: "custom",
          minMove: 0.01,
          formatter: valueFormatter,
        },
      });
      series.setData(line.data);
      seriesRefs.current.push(series);
    });

    chartRef.current.timeScale().fitContent();
    window.requestAnimationFrame(() => {
      if (!showLastPointPulse || !chartRef.current || !seriesRefs.current[0] || !normalizedLines[0]?.data?.length) {
        setLastPointMarker(null);
        return;
      }
      const lastPoint = normalizedLines[0].data[normalizedLines[0].data.length - 1];
      const x = chartRef.current.timeScale().timeToCoordinate(lastPoint.time);
      const y = seriesRefs.current[0].priceToCoordinate(lastPoint.value);
      const canvasRect = containerRef.current?.getBoundingClientRect();
      const rootRect = rootRef.current?.getBoundingClientRect();
      const offsetX = canvasRect && rootRect ? canvasRect.left - rootRect.left : 0;
      const offsetY = canvasRect && rootRect ? canvasRect.top - rootRect.top : 0;
      setLastPointMarker(Number.isFinite(x) && Number.isFinite(y) ? { x: x + offsetX, y: y + offsetY, color: normalizedLines[0].color } : null);
    });
  }, [normalizedLines, valueFormatter, showLastPointPulse]);

  const fitChart = () => {
    chartRef.current?.timeScale().fitContent();
  };

  if (!normalizedLines.length) {
    return (
      <div ref={rootRef} className={`interactiveLineChart ${className}`} style={{ height }}>
        <div className="interactiveLineChartEmpty">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`interactiveLineChart ${className}`} style={{ height }}>
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
      <button type="button" className="interactiveLineChartFit" onClick={fitChart}>
        Fit
      </button>
      <div
        ref={containerRef}
        className="interactiveLineChartCanvas"
        onDoubleClick={fitChart}
      />
      {showLastPointPulse && lastPointMarker ? (
        <div
          className="interactiveLineChartPulsePoint"
          style={{
            left: lastPointMarker.x,
            top: lastPointMarker.y,
            background: lastPointMarker.color,
            boxShadow: `0 0 12px ${lastPointMarker.color}99`,
          }}
        />
      ) : null}
    </div>
  );
}
