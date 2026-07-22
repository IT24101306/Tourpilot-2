/** Shared helpers for session inactivity timeouts (stored as minutes). */

export const SESSION_INACTIVITY_MIN_MINUTES = 1;
/** 7 days */
export const SESSION_INACTIVITY_MAX_MINUTES = 7 * 24 * 60;
export const SESSION_INACTIVITY_DEFAULT_MINUTES = 3 * 60;

export type SessionInactivityUnit = "minutes" | "hours";

export function clampSessionInactivityMinutes(raw: number): number {
  const n = Math.round(raw);
  if (!Number.isFinite(n)) return SESSION_INACTIVITY_DEFAULT_MINUTES;
  return Math.max(
    SESSION_INACTIVITY_MIN_MINUTES,
    Math.min(SESSION_INACTIVITY_MAX_MINUTES, n)
  );
}

/** Convert a UI amount + unit into stored minutes. */
export function toSessionInactivityMinutes(
  amount: number,
  unit: SessionInactivityUnit
): number {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    return SESSION_INACTIVITY_DEFAULT_MINUTES;
  }
  return clampSessionInactivityMinutes(unit === "hours" ? n * 60 : n);
}

/**
 * Prefer explicit minutes; fall back to legacy hours columns.
 * Agency override (minutes or hours) wins over platform defaults.
 */
export function resolveSessionInactivityMinutes(opts: {
  agencyMinutes?: number | null;
  agencyHours?: number | null;
  platformMinutes?: number | null;
  platformHours?: number | null;
}): number {
  if (opts.agencyMinutes != null && Number.isFinite(opts.agencyMinutes)) {
    return clampSessionInactivityMinutes(opts.agencyMinutes);
  }
  if (opts.agencyHours != null && Number.isFinite(opts.agencyHours)) {
    return clampSessionInactivityMinutes(opts.agencyHours * 60);
  }
  if (opts.platformMinutes != null && Number.isFinite(opts.platformMinutes)) {
    return clampSessionInactivityMinutes(opts.platformMinutes);
  }
  if (opts.platformHours != null && Number.isFinite(opts.platformHours)) {
    return clampSessionInactivityMinutes(opts.platformHours * 60);
  }
  return SESSION_INACTIVITY_DEFAULT_MINUTES;
}

/** Pick a friendly unit for editing (prefer hours when evenly divisible). */
export function splitSessionInactivityForEdit(minutes: number): {
  amount: number;
  unit: SessionInactivityUnit;
} {
  const m = clampSessionInactivityMinutes(minutes);
  if (m >= 60 && m % 60 === 0) {
    return { amount: m / 60, unit: "hours" };
  }
  return { amount: m, unit: "minutes" };
}

export function formatSessionInactivity(minutes: number): string {
  const m = clampSessionInactivityMinutes(minutes);
  if (m >= 60 && m % 60 === 0) {
    const h = m / 60;
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return `${h}h ${rem}m`;
  }
  return `${m} minute${m === 1 ? "" : "s"}`;
}
