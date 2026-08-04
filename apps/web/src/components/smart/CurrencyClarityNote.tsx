import { useCurrency } from "../../context/CurrencyContext";

/** Clarity note when visitor currency differs from LKR listing currency. */
export function CurrencyClarityNote({ className = "" }: { className?: string }) {
  const { currency, ratesLoading } = useCurrency();
  if (ratesLoading || currency === "LKR") return null;

  return (
    <p className={`currency-clarity-note ${className}`.trim()}>
      Prices convert from LKR to <strong>{currency}</strong> using live mid-market rates — approximate,
      and final charges may differ slightly at payment.
    </p>
  );
}
