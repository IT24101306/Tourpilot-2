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
