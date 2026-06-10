/** Nights stayed — standard package convention (2-day trip = 1 night). */
export function tourNightsFromDays(days: number): number {
  if (!Number.isFinite(days) || days < 1) return 0;
  return Math.max(0, Math.round(days) - 1);
}

export function formatTourDaysNights(days: number): string {
  const d = Math.max(1, Math.round(days));
  const nights = tourNightsFromDays(d);
  const dayLabel = `${d} day${d === 1 ? "" : "s"}`;
  const nightLabel = `${nights} night${nights === 1 ? "" : "s"}`;
  return `${dayLabel} · ${nightLabel}`;
}

function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function formatDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** End date for a package: inclusive span of `tourDays` (start day counts as day 1). */
export function endDateFromStartAndTourDays(startDate: string, tourDays: number): string | null {
  const start = parseDateInput(startDate);
  if (!start || tourDays < 1) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + Math.max(0, Math.round(tourDays) - 1));
  return formatDateInput(end);
}

/** Inclusive calendar days between two YYYY-MM-DD values. */
export function calendarDaysBetween(startDate: string, endDate: string): number | null {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  if (!start || !end) return null;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return null;
  return Math.floor(diffMs / 86_400_000) + 1;
}
