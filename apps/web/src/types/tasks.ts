export type TaskPriority = "high" | "medium" | "low";

export type TaskItem = {
  id: string;
  title: string;
  hint: string;
  priority: TaskPriority;
  dueLabel: string;
  dueToday?: boolean;
  category: string;
  link?: string;
  sourceKey?: string;
};

export type TaskFilter = "all" | "today" | "priority" | "done";
