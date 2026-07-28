import { formatDisplayMoney, type DisplayCurrency } from "@tourpilot/shared";
import { useFormatMoney } from "../../context/CurrencyContext";

type Props = {
  amount: number;
  /** @deprecated Prefer exact amounts — "from" is ignored for tour pricing. */
  prefix?: string;
  /** Force a currency; tour prices should pass "USD". */
  currency?: DisplayCurrency;
  className?: string;
};

/** Renders an LKR-stored amount in the visitor's display currency (default USD). */
export function FormatLkr({ amount, prefix, currency: currencyOverride, className }: Props) {
  const { format, currency, rates } = useFormatMoney();
  const resolved = currencyOverride ?? currency;
  const text =
    currencyOverride != null
      ? formatDisplayMoney(amount, resolved, rates)
      : prefix && prefix !== "from"
        ? `${prefix}${format(amount)}`
        : format(amount);
  return <span className={className}>{text}</span>;
}

/** Tour listing / charge price — always USD (the main traveler currency). */
export function FormatTourPrice({ amount, className }: { amount: number; className?: string }) {
  return <FormatLkr amount={amount} currency="USD" className={className} />;
}
