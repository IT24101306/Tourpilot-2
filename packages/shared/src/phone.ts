/** Normalize to E.164 (+country + national number, digits only after +). */
export function toStoredPhone(phone: string): string {
  let raw = String(phone || "").trim().replace(/[\s\-().]/g, "");

  if (raw.startsWith("00")) {
    return "+" + raw.slice(2).replace(/\D/g, "");
  }

  if (raw.startsWith("+")) {
    return "+" + raw.slice(1).replace(/\D/g, "");
  }

  const digits = raw.replace(/\D/g, "");

  // Legacy Sri Lanka local format (0XXXXXXXXX) → +94XXXXXXXXX
  if (/^0[1-9]\d{8,9}$/.test(digits)) {
    return "+94" + digits.slice(1);
  }

  return "+" + digits;
}

/** E.164: + then 8–15 digits, first digit 1–9. */
export function isValidInternationalPhone(phone: string): boolean {
  const stored = toStoredPhone(phone);
  return /^\+[1-9]\d{7,14}$/.test(stored);
}

export function combinePhoneParts(countryCode: string, nationalNumber: string): string {
  const cc = countryCode.trim().startsWith("+")
    ? countryCode.trim().replace(/[\s\-().]/g, "")
    : "+" + countryCode.replace(/\D/g, "");
  const national = nationalNumber.replace(/\D/g, "").replace(/^0+/, "");
  return toStoredPhone(cc + national);
}

export function formatPhoneDisplay(phone: string): string {
  return toStoredPhone(phone);
}
