import { EntityTypeLineIcon } from "../icons/LineIcons";

type TourDay = {
  dayNumber: number;
  title: string | null;
  items: Array<{
    kind: string;
    label: string | null;
    priceLkr: number | null;
    entity: { name: string; type?: string } | null;
  }>;
};

type Props = {
  days: TourDay[];
  title?: string;
};

export function TourItineraryPreview({ days, title = "Your journey, day by day" }: Props) {
  if (!days.length) return null;

  return (
    <section className="module-itinerary itin-preview">
      <span className="module-badge module-badge--itinerary">Dream itinerary</span>
      <h2 className="itin-preview-title">{title}</h2>
      <p className="itin-preview-sub muted">Imagine each day before you book.</p>
      <div className="itin-timeline itin-timeline--compact">
        {days.map((day) => (
          <article key={day.dayNumber} className="itin-day">
            <div className="itin-day-marker">
              <span className="itin-day-dot" aria-hidden="true" />
              <span className="itin-day-num">Day {day.dayNumber}</span>
            </div>
            <div className="itin-day-content">
              {day.title && <h3 className="itin-day-title">{day.title}</h3>}
              <ul className="itin-moments">
                {day.items.map((item, i) => (
                  <li
                    key={`${day.dayNumber}-${i}`}
                    className={`itin-moment itin-moment--${item.kind.toLowerCase()}`}
                  >
                    <span className="itin-moment-icon" aria-hidden="true">
                      <EntityTypeLineIcon type={item.entity?.type ?? "OTHER"} size={16} />
                    </span>
                    <div className="itin-moment-body">
                      <strong>{item.entity?.name || item.label}</strong>
                      {item.priceLkr != null && (
                        <span className="itin-moment-price">
                          LKR {item.priceLkr.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
