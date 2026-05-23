import { useDriverMe } from "./types";

export function DriverVehiclePage() {
  const { me, loading } = useDriverMe();
  const vehicle = me?.driverProfile?.vehicle ?? "Toyota KDH";

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <>
      <div className="agency-panel-head">
        <h2>Vehicle Details</h2>
        <p>Vehicle assignment, compliance, and readiness checks.</p>
      </div>
      <div className="agency-stat-grid cols-2">
        <div className="agency-stat-card">
          <h3>Vehicle Model</h3>
          <p className="agency-stat-value">{vehicle}</p>
          <p className="agency-stat-sub">Plate: CAR-4862</p>
        </div>
        <div className="agency-stat-card">
          <h3>Maintenance</h3>
          <p className="agency-stat-value">In Date</p>
          <p className="agency-stat-sub">Next service: 08 May 2026</p>
        </div>
        <div className="agency-stat-card">
          <h3>Insurance</h3>
          <p className="agency-stat-value">Valid</p>
          <p className="agency-stat-sub">Expires: 19 Dec 2026</p>
        </div>
        <div className="agency-stat-card">
          <h3>Fuel Card</h3>
          <p className="agency-stat-value">Active</p>
          <p className="agency-stat-sub">Monthly limit: LKR 140,000</p>
        </div>
      </div>
    </>
  );
}
