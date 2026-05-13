// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseJsonObject(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeNumberString(value, { allowNegative = false } = {}) {
  const raw = normalizeText(value).replace(/[,$]/g, "").replace(/[rR]/g, "");
  if (!raw) return "";
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return "";
  if (!allowNegative && parsed <= 0) return "";
  return String(parsed);
}

function normalizeDirection(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized.includes("buy") || normalized === "long") return "long";
  if (normalized.includes("sell short") || normalized === "short") return "short";
  return "";
}

function normalizeFields(fields = {}) {
  const asset = normalizeText(fields.asset || fields.ticker || fields.symbol).toUpperCase();
  const entryPrice = normalizeNumberString(
    fields.entryPrice ||
    fields.fillPrice ||
    fields.filledPrice ||
    fields.averagePrice ||
    fields.avgPrice ||
    fields.price
  );
  const fillQuantity = normalizeNumberString(
    fields.fillQuantity ||
    fields.filledQuantity ||
    fields.quantity ||
    fields.qty ||
    fields.shares ||
    fields.fractionalShares
  );
  const notional = normalizeNumberString(
    fields.notional ||
    fields.amount ||
    fields.dollarAmount ||
    fields.orderAmount ||
    fields.total ||
    fields.size
  );
  const result = normalizeNumberString(fields.result || fields.resultR || fields.rMultiple, { allowNegative: true });

  return {
    asset,
    ticker: asset,
    symbol: asset,
    entryPrice,
    fillPrice: entryPrice,
    fillQuantity,
    quantity: fillQuantity,
    notional,
    amount: notional,
    size: notional,
    direction: normalizeDirection(fields.direction || fields.side || fields.orderSide || fields.action),
    result,
    setup: normalizeText(fields.setup).toLowerCase(),
    session: normalizeText(fields.session),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const OPENAI_KEY = Deno.env.get("OPENAIKEY") || Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_KEY) return jsonResponse({ ok: false, error: "Parser is not configured." }, 500);

    const { imageBase64, mimeType = "image/jpeg" } = await req.json();
    if (!imageBase64) return jsonResponse({ ok: false, error: "No image provided." }, 400);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content: [
              "Extract trade/order fields from brokerage screenshots.",
              "Return JSON only. Do not guess unreadable fields.",
              "Common supported layouts include Robinhood mobile order detail screens with labels like Symbol, Filled quantity, Average price, Fill price, Amount, Total, Submitted, Executed, Buy, and Sell.",
              "For fractional shares, preserve the decimal quantity.",
              "For dollar amount/notional, return the dollar amount separately from share quantity.",
              "If this is an order-detail screenshot with no P/L or R result, leave result empty.",
              "Map Buy to direction long. Map Sell Short to direction short. For a plain Sell order, leave direction empty unless the screenshot explicitly says short.",
            ].join(" "),
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  "Return this exact JSON shape:",
                  '{"ok":true,"fields":{"asset":"","ticker":"","symbol":"","entryPrice":"","fillPrice":"","fillQuantity":"","quantity":"","notional":"","amount":"","size":"","direction":"","result":"","setup":"","session":""},"missing":[]}',
                  "Put missing important fields in missing. Important fields are asset/ticker, fill price, fill quantity, notional/amount, and result if visible.",
                ].join("\n"),
              },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${imageBase64}` },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      return jsonResponse({ ok: false, error: "Screenshot parser request failed." }, response.status);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content || "";
    const parsed = parseJsonObject(content);
    if (!parsed?.fields) return jsonResponse({ ok: false, error: "Could not read trade fields." }, 422);

    const fields = normalizeFields(parsed.fields);
    const hasBrokerageOrderFields = Boolean(fields.asset && fields.entryPrice && (fields.fillQuantity || fields.notional));
    const hasTraditionalTradeFields = Boolean(fields.asset && fields.entryPrice && fields.result);
    if (!hasBrokerageOrderFields && !hasTraditionalTradeFields) {
      return jsonResponse({ ok: false, error: "Could not read reliable trade fields." }, 422);
    }

    const missing = Array.isArray(parsed.missing) ? parsed.missing.map(normalizeText).filter(Boolean) : [];
    if (!fields.asset) missing.push("asset");
    if (!fields.entryPrice) missing.push("fill price");
    if (!fields.fillQuantity) missing.push("fill quantity");
    if (!fields.notional) missing.push("amount");
    if (!fields.result) missing.push("result");

    return jsonResponse({
      ok: true,
      fields,
      missing: [...new Set(missing)],
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error?.message || "Could not parse screenshot." }, 500);
  }
});
