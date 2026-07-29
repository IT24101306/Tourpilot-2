import type { TaskItem } from "../../types/tasks";
import type { DriverAssignmentRow } from "../agency/driverTypes";

export function buildDriverTasks(assignments: DriverAssignmentRow[]): TaskItem[] {
  const tasks: TaskItem[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const a of assignments) {
    if (a.status === "Completed" || a.status === "Cancelled") continue;

    const start = a.startDate?.slice(0, 10);
    const end = a.endDate?.slice(0, 10) ?? start;
    const isToday = start != null && start <= today && end != null && end >= today;

    const time = a.startDate
      ? new Date(a.startDate).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
    const guests = a.inquiry?.pax != null ? ` · ${a.inquiry.pax} pax` : "";

    tasks.push({
      id: `assign-${a.id}`,
      title: `${a.title}${guests}`,
      hint: a.status === "On Route" ? "In progress — complete when done" : "Upcoming trip",
      priority: a.status === "On Route" ? "high" : isToday ? "high" : "medium",
      dueLabel: time,
      dueToday: isToday,
      category: isToday ? "Today" : "Upcoming",
      link: "/dashboard/driver/assigned",
    });
  }

  tasks.push({
    id: "driver-vehicle-check",
    title: "Pre-trip vehicle check",
    hint: "Fuel, tires, AC, and guest water stocked",
    priority: "medium",
    dueLabel: "Before first pickup",
    dueToday: true,
    category: "Vehicle",
    link: "/dashboard/driver/vehicle",
  });

  tasks.push({
    id: "driver-update-availability",
    title: "Update blocked dates",
    hint: "Keep your calendar accurate for dispatch",
    priority: "low",
    dueLabel: "This week",
    category: "Profile",
    link: "/dashboard/driver/profile",
  });

  return tasks;
}
