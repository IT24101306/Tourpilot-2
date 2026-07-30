import { Link } from "react-router-dom";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { DriverDayTimeline } from "../../components/driver/DriverDayTimeline";
import { EmptyState } from "../../components/feedback/EmptyState";
import { useDriverAssignments, todaysAssignments, assignmentsToSchedule } from "./useDriverAssignments";

export function DriverSchedulePage() {
  const { assignments, loading } = useDriverAssignments();
  const todays = todaysAssignments(assignments);
  const schedule = assignmentsToSchedule(todays);
  const done = schedule.filter((s) => s.done).length;

  if (loading) return <p className="muted">Loading schedule…</p>;

  return (
    <div className="module-shell module-operations">
      <ModuleHeader
        module="operations"
        title="Today's schedule"
        subtitle="Mission control for your day — complete each segment before moving on."
      >
        <Link to="/dashboard/driver/tasks" className="btn btn-teal">
          Task checklist
        </Link>
      </ModuleHeader>

      {schedule.length === 0 ? (
        <EmptyState
          title="No trips scheduled for today"
          description="Check back when your agency assigns you a trip that covers today's date."
          action={{ label: "View all assignments", to: "/dashboard/driver/assigned" }}
        />
      ) : (
        <>
          <p className="drv-schedule-progress muted">
            {done} of {schedule.length} segments completed
          </p>
          <DriverDayTimeline items={schedule} />
        </>
      )}
    </div>
  );
}
