import { normalizeRichHtml, sanitizeRichHtml } from "@tourpilot/shared";

/** Sanitize optional rich-text fields before DB write. */
export function sanitizeOptionalRichText(
  value: string | null | undefined
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return normalizeRichHtml(value, null);
}

export function sanitizeRequiredRichText(value: string | null | undefined): string {
  return sanitizeRichHtml(value ?? "");
}
