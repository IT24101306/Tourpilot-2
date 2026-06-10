import {
  formatOfferMonthLabel,
  OFFER_MONTH_ABBREVS,
  parseOfferMonthParts,
} from "@tourpilot/shared";

type Props = {
  offerMonth?: string | null;
  className?: string;
};

export function OfferMonthCalendar({ offerMonth, className }: Props) {
  const parts = parseOfferMonthParts(offerMonth);
  const monthLabel = formatOfferMonthLabel(offerMonth);

  if (!parts || !monthLabel) return null;

  const rootClass = ["offer-month-calendar", className].filter(Boolean).join(" ");

  return (
    <div className={rootClass} aria-label={`This offer is dedicated to ${monthLabel}`}>
      <div className="offer-month-calendar__icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect
            x="3"
            y="5"
            width="18"
            height="16"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </div>

      <div className="offer-month-calendar__content">
        <p className="offer-month-calendar__dedicated">
          Dedicated to <strong>{monthLabel}</strong>
        </p>
        <div className="offer-month-calendar__strip" role="list" aria-label="Months of the year">
          <span className="offer-month-calendar__year">{parts.year}</span>
          {OFFER_MONTH_ABBREVS.map((label, index) => {
            const monthNumber = index + 1;
            const isActive = monthNumber === parts.month;
            return (
              <span
                key={label}
                role="listitem"
                className={`offer-month-calendar__month${isActive ? " is-active" : ""}`}
                aria-current={isActive ? "date" : undefined}
              >
                {label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
