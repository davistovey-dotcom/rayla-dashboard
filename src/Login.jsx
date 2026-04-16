import { useState } from "react";
import { supabase } from "./supabase";

function countUp(el, from, to, duration, format) {
  const start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = format(from + (to - from) * ease);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
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
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0b1017", padding: "40px", textAlign: "center" }}>
      <div id="splash-logo" style={{ fontSize: "64px", fontWeight: 700, color: "#7CC4FF", letterSpacing: "6px", textTransform: "uppercase", marginBottom: "10px", opacity: 0, transform: "translateY(20px)", transition: "opacity 0.8s ease, transform 0.8s ease" }}>Rayla</div>
      <div id="splash-tag" style={{ fontSize: "16px", color: "#94a3b8", marginBottom: "44px", opacity: 0, transition: "opacity 0.8s ease 0.5s" }}>Trading redefined with AI</div>
      <button id="splash-btn" onClick={onEnter} style={{ background: "transparent", color: "#7CC4FF", border: "1px solid #7CC4FF", borderRadius: "10px", padding: "14px 48px", fontSize: "15px", fontWeight: 700, cursor: "pointer", opacity: 0, transition: "opacity 0.8s ease 0.9s" }}>Enter</button>
      <div style={{ display: "flex", gap: "48px", marginTop: "44px" }}>
        <div style={{ textAlign: "center", opacity: 0, transition: "opacity 0.8s ease 1.4s" }} id="splash-s1">
          <div id="splash-v1" style={{ fontSize: "22px", fontWeight: 700, color: "#4ade80" }}>+0.0R</div>
          <div style={{ fontSize: "11px", color: "#3a4a5a", textTransform: "uppercase", letterSpacing: "1px", marginTop: "4px" }}>Avg edge</div>
        </div>
        <div style={{ textAlign: "center", opacity: 0, transition: "opacity 0.8s ease 1.4s" }} id="splash-s2">
          <div id="splash-v2" style={{ fontSize: "22px", fontWeight: 700, color: "#4ade80" }}>0%</div>
          <div style={{ fontSize: "11px", color: "#3a4a5a", textTransform: "uppercase", letterSpacing: "1px", marginTop: "4px" }}>Win rate</div>
        </div>
        <div style={{ textAlign: "center", opacity: 0, transition: "opacity 0.8s ease 1.4s" }} id="splash-s3">
          <div id="splash-v3" style={{ fontSize: "22px", fontWeight: 700, color: "#4ade80" }}>0</div>
          <div style={{ fontSize: "11px", color: "#3a4a5a", textTransform: "uppercase", letterSpacing: "1px", marginTop: "4px" }}>S&P tracked</div>
        </div>
      </div>
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
  const [splashReady, setSplashReady] = useState(false);

  function handleSplashMount(el) {
    if (!el || splashReady) return;
    setSplashReady(true);
    setTimeout(() => {
      const logo = document.getElementById("splash-logo");
      const tag = document.getElementById("splash-tag");
      const btn = document.getElementById("splash-btn");
      const s1 = document.getElementById("splash-s1");
      const s2 = document.getElementById("splash-s2");
      const s3 = document.getElementById("splash-s3");
      const v1 = document.getElementById("splash-v1");
      const v2 = document.getElementById("splash-v2");
      const v3 = document.getElementById("splash-v3");
      if (logo) { logo.style.opacity = "1"; logo.style.transform = "translateY(0)"; }
      if (tag) tag.style.opacity = "1";
      if (btn) btn.style.opacity = "1";
      if (s1) s1.style.opacity = "1";
      if (s2) s2.style.opacity = "1";
      if (s3) s3.style.opacity = "1";
      if (v1) countUp(v1, 0, 2.4, 800, v => "+" + v.toFixed(1) + "R");
      if (v2) countUp(v2, 0, 68, 800, v => Math.round(v) + "%");
      if (v3) countUp(v3, 0, 500, 800, v => Math.round(v) + "+");
    }, 100);
  }

  async function handleSignUp() {
  if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
    alert("Enter your email, password, and confirm your password first.");
    return;
  }

  if (password.length < 6) {
    alert("Password must be at least 6 characters.");
    return;
  }

  if (password !== confirmPassword) {
    alert("Passwords do not match.");
    return;
  }

  setLoading(true);
  const { data, error } = await supabase.auth.signUp({ email, password });
  setLoading(false);

  if (error) {
    alert(`${error.code || "no_code"}: ${error.message}`);
    return;
  }

  alert("Account created. Check your email to verify your account.");
  setIsCreatingAccount(false);
  setPassword("");
  setConfirmPassword("");
}

  async function handleSignIn() {
    if (!email.trim() || !password.trim()) { alert("Enter your email and password first."); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { alert(`${error.code || "no_code"}: ${error.message}`); return; }
    onLogin?.(data);
  }

  if (screen === "splash") return <div ref={handleSplashMount}><SplashScreen onEnter={() => setScreen("login")} /></div>;

  
  return (
    <div className="authPage">
      <div className="authCard">
        <div className="authBrand">Rayla</div>
        <h1 className="authTitle">Welcome back</h1>
        <p className="authSubtitle">AI trading analysis and coaching, all in one place.</p>
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
  {loading ? "Loading..." : isCreatingAccount ? "Create Account" : "Sign In"}
</button>
          <button
  className="authSecondaryButton"
  onClick={() => {
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
  {isCreatingAccount ? "Back to Sign In" : "Create Account"}
</button>
        </div>
      </div>
    </div>
  );
}