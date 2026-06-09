import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { TourPilotBrand } from "./TourPilotBrand";

export function AuthLayout({
  title,
  subtitle,
  children,
  fullScreen = false,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  fullScreen?: boolean;
}) {
  if (fullScreen) {
    return (
      <div className="auth-page auth-page--fullscreen">
        <div className="auth-page__backdrop" aria-hidden="true" />
        <header className="auth-page__top">
          <TourPilotBrand onImage />
        </header>
        <div className="auth-card auth-card--floating">
          <div className="auth-box auth-box--floating auth-glass">
            <div className="auth-glass__shine" aria-hidden="true" />
            <div className="auth-glass__content">
              <h2 style={{ margin: "0 0 8px" }}>{title}</h2>
              <p className="muted auth-glass__subtitle" style={{ marginBottom: 20 }}>
                {subtitle}
              </p>
              {children}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <TourPilotBrand />
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

export function AuthSwitch({
  mode,
  returnTo,
}: {
  mode: "login" | "register";
  returnTo?: string | null;
}) {
  const registerTo =
    returnTo && returnTo.startsWith("/")
      ? `/register?redirect=${encodeURIComponent(returnTo)}`
      : "/register";
  const loginTo =
    returnTo && returnTo.startsWith("/")
      ? `/login?redirect=${encodeURIComponent(returnTo)}`
      : "/login";

  return (
    <p className="auth-switch muted">
      {mode === "login" ? (
        <>
          New here?{" "}
          <Link to={registerTo} className="auth-switch-link">
            Create a tourist account
          </Link>
        </>
      ) : (
        <>
          Already have an account?{" "}
          <Link to={loginTo} className="auth-switch-link">
            Log in with OTP
          </Link>
        </>
      )}
    </p>
  );
}
