import { Link } from "react-router-dom";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { OpsMetricStrip } from "../../components/module/OpsMetricStrip";
import { DriverDayTimeline } from "../../components/driver/DriverDayTimeline";
import { EmptyState } from "../../components/feedback/EmptyState";
import { formatDriverStatus, useDriverMe } from "./types";
import { useDriverAssignments, todaysAssignments, assignmentsToSchedule } from "./useDriverAssignments";

export function DriverOverviewPage() {
  const { me, loading: meLoading } = useDriverMe();
  const { assignments, loading: assignLoading } = useDriverAssignments();
  const loading = meLoading || assignLoading;

  const status = formatDriverStatus(me?.driverProfile?.status ?? "available");
  const todays = todaysAssignments(assignments);
  const schedule = assignmentsToSchedule(todays);
  const upcoming = assignments.filter((a) => a.status === "Scheduled" || a.status === "On Route");
  const completed = assignments.filter((a) => a.status === "Completed").length;

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
            id: "trips",
            label: "Active trips",
            value: upcoming.length,
            hint: `${completed} completed total`,
          },
          {
            id: "today",
            label: "Today's segments",
            value: todays.length,
            hint: todays.length === 0 ? "No trips today" : "Pickups & drops today",
          },
        ]}
      />

      <section className="ops-board">
        <div className="ops-board-head">
          <h3>Today's timeline</h3>
          <p className="muted">Pickups, drops, and segments in order.</p>
        </div>
        {schedule.length === 0 ? (
          <EmptyState
            title="No trips today"
            description="Your next assignment will appear here once scheduled by your agency."
            action={{ label: "View all assignments", to: "/dashboard/driver/assigned" }}
          />
        ) : (
          <DriverDayTimeline items={schedule} />
        )}
      </section>
    </div>
  );
}
