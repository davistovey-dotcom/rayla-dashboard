import { alpacaBrokerRequest, resolveBrokerConnection } from "../_shared/alpaca.ts";
import { buildCorsHeaders, jsonResponse, requireSupabaseUser } from "../_shared/auth.ts";

const RANGE_CONFIG: Record<string, { period: string; timeframe: string; intradayReporting?: string }> = {
  // Matches Alpaca's web dashboard 1D chart request: period=1D + timeframe=1Min +
  // intraday_reporting=continuous, anchored via an explicit `start` at the most recent
  // past 20:00 America/New_York (extended-hours close). See getMostRecent20EtIso() below.
  "1D": { period: "1D", timeframe: "1Min", intradayReporting: "continuous" },
  "1W": { period: "1W", timeframe: "15Min", intradayReporting: "continuous" },
  "1M": { period: "1M", timeframe: "1D" },
  "3M": { period: "3M", timeframe: "1D" },
  "1Y": { period: "1A", timeframe: "1D" },
  ALL: { period: "all", timeframe: "1D" },
};

// Returns an ISO-8601 UTC string representing the most recent past 20:00 America/New_York
// timestamp. If we're at or after 20:00 ET today, returns today's 20:00 ET. Otherwise
// returns yesterday's 20:00 ET. DST-safe via iterative correction.
// This is the same session-close anchor Alpaca's web dashboard uses for its 1D chart.
function getMostRecent20EtIso(nowMs: number = Date.now()): string {
  const etFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    hour12: false,
  });
  const partsFor = (ms: number) => Object.fromEntries(
    etFormatter.formatToParts(new Date(ms)).map((p) => [p.type, p.value])
  );

  const nowParts = partsFor(nowMs);
  const nowMins = parseInt(nowParts.hour, 10) * 60 + parseInt(nowParts.minute, 10);
  const rollbackDays = nowMins < 20 * 60 ? 1 : 0;
  const anchorParts = partsFor(nowMs - rollbackDays * 24 * 60 * 60 * 1000);

  // Start guess assumes EDT (UTC-4) → 20:00 ET = 00:00 UTC next day.
  // During EST the correction loop bumps it forward 60 min.
  let guess = Date.UTC(
    parseInt(anchorParts.year, 10),
    parseInt(anchorParts.month, 10) - 1,
    parseInt(anchorParts.day, 10) + 1,
    0, 0, 0,
  );
  for (let i = 0; i < 3; i++) {
    const g = partsFor(guess);
    const diffMins = (20 * 60) - (parseInt(g.hour, 10) * 60 + parseInt(g.minute, 10));
    if (diffMins === 0 && g.day === anchorParts.day) break;
    guess += diffMins * 60 * 1000;
  }
  return new Date(guess).toISOString();
}

const ZERO_BASELINE_RANGES = new Set(["1M", "ALL"]);

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

function normalizePortfolioHistory(raw: any, range: string) {
  const timestamps = Array.isArray(raw?.timestamp) ? raw.timestamp : [];
  const equity = Array.isArray(raw?.equity) ? raw.equity : [];
  const profitLoss = Array.isArray(raw?.profit_loss) ? raw.profit_loss : [];
  const profitLossPct = Array.isArray(raw?.profit_loss_pct) ? raw.profit_loss_pct : [];
  const baseValue = toFiniteNumber(raw?.base_value);
  const allowZeroEquity = ZERO_BASELINE_RANGES.has(normalizeRange(range));

  return timestamps
    .map((timestamp: unknown, index: number) => {
      const timeMs = normalizeTimestamp(timestamp);
      const value = toFiniteNumber(equity[index]);
      if (!timeMs || value == null || value < 0 || (!allowZeroEquity && value === 0)) return null;
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

function firstFinite(arr: any[]): number | null {
  for (const v of arr) {
    const n = toFiniteNumber(v);
    if (n != null) return n;
  }
  return null;
}

function lastFinite(arr: any[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    const n = toFiniteNumber(arr[i]);
    if (n != null) return n;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: buildCorsHeaders() });
  }

  try {
    const { supabase, user } = await requireSupabaseUser(req);
    const body = await req.json().catch(() => ({}));
    const { connection, isPaper } = await resolveBrokerConnection(supabase, user.id, body?.preferPaper ?? null);

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
    // 1D chart: pin `start` to the most recent past 20:00 ET session-close anchor to
    // match Alpaca's web dashboard behavior. Other ranges leave `start` unset so
    // Alpaca uses its default period-relative window.
    if (range === "1D") {
      params.set("start", getMostRecent20EtIso());
    }

    const history = await alpacaBrokerRequest(
      connection.access_token,
      `/v2/account/portfolio/history?${params.toString()}`,
      isPaper
    );
    const points = normalizePortfolioHistory(history, range);

    const histTimestamps = Array.isArray(history?.timestamp) ? history.timestamp : [];
    const histEquityArr = Array.isArray(history?.equity) ? history.equity : [];
    const firstEquity = firstFinite(histEquityArr);
    const histLastEquity = lastFinite(histEquityArr);

    // Window start: first timestamp of the history response (Unix seconds → ms)
    const windowStartMs = histTimestamps.length > 0 ? normalizeTimestamp(histTimestamps[0]) : null;

    // Fetch live account + positions; on failure fall back to equity-array only
    let liveEquity: number | null = null;
    let unrealizedPnl: number | null = null;
    try {
      const [rawAccount, rawPositions] = await Promise.all([
        alpacaBrokerRequest(connection.access_token, "/v2/account", isPaper),
        alpacaBrokerRequest(connection.access_token, "/v2/positions", isPaper),
      ]);
      liveEquity = toFiniteNumber(rawAccount?.equity);
      if (Array.isArray(rawPositions)) {
        unrealizedPnl = rawPositions.reduce((sum, p) => {
          const pl = parseFloat(p?.unrealized_pl ?? p?.unrealizedPl ?? "");
          return sum + (Number.isFinite(pl) ? pl : 0);
        }, 0);
      }
    } catch (_e) {
      // fall through — liveEquity and unrealizedPnl remain null
    }

    // For non-ALL ranges: fetch cash deposit/withdrawal activities in the window
    // to subtract them from the equity delta (equity delta includes deposits).
    let netDepositsInWindow = 0;
    if (range !== "ALL" && windowStartMs != null) {
      try {
        const afterDate = new Date(windowStartMs).toISOString().split("T")[0];
        const actParams = new URLSearchParams({
          activity_types: "CSD,CSW",
          after: afterDate,
        });
        const rawActivities = await alpacaBrokerRequest(
          connection.access_token,
          `/v2/account/activities?${actParams.toString()}`,
          isPaper
        );
        console.log("[activities raw]", JSON.stringify(rawActivities));

        if (Array.isArray(rawActivities)) {
          // Filter to activities on or after the window start (after= may be exclusive)
          netDepositsInWindow = rawActivities.reduce((sum, a) => {
            const actDateMs = Date.parse(String(a?.date || a?.transaction_time || a?.created_at || ""));
            if (Number.isFinite(actDateMs) && actDateMs < windowStartMs) return sum;
            const amt = parseFloat(a?.net_amount ?? a?.amount ?? a?.netAmount ?? "");
            return sum + (Number.isFinite(amt) ? amt : 0);
          }, 0);
        }
      } catch (e) {
        console.log("[activities error]", String((e as any)?.message || e));
        // netDepositsInWindow stays 0 — fall back to raw equity delta
      }
    }

    // Synthesize a live-equity terminal point so all range views end at the same current value.
    // Replace the last historical point if it falls within 60 s of now (avoids near-duplicate timestamps).
    if (liveEquity != null && liveEquity > 0) {
      const nowMs = Date.now();
      const last = points[points.length - 1];
      const livePoint = { timeMs: nowMs, value: liveEquity, pnl: null, returnPct: null, baseValue: last?.baseValue ?? null };
      if (last && nowMs - last.timeMs < 60_000) {
        points[points.length - 1] = livePoint;
      } else {
        points.push(livePoint);
      }
    }

    let periodPnl: number | null = null;
    let periodPct: number | null = null;
    let startingCapital: number | null = null;
    let source: string;

    if (range === "ALL") {
      // Use live unrealized P/L as the all-time P/L anchor — unchanged
      const effectiveEquity = liveEquity ?? histLastEquity;
      if (unrealizedPnl != null && effectiveEquity != null) {
        periodPnl = unrealizedPnl;
        startingCapital = effectiveEquity - periodPnl;
        periodPct = startingCapital > 0 ? (periodPnl / startingCapital) * 100 : null;
        source = "unrealized";
      } else if (firstEquity != null && histLastEquity != null) {
        periodPnl = histLastEquity - firstEquity;
        startingCapital = firstEquity;
        periodPct = startingCapital > 0 ? (periodPnl / startingCapital) * 100 : null;
        source = "equity-delta-fallback";
      } else {
        source = "unavailable";
      }
    } else {
      // 1D/1W/1M/1Y: equity delta minus deposits, anchored to live price
      const lastEquity = liveEquity ?? histLastEquity;
      if (firstEquity != null && lastEquity != null) {
        periodPnl = (lastEquity - firstEquity) - netDepositsInWindow;
        startingCapital = firstEquity + netDepositsInWindow;
        periodPct = startingCapital > 0 ? (periodPnl / startingCapital) * 100 : null;
        source = liveEquity != null ? "equity-delta" : "equity-delta-fallback";
      } else {
        source = "unavailable";
      }
    }

    console.log("[periodPnl debug]", JSON.stringify({ range, periodPnl, periodPct, startingCapital, source, netDepositsInWindow }));

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
      periodPnl,
      periodPct,
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
