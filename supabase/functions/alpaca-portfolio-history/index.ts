import { alpacaBrokerRequest, resolveBrokerConnection } from "../_shared/alpaca.ts";
import { buildCorsHeaders, jsonResponse, requireSupabaseUser } from "../_shared/auth.ts";

const RANGE_CONFIG: Record<string, { period: string; timeframe: string; intradayReporting?: string }> = {
  "1D": { period: "1D", timeframe: "5Min", intradayReporting: "continuous" },
  "1W": { period: "1W", timeframe: "15Min", intradayReporting: "continuous" },
  "1M": { period: "1M", timeframe: "1D" },
  "3M": { period: "3M", timeframe: "1D" },
  "1Y": { period: "1A", timeframe: "1D" },
  ALL: { period: "all", timeframe: "1D" },
};

function normalizeRange(value: unknown) {
  const raw = String(value || "1D").trim().toUpperCase();
  if (raw === "MAX") return "ALL";
  return RANGE_CONFIG[raw] ? raw : "1D";
}

function toFiniteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTimestamp(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric > 1_000_000_000_000 ? Math.round(numeric) : Math.round(numeric * 1000);
}

function normalizePortfolioHistory(raw: any) {
  const timestamps = Array.isArray(raw?.timestamp) ? raw.timestamp : [];
  const equity = Array.isArray(raw?.equity) ? raw.equity : [];
  const profitLoss = Array.isArray(raw?.profit_loss) ? raw.profit_loss : [];
  const profitLossPct = Array.isArray(raw?.profit_loss_pct) ? raw.profit_loss_pct : [];
  const baseValue = toFiniteNumber(raw?.base_value);

  return timestamps
    .map((timestamp: unknown, index: number) => {
      const timeMs = normalizeTimestamp(timestamp);
      const value = toFiniteNumber(equity[index]);
      if (!timeMs || value == null || value <= 0) return null;
      return {
        timeMs,
        value,
        pnl: toFiniteNumber(profitLoss[index]),
        returnPct: toFiniteNumber(profitLossPct[index]),
        baseValue,
      };
    })
    .filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: buildCorsHeaders() });
  }

  try {
    const { supabase, user } = await requireSupabaseUser(req);
    const { connection, isPaper } = await resolveBrokerConnection(supabase, user.id);

    if (!connection) {
      return jsonResponse({
        ok: true,
        connected: false,
        provider: "alpaca",
        isPaper: false,
        range: normalizeRange(null),
        points: [],
      });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const range = normalizeRange(body?.range || url.searchParams.get("range"));
    const config = RANGE_CONFIG[range];
    const params = new URLSearchParams({
      period: config.period,
      timeframe: config.timeframe,
    });
    if (config.intradayReporting) {
      params.set("intraday_reporting", config.intradayReporting);
    }

    const history = await alpacaBrokerRequest(
      connection.access_token,
      `/v2/account/portfolio/history?${params.toString()}`,
      isPaper
    );
    const points = normalizePortfolioHistory(history);

    return jsonResponse({
      ok: true,
      connected: true,
      provider: "alpaca",
      isPaper,
      range,
      request: {
        period: config.period,
        timeframe: config.timeframe,
        intradayReporting: config.intradayReporting || null,
      },
      points,
      rawCount: Array.isArray(history?.timestamp) ? history.timestamp.length : 0,
      firstTimestamp: points[0]?.timeMs || null,
      lastTimestamp: points[points.length - 1]?.timeMs || null,
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to load Alpaca portfolio history.",
      },
      400
    );
  }
});
