import { Link } from "react-router-dom";
import { DEMO_ASSIGNMENTS, DEMO_SCHEDULE, formatDriverStatus, useDriverMe } from "./types";

export function DriverOverviewPage() {
  const { me, loading } = useDriverMe();
  const status = formatDriverStatus(me?.driverProfile?.status ?? "available");
  const upcoming = DEMO_ASSIGNMENTS.filter((t) => t.status !== "Completed");
  const completed = DEMO_ASSIGNMENTS.filter((t) => t.status === "Completed").length;
  const nextPickup = DEMO_SCHEDULE.find((s) => !s.done);
  const nextDrop = DEMO_SCHEDULE.find((s) => s.title.startsWith("Drop"));

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <>
      <div className="agency-panel-head">
        <h2>Driver Overview</h2>
        <p>Live duty summary, active assignments, and service quality indicators.</p>
      </div>
      <div className="agency-stat-grid cols-4">
        <Link to="/dashboard/driver/assigned" className="agency-stat-card clickable">
          <h3>Today Trips</h3>
          <p className="agency-stat-value">{DEMO_ASSIGNMENTS.length}</p>
          <p className="agency-stat-sub">
            {completed} completed, {upcoming.length} upcoming
          </p>
        </Link>
        <Link to="/dashboard/driver/profile" className="agency-stat-card clickable">
          <h3>Current Status</h3>
          <p className="agency-stat-value">{status}</p>
          <p className="agency-stat-sub">Ready for immediate assignment</p>
        </Link>
        <div className="agency-stat-card">
          <h3>Distance Today</h3>
          <p className="agency-stat-value">146 km</p>
          <p className="agency-stat-sub">Fuel efficiency: 12.8 km/l</p>
        </div>
        <div className="agency-stat-card">
          <h3>Rating</h3>
          <p className="agency-stat-value">4.9</p>
          <p className="agency-stat-sub">Based on last 40 trips</p>
        </div>
      </div>
      <div className="agency-kpi-row">
        <div className="agency-stat-card">
          <h3>Upcoming Pickup</h3>
          <p className="agency-stat-sub">
            {nextPickup
              ? `${nextPickup.time} — ${nextPickup.title.replace("Pickup — ", "")}`
              : "None scheduled"}
          </p>
        </div>
        <div className="agency-stat-card">
          <h3>Next Drop</h3>
          <p className="agency-stat-sub">
            {nextDrop
              ? `${nextDrop.time} — ${nextDrop.title.replace("Drop — ", "")}`
              : "None scheduled"}
          </p>
        </div>
        <div className="agency-stat-card">
          <h3>Dispatcher Note</h3>
          <p className="agency-stat-sub">Guest prefers short scenic stop.</p>
        </div>
      </div>
    </>
  );
}
