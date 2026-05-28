import type { DriverAssignmentRow } from "../../pages/agency/driverTypes";
import { assignmentStatusClass, formatShortDate } from "../../pages/agency/driverTypes";

type Props = {
  assignments: DriverAssignmentRow[];
};

export function DriverAssignmentCards({ assignments }: Props) {
  if (assignments.length === 0) {
    return <p className="muted">No assigned tours yet.</p>;
  }

  return (
    <ul className="drv-assign-list">
      {assignments.map((tour) => (
        <li key={tour.id}>
          <article className="drv-assign-card">
            <div className="drv-assign-top">
              <strong>{tour.title}</strong>
              <span className={`agency-status ${assignmentStatusClass(tour.status)}`}>
                {tour.status}
              </span>
            </div>
            <p className="drv-assign-meta muted">
              {formatShortDate(tour.startDate)}
              {tour.endDate ? ` → ${formatShortDate(tour.endDate)}` : ""}
              {tour.inquiry?.pax != null ? ` · ${tour.inquiry.pax} guests` : ""}
            </p>
            {tour.notes && <p className="drv-assign-notes">{tour.notes}</p>}
          </article>
        </li>
      ))}
    </ul>
  );
}
