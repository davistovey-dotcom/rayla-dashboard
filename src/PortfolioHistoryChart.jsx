import React, { useEffect, useMemo, useRef, useState } from "react";
import { AreaSeries, ColorType, CrosshairMode, createChart } from "lightweight-charts";
import { supabase } from "./supabase";

const PORTFOLIO_HISTORY_RANGES = [
  { value: "1D", label: "1D" },
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "1Y", label: "1Y" },
  { value: "ALL", label: "All" },
];

const RANGE_TO_MS = {
  "1D": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  "3M": 90 * 24 * 60 * 60 * 1000,
  "1Y": 365 * 24 * 60 * 60 * 1000,
};

const ALPACA_ZERO_BASELINE_RANGES = new Set(["1M", "ALL"]);

function normalizeRange(value) {
  const normalized = String(value || "1D").trim().toUpperCase();
  if (normalized === "MAX") return "ALL";
  return PORTFOLIO_HISTORY_RANGES.some((range) => range.value === normalized) ? normalized : "1D";
}

function toCurrency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "--";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function toPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "--";
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(2)}%`;
}

function isMobileChartViewport() {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(max-width: 640px)").matches;
}

function formatChartDate(timeMs, range, timeZone, compact = false) {
  const date = new Date(timeMs);
  if (!Number.isFinite(date.getTime())) return "";
  const safeTimeZone = timeZone || undefined;
  const normalizedRange = normalizeRange(range);
  const options = compact
    ? normalizedRange === "1D"
      ? { hour: "numeric", timeZone: safeTimeZone }
      : { month: "short", day: "numeric", timeZone: safeTimeZone }
    : normalizedRange === "1D"
      ? { hour: "numeric", minute: "2-digit", timeZone: safeTimeZone }
      : normalizedRange === "ALL"
        ? { month: "short", day: "numeric", year: "numeric", timeZone: safeTimeZone }
        : { month: "short", day: "numeric", timeZone: safeTimeZone };
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function normalizePoints(points, { allowZero = false } = {}) {
  const byTime = new Map();
  (Array.isArray(points) ? points : []).forEach((point) => {
    const timeMs = Number(point?.timeMs);
    const value = Number(point?.value);
    if (!Number.isFinite(timeMs) || !Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) return;
    byTime.set(Math.round(timeMs / 1000), { time: Math.round(timeMs / 1000), value, pnl: point?.pnl, returnPct: point?.returnPct });
  });
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
}

function normalizeTradeType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "investment" || normalized === "crypto_hold") return "investment";
  if (normalized === "swing_trade") return "swing_trade";
  return "day_trade";
}

function positionMatchesView(position, view) {
  const tradeType = normalizeTradeType(position?.trade_type || position?.tradeType || position?.position_type || position?.positionType);
  if (view === "holdings") return tradeType === "investment";
  if (view === "active") return tradeType === "day_trade" || tradeType === "swing_trade";
  return true;
}

function normalizeSnapshotTime(snapshot) {
  const raw = snapshot?.timestampMs ?? snapshot?.timeMs ?? snapshot?.timestamp ?? snapshot?.created_at;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric > 1_000_000_000_000 ? Math.round(numeric) : Math.round(numeric * 1000);
  const parsed = Date.parse(String(raw || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildFallbackPointsFromSnapshots(snapshots, range, view) {
  const normalizedRange = normalizeRange(range);
  const rows = (Array.isArray(snapshots) ? snapshots : [])
    .map((snapshot) => {
      const timeMs = normalizeSnapshotTime(snapshot);
      if (!Number.isFinite(timeMs)) return null;
      const positions = Array.isArray(snapshot?.positions)
        ? snapshot.positions
        : Array.isArray(snapshot?.positions_json)
          ? snapshot.positions_json
          : [];
      const matchingPositions = positions.filter((position) => positionMatchesView(position, view));

      let value = null;
      if (view === "portfolio") {
        const equity = Number(snapshot?.equity);
        const marketValue = Number(snapshot?.totalMarketValue ?? snapshot?.total_market_value);
        const cash = Number(snapshot?.cash);
        if (Number.isFinite(equity) && equity > 0) value = equity;
        else if (Number.isFinite(marketValue) && Number.isFinite(cash) && marketValue + cash > 0) value = marketValue + cash;
        else if (Number.isFinite(marketValue) && marketValue > 0) value = marketValue;
      } else {
        value = matchingPositions.reduce((sum, position) => {
          const marketValue = Number(position?.market_value ?? position?.marketValue);
          return Number.isFinite(marketValue) && marketValue > 0 ? sum + marketValue : sum;
        }, 0);
      }

      if (!Number.isFinite(value) || value <= 0) return null;
      return { timeMs, value, source: "broker_snapshot" };
    })
    .filter(Boolean)
    .sort((a, b) => a.timeMs - b.timeMs);

  const latestMs = rows[rows.length - 1]?.timeMs;
  const rangeMs = RANGE_TO_MS[normalizedRange];
  const startMs = Number.isFinite(rangeMs) && Number.isFinite(latestMs) ? latestMs - rangeMs : null;
  return startMs == null ? rows : rows.filter((point) => point.timeMs >= startMs);
}

function buildStats(chartData, fallbackValue, openPnl = null, openPct = null) {
  const positivePoints = chartData.filter((point) => Number(point?.value) > 0);
  const statPoints = positivePoints.length ? positivePoints : chartData;
  const lastPoint = statPoints[statPoints.length - 1];
  const latest = lastPoint?.value;
  const first = statPoints[0]?.value;
  const value = Number.isFinite(latest) ? latest : Number(fallbackValue);
  const propPnl = openPnl != null && Number.isFinite(Number(openPnl)) ? Number(openPnl) : null;
  const propPct = openPct != null && Number.isFinite(Number(openPct)) ? Number(openPct) : null;
  const seriesPnl = statPoints.length >= 2 && Number.isFinite(first) && Number.isFinite(latest)
    ? latest - first
    : null;
  const seriesPct = Number.isFinite(seriesPnl) && Number.isFinite(first) && first > 0
    ? (seriesPnl / first) * 100
    : null;
  const pnl = propPnl ?? seriesPnl;
  const pct = propPct ?? seriesPct;
  return {
    value: Number.isFinite(value) ? value : null,
    pnl,
    pct,
    positive: Number.isFinite(pnl) ? pnl >= 0 : true,
  };
}

function getPointTimestamp(point) {
  const timeMs = Number(point?.timeMs);
  if (Number.isFinite(timeMs)) return timeMs;
  const time = Number(point?.time);
  if (Number.isFinite(time)) return time > 1_000_000_000_000 ? time : time * 1000;
  return null;
}

function getVisibleDomainSeconds(chartData, range) {
  const domainTimes = chartData.map((point) => point?.time).filter((time) => Number.isFinite(time));
  if (!domainTimes.length) return null;
  const first = Math.min(...domainTimes);
  const last = Math.max(...domainTimes);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null;
  if (first === last) {
    return { from: first - 60 * 30, to: last + 60 * 30 };
  }

  const normalizedRange = normalizeRange(range);
  if (normalizedRange === "ALL") {
    return { from: first, to: last };
  }

  const rangeMs = RANGE_TO_MS[normalizedRange];
  if (!Number.isFinite(rangeMs)) return null;
  return {
    from: Math.max(first, last - Math.round(rangeMs / 1000)),
    to: last,
  };
}

function buildXAxisLabels(visibleDomain, range, timeZone) {
  if (!visibleDomain) return [];
  const from = Number(visibleDomain.from);
  const to = Number(visibleDomain.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return [];
  const compact = isMobileChartViewport();
  const normalizedRange = normalizeRange(range);
  const count = compact ? 3 : normalizedRange === "1D" ? 4 : 4;
  const labels = Array.from({ length: count }, (_, index) => {
    const ratio = count === 1 ? 0 : index / (count - 1);
    const timeMs = (from + ((to - from) * ratio)) * 1000;
    return {
      key: `${index}-${Math.round(timeMs)}`,
      text: formatChartDate(timeMs, range, timeZone, true),
    };
  });
  let previousText = "";
  return labels.map((label) => {
    if (label.text === previousText) return { ...label, text: "" };
    previousText = label.text;
    return label;
  });
}

class PortfolioHistoryChartBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Portfolio history chart render error:", error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className={`portfolioHistoryChart performancePortfolioTrendCard ${this.props.className || ""}`}>
          <div className="portfolioHistoryHeader">
            <div className="portfolioHistoryTitleBlock">
              <div className="portfolioHistoryTitle">{this.props.title || "Portfolio"}</div>
              <div className="portfolioHistorySubtitle">Portfolio history is temporarily unavailable.</div>
            </div>
          </div>
          <div className="portfolioHistoryChartFrame" style={{ height: this.props.height || 340 }}>
            <div className="portfolioHistoryEmpty">Rayla could not render this chart. The rest of your workspace is still available.</div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function PortfolioHistoryChartInner({
  title = "Your portfolio",
  subtitle = "Broker-calculated portfolio history from Alpaca.",
  currentValue = null,
  positionsCount = 0,
  positionsValue = null,
  statusLabel = null,
  range = "1D",
  onRangeChange = () => {},
  height = 340,
  timeZone = null,
  emptyMessage = "Portfolio history will appear as Alpaca returns account history.",
  className = "",
  compact = false,
  fallbackSnapshots = [],
  snapshotView = "portfolio",
  rangeOptions = PORTFOLIO_HISTORY_RANGES,
  showRangeHint = true,
  openPnl = null,
  openPct = null,
  prebuiltPoints = null,
  rangeNote = null,
}) {
  const normalizedRange = normalizeRange(range);
  const resolvedRangeOptions = useMemo(() => {
    const options = Array.isArray(rangeOptions) && rangeOptions.length ? rangeOptions : PORTFOLIO_HISTORY_RANGES;
    return options.map((option) => ({
      ...option,
      normalizedValue: normalizeRange(option.value),
    }));
  }, [rangeOptions]);
  const mobileChartViewport = isMobileChartViewport();
  const frameHeight = mobileChartViewport
    ? Math.min(Number(height) || 340, 270)
    : height;
  const containerRef = useRef(null);
  const endpointRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const chartDataRef = useRef([]);
  const rangeRef = useRef(normalizedRange);
  const timeZoneRef = useRef(timeZone || undefined);
  const [historyState, setHistoryState] = useState({
    loading: false,
    error: null,
    points: [],
    rawCount: 0,
    firstTimestamp: null,
    lastTimestamp: null,
    source: "alpaca_portfolio_history",
    periodPnl: null,
    periodPct: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function loadPortfolioHistory() {
      setHistoryState((state) => ({ ...state, loading: true, error: null }));
      try {
        const { data, error } = await supabase.functions.invoke("alpaca-portfolio-history", {
          body: { range: normalizedRange },
        });
        if (error || data?.ok === false) {
          throw new Error(data?.error || error?.message || "Unable to load Alpaca portfolio history.");
        }
        if (cancelled) return;
        const points = Array.isArray(data?.points) ? data.points : [];
        setHistoryState({
          loading: false,
          error: null,
          points,
          rawCount: Number(data?.rawCount ?? points.length) || 0,
          firstTimestamp: data?.firstTimestamp || points[0]?.timeMs || null,
          lastTimestamp: data?.lastTimestamp || points[points.length - 1]?.timeMs || null,
          source: "alpaca_portfolio_history",
          periodPnl: data?.periodPnl ?? null,
          periodPct: data?.periodPct ?? null,
        });
      } catch (error) {
        if (cancelled) return;
        setHistoryState({
          loading: false,
          error: error instanceof Error ? error.message : "Unable to load Alpaca portfolio history.",
          points: [],
          rawCount: 0,
          firstTimestamp: null,
          lastTimestamp: null,
          source: "alpaca_portfolio_history",
          periodPnl: null,
          periodPct: null,
        });
      }
    }
    loadPortfolioHistory();
    return () => {
      cancelled = true;
    };
  }, [normalizedRange]);

  const fallbackPoints = useMemo(
    () => buildFallbackPointsFromSnapshots(fallbackSnapshots, normalizedRange, snapshotView),
    [fallbackSnapshots, normalizedRange, snapshotView]
  );
  const prebuiltMapped = useMemo(
    () => Array.isArray(prebuiltPoints) && prebuiltPoints.length >= 2
      ? prebuiltPoints.map((bar) => ({ timeMs: bar.timeMs, value: bar.close }))
      : null,
    [prebuiltPoints]
  );
  const usesPrebuilt = prebuiltMapped != null;
  const usesAlpacaHistory = !usesPrebuilt && historyState.points.length >= 2;
  const displayPoints = usesPrebuilt ? prebuiltMapped : usesAlpacaHistory ? historyState.points : fallbackPoints;
  const allowZeroBaseline = usesAlpacaHistory && ALPACA_ZERO_BASELINE_RANGES.has(normalizedRange);
  const chartData = useMemo(
    () => normalizePoints(displayPoints, { allowZero: allowZeroBaseline }),
    [allowZeroBaseline, displayPoints]
  );
  const seriesData = chartData;
  const visibleDomain = useMemo(
    () => getVisibleDomainSeconds(chartData, normalizedRange),
    [chartData, normalizedRange]
  );
  const xAxisLabels = useMemo(
    () => buildXAxisLabels(visibleDomain, normalizedRange, timeZone || undefined),
    [normalizedRange, timeZone, visibleDomain]
  );
  const effectivePnl = (usesAlpacaHistory && historyState.periodPnl != null) ? historyState.periodPnl : openPnl;
  const effectivePct = (usesAlpacaHistory && historyState.periodPct != null) ? historyState.periodPct : openPct;
  const stats = useMemo(() => buildStats(chartData, currentValue, effectivePnl, effectivePct), [chartData, currentValue, effectivePnl, effectivePct]);

  const updateEndpointMarker = () => {
    const marker = endpointRef.current;
    const chart = chartRef.current;
    const series = seriesRef.current;
    const latestChartData = chartDataRef.current;
    const lastPoint = latestChartData[latestChartData.length - 1];
    if (!marker || !chart || !series || !lastPoint) return;
    const x = chart.timeScale().timeToCoordinate(lastPoint.time);
    const y = series.priceToCoordinate(lastPoint.value);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      marker.style.opacity = "0";
      return;
    }
    marker.style.opacity = "1";
    marker.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };

  useEffect(() => {
    chartDataRef.current = chartData;
  }, [chartData]);

  useEffect(() => {
    rangeRef.current = normalizedRange;
    timeZoneRef.current = timeZone || undefined;
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      timeScale: {
        visible: false,
        timeVisible: normalizedRange === "1D",
        secondsVisible: false,
        borderVisible: false,
        ticksVisible: false,
        tickMarkFormatter: (time) => formatChartDate(Number(time) * 1000, rangeRef.current, timeZoneRef.current, mobileChartViewport),
      },
    });
    requestAnimationFrame(updateEndpointMarker);
  }, [mobileChartViewport, normalizedRange, timeZone]);

  useEffect(() => {
    const firstDisplayTimestamp = getPointTimestamp(displayPoints[0]);
    const lastDisplayTimestamp = getPointTimestamp(displayPoints[displayPoints.length - 1]);
    console.log("[PortfolioHistoryChart]", {
      range: normalizedRange,
      dataSource: usesAlpacaHistory ? historyState.source : "broker_snapshot_fallback",
      rawPointCount: historyState.rawCount,
      fallbackPointCount: fallbackPoints.length,
      renderedPointCount: chartData.length,
      firstTimestamp: firstDisplayTimestamp ? new Date(firstDisplayTimestamp).toISOString() : null,
      lastTimestamp: lastDisplayTimestamp ? new Date(lastDisplayTimestamp).toISOString() : null,
      minValue: chartData.length ? Math.min(...chartData.map((point) => point.value)) : null,
      maxValue: chartData.length ? Math.max(...chartData.map((point) => point.value)) : null,
      alpacaHistoryError: historyState.error || null,
    });
  }, [chartData, displayPoints, fallbackPoints.length, historyState, normalizedRange, usesAlpacaHistory]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || chartRef.current) return undefined;

    const chart = createChart(container, {
      autoSize: true,
      height: frameHeight,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8f9aad",
        fontFamily: "Satoshi, Inter, system-ui, sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.08)" },
        horzLines: { color: "rgba(148,163,184,0.09)" },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.18 },
      },
      leftPriceScale: { visible: false },
      timeScale: {
        visible: false,
        borderVisible: false,
        ticksVisible: false,
        timeVisible: normalizedRange === "1D",
        secondsVisible: false,
        rightOffset: 4,
        barSpacing: 8,
        fixLeftEdge: true,
        fixRightEdge: true,
        lockVisibleTimeRangeOnResize: true,
        tickMarkFormatter: (time) => formatChartDate(Number(time) * 1000, rangeRef.current, timeZoneRef.current, mobileChartViewport),
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(124,196,255,0.28)", labelBackgroundColor: "#16263a" },
        horzLine: { color: "rgba(124,196,255,0.22)", labelBackgroundColor: "#16263a" },
      },
      handleScroll: false,
      handleScale: false,
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: "#7cc4ff",
      topColor: "rgba(124,196,255,0.24)",
      bottomColor: "rgba(124,196,255,0.02)",
      lineWidth: 3,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      priceFormat: {
        type: "custom",
        formatter: (value) => toCurrency(value),
      },
    });
    chartRef.current = chart;
    seriesRef.current = series;

    const scheduleEndpointMarkerUpdate = () => {
      requestAnimationFrame(updateEndpointMarker);
    };
    const timeScale = chart.timeScale();
    if (typeof timeScale.subscribeVisibleTimeRangeChange === "function") {
      timeScale.subscribeVisibleTimeRangeChange(scheduleEndpointMarkerUpdate);
    }
    if (typeof timeScale.subscribeVisibleLogicalRangeChange === "function") {
      timeScale.subscribeVisibleLogicalRangeChange(scheduleEndpointMarkerUpdate);
    }

    const resizeObserver = new ResizeObserver(scheduleEndpointMarkerUpdate);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (typeof timeScale.unsubscribeVisibleTimeRangeChange === "function") {
        timeScale.unsubscribeVisibleTimeRangeChange(scheduleEndpointMarkerUpdate);
      }
      if (typeof timeScale.unsubscribeVisibleLogicalRangeChange === "function") {
        timeScale.unsubscribeVisibleLogicalRangeChange(scheduleEndpointMarkerUpdate);
      }
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [frameHeight, mobileChartViewport, normalizedRange, timeZone]);

  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;
    seriesRef.current.setData(seriesData);
    if (visibleDomain) {
      chartRef.current.timeScale().setVisibleRange(visibleDomain);
    } else if (chartData.length) {
      chartRef.current.timeScale().fitContent();
    }
    requestAnimationFrame(updateEndpointMarker);
  }, [chartData, normalizedRange, seriesData, visibleDomain]);

  const headerValue = stats.value == null ? "--" : toCurrency(stats.value);
  const headerChange = Number.isFinite(stats.pnl) ? `${stats.pnl >= 0 ? "+" : ""}${toCurrency(stats.pnl)}` : "--";
  const headerPct = Number.isFinite(stats.pct) ? toPercent(stats.pct) : "";
  const hasChart = chartData.length >= 2;

  return (
    <div
      className={`portfolioHistoryChart performancePortfolioTrendCard ${compact ? "portfolioHistoryChartCompact" : ""} ${className}`}
      style={{ "--portfolioHistoryChartHeight": `${frameHeight}px` }}
    >
      <div className="portfolioHistoryHeader">
        <div className="portfolioHistoryTitleBlock">
          <div className="portfolioHistoryTitle">{title}</div>
          <div className="portfolioHistoryValueRow">
            <span className="portfolioHistoryCurrencyMark">$</span>
            <span className="portfolioHistoryValue">{headerValue.replace("$", "")}</span>
            <span className="portfolioHistoryChange" style={{ color: stats.positive ? "#4ade80" : "#f87171" }}>
              {headerChange}
              {headerPct ? ` ${headerPct}` : ""}
            </span>
          </div>
          {subtitle ? <div className="portfolioHistorySubtitle">{subtitle}</div> : null}
        </div>
        <div className="portfolioHistoryControls">
          <div className="portfolioHistoryRangeGroup" aria-label={`${title} chart range`}>
            {resolvedRangeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={normalizedRange === option.normalizedValue ? "active" : ""}
                onClick={() => onRangeChange(option.value === "ALL" ? "MAX" : option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="portfolioHistoryMeta">
            {positionsCount} position{positionsCount === 1 ? "" : "s"}
            {Number.isFinite(Number(positionsValue)) ? ` · ${toCurrency(positionsValue)}` : ""}
          </div>
          {statusLabel ? <div className="portfolioHistoryStatus">{statusLabel}</div> : null}
        </div>
      </div>
      {showRangeHint ? <div className="portfolioHistoryHint">Range buttons control this chart view.</div> : null}
      {rangeNote ? <div className="portfolioHistoryCoverage" style={{ marginTop: 8, marginLeft: 2 }}>{rangeNote}</div> : null}
      <div className="portfolioHistoryChartFrame" style={{ height: frameHeight }}>
        <div ref={containerRef} className="portfolioHistoryChartCanvas" />
        {hasChart ? <div ref={endpointRef} className="portfolioHistoryLiveMarker" aria-hidden="true" /> : null}
        {!hasChart && (
          <div className="portfolioHistoryEmpty">
            {historyState.loading
              ? "Loading Alpaca portfolio history..."
              : historyState.error && fallbackPoints.length < 2
                ? "Portfolio history is unavailable right now. Refresh broker data to collect a new snapshot."
                : emptyMessage}
          </div>
        )}
        {xAxisLabels.length ? (
          <div className="portfolioHistoryXAxisLabels" aria-hidden="true">
            {xAxisLabels.map((label) => (
              <span key={label.key}>
                {label.text}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function PortfolioHistoryChart(props) {
  const resetKey = `${normalizeRange(props.range)}:${props.title || ""}:${props.positionsCount ?? 0}:${props.currentValue ?? ""}`;
  return (
    <PortfolioHistoryChartBoundary
      resetKey={resetKey}
      title={props.title}
      height={props.height}
      className={props.className}
    >
      <PortfolioHistoryChartInner {...props} />
    </PortfolioHistoryChartBoundary>
  );
}
