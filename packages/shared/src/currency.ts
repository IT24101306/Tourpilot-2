export type DisplayCurrency =
  | "USD"
  | "EUR"
  | "GBP"
  | "AUD"
  | "CAD"
  | "INR"
  | "AED"
  | "SGD"
  | "LKR";

export const DISPLAY_CURRENCIES: DisplayCurrency[] = [
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "CAD",
  "INR",
  "AED",
  "SGD",
  "LKR",
];

/** Fixed display rate — amounts are stored in LKR in the database. */
export const LKR_PER_USD = 300;

/**
 * Approximate LKR per 1 unit of display currency (fixed for UI conversion).
 * Anchored on LKR_PER_USD; not live FX.
 */
export const LKR_PER_DISPLAY_UNIT: Record<DisplayCurrency, number> = {
  USD: LKR_PER_USD,
  EUR: 325,
  GBP: 380,
  AUD: 195,
  CAD: 220,
  INR: 3.6,
  AED: 82,
  SGD: 222,
  LKR: 1,
};

export const DISPLAY_CURRENCY_LABELS: Record<DisplayCurrency, string> = {
  USD: "US dollars",
  EUR: "Euros",
  GBP: "British pounds",
  AUD: "Australian dollars",
  CAD: "Canadian dollars",
  INR: "Indian rupees",
  AED: "UAE dirhams",
  SGD: "Singapore dollars",
  LKR: "Sri Lankan rupees",
};

const DISPLAY_CURRENCY_SET = new Set<string>(DISPLAY_CURRENCIES);

export function isDisplayCurrency(value: string): value is DisplayCurrency {
  return DISPLAY_CURRENCY_SET.has(value);
}

export function convertLkrToDisplay(amountLkr: number, currency: DisplayCurrency): number {
  const lkr = Number(amountLkr);
  if (!Number.isFinite(lkr) || lkr < 0) return 0;
  const rate = LKR_PER_DISPLAY_UNIT[currency] || LKR_PER_USD;
  if (currency === "LKR") return Math.round(lkr);
  if (currency === "INR") return Math.round(lkr / rate);
  return Math.round((lkr / rate) * 100) / 100;
}

export function formatDisplayMoney(amountLkr: number, currency: DisplayCurrency): string {
  const value = convertLkrToDisplay(amountLkr, currency);
  if (currency === "LKR") {
    return `LKR ${value.toLocaleString("en-LK")}`;
  }
  if (currency === "INR") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  }
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en")}`;
  }
}

export function formatFromLkr(amountLkr: number, currency: DisplayCurrency): string {
  return `From ${formatDisplayMoney(amountLkr, currency)}`;
}
