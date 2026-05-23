import { useAuth } from "../../context/AuthContext";

export function DriverEarningsPage() {
  const { user } = useAuth();

  return (
    <>
      <div className="agency-panel-head">
        <h2>Earnings</h2>
        <p>Trip income and incentives overview.</p>
      </div>
      <div className="agency-stat-grid">
        <div className="agency-stat-card">
          <h3>This Week</h3>
          <p className="agency-stat-value">LKR 28,500</p>
          <p className="agency-stat-sub">6 completed rides</p>
        </div>
        <div className="agency-stat-card">
          <h3>Incentive</h3>
          <p className="agency-stat-value">LKR 4,000</p>
          <p className="agency-stat-sub">On-time completion bonus</p>
        </div>
        <div className="agency-stat-card">
          <h3>Wallet Balance</h3>
          <p className="agency-stat-value">LKR {user?.walletBalance?.toLocaleString() ?? "0"}</p>
          <p className="agency-stat-sub">Pending payout releases on Monday</p>
        </div>
      </div>
    </>
  );
}
