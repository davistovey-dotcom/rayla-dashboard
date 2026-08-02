import React from "react";
import RaylaConversationList from "./RaylaConversationList";

// Compact history button — used only on mobile (the desktop sidebar is
// always visible, so no button is needed there).
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

// Mobile drawer — overlay panel that slides in from the left. Wraps the
// same RaylaConversationList used by the desktop sidebar so the two views
// stay in sync.
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
          <RaylaConversationList
            conversations={conversations}
            currentId={currentId}
            onSelect={(id) => { onSelect?.(id); onClose?.(); }}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}

// Desktop sidebar — always visible next to the chat surface. Same list
// component as the drawer.
export function RaylaConversationSidebar({
  conversations = [],
  currentId = null,
  onSelect,
  onNew,
  onDelete,
}) {
  return (
    <aside
      aria-label="Rayla conversation history"
      style={{
        width: 260,
        minWidth: 260,
        display: "flex",
        flexDirection: "column",
        background: "rgba(10,14,20,0.6)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "#7f8ea3", letterSpacing: "0.6px", textTransform: "uppercase" }}>
          Conversations
        </div>
      </div>
      <div style={{ padding: "10px 12px" }}>
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
      <div style={{ flex: 1, overflowY: "auto", padding: "2px 6px 10px" }}>
        <RaylaConversationList
          conversations={conversations}
          currentId={currentId}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      </div>
    </aside>
  );
}
