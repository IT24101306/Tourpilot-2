import { useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { TaskBoard } from "../../components/tasks/TaskBoard";
import { buildDriverTasks } from "./taskUtils";

export function DriverTasksPage() {
  const { user } = useAuth();
  const tasks = useMemo(() => buildDriverTasks(), []);

  if (!user) return null;

  return (
    <div className="module-shell module-tasks">
      <ModuleHeader
        module="tasks"
        title="Today's execution"
        subtitle="Your checklist for pickups, drops, and vehicle readiness."
      />

      <TaskBoard
        userId={user.id}
        generated={tasks}
        emptyMessage="No open tasks — enjoy the break or review your schedule."
      />
    </div>
  );
}
