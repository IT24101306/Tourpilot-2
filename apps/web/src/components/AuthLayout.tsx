import { type ReactNode } from "react";
import { Link } from "react-router-dom";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-page">
      <div className="auth-hero">
        <Link to="/" className="brand">
          Tour<span>Pilot</span>
        </Link>
        <div
          className="hero-image"
          style={{
            margin: "24px 0 0",
            minHeight: 480,
            backgroundImage:
              'linear-gradient(to top, rgba(0,0,0,.6), rgba(0,0,0,.2)), url("https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1800")',
          }}
        >
          <h1>Your Sri Lanka journey starts here</h1>
          <p>Phone + OTP. No passwords. Secure and simple.</p>
        </div>
      </div>
      <div className="auth-card">
        <div className="auth-box">
          <h2 style={{ margin: "0 0 8px" }}>{title}</h2>
          <p className="muted" style={{ marginBottom: 20 }}>
            {subtitle}
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}

export function AuthSwitch({ mode }: { mode: "login" | "register" }) {
  return (
    <p className="auth-switch muted">
      {mode === "login" ? (
        <>
          New here?{" "}
          <Link to="/register" className="auth-switch-link">
            Create a tourist account
          </Link>
        </>
      ) : (
        <>
          Already have an account?{" "}
          <Link to="/login" className="auth-switch-link">
            Log in with OTP
          </Link>
        </>
      )}
    </p>
  );
}
