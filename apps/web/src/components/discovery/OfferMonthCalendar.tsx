import { useMemo } from "react";
import {
  formatOfferMonthLabel,
  OFFER_MONTH_ABBREVS,
  parseOfferMonthParts,
} from "@tourpilot/shared";

type Props = {
  offerMonth?: string | null;
  /** All YYYY-MM values that have an active offer (highlights multiple months). */
  offerMonths?: string[];
  className?: string;
  variant?: "default" | "hero" | "sidebar";
  onMonthSelect?: (offerMonth: string) => void;
};

function collectMonths(offerMonth?: string | null, offerMonths?: string[]) {
  const values = offerMonths?.length
    ? offerMonths
    : offerMonth
      ? [offerMonth]
      : [];
  return [...new Set(values.filter(Boolean))].sort();
}

function groupMonthsByYear(months: string[]) {
  const map = new Map<number, Set<number>>();
  for (const value of months) {
    const parts = parseOfferMonthParts(value);
    if (!parts) continue;
    if (!map.has(parts.year)) map.set(parts.year, new Set());
    map.get(parts.year)!.add(parts.month);
  }
  return [...map.entries()].sort(([a], [b]) => a - b);
}

export function OfferMonthCalendar({
  offerMonth,
  offerMonths,
  className,
  variant = "default",
  onMonthSelect,
}: Props) {
  const months = useMemo(() => collectMonths(offerMonth, offerMonths), [offerMonth, offerMonths]);
  const highlight = offerMonth ?? months[months.length - 1] ?? null;
  const highlightParts = parseOfferMonthParts(highlight);
  const monthLabel = formatOfferMonthLabel(highlight);
  const byYear = useMemo(() => groupMonthsByYear(months), [months]);

  if (!months.length || !highlightParts || !monthLabel) return null;

  const highlightYear = highlightParts.year;
  const highlightMonth = highlightParts.month;

  const rootClass = [
    "offer-month-calendar",
    variant === "hero" && "offer-month-calendar--hero",
    variant === "sidebar" && "offer-month-calendar--sidebar",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (variant === "hero") {
    return (
      <div className={rootClass} aria-label={`This offer is dedicated to ${monthLabel}`}>
        <svg className="offer-month-calendar__hero-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <rect x="8" y="14" width="48" height="42" rx="4" stroke="currentColor" strokeWidth="2.5" />
          <path d="M8 24h48" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="20" cy="10" r="3" fill="currentColor" />
          <circle cx="32" cy="10" r="3" fill="currentColor" />
          <circle cx="44" cy="10" r="3" fill="currentColor" />
          <rect x="16" y="30" width="10" height="8" rx="1.5" fill="currentColor" opacity="0.85" />
          <rect x="30" y="30" width="10" height="8" rx="1.5" fill="currentColor" opacity="0.85" />
          <rect x="44" y="30" width="6" height="8" rx="1.5" fill="currentColor" opacity="0.85" />
          <rect x="16" y="42" width="10" height="8" rx="1.5" fill="currentColor" opacity="0.85" />
          <rect x="30" y="42" width="10" height="8" rx="1.5" fill="currentColor" opacity="0.85" />
          <rect x="44" y="42" width="6" height="8" rx="1.5" fill="currentColor" opacity="0.85" />
        </svg>
        <span className="offer-month-calendar__hero-month">For {monthLabel}</span>
      </div>
    );
  }

  function renderMonthCell(year: number, offeredMonths: Set<number>, layout: "strip" | "grid") {
    return OFFER_MONTH_ABBREVS.map((label, index) => {
      const monthNumber = index + 1;
      const monthKey = `${year}-${String(monthNumber).padStart(2, "0")}`;
      const hasOffer = offeredMonths.has(monthNumber);
      const isCurrent = highlightYear === year && highlightMonth === monthNumber;
      const classNames = [
        "offer-month-calendar__month",
        layout === "grid" && "offer-month-calendar__month--grid",
        hasOffer && "is-offered",
        isCurrent && "is-active",
      ]
        .filter(Boolean)
        .join(" ");

      if (hasOffer && onMonthSelect) {
        return (
          <button
            key={label}
            type="button"
            role="listitem"
            className={classNames}
            aria-current={isCurrent ? "date" : undefined}
            aria-label={formatOfferMonthLabel(monthKey) ?? label}
            onClick={() => onMonthSelect(monthKey)}
          >
            {label}
          </button>
        );
      }

      return (
        <span
          key={label}
          role="listitem"
          className={classNames}
          aria-current={isCurrent ? "date" : undefined}
        >
          {label}
        </span>
      );
    });
  }

  function renderYearStrip(year: number, offeredMonths: Set<number>) {
    return (
      <div key={year} className="offer-month-calendar__year-block">
        <div className="offer-month-calendar__strip" role="list" aria-label={`Offer months in ${year}`}>
          <span className="offer-month-calendar__year">{year}</span>
          {renderMonthCell(year, offeredMonths, "strip")}
        </div>
      </div>
    );
  }

  function renderYearGrid(year: number, offeredMonths: Set<number>) {
    return (
      <div key={year} className="offer-month-calendar__year-block offer-month-calendar__year-block--grid">
        <span className="offer-month-calendar__year">{year}</span>
        <div className="offer-month-calendar__grid" role="list" aria-label={`Offer months in ${year}`}>
          {renderMonthCell(year, offeredMonths, "grid")}
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass} aria-label="Months with special offers">
      {variant === "sidebar" ? (
        <>
          <div className="offer-month-calendar__sidebar-head">
            <div className="offer-month-calendar__icon-badge" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect
                  x="3"
                  y="5"
                  width="18"
                  height="16"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.75"
                />
                <path
                  d="M3 9h18M8 3v4M16 3v4"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="offer-month-calendar__sidebar-copy">
              <p className="offer-month-calendar__sidebar-title">Offer months</p>
              <span className="offer-month-calendar__viewing-pill">{monthLabel}</span>
            </div>
          </div>
          <div className="offer-month-calendar__years">
            {byYear.map(([year, offeredMonths]) => renderYearGrid(year, offeredMonths))}
          </div>
          <p className="offer-month-calendar__legend muted">
            <span className="offer-month-calendar__legend-dot is-offered" aria-hidden="true" />
            Has offer
          </p>
        </>
      ) : (
        <>
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
              <path
                d="M3 9h18M8 3v4M16 3v4"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="offer-month-calendar__content">
            <p className="offer-month-calendar__dedicated">
              Dedicated to <strong>{monthLabel}</strong>
            </p>
            {renderYearStrip(highlightParts.year, byYear.find(([y]) => y === highlightParts.year)?.[1] ?? new Set([highlightParts.month]))}
          </div>
        </>
      )}
    </div>
  );
}
