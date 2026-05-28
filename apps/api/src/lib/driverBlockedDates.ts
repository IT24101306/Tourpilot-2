const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseBlockedDates(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const date = entry.trim();
    if (ISO_DATE.test(date)) unique.add(date);
  }
  return [...unique].sort();
}

export function normalizeBlockedDates(dates: string[]): string[] {
  const unique = new Set<string>();
  for (const entry of dates) {
    const date = entry.trim();
    if (!ISO_DATE.test(date)) {
      throw new Error(`Invalid date format: ${entry}. Use YYYY-MM-DD.`);
    }
    unique.add(date);
  }
  return [...unique].sort();
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Expand assignment start/end into each calendar day (YYYY-MM-DD). */
export function assignmentDateKeys(
  assignments: Array<{ startDate: Date; endDate: Date | null; status: string }>
): string[] {
  const keys = new Set<string>();
  for (const a of assignments) {
    if (a.status === "Cancelled") continue;
    const start = new Date(a.startDate);
    const end = a.endDate ? new Date(a.endDate) : new Date(a.startDate);
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cursor <= last) {
      keys.add(toDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return [...keys].sort();
}
