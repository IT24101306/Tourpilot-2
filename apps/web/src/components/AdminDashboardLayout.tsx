import { Link, NavLink, Outlet } from "react-router-dom";

const ADMIN_TABS: { to: string; label: string; end?: boolean }[] = [
  { to: "/dashboard/admin", label: "Overview", end: true },
  { to: "/dashboard/admin/agencies", label: "Agencies" },
  { to: "/dashboard/admin/users", label: "Users" },
  { to: "/dashboard/admin/inquiries", label: "Inquiries" },
  { to: "/dashboard/admin/tours", label: "Tours" },
  { to: "/dashboard/admin/commissions", label: "Commissions" },
  { to: "/dashboard/admin/ledger", label: "Ledger" },
  { to: "/dashboard/admin/offers", label: "Offers" },
  { to: "/dashboard/admin/reviews", label: "Reviews" },
  { to: "/dashboard/admin/drivers", label: "Drivers" },
  { to: "/dashboard/admin/cms", label: "CMS" },
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
          <Link to="/profile" className="btn btn-ghost btn-nav">
            Account
          </Link>
          <Link to="/" className="btn btn-ghost btn-nav">
            Public site
          </Link>
        </div>
      </header>

      <nav className="agency-tabs admin-tabs" aria-label="Admin sections">
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

      <section className="agency-content admin-content">
        <Outlet />
      </section>
    </div>
  );
}
