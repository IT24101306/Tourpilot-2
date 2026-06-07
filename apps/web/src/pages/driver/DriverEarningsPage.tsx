import { ModuleHeader } from "../../components/module/ModuleHeader";
import { useDriverEarnings } from "./useDriverEarnings";

export function DriverEarningsPage() {
  const { data, loading } = useDriverEarnings();

  if (loading) return <p className="muted">Loading…</p>;

  const week = data?.thisWeekLkr ?? 0;
  const completed = data?.completedTrips ?? 0;
  const wallet = data?.walletBalance ?? 0;

  return (
    <div className="module-shell module-operations">
      <ModuleHeader
        module="operations"
        title="Earnings"
        subtitle="Trip income from completed assignments and your platform wallet."
      />
      <div className="agency-stat-grid drv-readiness-grid">
        <div className="agency-stat-card">
          <h3>This week</h3>
          <p className="agency-stat-value">LKR {week.toLocaleString()}</p>
          <p className="agency-stat-sub">
            {data?.recentCompleted?.length ?? 0} completed assignment
            {(data?.recentCompleted?.length ?? 0) === 1 ? "" : "s"} this week
          </p>
        </div>
        <div className="agency-stat-card">
          <h3>Completed trips</h3>
          <p className="agency-stat-value">{completed}</p>
          <p className="agency-stat-sub">{data?.upcomingTrips ?? 0} upcoming</p>
        </div>
        <div className="agency-stat-card">
          <h3>Wallet balance</h3>
          <p className="agency-stat-value">LKR {wallet.toLocaleString()}</p>
          <p className="agency-stat-sub">Platform wallet credits</p>
        </div>
      </div>

      {data?.recentCompleted && data.recentCompleted.length > 0 && (
        <div className="drv-earnings-recent">
          <h3>Recent completed</h3>
          <ul>
            {data.recentCompleted.map((trip) => (
              <li key={trip.id}>
                <strong>{trip.title}</strong>
                <span className="muted">
                  {" "}
                  · {new Date(trip.date).toLocaleDateString()}
                  {trip.pax != null && ` · ${trip.pax} pax`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
