import type { DisplayCurrency } from "@tourpilot/shared";
import { DISPLAY_CURRENCIES, LKR_PER_USD } from "@tourpilot/shared";
import { useCurrency } from "../../context/CurrencyContext";

export function CurrencyPreferencePanel() {
  const { currency, setCurrency, saving, canChange } = useCurrency();

  if (!canChange) return null;

  return (
    <section className="account-currency-panel" aria-labelledby="currencyPrefTitle">
      <header className="account-currency-panel__head account-section-head">
        <h2 id="currencyPrefTitle" className="account-currency-panel__title">
          Display currency
        </h2>
        <p className="account-currency-panel__lead">
          Choose how tour and offer prices are shown across TourPilot. Amounts are converted from
          operator prices at approximately {LKR_PER_USD} LKR = 1 USD.
        </p>
      </header>
      <div className="account-currency-panel__options" role="radiogroup" aria-label="Display currency">
        {DISPLAY_CURRENCIES.map((code) => (
          <label
            key={code}
            className={`account-currency-option${currency === code ? " is-active" : ""}`}
          >
            <input
              type="radio"
              name="displayCurrency"
              value={code}
              checked={currency === code}
              disabled={saving}
              onChange={() => setCurrency(code as DisplayCurrency)}
            />
            <span className="account-currency-option__label">{code}</span>
            <span className="account-currency-option__hint">
              {code === "USD" ? "US dollars" : "Sri Lankan rupees"}
            </span>
          </label>
        ))}
      </div>
      {saving && <p className="muted account-currency-panel__status">Saving preference…</p>}
    </section>
  );
}
