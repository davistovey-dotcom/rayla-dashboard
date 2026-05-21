import { useEffect, useState } from "react";
import { supabase } from "./supabase";

function getCalmAuthErrorMessage(error, fallback) {
  const message = String(error?.message || "").trim();
  const normalized = message.toLowerCase();
  if (!message) return fallback;
  if (normalized.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirm your email, then sign in again.";
  }
  if (normalized.includes("already registered") || normalized.includes("already been registered")) {
    return "That email already has a Rayla account. Sign in instead.";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Too many attempts. Wait a moment, then try again.";
  }
  return message;
}

const TUTORIAL_SLIDES = [
  { title: "Welcome to Rayla", desc: "Rayla is your AI-powered trading companion. Track your trades, find your edge, and get real-time market intelligence — all in one place." },
  { title: "Log your trades", desc: "Head to the Trades tab to log every entry. Track your asset, setup, session, and result in R. The more you log, the smarter your coach gets." },
  { title: "Meet your AI Coach", desc: "The AI Coach tab analyzes your trade history and finds your strongest edges, weakest patterns, and what to focus on next. Ask it anything about your performance." },
  { title: "Daily market intel", desc: "The Intel tab scans the S&P 500 and top crypto every day. It shows you what's hot, what's cold, and the news driving each move." },
  { title: "Ask Rayla", desc: "Type any ticker into Ask Rayla on the Intel tab. She'll give you a direct signal — hot, cold, or neutral — based on today's data." },
  { title: "Live market", desc: "The Market tab shows live prices for every symbol in your watchlist. Add any stock or crypto and get real-time quotes and charts." },
];

export function Tutorial({ onDone }) {
  const [current, setCurrent] = useState(0);
  const isLast = current === TUTORIAL_SLIDES.length - 1;
  const slide = TUTORIAL_SLIDES[current];

  return (
    <div style={{ minHeight: "100vh", background: "#0b1017", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", textAlign: "center" }}>
      <div style={{ fontSize: "13px", color: "#7CC4FF", letterSpacing: "3px", textTransform: "uppercase", fontWeight: 700, marginBottom: "32px" }}>Rayla</div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "40px" }}>
        {TUTORIAL_SLIDES.map((_, i) => (
          <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", background: i === current ? "#7CC4FF" : "rgba(255,255,255,0.15)", transition: "background 0.3s" }} />
        ))}
      </div>
      <div style={{ fontSize: "26px", fontWeight: 600, color: "#ffffff", marginBottom: "14px", letterSpacing: "-0.3px", maxWidth: "420px" }}>{slide.title}</div>
      <div style={{ fontSize: "15px", color: "#94a3b8", lineHeight: 1.75, maxWidth: "380px", marginBottom: "44px" }}>{slide.desc}</div>
      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        <button onClick={onDone} style={{ background: "transparent", color: "#ffffff", border: "none", fontSize: "14px", fontWeight: 500, cursor: "pointer", padding: "13px 16px", opacity: 0.6 }}>Skip</button>
        <button onClick={() => isLast ? onDone() : setCurrent(c => c + 1)} style={{ background: "#7CC4FF", color: "#0b1017", border: "none", borderRadius: "10px", padding: "13px 36px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
          {isLast ? "Get Started" : "Next"}
        </button>
      </div>
    </div>
  );
}

function SplashScreen({ onEnter }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="authSplash">
      <div className="authSplashIdentity" style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(10px)" }}>
        <img className="authSplashBadge" src="/badger.png" alt="" />
        <img className="authSplashLogo" src="/rayla-logo.png" alt="Rayla" />
      </div>
      <button className="authSplashButton" onClick={onEnter} style={{ opacity: visible ? 1 : 0 }}>Continue</button>
    </div>
  );
}

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [screen, setScreen] = useState("splash");
  const [authMessage, setAuthMessage] = useState(null);

  async function handleSignUp() {
  if (loading) return;
  setAuthMessage(null);
  if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
    setAuthMessage({ type: "error", text: "Enter your email and password first." });
    return;
  }

  if (password.length < 6) {
    setAuthMessage({ type: "error", text: "Use at least 6 characters for your password." });
    return;
  }

  if (password !== confirmPassword) {
    setAuthMessage({ type: "error", text: "Passwords do not match." });
    return;
  }

  setLoading(true);
  const { error } = await supabase.auth.signUp({ email, password });
  setLoading(false);

  if (error) {
    setAuthMessage({ type: "error", text: getCalmAuthErrorMessage(error, "Could not create account.") });
    return;
  }

  setAuthMessage({ type: "success", text: "Account created. Check your email to verify your account." });
  setIsCreatingAccount(false);
  setPassword("");
  setConfirmPassword("");
}

  async function handleSignIn() {
    if (loading) return;
    setAuthMessage(null);
    if (!email.trim() || !password.trim()) {
      setAuthMessage({ type: "error", text: "Enter your email and password first." });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setAuthMessage({ type: "error", text: getCalmAuthErrorMessage(error, "Could not sign in.") });
      return;
    }
    onLogin?.(data);
  }

  if (screen === "splash") return <SplashScreen onEnter={() => setScreen("login")} />;

  
  return (
    <div className="authPage">
      <div className="authCard">
        <div className="authIdentity">
          <img className="authBadge" src="/badger.png" alt="" />
          <img className="authLogo" src="/rayla-logo.png" alt="Rayla" />
        </div>
        <h1 className="authTitle">{isCreatingAccount ? "Create your workspace" : "Welcome back"}</h1>
        <div className="authForm">
          <label className="authLabel">Email</label>
          <input className="authInput" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="authLabel">Password</label>
<input
  className="authInput"
  type="password"
  placeholder="Minimum 6 characters"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
/>

{isCreatingAccount && (
  <>
    <label className="authLabel">Confirm Password</label>
    <input
      className="authInput"
      type="password"
      placeholder="Retype your password"
      value={confirmPassword}
      onChange={(e) => setConfirmPassword(e.target.value)}
    />
  </>
)}
          <button
  className="authPrimaryButton"
  onClick={isCreatingAccount ? handleSignUp : handleSignIn}
  disabled={loading}
>
  {loading ? (isCreatingAccount ? "Creating account..." : "Signing in...") : isCreatingAccount ? "Create account" : "Sign in"}
</button>
          <button
  className="authSecondaryButton"
  onClick={() => {
    setAuthMessage(null);
    if (isCreatingAccount) {
      setIsCreatingAccount(false);
      setPassword("");
      setConfirmPassword("");
    } else {
      setIsCreatingAccount(true);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    }
  }}
  disabled={loading}
>
  {isCreatingAccount ? "Back to sign in" : "Create account"}
</button>
          {authMessage ? (
            <div className={`authMessage ${authMessage.type === "success" ? "success" : "error"}`}>
              {authMessage.text}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
