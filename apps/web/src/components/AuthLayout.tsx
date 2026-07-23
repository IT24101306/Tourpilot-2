import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { TourPilotBrand } from "./TourPilotBrand";
import { MarketingTopNav } from "./MarketingTopNav";

export function AuthLayout({
  title,
  subtitle,
  children,
  fullScreen = false,
  billboardLines,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  fullScreen?: boolean;
  /** Large stacked headline outside the auth card (fullscreen only). */
  billboardLines?: string[];
}) {
  if (fullScreen) {
    const hasBillboard = Boolean(billboardLines?.length);
    return (
      <div
        className={`auth-page auth-page--fullscreen${hasBillboard ? " auth-page--with-billboard" : ""}`}
      >
        <div className="auth-page__backdrop" aria-hidden="true" />
        <MarketingTopNav />
        <div className="auth-page__stage">
          {hasBillboard ? (
            <p className="auth-billboard">
              {billboardLines!.map((line) => (
                <span key={line} className="auth-billboard__line">
                  {line}
                </span>
              ))}
            </p>
          ) : null}
          <div className="auth-card auth-card--floating">
            <div className="auth-box auth-box--floating auth-glass">
              <div className="auth-glass__shine" aria-hidden="true" />
              <div className="auth-glass__content">
                <h2 className="auth-box__title">{title}</h2>
                {subtitle ? (
                  <p className="muted auth-glass__subtitle auth-box__subtitle">{subtitle}</p>
                ) : null}
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <TourPilotBrand onDark />
        <div className="auth-hero__panel">
          <div className="auth-hero__copy">
            <p className="auth-hero__eyebrow">Sri Lanka travel</p>
            <h1>Your Sri Lanka journey starts here</h1>
            <p>Discover tours, save favorites, and plan with confidence.</p>
          </div>
        </div>
      </div>
      <div className="auth-card">
        <div className="auth-box">
          <h2 className="auth-box__title">{title}</h2>
          {subtitle ? <p className="muted auth-box__subtitle">{subtitle}</p> : null}
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
            Log in
          </Link>
        </>
      )}
    </p>
  );
}
