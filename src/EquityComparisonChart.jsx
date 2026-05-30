import { useMemo } from "react";
import InteractiveLineChart from "./InteractiveLineChart";

const DAY_MS = 24 * 60 * 60 * 1000;

function timeToMs(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value > 1e12 ? value : value > 1e9 ? value * 1000 : null;
  }
  const ms = Date.parse(String(value || ""));
  return Number.isFinite(ms) ? ms : null;
}

function formatPct(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return "--";
  const numeric = Number(value);
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(digits)}%`;
}

function formatAxisPct(value) {
  if (!Number.isFinite(Number(value))) return "--";
  const numeric = Number(value);
  const digits = Math.abs(numeric) >= 10 ? 0 : Math.abs(numeric) >= 1 ? 1 : 2;
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(digits)}%`;
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

function getComparisonVisibleRange(points, chartRange) {
  const times = (Array.isArray(points) ? points : [])
    .map((point) => Number(point?.timeMs))
    .filter(Number.isFinite);
  if (!times.length) return null;

  const endMs = Math.max(...times);
  const actualStartMs = Math.min(...times);

  if (chartRange === "1D") return { fromMs: endMs - DAY_MS, toMs: endMs };
  if (chartRange === "1W") return { fromMs: endMs - 7 * DAY_MS, toMs: endMs };
  if (chartRange === "1M") return { fromMs: endMs - 30 * DAY_MS, toMs: endMs };
  if (chartRange === "3M") return { fromMs: endMs - 90 * DAY_MS, toMs: endMs };
  if (chartRange === "1Y") return { fromMs: endMs - 365 * DAY_MS, toMs: endMs };

  if (actualStartMs === endMs) {
    return { fromMs: actualStartMs - 12 * 60 * 60 * 1000, toMs: endMs + 12 * 60 * 60 * 1000 };
  }
  const padMs = Math.max((endMs - actualStartMs) * 0.03, 60 * 60 * 1000);
  return { fromMs: actualStartMs - padMs, toMs: endMs + padMs };
}

export default function EquityComparisonChart({
  equityPoints,
  benchmarkPoints,
  benchmarkSymbol,
  benchmarkLabel,
  chartRange,
  benchmarkLoading,
  timeZone = null,
}) {
  const equityValues = useMemo(
    () => (Array.isArray(equityPoints) ? equityPoints : [])
      .map((point) => {
        const timeMs = timeToMs(point?.time);
        const equityValue = Number(point?.equity ?? point?.value);
        return Number.isFinite(timeMs) && Number.isFinite(equityValue)
          ? { timeMs, equityValue }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.timeMs - b.timeMs),
    [equityPoints]
  );

  const equityBaseline = Number(equityValues[0]?.equityValue);
  const equityLine = useMemo(
    () => equityValues
      .map((point) => ({
        timeMs: point.timeMs,
        value: Number.isFinite(equityBaseline) && equityBaseline > 0
          ? ((point.equityValue - equityBaseline) / equityBaseline) * 100
          : null,
      }))
      .filter((point) => Number.isFinite(point.value)),
    [equityBaseline, equityValues]
  );

  const benchmarkValues = useMemo(
    () => (Array.isArray(benchmarkPoints) ? benchmarkPoints : [])
      .map((point) => {
        const timeMs = timeToMs(point?.time);
        const benchmarkValue = readBenchmarkPointValue(point);
        return Number.isFinite(timeMs) && Number.isFinite(benchmarkValue)
          ? { timeMs, benchmarkValue, raw: point }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.timeMs - b.timeMs),
    [benchmarkPoints]
  );

  const benchmarkBaseline = Number(benchmarkValues[0]?.benchmarkValue);
  const benchmarkLine = useMemo(
    () => benchmarkValues
      .map((point) => ({
        timeMs: point.timeMs,
        value: readBenchmarkPointPctChange(point.raw, benchmarkBaseline),
      }))
      .filter((point) => Number.isFinite(point.value)),
    [benchmarkBaseline, benchmarkValues]
  );

  const resolvedBenchmarkLabel = benchmarkLabel || benchmarkSymbol || "Benchmark";
  const lines = [
    equityLine.length >= 2
      ? { symbol: "Your return", color: "#7CC4FF", points: equityLine }
      : null,
    benchmarkLine.length >= 2
      ? { symbol: `${resolvedBenchmarkLabel} return`, color: "#A78BFA", points: benchmarkLine }
      : null,
  ].filter(Boolean);

  const visibleTimeRange = useMemo(
    () => getComparisonVisibleRange([...equityLine, ...benchmarkLine], chartRange),
    [benchmarkLine, chartRange, equityLine]
  );

  const lastEquityReturn = equityLine[equityLine.length - 1]?.value;

  return (
    <div className="equityComparisonChart">
      {benchmarkLoading && !lines.length ? (
        <div className="interactiveLineChartEmpty">Loading benchmark...</div>
      ) : (
        <InteractiveLineChart
          className="equityComparisonChartEngine tradePortfolioEngineChart"
          height="100%"
          lines={lines}
          visibleTimeRange={visibleTimeRange}
          timeZone={timeZone}
          debugLabel={`Equity Curve ${chartRange}`}
          valueFormatter={formatAxisPct}
          emptyMessage="No equity curve for this range yet."
        />
      )}
      {Number.isFinite(lastEquityReturn) ? (
        <div className="equityComparisonChartSummary">
          Your return {formatPct(lastEquityReturn)}
        </div>
      ) : null}
    </div>
  );
}
