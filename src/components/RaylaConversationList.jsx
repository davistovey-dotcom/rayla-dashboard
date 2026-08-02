import React from "react";

// Pure conversation-list rows shared by the desktop sidebar and the mobile
// drawer. No routing / no data fetching — the parent owns state and hands
// the list + callbacks in.

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

export default function RaylaConversationList({
  conversations = [],
  currentId = null,
  onSelect,
  onDelete,
}) {
  if (conversations.length === 0) {
    return (
      <div style={{ padding: "16px", color: "#64748b", fontSize: 13, fontStyle: "italic" }}>
        No previous conversations yet.
      </div>
    );
  }

  return (
    <>
      {conversations.map((c) => {
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
      })}
    </>
  );
}
