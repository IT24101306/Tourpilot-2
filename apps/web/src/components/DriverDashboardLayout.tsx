<<<<<<< HEAD
import { Link, NavLink, Outlet } from "react-router-dom";

const DRIVER_TABS: { to: string; label: string; end?: boolean }[] = [
  { to: "/dashboard/driver", label: "Overview", end: true },
  { to: "/dashboard/driver/assigned", label: "Assigned Tours" },
  { to: "/dashboard/driver/schedule", label: "Today Schedule" },
  { to: "/dashboard/driver/vehicle", label: "Vehicle" },
  { to: "/dashboard/driver/earnings", label: "Earnings" },
  { to: "/dashboard/driver/profile", label: "Profile" },
];

export function DriverDashboardLayout() {
  return (
    <div className="agency-dashboard">
      <header className="agency-topbar">
        <div className="agency-brand">
          <span className="brand">
            Tour<span>Pilot</span>
          </span>
          <span className="agency-brand-sub">DriverDashboard</span>
        </div>
        <div className="agency-top-actions">
          <button type="button" className="agency-icon-btn" aria-label="Notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            <span className="agency-icon-dot" aria-hidden="true" />
          </button>
=======
import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/dashboard.css";

export function DriverDashboardLayout() {
  const { user } = useAuth();

  return (
    <main className="agent-dashboard driver-dashboard-shell">
      <header className="agent-topbar">
        <h1 className="agent-brand">
          Tour<span>Pilot</span> DriverDashboard
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
          {user?.role === "AGENCY" && (
            <Link to="/dashboard/agency" className="btn btn-ghost">
              Agent Dashboard
            </Link>
          )}
>>>>>>> a1fb766 (Implement dashboard and API updates)
          <Link to="/" className="btn btn-ghost">
            Back to Site
          </Link>
        </div>
      </header>

<<<<<<< HEAD
      <nav className="agency-tabs" aria-label="Driver dashboard tabs">
        {DRIVER_TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `agency-tab${isActive ? " active" : ""}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <section className="agency-content">
        <Outlet />
      </section>
    </div>
=======
      <Outlet />
    </main>
>>>>>>> a1fb766 (Implement dashboard and API updates)
  );
}
