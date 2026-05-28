import { Link, NavLink, Outlet } from "react-router-dom";

const ADMIN_TABS: { to: string; label: string; end?: boolean }[] = [
  { to: "/dashboard/admin", label: "Overview", end: true },
  { to: "/dashboard/admin/offers", label: "Offers" },
];

export function AdminDashboardLayout() {
  return (
    <div className="agency-dashboard admin-dashboard">
      <header className="topbar topbar--site">
        <div className="topbar-brand">
          <Link to="/" className="brand">
            Tour<span>Pilot</span>
          </Link>
          <span className="topbar-context">Platform admin</span>
        </div>
        <div className="topbar-actions">
          <Link to="/" className="btn btn-ghost">
            Public site
          </Link>
        </div>
      </header>

      <nav className="agency-tabs" aria-label="Admin tabs">
        {ADMIN_TABS.map((tab) => (
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
