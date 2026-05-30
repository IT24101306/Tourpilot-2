import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CreateReferralCodeModal } from "./influencer/CreateReferralCodeModal";
import {
  InfluencerDashboardContext,
  useInfluencerDashboardProvider,
} from "../pages/influencer/types";

const INFLUENCER_TABS: { to: string; label: string; end?: boolean }[] = [
  { to: "/dashboard/influencer", label: "Overview", end: true },
  { to: "/dashboard/influencer/tours", label: "Tours" },
  { to: "/dashboard/influencer/display", label: "Display" },
  { to: "/dashboard/influencer/codes", label: "Codes" },
  { to: "/dashboard/influencer/commissions", label: "Commissions" },
  { to: "/dashboard/influencer/guide", label: "Guide" },
];

export function InfluencerDashboardLayout() {
  const { token } = useAuth();
  const value = useInfluencerDashboardProvider();

  return (
    <InfluencerDashboardContext.Provider value={value}>
      <div className="agency-dashboard influencer-dashboard">
        <header className="topbar topbar--site">
          <div className="topbar-brand">
            <Link to="/" className="brand">
              Tour<span>Pilot</span>
            </Link>
            <span className="topbar-context">Partner growth</span>
          </div>
          <div className="topbar-actions">
            <Link to="/profile" className="btn btn-ghost">
              Profile
            </Link>
            <Link to="/" className="btn btn-ghost">
              Public site
            </Link>
          </div>
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
