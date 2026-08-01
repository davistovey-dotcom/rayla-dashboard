import React from "react";

// A compact conversation-history control for Ask Rayla.
//
// - Button: shows conversation count and toggles the drawer.
// - Drawer: overlays the current chat with a scrollable list of past
//   conversations (most-recent first), a "+ New" button, and per-item
//   delete. Uses only inline styles + tokens already present elsewhere in
//   the app so it inherits the Ask Rayla visual language.

function formatRelative(iso) {
  const ts = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(ts)) return "";
  const diff = Date.now() - ts;
  const min = 60 * 1000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.round(diff / min)}m ago`;
  if (diff < day) return `${Math.round(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.round(diff / day)}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function RaylaHistoryButton({ count = 0, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open conversation history"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(8,12,18,0.6)",
        color: "#94a3b8",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.2px",
        cursor: "pointer",
      }}
    >
      <span aria-hidden="true">☰</span>
      <span>History{count > 0 ? ` · ${count}` : ""}</span>
    </button>
  );
}

export default function RaylaHistoryDrawer({
  open,
  conversations = [],
  currentId = null,
  onClose,
  onSelect,
  onNew,
  onDelete,
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rayla conversation history"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 1200,
        display: "flex",
        justifyContent: "flex-start",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(360px, 90vw)",
          height: "100dvh",
          background: "#0b1220",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "10px 0 40px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: "#e2f0ff", letterSpacing: "0.2px" }}>
            Conversations
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close history"
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              fontSize: 18,
              cursor: "pointer",
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: "12px 16px" }}>
          <button
            type="button"
            onClick={onNew}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(124,196,255,0.28)",
              background: "rgba(124,196,255,0.14)",
              color: "#7CC4FF",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + New conversation
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px 16px" }}>
          {conversations.length === 0 ? (
            <div style={{ padding: "16px", color: "#64748b", fontSize: 13, fontStyle: "italic" }}>
              No previous conversations yet.
            </div>
          ) : (
            conversations.map((c) => {
              const active = c.id === currentId;
              const title = c.title && c.title.trim() ? c.title : "New conversation";
              return (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: active ? "rgba(124,196,255,0.10)" : "transparent",
                    border: active ? "1px solid rgba(124,196,255,0.22)" : "1px solid transparent",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onSelect?.(c.id)}
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      color: active ? "#e2f0ff" : "#cbd5e1",
                      textAlign: "left",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: active ? 700 : 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={title}
                    >
                      {title}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{formatRelative(c.updated_at)}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const ok = typeof window !== "undefined"
                        ? window.confirm(`Delete "${title}"? This cannot be undone.`)
                        : true;
                      if (ok) onDelete?.(c.id);
                    }}
                    aria-label={`Delete conversation ${title}`}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#7f8ea3",
                      fontSize: 14,
                      cursor: "pointer",
                      padding: "4px 8px",
                      borderRadius: 6,
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
