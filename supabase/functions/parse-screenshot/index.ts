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

function diagnosticFailure({
  error,
  status = 422,
  collapsePoint = "exception_before_parse",
  provider = "",
  providerStatus = null,
  providerError = "",
  rawText = "",
  extractedCandidates = null,
  normalizedFields = null,
  partialPrefill = null,
  failedFields = [],
  failureReasons = [],
  confidence = null,
}) {
  const payload = {
    ok: false,
    error,
    provider: provider || (providerStatus || providerError ? "openai" : undefined),
    providerStatus,
    providerError,
    rawText,
    extractedCandidates,
    normalizedFields,
    partialPrefill: partialPrefill || { fields: {}, notes: {}, fieldCount: 0 },
    failedFields,
    failureReasons,
    collapsePoint,
    confidence: confidence || { score: 0, fields: [], byField: {} },
  };
  logParseDiagnostic(collapsePoint, payload);
  return jsonResponse(payload, status);
}

function getVisionProviderConfig() {
  const openAiKey = Deno.env.get("OPENAIKEY") || Deno.env.get("OPENAI_API_KEY") || "";
  if (openAiKey) {
    return {
      provider: "openai",
      apiKey: openAiKey,
      url: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4o-mini",
      headers: {},
    };
  }

  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY") || "";
  if (openRouterKey) {
    return {
      provider: "openrouter",
      apiKey: openRouterKey,
      url: "https://openrouter.ai/api/v1/chat/completions",
      model: "openai/gpt-4o-mini",
      headers: {
        "HTTP-Referer": "https://rayla.app",
        "X-Title": "Rayla Screenshot Parser",
      },
    };
  }

  return null;
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

const COMPANY_TICKER_MAP = new Map([
  ["NRG ENERGY", "NRG"],
  ["NRG ENERGY INC", "NRG"],
  ["NRG ENERGY INC.", "NRG"],
]);

function compactCompanyName(value) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/\b(COMMON STOCK|CLASS A|CLASS B|INCORPORATED|INC|CORPORATION|CORP|COMPANY|CO|LTD|PLC)\b\.?/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function resolveTickerFromCompanyName(value) {
  const compact = compactCompanyName(value);
  if (!compact) return "";
  return COMPANY_TICKER_MAP.get(compact) || "";
}

function normalizeAssetSymbol(value) {
  const normalized = normalizeText(value).toUpperCase();
  return /^[A-Z][A-Z0-9./-]{0,11}$/.test(normalized) ? normalized : "";
}

function resolveAssetFromCandidates(fields = {}) {
  const symbolCandidates = [fields.asset, fields.ticker, fields.symbol];
  const directAsset = normalizeAssetSymbol(symbolCandidates.find((value) => normalizeAssetSymbol(value)));
  const companyCandidates = [
    fields.companyName,
    fields.company,
    fields.securityName,
    fields.assetName,
    fields.name,
    ...symbolCandidates.filter((value) => !normalizeAssetSymbol(value)),
  ];
  const companyResolvedAsset = companyCandidates
    .map(resolveTickerFromCompanyName)
    .find(Boolean) || "";
  const companySource = companyCandidates.find((value) => resolveTickerFromCompanyName(value)) || "";

  return {
    asset: directAsset || companyResolvedAsset,
    directAsset,
    companyResolvedAsset,
    companySource,
  };
}

function normalizeNumberString(value, { allowNegative = false } = {}) {
  const raw = normalizeText(value).replace(/[,$]/g, "").replace(/[rR]/g, "");
  if (!raw) return "";
  const numericTokens = raw.match(/-?\d+(?:\.\d+)?/g) || [];
  if (numericTokens.length !== 1) return "";
  const parsed = Number.parseFloat(numericTokens[0]);
  if (!Number.isFinite(parsed)) return "";
  if (!allowNegative && parsed <= 0) return "";
  return String(parsed);
}

function normalizeDateTimeLocal(value) {
  const raw = normalizeText(value);
  if (!raw) return "";
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed).toISOString().slice(0, 16);
}

function normalizeDirection(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized.includes("buy") || normalized === "long") return "long";
  if (normalized.includes("sell short") || normalized === "short") return "short";
  return "";
}

function normalizeFields(fields = {}) {
  const { asset, directAsset, companyResolvedAsset, companySource } = resolveAssetFromCandidates(fields);
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
  const filledAt = normalizeDateTimeLocal(fields.filledAt || fields.executedAt || fields.executionTime || fields.fillTime);
  const submittedAt = normalizeDateTimeLocal(fields.submittedAt || fields.submittedTime || fields.orderSubmittedAt);
  const entryTime = filledAt || normalizeDateTimeLocal(fields.entryTime || fields.entryDate || fields.tradeDate || fields.date) || submittedAt;

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
    entryTime,
    filledAt,
    submittedAt,
    direction: normalizeDirection(fields.direction || fields.side || fields.orderSide || fields.action),
    result,
    setup: normalizeText(fields.setup).toLowerCase(),
    session: normalizeText(fields.session),
    confidence: buildFieldConfidence({ directAsset, companyResolvedAsset, entryPrice, fillQuantity, notional, entryTime, result }),
    diagnostics: {
      assetSource: directAsset ? "ticker" : companyResolvedAsset ? "company-name-map" : "",
      companySource,
    },
  };
}

function buildFieldConfidence({ directAsset, companyResolvedAsset, entryPrice, fillQuantity, notional, entryTime, result }) {
  const scoreParts = [];
  const byField = {
    asset: directAsset ? { score: 0.35, source: "ticker" } : companyResolvedAsset ? { score: 0.3, source: "company-name-map" } : { score: 0, source: "" },
    entryPrice: entryPrice ? { score: 0.25, source: "fill-price" } : { score: 0, source: "" },
    fillQuantity: fillQuantity ? { score: 0.15, source: "filled-quantity" } : { score: 0, source: "" },
    notional: notional ? { score: 0.2, source: "order-amount" } : { score: 0, source: "" },
    entryTime: entryTime ? { score: 0.1, source: "filled-or-submitted-time" } : { score: 0, source: "" },
    result: result ? { score: 0.1, source: "result" } : { score: 0, source: "" },
  };
  if (directAsset) scoreParts.push({ field: "asset", source: "ticker", score: 0.35 });
  else if (companyResolvedAsset) scoreParts.push({ field: "asset", source: "company-name-map", score: 0.3 });
  if (entryPrice) scoreParts.push({ field: "fill price", score: 0.25 });
  if (fillQuantity) scoreParts.push({ field: "fill quantity", score: 0.15 });
  if (notional) scoreParts.push({ field: "amount", score: 0.2 });
  if (entryTime) scoreParts.push({ field: "filled time", score: 0.1 });
  if (result) scoreParts.push({ field: "result", score: 0.1 });

  const score = Math.min(1, scoreParts.reduce((sum, part) => sum + part.score, 0));
  return {
    score: Number(score.toFixed(2)),
    fields: scoreParts.map(({ field, source }) => source ? `${field}:${source}` : field),
    byField,
  };
}

function buildPartialPrefill(fields) {
  const partial = {};
  const notes = {};
  const companySource = normalizeText(fields?.diagnostics?.companySource);

  if (fields?.diagnostics?.assetSource === "ticker" && fields.asset) {
    partial.asset = fields.asset;
  } else if (fields?.diagnostics?.assetSource === "company-name-map" && fields.asset) {
    partial.asset = fields.asset;
  } else if (companySource) {
    partial.asset = companySource;
    notes.asset = "Confirm ticker.";
  }

  if (fields?.entryPrice) partial.entryPrice = fields.entryPrice;
  if (fields?.notional) partial.size = fields.notional;
  if (fields?.entryTime) partial.entryTime = fields.entryTime;
  if (fields?.direction) partial.direction = fields.direction;

  return {
    fields: partial,
    notes,
    fieldCount: Object.keys(partial).length,
    hasUsefulSeed: Boolean(partial.asset && (partial.direction || fields?.direction || partial.entryPrice || partial.size)),
    hasAssetOrCompany: Boolean(partial.asset),
    hasPriceOrAmount: Boolean(partial.entryPrice || partial.size),
  };
}

function hasUsefulPartialPrefill(partialPrefill) {
  return Boolean(
    partialPrefill?.hasAssetOrCompany
    && partialPrefill?.hasPriceOrAmount
  );
}

function buildFieldFailures(fields, uniqueMissing, confidence, { hasBrokerageOrderFields, hasTraditionalTradeFields, minimumConfidence }) {
  const failures = [];
  if (!fields.asset) failures.push("Could not confidently identify ticker symbol.");
  if (!fields.entryPrice && !fields.notional) failures.push("Fill price and order amount are both missing or ambiguous.");
  if (!fields.fillQuantity) failures.push("Filled quantity missing or ambiguous.");
  if (!fields.notional) failures.push("Order amount missing or ambiguous.");
  if (!fields.entryTime) failures.push("Filled timestamp missing.");
  if (!hasBrokerageOrderFields && !hasTraditionalTradeFields) failures.push("Required broker order fields did not meet the parser threshold.");
  if (confidence.score < minimumConfidence) failures.push(`Parser confidence ${confidence.score} below required ${minimumConfidence}.`);

  const failedFields = uniqueMissing.filter((field) => field !== "result");
  return {
    failedFields,
    failureReasons: [...new Set(failures)],
  };
}

function logParseDiagnostic(label, payload) {
  console.log(`parse-screenshot ${label}`, JSON.stringify(payload));
}

async function validateAuthenticatedRequest(req) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      response: diagnosticFailure({
        error: "Authentication required.",
        status: 401,
        collapsePoint: "auth_required",
        failureReasons: ["A signed-in Rayla session is required to parse screenshots."],
        failedFields: ["authorization"],
      }),
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      response: diagnosticFailure({
        error: "Parser auth is not configured.",
        status: 500,
        collapsePoint: "auth_configuration_missing",
        failureReasons: ["Missing SUPABASE_URL or SUPABASE_ANON_KEY."],
        failedFields: ["parser authentication"],
      }),
    };
  }

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: authHeader,
        apikey: supabaseAnonKey,
      },
    });

    if (!authResponse.ok) {
      return {
        ok: false,
        response: diagnosticFailure({
          error: "Authentication required.",
          status: 401,
          collapsePoint: "auth_invalid",
          failureReasons: ["The screenshot parser requires a valid signed-in Rayla session."],
          failedFields: ["authorization"],
        }),
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      response: diagnosticFailure({
        error: "Could not verify screenshot parser session.",
        status: 401,
        collapsePoint: "auth_verification_failed",
        failureReasons: [error?.message || "Supabase auth verification failed."],
        failedFields: ["authorization"],
      }),
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let requestContext = {
    rawText: "",
    extractedCandidates: null,
    normalizedFields: null,
    partialPrefill: null,
    confidence: null,
  };

  try {
    const authResult = await validateAuthenticatedRequest(req);
    if (!authResult.ok) return authResult.response;

    const visionProvider = getVisionProviderConfig();
    if (!visionProvider) {
      return diagnosticFailure({
        error: "Parser is not configured.",
        status: 500,
        collapsePoint: "exception_before_parse",
        failureReasons: ["Missing OPENAI_API_KEY, OPENAIKEY, or OPENROUTER_API_KEY."],
        failedFields: ["parser configuration"],
      });
    }

    let requestBody = null;
    try {
      requestBody = await req.json();
    } catch (error) {
      return diagnosticFailure({
        error: "Could not read screenshot request payload.",
        status: 400,
        collapsePoint: "image_decode_failed",
        failureReasons: [error?.message || "Request JSON could not be decoded."],
        failedFields: ["image payload"],
      });
    }

    const { imageBase64, mimeType = "image/jpeg" } = requestBody || {};
    if (!imageBase64) {
      return diagnosticFailure({
        error: "No image provided.",
        status: 400,
        collapsePoint: "missing_image_payload",
        failureReasons: ["The screenshot upload did not include imageBase64."],
        failedFields: ["image payload"],
      });
    }

    const response = await fetch(visionProvider.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${visionProvider.apiKey}`,
        ...visionProvider.headers,
      },
      body: JSON.stringify({
        model: visionProvider.model,
        temperature: 0,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content: [
              "Extract trade/order fields from brokerage screenshots.",
              "Return JSON only. Do not guess unreadable fields.",
              "Common supported layouts include Robinhood mobile order detail screens with labels like Symbol, Filled quantity, Average price, Fill price, Amount, Total, Submitted, Executed, Buy, and Sell.",
              "If a ticker is not visible but a company/security name is visible, return that text in companyName and leave ticker empty.",
              "For fractional shares, preserve the decimal quantity.",
              "For dollar amount/notional, return the dollar amount separately from share quantity.",
              "If multiple timestamps are visible, return the filled/executed timestamp in filledAt and the submitted timestamp in submittedAt.",
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
                  '{"ok":true,"rawText":"","fields":{"asset":"","ticker":"","symbol":"","companyName":"","entryPrice":"","fillPrice":"","fillQuantity":"","quantity":"","notional":"","amount":"","size":"","filledAt":"","submittedAt":"","entryTime":"","direction":"","result":"","setup":"","session":""},"missing":[]}',
                  "rawText should be a concise transcription of visible order-detail labels and values only.",
                  "Put missing important fields in missing. Important fields are asset/ticker or companyName, fill price, fill quantity, notional/amount, filled timestamp if visible, and result if visible.",
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
      const providerText = await response.text();
      let providerPayload = null;
      try {
        providerPayload = JSON.parse(providerText);
      } catch {
        providerPayload = { message: providerText.slice(0, 1000) };
      }
      const providerError = providerPayload?.error?.message || providerPayload?.message || "Screenshot parser request failed.";
      return diagnosticFailure({
        error: providerError,
        status: response.status,
        collapsePoint: "upstream_vision_error",
        provider: visionProvider.provider,
        providerStatus: response.status,
        providerError,
        failureReasons: [`${visionProvider.provider} vision request failed with status ${response.status}.`],
        failedFields: ["upstream vision"],
      });
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content || "";
    if (!content) {
      return diagnosticFailure({
        error: "Vision response was empty.",
        status: 422,
        collapsePoint: "upstream_empty_response",
        provider: visionProvider.provider,
        failureReasons: [`${visionProvider.provider} returned no message content.`],
        failedFields: ["upstream vision content"],
      });
    }
    const parsed = parseJsonObject(content);
    if (!parsed?.fields) {
      return diagnosticFailure({
        error: "Could not read structured trade fields from screenshot.",
        status: 422,
        collapsePoint: "malformed_model_output",
        failedFields: ["structured parser output"],
        failureReasons: ["Vision response did not include the expected fields object."],
        rawText: "",
        extractedCandidates: null,
        providerError: content.slice(0, 2500),
      });
    }

    const fields = normalizeFields(parsed.fields);
    const confidence = fields.confidence || { score: 0, fields: [] };
    const partialPrefill = buildPartialPrefill(fields);
    requestContext = {
      rawText: normalizeText(parsed.rawText).slice(0, 3000),
      extractedCandidates: parsed.fields,
      normalizedFields: fields,
      partialPrefill,
      confidence,
    };
    const hasBrokerageOrderFields = Boolean(fields.asset && fields.entryPrice && (fields.fillQuantity || fields.notional));
    const hasTraditionalTradeFields = Boolean(fields.asset && fields.entryPrice && fields.result);
    const hasUsefulPartial = hasUsefulPartialPrefill(partialPrefill);
    const missing = Array.isArray(parsed.missing) ? parsed.missing.map(normalizeText).filter(Boolean) : [];
    if (!fields.asset) missing.push("asset");
    if (!fields.entryPrice) missing.push("fill price");
    if (!fields.fillQuantity) missing.push("fill quantity");
    if (!fields.notional) missing.push("amount");
    if (!fields.entryTime) missing.push("filled timestamp");
    if (!fields.result) missing.push("result");
    const uniqueMissing = [...new Set(missing)];
    const minimumConfidence = hasTraditionalTradeFields ? 0.6 : 0.75;
    const fullParseFailed = (!hasBrokerageOrderFields && !hasTraditionalTradeFields) || confidence.score < minimumConfidence;
    if (fullParseFailed && !hasUsefulPartial) {
      const { failedFields, failureReasons } = buildFieldFailures(fields, uniqueMissing, confidence, {
        hasBrokerageOrderFields,
        hasTraditionalTradeFields,
        minimumConfidence,
      });
      const diagnostic = {
        rawText: normalizeText(parsed.rawText).slice(0, 3000),
        extractedCandidates: parsed.fields,
        normalizedFields: fields,
        partialPrefill,
        missing: uniqueMissing,
        failedFields,
        failureReasons,
        confidence,
        collapsePoint: partialPrefill.fieldCount > 0 ? "insufficient_hard_blocker_fields" : "no_trustworthy_partial_fields",
      };
      logParseDiagnostic("field_failure", diagnostic);
      return jsonResponse({
        ok: false,
        error: failureReasons[0] || "Could not read reliable trade fields.",
        failedFields,
        failureReasons,
        missing: uniqueMissing,
        rawText: diagnostic.rawText,
        extractedCandidates: parsed.fields,
        normalizedFields: fields,
        partialPrefill,
        collapsePoint: diagnostic.collapsePoint,
        confidence,
      }, 422);
    }

    const responseOk = !fullParseFailed;
    logParseDiagnostic(responseOk ? "success" : "partial_success", {
      rawText: normalizeText(parsed.rawText).slice(0, 3000),
      extractedCandidates: parsed.fields,
      normalizedFields: fields,
      partialPrefill,
      missing: uniqueMissing,
      confidence,
      collapsePoint: responseOk ? "" : "partial_prefill_survived_strict_confidence",
    });

    return jsonResponse({
      ok: responseOk,
      partial: !responseOk,
      error: responseOk ? undefined : "Partially read screenshot fields.",
      failureReasons: responseOk ? [] : buildFieldFailures(fields, uniqueMissing, confidence, {
        hasBrokerageOrderFields,
        hasTraditionalTradeFields,
        minimumConfidence,
      }).failureReasons,
      failedFields: responseOk ? [] : buildFieldFailures(fields, uniqueMissing, confidence, {
        hasBrokerageOrderFields,
        hasTraditionalTradeFields,
        minimumConfidence,
      }).failedFields,
      fields,
      missing: uniqueMissing,
      rawText: normalizeText(parsed.rawText).slice(0, 3000),
      extractedCandidates: parsed.fields,
      normalizedFields: fields,
      partialPrefill,
      collapsePoint: responseOk ? "" : "partial_prefill_survived_strict_confidence",
      confidence,
    }, responseOk ? 200 : 200);
  } catch (error) {
    return diagnosticFailure({
      error: error?.message || "Could not parse screenshot.",
      status: 500,
      collapsePoint: "exception_before_parse",
      rawText: requestContext.rawText,
      extractedCandidates: requestContext.extractedCandidates,
      normalizedFields: requestContext.normalizedFields,
      partialPrefill: requestContext.partialPrefill,
      confidence: requestContext.confidence,
      failedFields: ["parser exception"],
      failureReasons: [error?.stack || error?.message || "Unknown parser exception."],
    });
  }
});
