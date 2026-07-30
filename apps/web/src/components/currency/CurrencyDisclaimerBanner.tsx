import { useState } from "react";
import { useCurrency } from "../../context/CurrencyContext";

const STORAGE_KEY = "tourpilot_currency_banner_dismissed";

function isDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function CurrencyDisclaimerBanner() {
  const { currency } = useCurrency();
  const [dismissed, setDismissed] = useState(isDismissed);

  if (currency === "USD" || dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  return (
    <div className="currency-disclaimer-banner" role="status">
      <p>
        Prices shown in <strong>{currency}</strong> are approximate, converted from USD at
        today&apos;s rate.
      </p>
      <button
        type="button"
        className="currency-disclaimer-banner__close"
        onClick={dismiss}
        aria-label="Dismiss currency notice"
      >
        ×
      </button>
    </div>
  );
}
