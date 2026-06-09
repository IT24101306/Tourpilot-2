import { Link, NavLink, Outlet } from "react-router-dom";
import { TourPilotBrand } from "./TourPilotBrand";

const DRIVER_TABS: { to: string; label: string; end?: boolean }[] = [
  { to: "/dashboard/driver", label: "Today", end: true },
  { to: "/dashboard/driver/overview", label: "Overview" },
  { to: "/dashboard/driver/assigned", label: "Assigned" },
  { to: "/dashboard/driver/tasks", label: "Tasks" },
  { to: "/dashboard/driver/vehicle", label: "Vehicle" },
  { to: "/dashboard/driver/earnings", label: "Earnings" },
  { to: "/dashboard/driver/profile", label: "Profile" },
];

export function DriverDashboardLayout() {
  return (
    <div className="agency-dashboard">
      <div className="agency-dash-chrome">
      <header className="topbar topbar--agency-dash">
        <div className="topbar-brand">
          <TourPilotBrand onDark />
          <span className="topbar-context">Driver dashboard</span>
        </div>
        <nav className="nav nav--light" aria-label="Driver utilities">
          <div className="nav-actions nav-actions--light">
            <Link to="/dashboard/driver/profile" className="nav-link-light">
              Profile
            </Link>
            <button type="button" className="agency-icon-btn" aria-label="Notifications">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              <span className="agency-icon-dot" aria-hidden="true" />
            </button>
            <Link to="/" className="nav-link-light">
              Back to Site
            </Link>
          </div>
        </nav>
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
      </div>

      <section className="agency-content">
        <Outlet />
      </section>
    </div>
  );
}
