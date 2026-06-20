import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function ResetPassword() {
  const [screen, setScreen] = useState("form"); // "form" | "success"
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(() => {});
    return () => listener?.subscription?.unsubscribe();
  }, []);

  async function handleSubmit() {
    if (saving) return;
    setError(null);
    const missing = [];
    if (newPw.length < 8) missing.push("at least 8 characters");
    if (!/[A-Z]/.test(newPw)) missing.push("an uppercase letter");
    if (!/[0-9]/.test(newPw)) missing.push("a number");
    if (!/[^A-Za-z0-9]/.test(newPw)) missing.push("a special character");
    if (missing.length) {
      setError(`Password must include ${missing.join(", ")}.`);
      return;
    }
    if (newPw !== confirmPw) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
      if (updateErr) {
        const msg = String(updateErr.message || "").toLowerCase();
        if (msg.includes("auth session") || msg.includes("not authenticated") || msg.includes("jwt")) {
          setError("This reset link is no longer valid. Request a new password reset email from the sign-in screen.");
        } else {
          setError(updateErr.message || "Could not update password.");
        }
        return;
      }
      await supabase.auth.signOut({ scope: "global" }).catch((err) => {
        console.error("[reset-password] sign_out_after_update_failed", err?.message || err);
      });
      setScreen("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setSaving(false);
    }
  }

  const submitDisabled = saving || !newPw || !confirmPw;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0b1017", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: '"Satoshi", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: "#e2e8f0" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "rgba(15,22,32,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, padding: "28px 28px 24px", boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
        {screen === "form" ? (
          <>
            <div style={{ fontSize: 19, fontWeight: 700, color: "#f1f5f9", marginBottom: 8, letterSpacing: "-0.3px" }}>Set a new password</div>
            <div style={{ fontSize: 12, color: "#7f8ea3", marginBottom: 18, lineHeight: 1.5 }}>
              You arrived here from a password reset link. Choose a new password to finish.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="New password"
                autoComplete="new-password"
                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "10px 12px", fontSize: 14, color: "#f1f5f9", outline: "none", boxSizing: "border-box" }}
              />
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "10px 12px", fontSize: 14, color: "#f1f5f9", outline: "none", boxSizing: "border-box" }}
              />
              <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
                8+ characters, uppercase letter, number, and special character required.
              </div>
            </div>
            {error ? (
              <div style={{ fontSize: 12, color: "#fca5a5", marginBottom: 12, padding: "10px 12px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.18)", borderRadius: 9, lineHeight: 1.5 }}>
                {error}
              </div>
            ) : null}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitDisabled}
              style={{ width: "100%", background: submitDisabled ? "rgba(124,196,255,0.25)" : "rgba(124,196,255,0.9)", border: "1px solid rgba(124,196,255,0.35)", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 700, color: submitDisabled ? "rgba(255,255,255,0.4)" : "#0b1017", cursor: submitDisabled ? "not-allowed" : "pointer", transition: "background 0.15s, color 0.15s" }}
            >
              {saving ? "Saving..." : "Update password"}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 19, fontWeight: 700, color: "#f1f5f9", marginBottom: 12, letterSpacing: "-0.3px" }}>Password updated</div>
            <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.65 }}>
              Return to the device or app where you were using Rayla and sign in again.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
