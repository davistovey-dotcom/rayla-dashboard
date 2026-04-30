import TradingViewLiveChart, { mapAssetToTradingViewWidgetSymbol } from "./TradingViewLiveChart";

export { mapAssetToTradingViewWidgetSymbol };

export default function HomeTradingViewWidget({ asset, height = "100%", defaultInterval = "5m" }) {
  return (
    <TradingViewLiveChart
      asset={asset}
      height={height}
      interval={defaultInterval}
    />
  );
}
