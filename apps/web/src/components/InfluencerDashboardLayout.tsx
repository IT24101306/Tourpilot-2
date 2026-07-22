import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CreateReferralCodeModal } from "./influencer/CreateReferralCodeModal";
import { ClientBrand } from "./ClientBrand";
import { DashboardSupportButton } from "./support/SupportAgentsModal";
import {
  InfluencerDashboardContext,
  useInfluencerDashboardProvider,
} from "../pages/influencer/types";

const INFLUENCER_TABS: { to: string; label: string; end?: boolean }[] = [
  { to: "/dashboard/i", label: "Overview", end: true },
  { to: "/dashboard/i/tours", label: "Tours" },
  { to: "/dashboard/i/display", label: "Display" },
  { to: "/dashboard/i/inquiries", label: "Chats" },
  { to: "/dashboard/i/codes", label: "Codes" },
  { to: "/dashboard/i/commission-requests", label: "Rate talks" },
  { to: "/dashboard/i/commissions", label: "Commissions" },
  { to: "/dashboard/i/domain", label: "Domain" },
  { to: "/dashboard/i/guide", label: "Guide" },
];

export function InfluencerDashboardLayout() {
  const { token, user } = useAuth();
  const value = useInfluencerDashboardProvider();

  return (
    <InfluencerDashboardContext.Provider value={value}>
      <div className="agency-dashboard influencer-dashboard">
        <div className="agency-dash-chrome">
        <header className="topbar topbar--agency-dash">
          <div className="topbar-brand">
            <ClientBrand
              name={user?.name ?? "Partner"}
              logoUrl={user?.avatarUrl}
              to="/dashboard/i"
              onDark
              subtitle="Partner growth"
            />
          </div>
          <nav className="nav nav--light" aria-label="Partner utilities">
            <div className="nav-actions nav-actions--light">
              <DashboardSupportButton />
              <Link to="/profile" className="nav-link-light">
                Profile
              </Link>
              <Link to="/" className="nav-link-light">
                Public site
              </Link>
            </div>
          </nav>
        </header>

        <nav className="agency-tabs" aria-label="Influencer dashboard tabs">
          {INFLUENCER_TABS.map((tab) => (
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
          {value.error && <p className="partner-toast partner-toast--error">{value.error}</p>}
          {value.toast && <p className="partner-toast">{value.toast}</p>}
          <Outlet />
        </section>

        {token && (
          <CreateReferralCodeModal
            open={value.codeModalOpen}
            token={token}
            tours={value.tours}
            preselectedTourId={value.preselectedTourId}
            onClose={() => value.setCodeModalOpen(false)}
            onCreated={value.refresh}
          />
        )}
      </div>
    </InfluencerDashboardContext.Provider>
  );
}
