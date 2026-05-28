import type { TaskItem } from "../../types/tasks";
import { DEMO_ASSIGNMENTS, DEMO_SCHEDULE } from "./types";

export function buildDriverTasks(): TaskItem[] {
  const tasks: TaskItem[] = [];

  for (const item of DEMO_SCHEDULE.filter((s) => !s.done)) {
    tasks.push({
      id: `schedule-${item.time}`,
      title: item.title,
      hint: "Today's schedule — mark complete when done",
      priority: "high",
      dueLabel: item.time,
      dueToday: true,
      category: "Today",
      link: "/dashboard/driver",
    });
  }

  for (const tour of DEMO_ASSIGNMENTS.filter((t) => t.status !== "Completed")) {
    tasks.push({
      id: `assign-${tour.code}`,
      title: `${tour.code} · ${tour.route}`,
      hint: `${tour.time} · ${tour.guests} guests · ${tour.status}`,
      priority: tour.status === "On Route" ? "high" : "medium",
      dueLabel: tour.time,
      dueToday: true,
      category: "Assignment",
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
