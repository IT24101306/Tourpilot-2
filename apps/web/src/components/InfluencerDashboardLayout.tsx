import { Link, Outlet } from "react-router-dom";
import "../styles/dashboard.css";

export function InfluencerDashboardLayout() {
  return (
    <main className="agent-dashboard influencer-dashboard-shell">
      <header className="agent-topbar">
        <h1 className="agent-brand">
          Tour<span>Pilot</span> InfluencerDashboard
        </h1>
        <div className="agent-top-actions">
          <button type="button" className="agent-icon-btn" aria-label="Notifications">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path
                d="M15 17H5C5.95 16.1 6.5 14.9 6.5 13.6V10.5C6.5 7.46 8.96 5 12 5C15.04 5 17.5 7.46 17.5 10.5V13.6C17.5 14.9 18.05 16.1 19 17H15Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10 19C10.35 19.6 11.12 20 12 20C12.88 20 13.65 19.6 14 19"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="agent-icon-dot" aria-hidden="true" />
          </button>
          <Link to="/profile" className="btn btn-ghost">
            Profile
          </Link>
          <Link to="/" className="btn btn-ghost">
            Back to Site
          </Link>
        </div>
      </header>

      <Outlet />
    </main>
  );
}
