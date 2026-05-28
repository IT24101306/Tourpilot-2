export function daysUntilEnd(validUntil: string): number {
  const ms = new Date(validUntil).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function uniqueDistricts(
  agencies: Array<{ district: string | null }>
): string[] {
  const set = new Set<string>();
  for (const a of agencies) {
    if (a.district?.trim()) set.add(a.district.trim());
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
