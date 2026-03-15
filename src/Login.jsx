import { useState } from "react";
import { supabase } from "./supabase";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!email.trim() || !password.trim()) {
      alert("Enter your email and create a password first.");
      return;
    }

    if (password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(`${error.code || "no_code"}: ${error.message}`);
      return;
    }

    alert("Account created. Now sign in.");
    onLogin?.(data);
  }

  async function handleSignIn() {
    if (!email.trim() || !password.trim()) {
      alert("Enter your email and password first.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(`${error.code || "no_code"}: ${error.message}`);
      return;
    }

    onLogin?.(data);
  }

  return (
    <div className="authPage">
      <div className="authCard">
        <div className="authBrand">Rayla</div>
        <h1 className="authTitle">Welcome back</h1>
        <p className="authSubtitle">
          AI trading analysis and coaching, all in one place.
        </p>

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
            placeholder="Minimum 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="authPrimaryButton" onClick={handleSignIn} disabled={loading}>
            {loading ? "Loading..." : "Sign In"}
          </button>

          <button className="authSecondaryButton" onClick={handleSignUp} disabled={loading}>
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}