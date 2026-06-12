import { alpacaBrokerRequest, alpacaPaperRequest, resolveBrokerConnection } from "../_shared/alpaca.ts";
import { buildCorsHeaders, jsonResponse, requireSupabaseUser } from "../_shared/auth.ts";

const CANONICAL_ALPACA_CRYPTO_ASSETS = [
  {
    symbol: "BTC/USD",
    name: "Bitcoin / US Dollar",
    exchange: "Crypto",
    asset_class: "crypto",
    tradable: true,
    marginable: false,
    shortable: false,
    easy_to_borrow: false,
    fractionable: true,
    status: "active",
  },
  {
    symbol: "ETH/USD",
    name: "Ethereum / US Dollar",
    exchange: "Crypto",
    asset_class: "crypto",
    tradable: true,
    marginable: false,
    shortable: false,
    easy_to_borrow: false,
    fractionable: true,
    status: "active",
  },
];

function normalizeAssetResult(asset: any) {
  return {
    symbol: String(asset?.symbol || "").toUpperCase(),
    name: asset?.name || "",
    exchange: asset?.exchange || "",
    assetClass: asset?.asset_class || "us_equity",
    tradable: Boolean(asset?.tradable),
    marginable: Boolean(asset?.marginable),
    shortable: Boolean(asset?.shortable),
    easyToBorrow: Boolean(asset?.easy_to_borrow),
    fractionable: Boolean(asset?.fractionable),
    status: asset?.status || "active",
  };
}

function normalizeAssetSymbolForSearch(symbol: string) {
  const upper = String(symbol || "").trim().toUpperCase();
  return upper.replace(/[^A-Z0-9]/g, "");
}

function getCryptoBaseSymbol(symbol: string) {
  const compactSymbol = normalizeAssetSymbolForSearch(symbol);
  return compactSymbol.endsWith("USD") ? compactSymbol.slice(0, -3) : compactSymbol;
}

function getCanonicalCryptoMatches(query: string) {
  const compactQuery = normalizeAssetSymbolForSearch(query);
  if (!compactQuery) return [];

  return CANONICAL_ALPACA_CRYPTO_ASSETS.filter((asset) => {
    const compactSymbol = normalizeAssetSymbolForSearch(asset.symbol);
    const cryptoBase = getCryptoBaseSymbol(asset.symbol);
    const name = String(asset.name || "").toUpperCase();
    return (
      compactSymbol.includes(compactQuery)
      || cryptoBase === compactQuery
      || name.includes(String(query || "").trim().toUpperCase())
    );
  });
}

function rankAssetMatch(asset: any, query: string) {
  const symbol = String(asset?.symbol || "").toUpperCase();
  const name = String(asset?.name || "").toUpperCase();
  const assetClass = String(asset?.asset_class || "").toLowerCase();
  const compactSymbol = normalizeAssetSymbolForSearch(symbol);
  const compactQuery = normalizeAssetSymbolForSearch(query);
  const cryptoBase = getCryptoBaseSymbol(symbol);

  if (assetClass === "crypto" && (symbol === `${query}/USD` || compactSymbol === `${compactQuery}USD` || cryptoBase === compactQuery)) return -1;

  if (symbol === query) return 0;
  if (symbol.startsWith(query)) return 1;
  if (name.startsWith(query)) return 2;
  if (symbol.includes(query)) return 3;
  if (name.includes(query)) return 4;
  return 5;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: buildCorsHeaders() });
  }

  try {
    const { supabase, user } = await requireSupabaseUser(req);
    const bodyData = await req.json().catch(() => ({}));
    const { query = "" } = bodyData;
    const normalizedQuery = String(query || "").trim().toUpperCase();

    if (!normalizedQuery) {
      return jsonResponse({ ok: true, connected: true, assets: [] });
    }

    const { connection, isPaper } = await resolveBrokerConnection(supabase, user.id, bodyData?.preferPaper ?? null);

    if (!connection) {
      return jsonResponse({
        ok: true,
        connected: false,
        assets: [],
        error: "Connect your Alpaca account before searching tradable assets.",
      });
    }

    const [equityAssets, cryptoAssets] = await Promise.all([
      alpacaBrokerRequest(connection.access_token, "/v2/assets?status=active&asset_class=us_equity", isPaper),
      alpacaBrokerRequest(connection.access_token, "/v2/assets?status=active&asset_class=crypto", isPaper),
    ]);
    const assets = [
      ...(Array.isArray(cryptoAssets) ? cryptoAssets : []),
      ...(Array.isArray(equityAssets) ? equityAssets : []),
    ];
    const canonicalCryptoMatches = getCanonicalCryptoMatches(normalizedQuery);
    const filteredAssets = [...canonicalCryptoMatches, ...(Array.isArray(assets) ? assets : [])]
      .filter((asset) => asset?.tradable === true)
      .filter((asset) => {
        const symbol = String(asset?.symbol || "").toUpperCase();
        const name = String(asset?.name || "").toUpperCase();
        const compactSymbol = normalizeAssetSymbolForSearch(symbol);
        const compactQuery = normalizeAssetSymbolForSearch(normalizedQuery);
        const cryptoBase = getCryptoBaseSymbol(symbol);
        return symbol.includes(normalizedQuery) || compactSymbol.includes(compactQuery) || cryptoBase === compactQuery || name.includes(normalizedQuery);
      })
      .sort((a, b) => {
        const rankDelta = rankAssetMatch(a, normalizedQuery) - rankAssetMatch(b, normalizedQuery);
        if (rankDelta !== 0) return rankDelta;

        const symbolA = String(a?.symbol || "").toUpperCase();
        const symbolB = String(b?.symbol || "").toUpperCase();
        const nameA = String(a?.name || "").toUpperCase();
        const nameB = String(b?.name || "").toUpperCase();

        const symbolLengthDelta = Math.abs(symbolA.length - normalizedQuery.length) - Math.abs(symbolB.length - normalizedQuery.length);
        if (symbolLengthDelta !== 0) return symbolLengthDelta;

        const nameLengthDelta = nameA.length - nameB.length;
        if (nameLengthDelta !== 0) return nameLengthDelta;

        return symbolA.localeCompare(symbolB);
      })
      .filter((asset, index, list) => {
        const symbol = normalizeAssetSymbolForSearch(asset?.symbol);
        return symbol && list.findIndex((candidate) => normalizeAssetSymbolForSearch(candidate?.symbol) === symbol) === index;
      })
      .slice(0, 8)
      .map(normalizeAssetResult);

    return jsonResponse({
      ok: true,
      connected: true,
      assets: filteredAssets,
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to search tradable Alpaca assets.",
      },
      400
    );
  }
});
