// Behavior Capture (Phase 1) — trade-close reflection helpers.
//
// The goal: when a live brokerage position closes, queue a passive "want to
// reflect on this?" prompt. When the user next opens Ask Rayla they see a
// chip under the toolbar. Clicking the chip starts a short conversation
// with Rayla that ends with a LEDGER_ENTRY marker; the client parses that
// marker and silently INSERTs a decision_ledger_entries row.
//
// This module owns:
//   - close-detection over the brokerage-positions snapshot stream
//   - localStorage-backed pending-capture queue (per user, 3 items, 3d TTL)
//   - LEDGER_ENTRY marker parsing + stripping
//
// It is pure — no React, no supabase calls. Parent (App.jsx) wires effects
// and DB writes; this module only shapes data.

const QUEUE_MAX_ITEMS = 3;
const QUEUE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

function queueKey(userId) {
  return userId ? `rayla_capture_queue_${userId}` : null;
}

function normalizePosition(p) {
  if (!p) return null;
  const symbol = String(p.symbol || "").toUpperCase().trim();
  if (!symbol) return null;
  return {
    symbol,
    qty: Number(p.qty),
    avgEntryPrice: Number(p.avgEntryPrice ?? p.avg_entry_price),
    currentPrice: Number(p.currentPrice ?? p.current_price),
    marketValue: Number(p.marketValue ?? p.market_value),
    unrealizedPl: Number(p.unrealizedPl ?? p.unrealized_pl),
    unrealizedPlpc: Number(p.unrealizedPlpc ?? p.unrealized_plpc),
    // Some flows tag positions with a stable id; fall back to symbol.
    positionId: String(p.id || p.positionId || p.symbol || "").trim() || symbol,
  };
}

// Diffs the previous vs current broker-positions snapshot and returns the
// positions that were present before and are gone now. Each returned item
// carries the outcome data derived from the prev snapshot (since Alpaca
// stops reporting the row once closed). Never touches localStorage — the
// caller decides whether to enqueue.
export function detectClosedPositions(prevArr, currArr) {
  const prevList = (Array.isArray(prevArr) ? prevArr : []).map(normalizePosition).filter(Boolean);
  const currSyms = new Set(
    (Array.isArray(currArr) ? currArr : [])
      .map((p) => String(p?.symbol || "").toUpperCase().trim())
      .filter(Boolean),
  );
  const closed = [];
  for (const p of prevList) {
    if (currSyms.has(p.symbol)) continue;
    // Compute outcome from the last-known state.
    const qty = Number.isFinite(p.qty) ? p.qty : null;
    const entryPrice = Number.isFinite(p.avgEntryPrice) && p.avgEntryPrice > 0 ? p.avgEntryPrice : null;
    const exitPrice = Number.isFinite(p.currentPrice) && p.currentPrice > 0 ? p.currentPrice : null;
    const pl = Number.isFinite(p.unrealizedPl) ? p.unrealizedPl : null;
    // unrealized_plpc is a fraction from Alpaca (e.g. 0.024 = 2.4%); normalize to percent.
    const plPct = Number.isFinite(p.unrealizedPlpc) ? p.unrealizedPlpc * 100 : null;
    const side = qty != null ? (qty >= 0 ? "long" : "short") : null;
    closed.push({
      id: `${p.symbol}:${Date.now()}`,
      symbol: p.symbol,
      positionId: p.positionId,
      side,
      qty: qty != null ? Math.abs(qty) : null,
      entryPrice,
      exitPrice,
      pl: pl != null ? Number(pl.toFixed(2)) : null,
      plPct: plPct != null ? Number(plPct.toFixed(2)) : null,
      closedAt: new Date().toISOString(),
    });
  }
  return closed;
}

// ---------------------------------------------------------------------------
// Queue — localStorage per user
// ---------------------------------------------------------------------------

function pruneExpired(items, now = Date.now()) {
  return items.filter((it) => {
    const added = Date.parse(it?.addedAt || it?.closedAt || 0);
    if (!Number.isFinite(added)) return false;
    return now - added <= QUEUE_TTL_MS;
  });
}

export function readCaptureQueue(userId) {
  const key = queueKey(userId);
  if (!key || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const pruned = pruneExpired(parsed);
    if (pruned.length !== parsed.length) writeCaptureQueue(userId, pruned);
    return pruned;
  } catch {
    return [];
  }
}

export function writeCaptureQueue(userId, arr) {
  const key = queueKey(userId);
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.isArray(arr) ? arr : []));
  } catch {
    /* private mode / quota — non-fatal */
  }
}

// Adds a capture item. Dedupes on positionId (a re-detected close for the
// same position — should be rare, but guards against React re-renders).
// Caps queue at QUEUE_MAX_ITEMS by dropping the oldest.
export function enqueueCapture(userId, item) {
  if (!userId || !item) return null;
  const existing = readCaptureQueue(userId);
  const dedupKey = item.positionId || item.symbol;
  const alreadyQueued = existing.some((it) => (it.positionId || it.symbol) === dedupKey);
  if (alreadyQueued) return null;

  const stamped = { ...item, addedAt: item.addedAt || new Date().toISOString() };
  const next = [...existing, stamped];
  // Keep the newest QUEUE_MAX_ITEMS; drop from the front (oldest first).
  const capped = next.length > QUEUE_MAX_ITEMS ? next.slice(next.length - QUEUE_MAX_ITEMS) : next;
  writeCaptureQueue(userId, capped);
  return stamped;
}

// Removes a specific queued capture by id (used when the user answers OR
// dismisses without answering — either way, we don't re-surface it).
export function dequeueCapture(userId, captureId) {
  if (!userId || !captureId) return;
  const existing = readCaptureQueue(userId);
  const next = existing.filter((it) => it.id !== captureId);
  writeCaptureQueue(userId, next);
}

// ---------------------------------------------------------------------------
// Chip label + seed message templates (client-side, no LLM roundtrip needed)
// ---------------------------------------------------------------------------

// The chip that appears under the Ask Rayla toolbar. Deliberately brief —
// name the symbol + the direction/magnitude of the result so the user knows
// what they'd be reflecting on before they click.
export function formatCaptureChipLabel(item) {
  if (!item?.symbol) return "Reflect on your recent trade";
  const symbol = item.symbol;
  const plPct = Number(item.plPct);
  if (!Number.isFinite(plPct)) return `${symbol} closed — reflect`;
  const sign = plPct >= 0 ? "+" : "";
  return `${symbol} closed — reflect (${sign}${plPct.toFixed(2)}%)`;
}

// The seed message Rayla "says" when the capture conversation opens.
// Hard-coded here so the click is instantaneous — no LLM roundtrip for the
// opening question. Rayla only takes over from the user's first reply.
export function buildCaptureSeedMessage(item) {
  if (!item?.symbol) return "That trade just closed. What did it teach you?";
  const symbol = item.symbol;
  const plPct = Number(item.plPct);
  const pl = Number(item.pl);
  const sideLabel = item.side === "short" ? "Short " : "";
  let outcome = "";
  if (Number.isFinite(plPct)) {
    const sign = plPct >= 0 ? "+" : "";
    const plStr = Number.isFinite(pl) ? ` (${pl >= 0 ? "+" : ""}$${Math.abs(pl).toFixed(2)})` : "";
    outcome = ` at ${sign}${plPct.toFixed(2)}%${plStr}`;
  }
  return `${sideLabel}${symbol} just closed${outcome}. What did that one teach you?`;
}

// ---------------------------------------------------------------------------
// LEDGER_ENTRY marker parsing
// ---------------------------------------------------------------------------
//
// Rayla emits, at the end of her capture response, a strict marker:
//
//     LEDGER_ENTRY:
//     {
//       "entry_type": "reflection",
//       "symbol": "TSLA",
//       "reasoning": "...",
//       "lesson": "...",
//       "emotion": null,
//       "rule_followed": true,
//       "outcome": "+$120 (+2.4%)"
//     }
//
// We strip everything from the marker onward when displaying the message,
// and JSON.parse the block on stream complete to write the ledger row.

const LEDGER_MARKER_START_RE = /\n\s*LEDGER_ENTRY\s*:/i;
const LEDGER_MARKER_FULL_RE = /\n\s*LEDGER_ENTRY\s*:\s*\n?(\{[\s\S]*\})\s*$/i;

// Returns the message content with the LEDGER_ENTRY block removed. Safe on
// partial streaming text — strips as soon as the marker appears, even
// before the JSON block is complete.
export function stripLedgerEntryMarker(text) {
  if (!text) return "";
  const m = text.match(LEDGER_MARKER_START_RE);
  if (!m) return text;
  return text.slice(0, m.index).trimEnd();
}

// Parses the LEDGER_ENTRY JSON block out of a complete assistant response.
// Returns null when: the marker is absent, the JSON is malformed, or the
// parsed object lacks required fields. Never throws.
//
// Per the spec: malformed markers are dropped silently and logged to
// console (the log is the caller's responsibility). The conversation
// itself is not interrupted.
export function parseLedgerEntryMarker(text) {
  if (!text) return null;
  const m = text.match(LEDGER_MARKER_FULL_RE);
  if (!m) return null;
  let parsed;
  try {
    parsed = JSON.parse(m[1]);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const validTypes = new Set(["plan", "trade", "reflection", "rule_check", "other"]);
  if (typeof parsed.entry_type !== "string" || !validTypes.has(parsed.entry_type)) return null;
  // Coerce empty strings to null for optional text fields so we don't insert
  // meaningless whitespace into the ledger.
  const cleanStr = (v) => {
    if (v == null) return null;
    const s = String(v).trim();
    return s ? s : null;
  };
  return {
    entry_type: parsed.entry_type,
    symbol: cleanStr(parsed.symbol),
    decision: cleanStr(parsed.decision),
    reasoning: cleanStr(parsed.reasoning),
    lesson: cleanStr(parsed.lesson),
    emotion: cleanStr(parsed.emotion),
    outcome: cleanStr(parsed.outcome),
    rule_followed: typeof parsed.rule_followed === "boolean" ? parsed.rule_followed : null,
    confidence: Number.isFinite(Number(parsed.confidence))
      ? Math.min(10, Math.max(1, Math.round(Number(parsed.confidence))))
      : null,
  };
}
