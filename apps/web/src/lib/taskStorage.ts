import type { TaskItem } from "../types/tasks";

const doneKey = (userId: string) => `tourpilot_tasks_done_${userId}`;
const manualKey = (userId: string) => `tourpilot_tasks_manual_${userId}`;

export function loadDoneTaskIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(doneKey(userId));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function saveDoneTaskIds(userId: string, ids: Set<string>) {
  localStorage.setItem(doneKey(userId), JSON.stringify([...ids]));
}

export function loadManualTasks(userId: string): TaskItem[] {
  try {
    const raw = localStorage.getItem(manualKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as TaskItem[];
  } catch {
    return [];
  }
}

export function saveManualTasks(userId: string, tasks: TaskItem[]) {
  localStorage.setItem(manualKey(userId), JSON.stringify(tasks));
}
