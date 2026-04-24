import { alpacaPaperRequest } from "../_shared/alpaca.ts";
import { buildCorsHeaders, jsonResponse, requireSupabaseUser } from "../_shared/auth.ts";

function normalizeAssetResult(asset: any) {
  return {
    symbol: String(asset?.symbol || "").toUpperCase(),
    name: asset?.name || "",
    exchange: asset?.exchange || "",
    assetClass: asset?.asset_class || "us_equity",
    tradable: Boolean(asset?.tradable),
    status: asset?.status || "active",
  };
}

function rankAssetMatch(asset: any, query: string) {
  const symbol = String(asset?.symbol || "").toUpperCase();
  const name = String(asset?.name || "").toUpperCase();

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
    const { query = "" } = await req.json();
    const normalizedQuery = String(query || "").trim().toUpperCase();

    if (!normalizedQuery) {
      return jsonResponse({ ok: true, connected: true, assets: [] });
    }

    const { data: connection, error } = await supabase
      .from("user_broker_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "alpaca")
      .eq("is_paper", true)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!connection) {
      return jsonResponse({
        ok: true,
        connected: false,
        assets: [],
        error: "Connect your Alpaca Paper account before searching tradable assets.",
      });
    }

    const assets = await alpacaPaperRequest(connection.access_token, "/v2/assets?status=active&asset_class=us_equity");
    const filteredAssets = (Array.isArray(assets) ? assets : [])
      .filter((asset) => asset?.tradable === true)
      .filter((asset) => {
        const symbol = String(asset?.symbol || "").toUpperCase();
        const name = String(asset?.name || "").toUpperCase();
        return symbol.includes(normalizedQuery) || name.includes(normalizedQuery);
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
