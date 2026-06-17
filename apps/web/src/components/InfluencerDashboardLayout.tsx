import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CreateReferralCodeModal } from "./influencer/CreateReferralCodeModal";
import { TourPilotBrand } from "./TourPilotBrand";
import {
  InfluencerDashboardContext,
  useInfluencerDashboardProvider,
} from "../pages/influencer/types";

const INFLUENCER_TABS: { to: string; label: string; end?: boolean }[] = [
  { to: "/dashboard/influencer", label: "Overview", end: true },
  { to: "/dashboard/influencer/tours", label: "Tours" },
  { to: "/dashboard/influencer/display", label: "Display" },
  { to: "/dashboard/influencer/codes", label: "Codes" },
  { to: "/dashboard/influencer/commission-requests", label: "Rate talks" },
  { to: "/dashboard/influencer/commissions", label: "Commissions" },
  { to: "/dashboard/influencer/guide", label: "Guide" },
];

export function InfluencerDashboardLayout() {
  const { token } = useAuth();
  const value = useInfluencerDashboardProvider();

  return (
    <InfluencerDashboardContext.Provider value={value}>
      <div className="agency-dashboard influencer-dashboard">
        <div className="agency-dash-chrome">
        <header className="topbar topbar--agency-dash">
          <div className="topbar-brand">
            <TourPilotBrand onDark />
            <span className="topbar-context">Partner growth</span>
          </div>
          <nav className="nav nav--light" aria-label="Partner utilities">
            <div className="nav-actions nav-actions--light">
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
