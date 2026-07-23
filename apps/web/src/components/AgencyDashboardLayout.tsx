import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { agencyFeaturesOf, useAuth } from "../context/AuthContext";
import { navLinkLightClass } from "../utils/navLinkClass";
import { NotificationBell } from "./NotificationBell";
import { ConfirmActionProvider, useConfirmAction } from "./confirm/ConfirmActionContext";
import { TourPilotBrand } from "./TourPilotBrand";
import { DashboardSupportButton } from "./support/SupportAgentsModal";
import "../styles/dashboard.css";

const AGENCY_TABS: {
  to: string;
  label: string;
  end?: boolean;
  feature?: "offers" | "display" | "negotiationsBookings" | "customDomain";
}[] = [
  { to: "/dashboard/agency", label: "Overview", end: true },
  { to: "/dashboard/agency/bookings", label: "Bookings", feature: "negotiationsBookings" },
  { to: "/dashboard/agency/negotiations", label: "Negotiations", feature: "negotiationsBookings" },
  { to: "/dashboard/agency/tasks", label: "Tasks" },
  { to: "/dashboard/agency/travelers", label: "Travelers" },
  { to: "/dashboard/agency/display", label: "Display", feature: "display" },
  { to: "/dashboard/agency/offers", label: "Offers", feature: "offers" },
  { to: "/dashboard/agency/domain", label: "Domain", feature: "customDomain" },
];

const BUILD_STEPS: {
  step: number;
  to: string;
  label: string;
  hint: string;
  feature?: "readyMadeTours";
}[] = [
  {
    step: 1,
    to: "/dashboard/agency/all",
    label: "Entities",
    hint: "Add places, hotels, transport, and more",
  },
  {
    step: 2,
    to: "/dashboard/agency/groups",
    label: "Groups",
    hint: "Bundle entities into reusable sets",
  },
  {
    step: 3,
    to: "/dashboard/agency/tours",
    label: "Tours",
    hint: "Build and publish tour packages",
    feature: "readyMadeTours",
  },
];

const NETWORK_LINKS: { to: string; label: string; icon: "drivers" | "partners" }[] = [
  { to: "/dashboard/agency/drivers", label: "Drivers", icon: "drivers" },
  { to: "/dashboard/agency/partners", label: "Partners", icon: "partners" },
];

function HandshakeIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m11 17 2 2a1 1 0 1 0 3-3" />
      <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
      <path d="m21 3 1 11h-2" />
      <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
      <path d="M3 4h8" />
    </svg>
  );
}

function DriversIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3.2v3.3M12 17.5v3.3M3.2 12h3.3M17.5 12h3.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PartnersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a3.5 3.5 0 0 1 0 6.74"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AgencyDashboardLayout() {
  return (
    <ConfirmActionProvider>
      <AgencyDashboardLayoutInner />
    </ConfirmActionProvider>
  );
}

function AgencyDashboardLayoutInner() {
  const { user, token, refreshUser, logout } = useAuth();
  const { requestConfirm } = useConfirmAction();
  const location = useLocation();
  const features = agencyFeaturesOf(user);
  const agencyStatus = user?.agency?.status;
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupStatus, setTopupStatus] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [stepsMenuOpen, setStepsMenuOpen] = useState(false);
  const [networkMenuOpen, setNetworkMenuOpen] = useState(false);
  const sideMenusRef = useRef<HTMLDivElement>(null);

  const visibleTabs = useMemo(
    () =>
      AGENCY_TABS.filter((tab) => {
        if (tab.feature === "offers") return features.offers;
        if (tab.feature === "display") return features.display;
        if (tab.feature === "negotiationsBookings") return features.negotiationsBookings;
        if (tab.feature === "customDomain") return features.customDomain;
        return true;
      }),
    [
      features.offers,
      features.display,
      features.negotiationsBookings,
      features.customDomain,
    ]
  );

  const visibleBuildSteps = useMemo(
    () =>
      BUILD_STEPS.filter((step) => {
        if (step.feature === "readyMadeTours") return features.readyMadeTours;
        return true;
      }),
    [features.readyMadeTours]
  );

  const onBuildStep = visibleBuildSteps.some(
    (step) =>
      location.pathname === step.to || location.pathname.startsWith(`${step.to}/`)
  );
  const onNetworkLink = NETWORK_LINKS.some(
    (link) =>
      location.pathname === link.to || location.pathname.startsWith(`${link.to}/`)
  );

  const blockedByFeature =
    (!features.offers && location.pathname.startsWith("/dashboard/agency/offers")) ||
    (!features.display && location.pathname.startsWith("/dashboard/agency/display")) ||
    (!features.negotiationsBookings &&
      (location.pathname.startsWith("/dashboard/agency/negotiations") ||
        location.pathname.startsWith("/dashboard/agency/bookings") ||
        location.pathname.startsWith("/dashboard/agency/trip-room"))) ||
    (!features.readyMadeTours && location.pathname.startsWith("/dashboard/agency/tours")) ||
    (!features.driversAndPartners &&
      (location.pathname.startsWith("/dashboard/agency/drivers") ||
        location.pathname.startsWith("/dashboard/agency/partners"))) ||
    (!features.customDomain &&
      location.pathname.startsWith("/dashboard/agency/domain"));

  useEffect(() => {
    if (!stepsMenuOpen && !networkMenuOpen) return;

    function handlePointerDown(e: MouseEvent) {
      if (sideMenusRef.current && !sideMenusRef.current.contains(e.target as Node)) {
        setStepsMenuOpen(false);
        setNetworkMenuOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setStepsMenuOpen(false);
        setNetworkMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [stepsMenuOpen, networkMenuOpen]);

  if (blockedByFeature) {
    return <Navigate to="/dashboard/agency" replace />;
  }

  async function executeTopup(value: number) {
    if (!token) return;
    setTopupLoading(true);
    setTopupStatus("");
    try {
      await api("/wallet/topup", {
        method: "POST",
        token,
        body: JSON.stringify({ amount: value }),
      });
      await refreshUser();
      setTopupStatus(`Topup successful. ${value.toLocaleString()} Credits added.`);
      setTopupAmount("");
      setTimeout(() => {
        setTopupOpen(false);
        setTopupStatus("");
      }, 900);
    } catch (err) {
      setTopupStatus(err instanceof ApiError ? err.message : "Topup failed");
    } finally {
      setTopupLoading(false);
    }
  }

  function handleTopup(e: FormEvent) {
    e.preventDefault();
    const value = Number(topupAmount);
    if (!token || !Number.isFinite(value) || value <= 0) {
      setTopupStatus("Enter a valid amount.");
      return;
    }

    requestConfirm({
      title: "Confirm wallet topup",
      description: "Funds will be added to your agency wallet immediately.",
      confirmLabel: "Add funds",
      summary: [{ label: "Amount", value: `${value.toLocaleString()} Credits` }],
      onConfirm: () => executeTopup(value),
    });
  }

  return (
    <div className="agency-dashboard">
      <div className="agency-dash-chrome">
      <header className="topbar topbar--agency-dash">
        <div className="topbar-brand">
          <TourPilotBrand onDark />
        </div>
        <nav className="nav nav--light" aria-label="Dashboard utilities">
          <div className="nav-actions nav-actions--light">
            {features.support && <DashboardSupportButton />}
            {features.walletTopup && (
              <button type="button" className="nav-link-light" onClick={() => setTopupOpen(true)}>
                Topup
              </button>
            )}
            <NavLink to="/profile" className={navLinkLightClass}>
              Profile
            </NavLink>
            <NotificationBell />
            {user?.agency?.slug ? (
              <a
                href={`/agencies/${user.agency.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="nav-link-light"
              >
                Site
              </a>
            ) : features.display ? (
              <Link to="/dashboard/agency/display" className="nav-link-light">
                Site
              </Link>
            ) : null}
            <button type="button" className="nav-link-light" onClick={logout}>
              Log out
            </button>
          </div>
        </nav>
      </header>

      <nav className="agency-tabs" aria-label="Dashboard tabs">
        <div className="agency-tabs__menu" ref={sideMenusRef}>
          {features.driversAndPartners && (
            <>
          <button
            type="button"
            className={`agency-tabs__icon-btn${networkMenuOpen ? " is-open" : ""}${
              onNetworkLink ? " is-active" : ""
            }`}
            aria-label="Drivers and partners"
            aria-expanded={networkMenuOpen}
            aria-haspopup="menu"
            onClick={() => {
              setNetworkMenuOpen((open) => !open);
              setStepsMenuOpen(false);
            }}
          >
            <HandshakeIcon />
          </button>
          {networkMenuOpen && (
            <div
              className="agency-tabs-network"
              role="menu"
              aria-label="Drivers and partners"
            >
              {NETWORK_LINKS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  role="menuitem"
                  className={({ isActive }) =>
                    `agency-tabs-network__link${isActive ? " is-active" : ""}`
                  }
                  onClick={() => setNetworkMenuOpen(false)}
                  title={item.label}
                  aria-label={item.label}
                >
                  {item.icon === "drivers" ? <DriversIcon /> : <PartnersIcon />}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          )}
            </>
          )}
          <button
            type="button"
            className={`agency-tabs__hamburger${stepsMenuOpen ? " is-open" : ""}${
              onBuildStep ? " is-active" : ""
            }`}
            aria-label="Tour building steps"
            aria-expanded={stepsMenuOpen}
            aria-haspopup="menu"
            onClick={() => {
              setStepsMenuOpen((open) => !open);
              setNetworkMenuOpen(false);
            }}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
          {stepsMenuOpen && (
            <div className="agency-tabs-steps" role="menu" aria-label="Build your catalog">
              <p className="agency-tabs-steps__title">
                Build in {visibleBuildSteps.length} step{visibleBuildSteps.length === 1 ? "" : "s"}
              </p>
              <ol className="agency-tabs-steps__list">
                {visibleBuildSteps.map((item, index) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      role="menuitem"
                      className={({ isActive }) =>
                        `agency-tabs-steps__link${isActive ? " is-active" : ""}`
                      }
                      onClick={() => setStepsMenuOpen(false)}
                    >
                      <span className="agency-tabs-steps__num">{index + 1}</span>
                      <span className="agency-tabs-steps__copy">
                        <strong>{item.label}</strong>
                        <span>{item.hint}</span>
                      </span>
                    </NavLink>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
        <div className="agency-tabs__list">
          {visibleTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => `agency-tab${isActive ? " active" : ""}`}
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
      </div>

      <section className="agency-content">
        {agencyStatus === "PENDING" && (
          <div className="agency-status-banner agency-status-banner--pending" role="status">
            <strong>Verification in progress</strong>
            <p>
              Your KYC was submitted and is awaiting TourPilot approval. You can prepare tours and
              your storefront; travelers will see your agency once approved.
            </p>
          </div>
        )}
        {agencyStatus === "REJECTED" && (
          <div className="agency-status-banner agency-status-banner--rejected" role="alert">
            <strong>Application not approved</strong>
            <p>
              Contact support if you believe this was a mistake. You can update your details and
              reach out to request a review.
            </p>
          </div>
        )}
        {agencyStatus === "SUSPENDED" && (
          <div className="agency-status-banner agency-status-banner--rejected" role="alert">
            <strong>Account suspended</strong>
            <p>Your agency is not visible to travelers. Please contact TourPilot support.</p>
          </div>
        )}
        <Outlet />
      </section>

      {topupOpen && (
        <div
          className="entity-modal open"
          role="presentation"
          onClick={() => setTopupOpen(false)}
        >
          <div
            className="entity-dialog topup-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="topupTitle"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-head">
              <h3 id="topupTitle">Wallet topup</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setTopupOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="dialog-sub muted">Add funds to your agency wallet.</p>
            <form className="topup-form" onSubmit={(e) => handleTopup(e)}>
              <div className="topup-quick-row">
                {[100, 500, 1000].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className="topup-quick-btn"
                    disabled={topupLoading}
                    onClick={() => {
                      setTopupAmount(String(amount));
                      setTopupStatus("");
                    }}
                  >
                    {amount}
                  </button>
                ))}
              </div>
              <label htmlFor="topupAmount">Custom amount (Credits)</label>
              <input
                id="topupAmount"
                type="number"
                min="1"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                placeholder="Enter amount"
              />
              <div className="dialog-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setTopupOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={topupLoading}>
                  {topupLoading ? "Processing…" : "Topup"}
                </button>
              </div>
              {topupStatus && <p className="entity-status">{topupStatus}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
