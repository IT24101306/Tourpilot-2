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
          <Link to="/" className="btn btn-ghost">
            Back to Site
          </Link>
        </div>
      </header>

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
  );
}
