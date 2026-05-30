import { FormEvent, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import "../styles/dashboard.css";

const AGENCY_TABS: { to: string; label: string; end?: boolean }[] = [
  { to: "/dashboard/agency", label: "Overview", end: true },
  { to: "/dashboard/agency/bookings", label: "Bookings" },
  { to: "/dashboard/agency/negotiations", label: "Negotiations" },
  { to: "/dashboard/agency/tasks", label: "Tasks" },
  { to: "/dashboard/agency/tours", label: "Tours" },
  { to: "/dashboard/agency/drivers", label: "Drivers" },
  { to: "/dashboard/agency/travelers", label: "Travelers" },
  { to: "/dashboard/agency/all", label: "ALL" },
  { to: "/dashboard/agency/groups", label: "Groups" },
  { to: "/dashboard/agency/offers", label: "Offers" },
  { to: "/dashboard/agency/display", label: "Display" },
];
export function AgencyDashboardLayout() {
  const { user, token, refreshUser } = useAuth();
  const agencyStatus = user?.agency?.status;
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupStatus, setTopupStatus] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);

  async function handleTopup(e: FormEvent) {
    e.preventDefault();
    const value = Number(topupAmount);
    if (!token || !Number.isFinite(value) || value <= 0) {
      setTopupStatus("Enter a valid amount.");
      return;
    }

    setTopupLoading(true);
    setTopupStatus("");
    try {
      await api("/wallet/topup", {
        method: "POST",
        token,
        body: JSON.stringify({ amount: value }),
      });
      await refreshUser();
      setTopupStatus(`Topup successful. LKR ${value.toLocaleString()} added.`);
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

  return (
    <div className="agency-dashboard">
      <header className="topbar topbar--site">
        <div className="topbar-brand">
          <Link to="/" className="brand">
            Tour<span>Pilot</span>
          </Link>
          <span className="topbar-context">Agent dashboard</span>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn btn-primary" onClick={() => setTopupOpen(true)}>
            Topup
          </button>
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

      <nav className="agency-tabs" aria-label="Dashboard tabs">
        {AGENCY_TABS.map((tab) => (
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
              <label htmlFor="topupAmount">Custom amount (LKR)</label>
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
