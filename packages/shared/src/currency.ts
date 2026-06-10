export type DisplayCurrency = "USD" | "LKR";

export const DISPLAY_CURRENCIES: DisplayCurrency[] = ["USD", "LKR"];

/** Fixed display rate — amounts are stored in LKR in the database. */
export const LKR_PER_USD = 300;

export function isDisplayCurrency(value: string): value is DisplayCurrency {
  return value === "USD" || value === "LKR";
}

export function convertLkrToDisplay(amountLkr: number, currency: DisplayCurrency): number {
  const lkr = Number(amountLkr);
  if (!Number.isFinite(lkr) || lkr < 0) return 0;
  if (currency === "LKR") return Math.round(lkr);
  return Math.round((lkr / LKR_PER_USD) * 100) / 100;
}

export function formatDisplayMoney(amountLkr: number, currency: DisplayCurrency): string {
  const value = convertLkrToDisplay(amountLkr, currency);
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  return `LKR ${value.toLocaleString("en-LK")}`;
}

export function formatFromLkr(amountLkr: number, currency: DisplayCurrency): string {
  return `From ${formatDisplayMoney(amountLkr, currency)}`;
}
