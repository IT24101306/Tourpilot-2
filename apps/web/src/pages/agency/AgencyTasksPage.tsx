import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { TaskBoard } from "../../components/tasks/TaskBoard";
import { buildAgencyTasks } from "./taskUtils";
import type { AgencyInquiry } from "./types";

export function AgencyTasksPage() {
  const { user, token } = useAuth();
  const [inquiries, setInquiries] = useState<AgencyInquiry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api<AgencyInquiry[]>("/inquiries/mine", { token })
      .then(setInquiries)
      .finally(() => setLoading(false));
  }, [token]);

  const tasks = useMemo(() => buildAgencyTasks(inquiries), [inquiries]);

  if (!user) return null;

  return (
    <div className="module-shell module-tasks">
      <ModuleHeader
        module="tasks"
        title="Execution checklist"
        subtitle="Auto-generated next actions from inquiries — check off as you complete them."
      />

      {loading ? (
        <p className="muted">Loading tasks…</p>
      ) : (
        <TaskBoard
          userId={user.id}
          generated={tasks}
          emptyMessage="All caught up. New tasks appear when inquiries need action."
        />
      )}
    </div>
  );
}
