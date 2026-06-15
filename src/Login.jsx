import { useEffect, useState } from "react";
import { supabase } from "./supabase";

function getCalmAuthErrorMessage(error, fallback) {
  const message = String(error?.message || "").trim();
  const normalized = message.toLowerCase();
  if (!message) return fallback;
  if (normalized.includes("invalid login credentials")) return "Email or password is incorrect.";
  if (normalized.includes("email not confirmed")) return "Confirm your email, then sign in again.";
  if (normalized.includes("already registered") || normalized.includes("already been registered")) return "That email already has a Rayla account. Sign in instead.";
  if (normalized.includes("rate limit") || normalized.includes("too many")) return "Too many attempts. Wait a moment, then try again.";
  if (normalized.includes("token") && normalized.includes("expired")) return "That code has expired. Use Resend to get a new one.";
  if (normalized.includes("otp") || normalized.includes("token is invalid")) return "That code is incorrect or has expired. Check your email or use Resend.";
  return "Something went wrong. Please try again.";
}

function getAuthRedirectUrl() {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}/`;
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

const RESEND_COOLDOWN_SECONDS = 60;

function VerifyEmailScreen({ email, onVerify, onResend, onChangeEmail, authMessage }) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [codeError, setCodeError] = useState(null);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleVerify() {
    const trimmed = code.replace(/\s/g, "");
    if (!trimmed) {
      setCodeError("Enter the code from your email.");
      return;
    }
    if (verifying) return;
    setVerifying(true);
    setCodeError(null);
    const result = await onVerify(trimmed);
    setVerifying(false);
    if (result?.error) {
      setCodeError(result.error);
      setCode("");
    }
    // On success the parent session fires via onAuthStateChange — app transitions automatically
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setCodeError(null);
    setCode("");
    await onResend();
    setResending(false);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  function handleCodeInput(e) {
    // Allow digits and letters, strip spaces, cap at 8 chars
    const val = e.target.value.replace(/[^0-9a-zA-Z]/g, "").slice(0, 8);
    setCode(val);
    setCodeError(null);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleVerify();
  }

  const canResend = cooldown === 0 && !resending;

  return (
    <div className="authPage">
      <div className="authCard">
        <div className="authIdentity">
          <img className="authBadge" src="/badger.png" alt="" />
          <img className="authLogo" src="/rayla-logo.png" alt="Rayla" />
        </div>
        <h1 className="authTitle">Verify your email</h1>
        <div className="authForm">
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6, marginBottom: 6 }}>
              We sent a verification code to:
            </div>
            <div style={{ color: "#ffffff", fontSize: 15, fontWeight: 600, wordBreak: "break-all" }}>
              {email}
            </div>
          </div>

          <label className="authLabel">Verification Code</label>
          <input
            className="authInput"
            type="text"
            inputMode="numeric"
            placeholder="Enter the code from your email"
            value={code}
            onChange={handleCodeInput}
            onKeyDown={handleKeyDown}
            maxLength={8}
            autoComplete="one-time-code"
            autoFocus
            style={{ letterSpacing: "0.2em", fontSize: 20, textAlign: "center" }}
          />

          {codeError ? (
            <div className="authMessage error">{codeError}</div>
          ) : authMessage ? (
            <div className={`authMessage ${authMessage.type === "success" ? "success" : "error"}`}>
              {authMessage.text}
            </div>
          ) : null}

          <button
            className="authPrimaryButton"
            onClick={handleVerify}
            disabled={verifying || !code.trim()}
          >
            {verifying ? "Verifying..." : "Verify Account"}
          </button>

          <div style={{ background: "rgba(124,196,255,0.07)", border: "1px solid rgba(124,196,255,0.15)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7 }}>
              Check your <strong style={{ color: "#cbd5e1" }}>spam or junk folder</strong> if the code doesn&rsquo;t arrive. Clicking the link in the email also works if you prefer.
            </div>
          </div>

          <button
            className="authSecondaryButton"
            onClick={handleResend}
            disabled={!canResend}
            style={{ opacity: canResend ? 1 : 0.55 }}
          >
            {resending ? "Sending new code..." : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>

          <button
            className="authSecondaryButton"
            onClick={onChangeEmail}
          >
            Use a different email address
          </button>

          <div style={{ color: "#475569", fontSize: 12, lineHeight: 1.5, marginTop: 4, textAlign: "center" }}>
            Codes may take a few minutes to arrive.
          </div>
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
  const [screen, setScreen] = useState("splash"); // "splash" | "login" | "verify"
  const [authMessage, setAuthMessage] = useState(null);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationType, setVerificationType] = useState("signup");

  useEffect(() => {
    // If the user arrives via an email confirmation link, the Supabase client
    // parses the URL hash and fires SIGNED_IN. Detect that here so we skip
    // the code-entry screen and go straight into the app.
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) onLogin?.({ session: data.session, user: data.session.user });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        onLogin?.({ session, user: session.user });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSignUp() {
    if (loading) return;
    setAuthMessage(null);
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      setAuthMessage({ type: "error", text: "Enter your email and password first." });
      return;
    }
    const missingRules = [];
    if (password.length < 8) missingRules.push("at least 8 characters");
    if (!/[A-Z]/.test(password)) missingRules.push("an uppercase letter");
    if (!/[0-9]/.test(password)) missingRules.push("a number");
    if (!/[^A-Za-z0-9]/.test(password)) missingRules.push("a special character");
    if (missingRules.length > 0) {
      setAuthMessage({ type: "error", text: `Password must include ${missingRules.join(", ")}.` });
      return;
    }
    if (password !== confirmPassword) {
      setAuthMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    setLoading(true);
    try {
      // Create the user through Supabase's signup flow so the Confirmation email
      // template can send {{ .Token }} for desktop code entry.
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
          data: {
            timezone: browserTimeZone,
          },
        },
      });

      console.log("[signup debug] data:", JSON.stringify(data, null, 2), "error:", JSON.stringify(error, null, 2));

      console.info("[auth] signup verification requested", {
        email: normalizedEmail,
        ok: !error,
        userId: data?.user?.id || null,
        hasSession: Boolean(data?.session),
        emailConfirmedAt: data?.user?.email_confirmed_at || null,
        timezone: browserTimeZone,
        error: error?.message || null,
      });

      if (error) {
        console.error("[auth] signup verification error", { message: error.message, status: error.status });
        setAuthMessage({ type: "error", text: getCalmAuthErrorMessage(error, "Could not send verification email.") });
        return;
      }

      if (data?.session) {
        onLogin?.(data);
        return;
      }

      if (data?.user?.identities?.length === 0) {
        setAuthMessage({
          type: "error",
          text: "An account with this email already exists. Try signing in, or reset your password later.",
        });
        setIsCreatingAccount(false);
        return;
      }

      setVerificationEmail(normalizedEmail);
      setVerificationType("signup");
      setPassword("");
      setConfirmPassword("");
      setAuthMessage({ type: "success", text: "Verification email sent. Check your inbox and spam folder." });
      setScreen("verify");
    } catch (err) {
      console.error("[auth] signup verification threw", err);
      setAuthMessage({ type: "error", text: getCalmAuthErrorMessage(err, "Could not send verification email.") });
    } finally {
      setLoading(false);
    }
  }

  // Called by VerifyEmailScreen with the code the user typed
  async function handleVerifyCode(code) {
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: verificationEmail,
        token: code,
        type: verificationType,
      });

      console.info("[auth] verify OTP", {
        email: verificationEmail,
        type: verificationType,
        ok: !verifyError,
        hasSession: Boolean(data?.session),
        userId: data?.user?.id || null,
        error: verifyError?.message || null,
      });

      if (verifyError) {
        console.error("[auth] verify OTP failed", verifyError);
        return { error: getCalmAuthErrorMessage(verifyError, "That code is incorrect or has expired. Use Resend to get a new one.") };
      }

      setAuthMessage(null);

      if (!data?.session) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          return { error: "Email verified. Sign in with your password to continue." };
        }
      }

      // onAuthStateChange fires SIGNED_IN → App session is set → Login unmounts
      return { error: null };
    } catch (err) {
      console.error("[auth] verify OTP threw", err);
      return { error: getCalmAuthErrorMessage(err, "Verification failed. Please try again.") };
    }
  }

  // Called by VerifyEmailScreen resend button — sends a fresh OTP code
  async function handleResendCode() {
    const targetEmail = (verificationEmail || email).trim().toLowerCase();
    if (!targetEmail) return;
    try {
      let error = null;
      if (verificationType === "signup") {
        ({ error } = await supabase.auth.resend({
          type: "signup",
          email: targetEmail,
          options: {
            emailRedirectTo: getAuthRedirectUrl(),
          },
        }));
      } else {
        ({ error } = await supabase.auth.signInWithOtp({
          email: targetEmail,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: getAuthRedirectUrl(),
          },
        }));
      }

      console.info("[auth] resend verification", { email: targetEmail, type: verificationType, ok: !error, error: error?.message || null });

      if (error) {
        console.error("[auth] resend verification failed", error);
        setAuthMessage({ type: "error", text: getCalmAuthErrorMessage(error, "Could not resend code.") });
        return;
      }

      setAuthMessage({ type: "success", text: "New code sent. Check your inbox and spam folder." });
    } catch (err) {
      console.error("[auth] resend OTP threw", err);
      setAuthMessage({ type: "error", text: getCalmAuthErrorMessage(err, "Could not resend code.") });
    }
  }

  async function handleSignIn() {
    if (loading) return;
    setAuthMessage(null);
    if (!email.trim() || !password.trim()) {
      setAuthMessage({ type: "error", text: "Enter your email and password first." });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      console.info("[auth] signin", {
        email: email.trim().toLowerCase(),
        ok: !error,
        hasSession: Boolean(data?.session),
        error: error?.message || null,
      });
      if (error) {
        setAuthMessage({ type: "error", text: getCalmAuthErrorMessage(error, "Could not sign in.") });
        return;
      }
      onLogin?.(data);
    } catch (err) {
      console.error("[auth] signin threw", err);
      setAuthMessage({ type: "error", text: getCalmAuthErrorMessage(err, "Could not sign in.") });
    } finally {
      setLoading(false);
    }
  }

  if (screen === "splash") return <SplashScreen onEnter={() => setScreen("login")} />;

  if (screen === "verify") {
    return (
      <VerifyEmailScreen
        email={verificationEmail}
        onVerify={handleVerifyCode}
        onResend={handleResendCode}
        onChangeEmail={() => {
          setScreen("login");
          setIsCreatingAccount(true);
          setEmail("");
          setPassword("");
          setConfirmPassword("");
          setVerificationEmail("");
          setVerificationType("signup");
          setAuthMessage(null);
        }}
        authMessage={authMessage}
      />
    );
  }

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
          <input
            className="authInput"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="authLabel">Password</label>
          <input
            className="authInput"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {isCreatingAccount && (
            <p style={{ margin: "4px 0 6px", fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>
              8+ characters, uppercase letter, number, and special character required.
            </p>
          )}
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
            {loading
              ? (isCreatingAccount ? "Sending code..." : "Signing in...")
              : isCreatingAccount ? "Create account" : "Sign in"}
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
