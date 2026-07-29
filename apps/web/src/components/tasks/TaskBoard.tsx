import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { TaskFilter, TaskItem } from "../../types/tasks";
import {
  loadDoneTaskIds,
  loadManualTasks,
  saveDoneTaskIds,
  saveManualTasks,
} from "../../lib/taskStorage";

type Props = {
  userId: string;
  generated: TaskItem[];
  emptyMessage?: string;
};

export function TaskBoard({ userId, generated, emptyMessage }: Props) {
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [doneIds, setDoneIds] = useState<Set<string>>(() => loadDoneTaskIds(userId));
  const [manual, setManual] = useState<TaskItem[]>(() => loadManualTasks(userId));
  const [newTitle, setNewTitle] = useState("");

  const allTasks = useMemo(() => {
    const seen = new Set<string>();
    const merged: TaskItem[] = [];
    for (const t of [...generated, ...manual]) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      merged.push(t);
    }
    return merged;
  }, [generated, manual]);

  const withStatus = useMemo(
    () =>
      allTasks.map((t) => ({
        ...t,
        done: doneIds.has(t.id),
      })),
    [allTasks, doneIds]
  );

  const filtered = useMemo(() => {
    return withStatus.filter((t) => {
      if (filter === "done") return t.done;
      if (filter === "today") return t.dueToday && !t.done;
      if (filter === "priority") return t.priority === "high" && !t.done;
      return true;
    });
  }, [withStatus, filter]);

  const counts = useMemo(
    () => ({
      open: withStatus.filter((t) => !t.done).length,
      today: withStatus.filter((t) => t.dueToday && !t.done).length,
      high: withStatus.filter((t) => t.priority === "high" && !t.done).length,
      done: withStatus.filter((t) => t.done).length,
    }),
    [withStatus]
  );

  function toggleDone(id: string) {
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveDoneTaskIds(userId, next);
      return next;
    });
  }

  function addManualTask(e: FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const task: TaskItem = {
      id: `manual-${Date.now()}`,
      title,
      hint: "Added by you",
      priority: "medium",
      dueLabel: "Flexible",
      category: "Personal",
    };
    const next = [task, ...manual];
    setManual(next);
    saveManualTasks(userId, next);
    setNewTitle("");
  }

  const openTasks = filtered.filter((t) => !t.done);
  const doneTasks = filtered.filter((t) => t.done);

  return (
    <div className="task-board">
      <div className="task-filter-strip">
        {(
          [
            ["all", `All (${counts.open + counts.done})`],
            ["today", `Today (${counts.today})`],
            ["priority", `Priority (${counts.high})`],
            ["done", `Done (${counts.done})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`task-filter-btn${filter === key ? " active" : ""}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <form className="task-add-form" onSubmit={addManualTask}>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a task for today…"
          aria-label="New task"
        />
        <button type="submit" className="btn btn-primary">
          Add
        </button>
      </form>

      {openTasks.length === 0 && doneTasks.length === 0 ? (
        <p className="muted">{emptyMessage ?? "No tasks match this filter."}</p>
      ) : (
        <div className="task-split-layout">
          <section className="task-split-col">
            <h3>Open ({openTasks.length})</h3>
            {openTasks.length === 0 ? (
              <p className="muted">All caught up — nothing pending.</p>
            ) : (
              <ul className="task-list">
                {openTasks.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={() => toggleDone(task.id)} />
                ))}
              </ul>
            )}
          </section>

          <section className="task-split-col task-split-col--done">
            <h3>Done ({doneTasks.length})</h3>
            {doneTasks.length === 0 ? (
              <p className="muted">Completed tasks appear here.</p>
            ) : (
              <ul className="task-list task-list--done">
                {doneTasks.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={() => toggleDone(task.id)} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
}: {
  task: TaskItem & { done: boolean };
  onToggle: () => void;
}) {
  return (
    <li className={`task-row task-row--${task.priority}${task.done ? " done" : ""}`}>
      <label className="task-check">
        <input type="checkbox" checked={task.done} onChange={onToggle} />
        <span className="task-check-box" aria-hidden="true" />
      </label>
      <div className="task-row-body">
        <div className="task-row-top">
          <strong>{task.title}</strong>
          <span className={`task-priority task-priority--${task.priority}`}>{task.priority}</span>
        </div>
        <p className="task-hint">{task.hint}</p>
        <div className="task-row-meta">
          <span className="task-due">{task.dueLabel}</span>
          <span className="task-category">{task.category}</span>
          {task.link && (
            <Link to={task.link} className="task-link">
              Open →
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
