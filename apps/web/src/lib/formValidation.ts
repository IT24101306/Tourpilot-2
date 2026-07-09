export type FieldRule = {
  label: string;
  value: unknown;
  required?: boolean;
};

export function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (typeof value === "number") return Number.isNaN(value);
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Returns field-key → message for each empty required field. */
export function validateRequiredFields(fields: Record<string, FieldRule>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [key, field] of Object.entries(fields)) {
    if (field.required === false) continue;
    if (isEmptyValue(field.value)) {
      errors[key] = `${field.label} is required`;
    }
  }
  return errors;
}

export function hasValidationErrors(errors: Record<string, string>): boolean {
  return Object.keys(errors).length > 0;
}
