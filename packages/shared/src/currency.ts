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

/**
 * Traveler listing / charging currency is USD.
 * DB fields are still named *Lkr and hold LKR amounts for local ops;
 * we convert LKR → USD for the listed price, then roughly to other display currencies.
 */
export const LISTING_CURRENCY: DisplayCurrency = "USD";

/** Fallback LKR per 1 USD when live FX is unavailable. */
export const LKR_PER_USD = 300;

/**
 * Approximate LKR per 1 unit of display currency (fallback only).
 * Live rates from GET /api/fx/rates override these in the UI.
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

/** LKR needed to buy 1 unit of each display currency. */
export type LkrRateTable = Record<DisplayCurrency, number>;

export type FxRatesPayload = {
  /** LKR per 1 unit of each currency */
  rates: LkrRateTable;
  /** ISO timestamp of the rate snapshot */
  asOf: string;
  /** Whether rates came from a live provider or static fallback */
  live: boolean;
  source?: string;
};

export const DISPLAY_CURRENCY_LABELS: Record<DisplayCurrency, string> = {
  USD: "US dollars — listing currency",
  EUR: "Euros (approx.)",
  GBP: "British pounds (approx.)",
  AUD: "Australian dollars (approx.)",
  CAD: "Canadian dollars (approx.)",
  INR: "Indian rupees (approx.)",
  AED: "UAE dirhams (approx.)",
  SGD: "Singapore dollars (approx.)",
  LKR: "Sri Lankan rupees",
};

const DISPLAY_CURRENCY_SET = new Set<string>(DISPLAY_CURRENCIES);

export function isDisplayCurrency(value: string): value is DisplayCurrency {
  return DISPLAY_CURRENCY_SET.has(value);
}

export function resolveLkrRates(rates?: Partial<LkrRateTable> | null): LkrRateTable {
  const out = { ...LKR_PER_DISPLAY_UNIT };
  if (!rates) return out;
  for (const code of DISPLAY_CURRENCIES) {
    const n = Number(rates[code]);
    if (Number.isFinite(n) && n > 0) out[code] = n;
  }
  out.LKR = 1;
  return out;
}

/**
 * Convert a stored LKR amount for display.
 * Path: LKR → USD (listing) → optional other currency via cross-rate.
 */
export function convertLkrToDisplay(
  amountLkr: number,
  currency: DisplayCurrency,
  rates?: Partial<LkrRateTable> | null
): number {
  const lkr = Number(amountLkr);
  if (!Number.isFinite(lkr) || lkr < 0) return 0;
  const table = resolveLkrRates(rates);
  const lkrPerUsd = table.USD || LKR_PER_USD;

  if (currency === "LKR") return Math.round(lkr);

  // Canonical traveler amount is USD.
  const usd = lkr / lkrPerUsd;
  if (currency === "USD") return Math.round(usd * 100) / 100;

  const lkrPerUnit = table[currency] || lkrPerUsd;
  const inCurrency = usd * (lkrPerUsd / lkrPerUnit);
  if (currency === "INR") return Math.round(inCurrency);
  return Math.round(inCurrency * 100) / 100;
}

export function formatDisplayMoney(
  amountLkr: number,
  currency: DisplayCurrency,
  rates?: Partial<LkrRateTable> | null
): string {
  const value = convertLkrToDisplay(amountLkr, currency, rates);
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

export function formatFromLkr(
  amountLkr: number,
  currency: DisplayCurrency,
  rates?: Partial<LkrRateTable> | null
): string {
  return `From ${formatDisplayMoney(amountLkr, currency, rates)}`;
}

/** Convert a USD listing amount back to LKR using the rate table. */
export function usdToLkr(
  amountUsd: number,
  rates?: Partial<LkrRateTable> | null
): number {
  const usd = Number(amountUsd);
  if (!Number.isFinite(usd) || usd < 0) return 0;
  const table = resolveLkrRates(rates);
  return Math.round(usd * (table.USD || LKR_PER_USD));
}

/**
 * Detect legacy baked labels like "$150.00 / per person" or "150 USD".
 * Returns the USD numeric amount, or null if the label isn't a USD price.
 */
export function parseUsdAmountFromLabel(label: string): number | null {
  const raw = String(label || "").trim();
  if (!raw) return null;
  const dollar = raw.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  const code = raw.match(/([\d,]+(?:\.\d+)?)\s*USD\b/i);
  const match = dollar || code;
  if (!match) return null;
  const n = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** True when a freeform label looks like a hardcoded USD price. */
export function isBakedUsdPriceLabel(label: string): boolean {
  return parseUsdAmountFromLabel(label) != null;
}

/**
 * Resolve an LKR amount for live display conversion.
 * Prefers explicit LKR, then recovers LKR from legacy baked USD labels.
 */
export function resolveAmountLkrForDisplay(params: {
  amountLkr?: number | null;
  priceLabel?: string | null;
  rates?: Partial<LkrRateTable> | null;
}): number | null {
  const direct = Number(params.amountLkr);
  if (Number.isFinite(direct) && direct >= 0) return direct;
  const usd = params.priceLabel ? parseUsdAmountFromLabel(params.priceLabel) : null;
  if (usd == null) return null;
  return usdToLkr(usd, params.rates);
}
