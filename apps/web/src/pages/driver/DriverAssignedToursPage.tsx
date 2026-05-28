import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { OpsMetricStrip } from "../../components/module/OpsMetricStrip";
import { DriverAssignmentCards } from "../../components/driver/DriverAssignmentCards";
import type { DriverAssignmentRow } from "../agency/driverTypes";

export function DriverAssignedToursPage() {
  const { token } = useAuth();
  const [assignments, setAssignments] = useState<DriverAssignmentRow[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api<DriverAssignmentRow[]>("/drivers/me/assignments", { token })
      .then(setAssignments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const filtered =
    filter === "all" ? assignments : assignments.filter((t) => t.status === filter);

  const metrics = useMemo(() => {
    return {
      scheduled: assignments.filter((t) => t.status === "Scheduled").length,
      onRoute: assignments.filter((t) => t.status === "On Route").length,
      completed: assignments.filter((t) => t.status === "Completed").length,
    };
  }, [assignments]);

  return (
    <div className="module-shell module-operations">
      <ModuleHeader
        module="operations"
        title="Assigned tours"
        subtitle="Trips linked to your profile — status and guest counts at a glance."
      />

      <OpsMetricStrip
        metrics={[
          {
            id: "sched",
            label: "Scheduled",
            value: metrics.scheduled,
            hint: "Not started",
            active: filter === "Scheduled",
            onClick: () => setFilter("Scheduled"),
          },
          {
            id: "route",
            label: "On route",
            value: metrics.onRoute,
            hint: "In progress",
            active: filter === "On Route",
            onClick: () => setFilter("On Route"),
          },
          {
            id: "done",
            label: "Completed",
            value: metrics.completed,
            hint: "Finished",
            active: filter === "Completed",
            onClick: () => setFilter("Completed"),
          },
          {
            id: "all",
            label: "All",
            value: assignments.length,
            hint: "Full list",
            active: filter === "all",
            onClick: () => setFilter("all"),
          },
        ]}
      />

      {loading ? (
        <p className="muted">Loading assignments…</p>
      ) : (
        <DriverAssignmentCards assignments={filtered} />
      )}
    </div>
  );
}
