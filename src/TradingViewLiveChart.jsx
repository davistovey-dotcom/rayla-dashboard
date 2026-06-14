import { useEffect, useMemo, useRef, useState } from "react";

const TRADINGVIEW_WIDGET_SCRIPT = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

function resolveStockWidgetSymbol(asset) {
  const rawSymbol = String(asset?.id || asset?.symbol || "").trim().toUpperCase();
  const exchange = String(asset?.exchange || "").trim().toUpperCase();
  const tvSymbol = String(asset?.tvSymbol || "").trim().toUpperCase();

  if (tvSymbol.includes(":")) return tvSymbol;
  if (exchange.includes("NASDAQ")) return `NASDAQ:${rawSymbol}`;
  if (exchange.includes("NYSE")) return `NYSE:${rawSymbol}`;
  if (exchange.includes("AMEX") || exchange.includes("ARCA") || exchange.includes("BATS") || exchange.includes("CBOE")) {
    return `AMEX:${rawSymbol}`;
  }
  return rawSymbol;
}

function resolveCryptoWidgetSymbol(asset) {
  const rawSymbol = String(asset?.id || asset?.symbol || "").trim().toUpperCase();
  const tvSymbol = String(asset?.tvSymbol || "").trim().toUpperCase();

  if (tvSymbol.includes(":")) {
    const [, marketSymbol = ""] = tvSymbol.split(":");
    const normalizedMarketSymbol = String(marketSymbol)
      .replace("/", "")
      .replace(/USDT$/i, "USD");

    return normalizedMarketSymbol ? `CRYPTO:${normalizedMarketSymbol}` : "CRYPTO:BTCUSD";
  }
  if (!rawSymbol) return "CRYPTO:BTCUSD";
  const normalizedRawSymbol = rawSymbol
    .replace("/", "")
    .replace(/USDT$/i, "")
    .replace(/USD$/i, "");
  return `CRYPTO:${normalizedRawSymbol}USD`;
}

export function mapAssetToTradingViewWidgetSymbol(asset) {
  if (!asset) return "";
  return (asset.type || "").toLowerCase() === "crypto"
    ? resolveCryptoWidgetSymbol(asset)
    : resolveStockWidgetSymbol(asset);
}

function mapIntervalToTradingViewValue(interval) {
  switch (String(interval || "1D")) {
    case "1m": return "1";
    case "5m": return "5";
    case "15m": return "15";
    case "30m": return "30";
    case "1h": return "60";
    case "1D":
    default:
      return "D";
  }
}

const isTouchDevice = () => window.matchMedia("(pointer: coarse)").matches;

export default function TradingViewLiveChart({
  asset,
  height = "100%",
  interval = "1D",
}) {
  const containerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const widgetSymbol = useMemo(() => mapAssetToTradingViewWidgetSymbol(asset), [asset]);
  const widgetInterval = useMemo(() => mapIntervalToTradingViewValue(interval), [interval]);

  useEffect(() => {
    if (!containerRef.current || !widgetSymbol) return undefined;

    setIsLoading(true);
    containerRef.current.innerHTML = "";

    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container";
    widgetContainer.style.width = "100%";
    widgetContainer.style.height = "100%";
    widgetContainer.style.pointerEvents = "auto";
    widgetContainer.style.touchAction = "pan-y";

    const widgetInner = document.createElement("div");
    widgetInner.className = "tradingview-widget-container__widget";
    widgetInner.style.width = "100%";
    widgetInner.style.height = "100%";
    widgetContainer.appendChild(widgetInner);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = TRADINGVIEW_WIDGET_SCRIPT;
    script.async = true;
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Etc/UTC";
    const touch = isTouchDevice();
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: widgetSymbol,
      interval: widgetInterval,
      timezone: browserTimeZone,
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      allow_symbol_change: false,
      hide_side_toolbar: true,
      hide_top_toolbar: true,
      disabled_features: [
        ...(touch ? [] : ["chart_scroll"]),
        "left_toolbar",
      ],
      enabled_features: touch ? ["pinch_scale"] : [],
      calendar: false,
      details: false,
      hotlist: false,
      withdateranges: false,
      save_image: false,
      backgroundColor: "#0d1117",
      gridColor: "rgba(255,255,255,0.06)",
      watchlist: [],
      support_host: "https://www.tradingview.com",
    });
    script.onload = () => {
      window.setTimeout(() => setIsLoading(false), 300);
    };
    script.onerror = () => {
      setIsLoading(false);
    };

    widgetContainer.appendChild(script);
    containerRef.current.appendChild(widgetContainer);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [widgetSymbol, widgetInterval]);

  if (!asset) return null;

  return (
    <div style={{ width: "100%", height, position: "relative", background: "#0d1117", borderRadius: 12, overflow: "hidden", touchAction: "pan-y" }}>
      {isLoading ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 12, zIndex: 1 }}>
          Loading chart...
        </div>
      ) : null}
      <div ref={containerRef} style={{ width: "100%", height: "100%", touchAction: "pan-y" }} />
    </div>
  );
}
