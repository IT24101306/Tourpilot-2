import { ModuleHeader } from "../../components/module/ModuleHeader";
import { useAuth } from "../../context/AuthContext";

export function DriverEarningsPage() {
  const { user } = useAuth();

  return (
    <div className="module-shell module-operations">
      <ModuleHeader
        module="operations"
        title="Earnings"
        subtitle="Trip income, incentives, and wallet balance."
      />
      <div className="agency-stat-grid drv-readiness-grid">
        <div className="agency-stat-card">
          <h3>This week</h3>
          <p className="agency-stat-value">LKR 28,500</p>
          <p className="agency-stat-sub">6 completed rides</p>
        </div>
        <div className="agency-stat-card">
          <h3>Incentive</h3>
          <p className="agency-stat-value">LKR 4,000</p>
          <p className="agency-stat-sub">On-time completion bonus</p>
        </div>
        <div className="agency-stat-card">
          <h3>Wallet balance</h3>
          <p className="agency-stat-value">LKR {user?.walletBalance?.toLocaleString() ?? "0"}</p>
          <p className="agency-stat-sub">Pending payout releases on Monday</p>
        </div>
      </div>
    </div>
  );
}
