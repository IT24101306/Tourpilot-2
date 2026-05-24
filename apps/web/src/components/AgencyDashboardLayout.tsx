<<<<<<< HEAD
import { Link, NavLink, Outlet } from "react-router-dom";

const AGENCY_TABS: { to: string; label: string; end?: boolean }[] = [
  { to: "/dashboard/agency", label: "Overview", end: true },
  { to: "/dashboard/agency/bookings", label: "Bookings" },
  { to: "/dashboard/agency/tours", label: "Tours" },
  { to: "/dashboard/agency/drivers", label: "Drivers" },
  { to: "/dashboard/agency/travelers", label: "Travelers" },
  { to: "/dashboard/agency/all", label: "ALL" },
  { to: "/dashboard/agency/groups", label: "Groups" },
];

export function AgencyDashboardLayout() {
  return (
    <div className="agency-dashboard">
      <header className="agency-topbar">
        <div className="agency-brand">
          <span className="brand">
            Tour<span>Pilot</span>
          </span>
          <span className="agency-brand-sub">AgentDashboard</span>
        </div>
        <div className="agency-top-actions">
          <button type="button" className="agency-icon-btn" aria-label="Notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            <span className="agency-icon-dot" aria-hidden="true" />
=======
import { FormEvent, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import "../styles/dashboard.css";

export function AgencyDashboardLayout() {
  const { token, refreshUser } = useAuth();
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupStatus, setTopupStatus] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);

  async function handleTopup(e: FormEvent, amount?: number) {
    e.preventDefault();
    const value = amount ?? Number(topupAmount);
    if (!token || !value || value <= 0) {
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
    <main className="agent-dashboard">
      <header className="agent-topbar">
        <h1 className="agent-brand">
          Tour<span>Pilot</span> AgentDashboard
        </h1>
        <div className="agent-top-actions">
          <button type="button" className="btn btn-primary" onClick={() => setTopupOpen(true)}>
            Topup
          </button>
          <button type="button" className="agent-icon-btn" aria-label="Notifications">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path
                d="M15 17H5C5.95 16.1 6.5 14.9 6.5 13.6V10.5C6.5 7.46 8.96 5 12 5C15.04 5 17.5 7.46 17.5 10.5V13.6C17.5 14.9 18.05 16.1 19 17H15Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10 19C10.35 19.6 11.12 20 12 20C12.88 20 13.65 19.6 14 19"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="agent-icon-dot" aria-hidden="true" />
>>>>>>> a1fb766 (Implement dashboard and API updates)
          </button>
          <Link to="/" className="btn btn-ghost">
            Back to Site
          </Link>
        </div>
      </header>

<<<<<<< HEAD
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
        <Outlet />
      </section>
    </div>
=======
      <Outlet />

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
                    onClick={(e) => handleTopup(e, amount)}
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
    </main>
>>>>>>> a1fb766 (Implement dashboard and API updates)
  );
}
