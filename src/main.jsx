import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

function RaylaCrashProbe() {
  throw new Error("Rayla test crash probe");
}

class RaylaErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Rayla app error boundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          background: "#0b1017",
          color: "#e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily: '"Satoshi", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>
          <div style={{
            width: "100%",
            maxWidth: 420,
            background: "rgba(18,26,38,0.86)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 18,
            padding: 24,
            textAlign: "center",
            boxShadow: "0 18px 54px rgba(0,0,0,0.22)",
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Rayla hit a temporary display issue.
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 18 }}>
              Your data was not changed.
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: "1px solid rgba(124,196,255,0.28)",
                background: "rgba(124,196,255,0.14)",
                color: "#f8fbff",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Reload Rayla
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <RaylaErrorBoundary>
    {import.meta.env.DEV && window.location.search.includes("__rayla_test_crash=1")
      ? <RaylaCrashProbe />
      : <App />}
  </RaylaErrorBoundary>
);

