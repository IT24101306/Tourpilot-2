import { Link } from "react-router-dom";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { OpsMetricStrip } from "../../components/module/OpsMetricStrip";
import { DriverDayTimeline } from "../../components/driver/DriverDayTimeline";
import { DEMO_ASSIGNMENTS, DEMO_SCHEDULE, formatDriverStatus, useDriverMe } from "./types";

export function DriverOverviewPage() {
  const { me, loading } = useDriverMe();
  const status = formatDriverStatus(me?.driverProfile?.status ?? "available");
  const openTasks = DEMO_SCHEDULE.filter((s) => !s.done).length;
  const upcoming = DEMO_ASSIGNMENTS.filter((t) => t.status !== "Completed");
  const completed = DEMO_ASSIGNMENTS.filter((t) => t.status === "Completed").length;

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <div className="module-shell module-operations">
      <ModuleHeader
        module="operations"
        title="Field overview"
        subtitle="Your duty snapshot — what's next on the road today."
      >
        <Link to="/dashboard/driver" className="btn btn-primary">
          Today's schedule
        </Link>
      </ModuleHeader>

      <p className="drv-duty-status">
        Duty status: <strong>{status}</strong>
      </p>

      <OpsMetricStrip
        metrics={[
          {
            id: "tasks",
            label: "Open tasks",
            value: openTasks,
            hint: "Checklist items left",
          },
          {
            id: "trips",
            label: "Active trips",
            value: upcoming.length,
            hint: `${completed} completed today`,
          },
        ]}
      />

      <section className="ops-board">
        <div className="ops-board-head">
          <h3>Today's timeline</h3>
          <p className="muted">Pickups, drops, and segments in order.</p>
        </div>
        <DriverDayTimeline items={DEMO_SCHEDULE} />
      </section>
    </div>
  );
}
