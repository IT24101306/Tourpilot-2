import { useState } from "react";
import { DEMO_ASSIGNMENTS, type AssignedTour } from "./types";

function statusClass(status: AssignedTour["status"]): string {
  if (status === "Completed") return "ok";
  if (status === "On Route") return "warn";
  return "warn";
}

export function DriverAssignedToursPage() {
  const [filter, setFilter] = useState("all");
  const filtered =
    filter === "all" ? DEMO_ASSIGNMENTS : DEMO_ASSIGNMENTS.filter((t) => t.status === filter);

  return (
    <>
      <div className="agency-panel-head">
        <h2>Assigned Tours</h2>
        <p>Trips currently assigned to your profile.</p>
      </div>
      <div className="agency-tools">
        <select
          className="agency-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter assigned tours"
        >
          <option value="all">All Status</option>
          <option value="Scheduled">Scheduled</option>
          <option value="On Route">On Route</option>
          <option value="Completed">Completed</option>
        </select>
      </div>
      <div className="agency-table-wrap">
        <table className="agency-table">
          <thead>
            <tr>
              <th>Tour Code</th>
              <th>Route</th>
              <th>Time</th>
              <th>Guests</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tour) => (
              <tr key={tour.code}>
                <td>{tour.code}</td>
                <td>{tour.route}</td>
                <td>{tour.time}</td>
                <td>{tour.guests}</td>
                <td>
                  <span className={`agency-status ${statusClass(tour.status)}`}>{tour.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
