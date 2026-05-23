import { DEMO_SCHEDULE } from "./types";

export function DriverSchedulePage() {
  return (
    <>
      <div className="agency-panel-head">
        <h2>Today Schedule</h2>
        <p>Checklist for each ride segment.</p>
      </div>
      <div className="agency-list">
        {DEMO_SCHEDULE.map((item) => (
          <div key={item.time + item.title} className="agency-list-item">
            <span>
              <strong>{item.time}</strong> — {item.title}
            </span>
            <span className={`agency-status ${item.done ? "ok" : "warn"}`}>
              {item.done ? "Done" : "Upcoming"}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
