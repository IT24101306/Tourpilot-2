import { useMemo } from "react";

type DayItem = {
  label: string;
  scheduledTime?: string | null;
  entityName?: string | null;
};

type Day = {
  dayNumber: number;
  title?: string | null;
  items: DayItem[];
};

type Props = {
  status: string;
  partnerName?: string | null;
  startDate?: string | null;
  days?: Day[];
  onOpenChat?: () => void;
};

function dayIndexFromStart(startDate: string | null | undefined): number {
  if (!startDate) return 0;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 0;
  const today = new Date();
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.floor((todayDay.getTime() - startDay.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, diff);
}

/** Live trip companion — today's plan for accepted / in-progress trips. */
export function TripCompanion({ status, partnerName, startDate, days = [], onOpenChat }: Props) {
  const active = status === "ACCEPTED" || status === "IN_PROGRESS" || status === "COMPLETED";
  const idx = dayIndexFromStart(startDate);
  const today = useMemo(() => {
    if (!days.length) return null;
    if (status === "ACCEPTED" && idx < 0) return days[0];
    return days[Math.min(idx, days.length - 1)] ?? days[0];
  }, [days, idx, status]);

  if (!active) return null;

  const partner = partnerName?.trim() || "your travel partner";

  return (
    <section className="trip-companion" aria-label="Trip companion">
      <header className="trip-companion__head">
        <p className="trip-companion__eyebrow">Trip companion</p>
        <h3>
          {status === "ACCEPTED" && idx <= 0
            ? "Getting ready"
            : status === "COMPLETED"
              ? "Trip complete"
              : `Day ${today?.dayNumber ?? idx + 1}`}
        </h3>
        <p className="muted">
          {today?.title || `Your plan with ${partner}`}
          {startDate ? ` · starts ${new Date(startDate).toLocaleDateString()}` : ""}
        </p>
      </header>

      {today?.items?.length ? (
        <ol className="trip-companion__list">
          {today.items.map((item, i) => (
            <li key={`${item.label}-${i}`}>
              {item.scheduledTime ? <time>{item.scheduledTime}</time> : null}
              <span>{item.entityName || item.label}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">Day details will appear here once your itinerary is shared.</p>
      )}

      {onOpenChat ? (
        <button type="button" className="btn btn-primary" onClick={onOpenChat}>
          Message {partner}
        </button>
      ) : null}
    </section>
  );
}
