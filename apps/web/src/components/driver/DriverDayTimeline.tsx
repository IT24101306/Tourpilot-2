import { Link } from "react-router-dom";

export type ScheduleItem = {
  time: string;
  title: string;
  done: boolean;
};

type Props = {
  items: ScheduleItem[];
  tasksLink?: string;
};

export function DriverDayTimeline({ items, tasksLink = "/dashboard/driver/tasks" }: Props) {
  const next = items.find((i) => !i.done);

  return (
    <div className="drv-timeline">
      {next && (
        <div className="drv-next-up">
          <span className="drv-next-label">Next up</span>
          <strong>
            {next.time} — {next.title}
          </strong>
          <Link to={tasksLink} className="drv-next-link">
            Open tasks →
          </Link>
        </div>
      )}
      <ol className="drv-timeline-list">
        {items.map((item) => (
          <li
            key={`${item.time}-${item.title}`}
            className={`drv-timeline-item${item.done ? " done" : ""}${next === item ? " current" : ""}`}
          >
            <span className="drv-timeline-time">{item.time}</span>
            <span className="drv-timeline-dot" aria-hidden="true" />
            <div className="drv-timeline-body">
              <strong>{item.title}</strong>
              <span className={`agency-status ${item.done ? "ok" : "warn"}`}>
                {item.done ? "Done" : "Upcoming"}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
