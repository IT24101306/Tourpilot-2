import { useMemo, useState } from "react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(year: number, month: number, day: number) {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

type Props = {
  blockedDates: string[];
  assignedDates?: string[];
  readOnly?: boolean;
  onBlockedDatesChange?: (dates: string[]) => void;
};

export function DriverAvailabilityCalendar({
  blockedDates,
  assignedDates = [],
  readOnly = false,
  onBlockedDatesChange,
}: Props) {
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const blockedSet = useMemo(() => new Set(blockedDates), [blockedDates]);
  const assignedSet = useMemo(() => new Set(assignedDates), [assignedDates]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleString(undefined, { month: "long", year: "numeric" });

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const blanks = Array.from({ length: firstDay }, (_, i) => ({ type: "blank" as const, key: `b-${i}` }));
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const key = toDateKey(year, month, day);
      return {
        type: "day" as const,
        key,
        day,
        blocked: blockedSet.has(key),
        assigned: !blockedSet.has(key) && assignedSet.has(key),
      };
    });
    return [...blanks, ...days];
  }, [year, month, blockedSet]);

  function toggleDay(dateKey: string) {
    if (readOnly || !onBlockedDatesChange) return;
    const next = new Set(blockedSet);
    if (next.has(dateKey)) next.delete(dateKey);
    else next.add(dateKey);
    onBlockedDatesChange([...next].sort());
  }

  return (
    <div className="driver-calendar">
      <div className="driver-calendar-toolbar">
        <button type="button" className="mini-btn" onClick={() => setViewDate(new Date(year, month - 1, 1))}>
          ◀
        </button>
        <div className="driver-calendar-month">{monthLabel}</div>
        <button type="button" className="mini-btn" onClick={() => setViewDate(new Date(year, month + 1, 1))}>
          ▶
        </button>
        {!readOnly && (
          <p className="driver-calendar-hint">Click dates to toggle availability</p>
        )}
      </div>

      <div className="driver-calendar-weekdays">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="driver-calendar-grid">
        {cells.map((cell) =>
          cell.type === "blank" ? (
            <div key={cell.key} className="driver-calendar-cell blank" />
          ) : (
            <button
              key={cell.key}
              type="button"
              className={`driver-calendar-cell day ${
                cell.blocked ? "blocked" : cell.assigned ? "assigned" : "available"
              }`}
              disabled={readOnly}
              onClick={() => toggleDay(cell.key)}
            >
              {cell.day}
              {cell.blocked && <span className="driver-calendar-dot" aria-hidden="true" />}
            </button>
          )
        )}
      </div>

      <div className="driver-calendar-legend">
        <span>
          <i className="legend-swatch available" /> Available
        </span>
        <span>
          <i className="legend-swatch assigned" /> Assigned
        </span>
        <span>
          <i className="legend-swatch blocked" /> Unavailable
        </span>
      </div>
    </div>
  );
}
