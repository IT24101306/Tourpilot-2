import { Link, NavLink, Outlet } from "react-router-dom";
import { ConfirmActionProvider } from "./confirm/ConfirmActionContext";
import { TourPilotBrand } from "./TourPilotBrand";

const ADMIN_TABS: { to: string; label: string; end?: boolean }[] = [
  { to: "/dashboard/admin", label: "Overview", end: true },
  { to: "/dashboard/admin/agencies", label: "Agencies" },
  { to: "/dashboard/admin/users", label: "Users" },
  { to: "/dashboard/admin/inquiries", label: "Inquiries" },
  { to: "/dashboard/admin/tours", label: "Tours" },
  { to: "/dashboard/admin/commissions", label: "Commissions" },
  { to: "/dashboard/admin/influencers", label: "Influencers" },
  { to: "/dashboard/admin/itineraries", label: "Itineraries" },
  { to: "/dashboard/admin/ledger", label: "Ledger" },
  { to: "/dashboard/admin/offers", label: "Offers" },
  { to: "/dashboard/admin/reviews", label: "Reviews" },
  { to: "/dashboard/admin/drivers", label: "Drivers" },
  { to: "/dashboard/admin/cms", label: "CMS" },
  { to: "/dashboard/admin/settings", label: "Settings" },
];

export function AdminDashboardLayout() {
  return (
    <ConfirmActionProvider>
    <div className="agency-dashboard admin-dashboard">
      <div className="agency-dash-chrome">
      <header className="topbar topbar--agency-dash">
        <div className="topbar-brand">
          <TourPilotBrand onDark />
          <span className="topbar-context">Platform admin</span>
        </div>
        <nav className="nav nav--light" aria-label="Admin utilities">
          <div className="nav-actions nav-actions--light">
            <Link to="/profile" className="nav-link-light">
              Account
            </Link>
            <Link to="/" className="nav-link-light">
              Public site
            </Link>
          </div>
        </nav>
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
      </div>

      <section className="agency-content admin-content">
        <Outlet />
      </section>
    </div>
    </ConfirmActionProvider>
  );
}
