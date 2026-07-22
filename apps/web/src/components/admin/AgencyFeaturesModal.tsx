import { useEffect, useState } from "react";
import {
  SESSION_INACTIVITY_MAX_MINUTES,
  SESSION_INACTIVITY_MIN_MINUTES,
  formatSessionInactivity,
  splitSessionInactivityForEdit,
  toSessionInactivityMinutes,
  type SessionInactivityUnit,
} from "@tourpilot/shared";
import type { AgencyFeatures } from "../../context/AuthContext";
import { DEFAULT_AGENCY_FEATURES } from "../../context/AuthContext";

const FEATURE_ROWS: { key: keyof AgencyFeatures; label: string; hint: string }[] = [
  {
    key: "readyMadeTours",
    label: "Ready-made tours",
    hint: "Agency can publish/edit packages. Travelers still see existing tours; inquire CTA off when disabled",
  },
  {
    key: "customInquiries",
    label: "Custom tour inquiries",
    hint: "Travelers can send custom trip requests (form hidden when off)",
  },
  {
    key: "negotiationsBookings",
    label: "Negotiations → bookings",
    hint: "Agency bookings tab + travelers can accept proposals (accept hidden when off)",
  },
  {
    key: "offers",
    label: "Loyalty / promo offers",
    hint: "Agency can manage offers. Travelers still see existing public offers when disabled",
  },
  {
    key: "display",
    label: "Display editor",
    hint: "Agency can edit the storefront. Public page stays visible when disabled",
  },
  {
    key: "driversAndPartners",
    label: "Drivers & Partners",
    hint: "Handshake menu, fleet, and partner requests (agency only)",
  },
  {
    key: "support",
    label: "Support",
    hint: "Support button in the dashboard top bar (agency only)",
  },
  {
    key: "walletTopup",
    label: "Wallet topup",
    hint: "Agency self-service wallet funding",
  },
  {
    key: "customDomain",
    label: "Custom domain",
    hint: "Agency can connect their own domain (Shopify-style) to their storefront",
  },
  {
    key: "externalStorefront",
    label: "External / headless website",
    hint: "Agency may run a separately coded website that uses TourPilot APIs (tours, OTP, inquiries)",
  },
  {
    key: "sessionInactivityTimeout",
    label: "Session inactivity timeout",
    hint: "If idle too long, session ends and they must log in again (login fee applies). Off = normal JWT session",
  },
];

export type AgencyFeaturesSavePayload = {
  features: AgencyFeatures;
  /** null = use platform default. Stored as minutes. */
  sessionInactivityMinutes: number | null;
};

type Props = {
  agencyName: string;
  open: boolean;
  loading: boolean;
  initial: AgencyFeatures;
  /** Agency override in minutes; null/undefined = platform default. */
  initialSessionInactivityMinutes?: number | null;
  /** @deprecated Legacy hours override — used only if minutes not provided. */
  initialSessionInactivityHours?: number | null;
  onClose: () => void;
  onSave: (payload: AgencyFeaturesSavePayload) => void;
};

function initialEditState(
  minutes: number | null | undefined,
  hours: number | null | undefined
): { amount: string; unit: SessionInactivityUnit } {
  if (minutes != null && Number.isFinite(minutes)) {
    const split = splitSessionInactivityForEdit(minutes);
    return { amount: String(split.amount), unit: split.unit };
  }
  if (hours != null && Number.isFinite(hours)) {
    return { amount: String(hours), unit: "hours" };
  }
  return { amount: "", unit: "minutes" };
}

export function AgencyFeaturesModal({
  agencyName,
  open,
  loading,
  initial,
  initialSessionInactivityMinutes = null,
  initialSessionInactivityHours = null,
  onClose,
  onSave,
}: Props) {
  const [features, setFeatures] = useState<AgencyFeatures>({
    ...DEFAULT_AGENCY_FEATURES,
    ...initial,
  });
  const [amountInput, setAmountInput] = useState("");
  const [unit, setUnit] = useState<SessionInactivityUnit>("minutes");

  useEffect(() => {
    if (open) {
      setFeatures({ ...DEFAULT_AGENCY_FEATURES, ...initial });
      const next = initialEditState(
        initialSessionInactivityMinutes,
        initialSessionInactivityHours
      );
      setAmountInput(next.amount);
      setUnit(next.unit);
    }
  }, [open, initial, initialSessionInactivityMinutes, initialSessionInactivityHours]);

  if (!open) return null;

  function toggle(key: keyof AgencyFeatures) {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const maxAmount = unit === "hours" ? 168 : SESSION_INACTIVITY_MAX_MINUTES;
  const amountInvalid =
    amountInput.trim() !== "" &&
    (!Number.isFinite(Number(amountInput)) ||
      Number(amountInput) < SESSION_INACTIVITY_MIN_MINUTES ||
      Number(amountInput) > maxAmount);

  function handleSave() {
    const raw = amountInput.trim();
    let sessionInactivityMinutes: number | null = null;
    if (raw !== "") {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < SESSION_INACTIVITY_MIN_MINUTES || n > maxAmount) {
        return;
      }
      sessionInactivityMinutes = toSessionInactivityMinutes(n, unit);
    }
    onSave({ features, sessionInactivityMinutes });
  }

  return (
    <div className="gov-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="gov-modal gov-features-modal"
        role="dialog"
        aria-labelledby="agency-features-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="gov-features-modal__head">
          <h3 id="agency-features-title">Feature access</h3>
          <p className="muted">{agencyName}</p>
        </header>

        <div className="gov-features-table" role="group" aria-label="Agency feature toggles">
          {FEATURE_ROWS.map((row) => {
            const on = features[row.key];
            return (
              <div key={row.key} className="gov-features-row">
                <div className="gov-features-row__copy">
                  <span className="gov-features-row__label">{row.label}</span>
                  <span className="gov-features-row__hint">{row.hint}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${row.label}: ${on ? "enabled" : "disabled"}`}
                  className={`gov-feature-switch${on ? " is-on" : ""}`}
                  disabled={loading}
                  onClick={() => toggle(row.key)}
                >
                  <span className="gov-feature-switch__track">
                    <span className="gov-feature-switch__thumb" />
                  </span>
                  <span className="gov-feature-switch__state">{on ? "On" : "Off"}</span>
                </button>
              </div>
            );
          })}
        </div>

        {features.sessionInactivityTimeout ? (
          <div className="gov-features-hours">
            <label htmlFor="agency-idle-amount">Idle timeout</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                id="agency-idle-amount"
                type="number"
                min={SESSION_INACTIVITY_MIN_MINUTES}
                max={maxAmount}
                placeholder="Platform default"
                value={amountInput}
                disabled={loading}
                onChange={(e) => setAmountInput(e.target.value)}
              />
              <select
                className="agency-filter"
                value={unit}
                disabled={loading}
                aria-label="Idle timeout unit"
                onChange={(e) => setUnit(e.target.value as SessionInactivityUnit)}
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
              </select>
            </div>
            <span className="muted">
              Leave blank to use the platform default from Settings.{" "}
              {unit === "minutes"
                ? `Range ${SESSION_INACTIVITY_MIN_MINUTES}–${SESSION_INACTIVITY_MAX_MINUTES} minutes.`
                : "Range 1–168 hours."}
              {amountInput.trim() && !amountInvalid
                ? ` (= ${formatSessionInactivity(toSessionInactivityMinutes(Number(amountInput), unit))})`
                : ""}
            </span>
            {amountInvalid ? (
              <span className="form-error">
                Enter a whole number in the allowed range for {unit}.
              </span>
            ) : null}
          </div>
        ) : null}

        <p className="gov-features-modal__note muted">
          Changes apply after the agency refreshes or signs in again.
        </p>

        <div className="gov-form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading || amountInvalid}
            onClick={handleSave}
          >
            {loading ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
