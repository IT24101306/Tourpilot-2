export function normalizePhone(phone: string): string {
  return String(phone || "").replace(/\D/g, "");
}

export function isValidSriLankaPhone(phone: string): boolean {
  const digits = normalizePhone(phone);
  return /^(0)?7[0-9]{8}$/.test(digits) || digits.length === 10;
}

export function toStoredPhone(phone: string): string {
  const digits = normalizePhone(phone);
  if (digits.length === 9 && digits.startsWith("7")) return `0${digits}`;
  if (digits.length === 10) return digits;
  return digits;
}
