import { resolveAmountLkrForDisplay } from "@tourpilot/shared";
import { useFormatMoney } from "../../context/CurrencyContext";

type Props = {
  amountLkr?: number | null;
  /** Legacy freeform label; USD-looking amounts are converted. */
  priceLabel?: string | null;
  suffix?: string;
  className?: string;
  /** Shown when nothing convertible is available. */
  fallback?: string;
};

/**
 * Traveler-facing price text.
 * Uses display-currency preference (default USD). Never leaves baked "$"/"USD"
 * labels as-is when the visitor picked another currency.
 */
export function DisplayPriceText({
  amountLkr,
  priceLabel,
  suffix,
  className,
  fallback = "Contact for price",
}: Props) {
  const { format, rates, currency } = useFormatMoney();
  const resolvedLkr = resolveAmountLkrForDisplay({ amountLkr, priceLabel, rates });

  if (resolvedLkr != null) {
    return (
      <span className={className}>
        {format(resolvedLkr)}
        {suffix ?? null}
      </span>
    );
  }

  const label = String(priceLabel || "").trim();
  if (label && !/\$|USD/i.test(label)) {
    return <span className={className}>{label}</span>;
  }
  // Baked USD label with no recoverable amount — don't mislead non-USD visitors.
  if (label && currency === "USD") {
    return <span className={className}>{label}</span>;
  }
  return <span className={className}>{fallback}</span>;
}
