import { formatDisplayMoney, type DisplayCurrency } from "@tourpilot/shared";
import { useFormatMoney } from "../../context/CurrencyContext";

type Props = {
  amount: number;
  /** @deprecated Prefer exact amounts — "from" is ignored for tour pricing. */
  prefix?: string;
  /** Force a currency; omit to use the visitor's display preference. */
  currency?: DisplayCurrency;
  className?: string;
};

/** Renders an LKR-stored amount in the visitor's display currency. */
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

/** Tour listing price — converts using the visitor's display currency preference. */
export function FormatTourPrice({
  amount,
  className,
  suffix,
}: {
  amount: number;
  className?: string;
  /** Optional trailing text, e.g. " / per person". */
  suffix?: string;
}) {
  const { format } = useFormatMoney();
  return (
    <span className={className}>
      {format(amount)}
      {suffix ?? null}
    </span>
  );
}
