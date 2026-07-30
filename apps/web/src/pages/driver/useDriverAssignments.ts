import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import type { DriverAssignmentRow } from "../agency/driverTypes";

export function useDriverAssignments() {
  const { token } = useAuth();
  const [assignments, setAssignments] = useState<DriverAssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    if (!token) return;
    setLoading(true);
    setError("");
    api<DriverAssignmentRow[]>("/drivers/me/assignments", { token })
      .then(setAssignments)
      .catch((err) => {
        setAssignments([]);
        setError(err instanceof Error ? err.message : "Failed to load assignments");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [token]);

  return { assignments, loading, error, refresh: load };
}

/** Filter assignments whose date range includes today. */
export function todaysAssignments(assignments: DriverAssignmentRow[]): DriverAssignmentRow[] {
  const today = new Date().toISOString().slice(0, 10);
  return assignments.filter((a) => {
    const start = a.startDate?.slice(0, 10);
    const end = a.endDate?.slice(0, 10) ?? start;
    return start != null && start <= today && end != null && end >= today;
  });
}

/** Build timeline schedule items from assignments. */
export function assignmentsToSchedule(
  assignments: DriverAssignmentRow[]
): { time: string; title: string; done: boolean }[] {
  return assignments.map((a) => {
    const time = a.startDate
      ? new Date(a.startDate).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
    const guests = a.inquiry?.pax != null ? ` · ${a.inquiry.pax} pax` : "";
    return {
      time,
      title: `${a.title}${guests}`,
      done: a.status === "Completed",
    };
  });
}
