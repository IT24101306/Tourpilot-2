import {
  calendarDaysBetween,
  endDateFromStartAndTourDays,
  formatTourDaysNights,
  tourNightsFromDays,
} from "@tourpilot/shared";

type Props = {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  tourDays?: number | null;
  disabled?: boolean;
};

export function InquiryTripDates({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  tourDays,
  disabled,
}: Props) {
  const packageDuration = tourDays != null && tourDays > 0 ? formatTourDaysNights(tourDays) : null;
  const selectedDays =
    tourDays != null && tourDays > 0
      ? tourDays
      : startDate && endDate
        ? calendarDaysBetween(startDate, endDate)
        : null;
  const selectedNights =
    selectedDays != null && selectedDays > 0 ? tourNightsFromDays(selectedDays) : null;
  const showDuration =
    selectedDays != null &&
    selectedDays > 0 &&
    Boolean(startDate && (endDate || (tourDays != null && tourDays > 0)));

  function handleStartChange(value: string) {
    onStartDateChange(value);
    if (tourDays != null && tourDays > 0 && value) {
      const autoEnd = endDateFromStartAndTourDays(value, tourDays);
      if (autoEnd) onEndDateChange(autoEnd);
    } else if (!value) {
      onEndDateChange("");
    }
  }

  const endLocked = Boolean(tourDays && tourDays > 0 && startDate);

  return (
    <div className="inquiry-trip-dates">
      <div className="agency-inquiry-grid agency-inquiry-grid--trip">
        <div className="inquiry-field">
          <label htmlFor="inquiry-start">Start date</label>
          <input
            id="inquiry-start"
            type="date"
            value={startDate}
            onChange={(e) => handleStartChange(e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="inquiry-field">
          <label htmlFor="inquiry-end">End date</label>
          <input
            id="inquiry-end"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => onEndDateChange(e.target.value)}
            readOnly={endLocked}
            className={endLocked ? "inquiry-input-readonly" : undefined}
            disabled={disabled}
            aria-describedby={endLocked ? "inquiry-end-hint" : undefined}
          />
          {endLocked && (
            <span id="inquiry-end-hint" className="inquiry-hint">
              Set from package length ({packageDuration})
            </span>
          )}
        </div>
      </div>

      {showDuration && (
        <p className="inquiry-duration-summary" aria-live="polite">
          <span className="inquiry-duration-summary__value">
            {selectedDays} day{selectedDays === 1 ? "" : "s"}
          </span>
          <span className="inquiry-duration-summary__sep" aria-hidden="true">
            ·
          </span>
          <span className="inquiry-duration-summary__value">
            {selectedNights} night{selectedNights === 1 ? "" : "s"}
          </span>
          {packageDuration && tourDays != null && (
            <span className="inquiry-duration-summary__package">
              Package: {packageDuration}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
