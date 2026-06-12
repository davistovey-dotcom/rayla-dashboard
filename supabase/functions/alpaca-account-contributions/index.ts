import {
  alpacaBrokerRequest,
  alpacaBrokerRequestWithHeaders,
  normalizeAlpacaAccount,
  resolveBrokerConnection,
} from "../_shared/alpaca.ts";
import { buildCorsHeaders, jsonResponse, requireSupabaseUser } from "../_shared/auth.ts";

const CONTRIBUTION_ACTIVITY_TYPES = ["CSD", "CSW", "JNLC", "ACATC", "ACATS"];

function toFiniteNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeActivity(activity: any) {
  const activityType = String(activity?.activity_type || activity?.activityType || "").trim().toUpperCase();
  const netAmount = toFiniteNumber(activity?.net_amount ?? activity?.netAmount);
  const date = activity?.date || activity?.transaction_time || activity?.created_at || null;

  return {
    id: activity?.id || null,
    activityType,
    date,
    netAmount,
    description: activity?.description || null,
    status: activity?.status || null,
    raw: activity,
  };
}

function extractNextPageToken(headers: Headers) {
  return (
    headers.get("pagination-token")
    || headers.get("Pagination-Token")
    || headers.get("next-page-token")
    || headers.get("Next-Page-Token")
    || null
  );
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
        deposits: 0,
        withdrawals: 0,
        netContributions: 0,
        accountPnl: null,
        accountReturnPct: null,
        activityCount: 0,
        latestActivityDate: null,
        rawActivityTypeTotals: {},
        activities: [],
      });
    }

    const rawAccount = await alpacaBrokerRequest(connection.access_token, "/v2/account", isPaper);
    const account = normalizeAlpacaAccount(rawAccount, isPaper);
    const activities: ReturnType<typeof normalizeActivity>[] = [];
    let pageToken: string | null = null;
    let pageGuard = 0;

    do {
      const params = new URLSearchParams({
        category: "non_trade_activity",
        activity_types: CONTRIBUTION_ACTIVITY_TYPES.join(","),
        direction: "asc",
        page_size: "100",
      });
      if (pageToken) params.set("page_token", pageToken);

      const { data, headers } = await alpacaBrokerRequestWithHeaders(
        connection.access_token,
        `/v2/account/activities?${params.toString()}`,
        isPaper
      );

      const pageActivities = Array.isArray(data) ? data.map(normalizeActivity) : [];
      activities.push(...pageActivities.filter((activity) => (
        CONTRIBUTION_ACTIVITY_TYPES.includes(activity.activityType)
        && Number.isFinite(activity.netAmount)
      )));

      pageToken = extractNextPageToken(headers);
      pageGuard += 1;
    } while (pageToken && pageGuard < 50);

    const rawActivityTypeTotals = activities.reduce<Record<string, { count: number; netAmount: number }>>((totals, activity) => {
      const key = activity.activityType || "UNKNOWN";
      if (!totals[key]) totals[key] = { count: 0, netAmount: 0 };
      totals[key].count += 1;
      totals[key].netAmount += activity.netAmount;
      return totals;
    }, {});

    const deposits = activities.reduce((sum, activity) => (
      activity.netAmount > 0 ? sum + activity.netAmount : sum
    ), 0);
    const withdrawals = activities.reduce((sum, activity) => (
      activity.netAmount < 0 ? sum + Math.abs(activity.netAmount) : sum
    ), 0);
    const netContributions = activities.reduce((sum, activity) => sum + activity.netAmount, 0);
    const equity = toFiniteNumber(account.equity);
    const accountPnl = Number.isFinite(equity) && Number.isFinite(netContributions)
      ? equity - netContributions
      : null;
    const accountReturnPct = accountPnl != null && netContributions !== 0
      ? (accountPnl / netContributions) * 100
      : null;
    const latestActivityDate = activities
      .map((activity) => Date.parse(String(activity.date || "")))
      .filter((timeMs) => Number.isFinite(timeMs))
      .sort((a, b) => b - a)[0];

    return jsonResponse({
      ok: true,
      connected: true,
      provider: "alpaca",
      isPaper,
      account: {
        equity: account.equity,
        portfolioValue: account.portfolioValue,
        cash: account.cash,
      },
      deposits,
      withdrawals,
      netContributions,
      accountPnl,
      accountReturnPct,
      activityCount: activities.length,
      latestActivityDate: Number.isFinite(latestActivityDate) ? new Date(latestActivityDate).toISOString() : null,
      rawActivityTypeTotals,
      activities,
      pagination: {
        exhausted: !pageToken,
        pagesFetched: pageGuard,
      },
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to load Alpaca account contribution activities.",
      },
      400
    );
  }
});
