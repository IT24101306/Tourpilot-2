import { Link } from "react-router-dom";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { DriverDayTimeline } from "../../components/driver/DriverDayTimeline";
import { DEMO_SCHEDULE } from "./types";

export function DriverSchedulePage() {
  const done = DEMO_SCHEDULE.filter((s) => s.done).length;

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

      <p className="drv-schedule-progress muted">
        {done} of {DEMO_SCHEDULE.length} segments completed
      </p>

      <DriverDayTimeline items={DEMO_SCHEDULE} />
    </div>
  );
}
