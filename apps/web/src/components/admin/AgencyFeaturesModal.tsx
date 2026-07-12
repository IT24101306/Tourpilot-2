import { useEffect, useState } from "react";
import type { AgencyFeatures } from "../../context/AuthContext";
import { DEFAULT_AGENCY_FEATURES } from "../../context/AuthContext";

const FEATURE_ROWS: { key: keyof AgencyFeatures; label: string; hint: string }[] = [
  {
    key: "driversAndPartners",
    label: "Drivers & Partners",
    hint: "Handshake menu, fleet, and partner requests",
  },
  {
    key: "support",
    label: "Support",
    hint: "Support button in the dashboard top bar",
  },
  {
    key: "walletTopup",
    label: "Wallet topup",
    hint: "Self-service wallet funding",
  },
  {
    key: "offers",
    label: "Offers",
    hint: "Loyalty offers tab and management",
  },
];

type Props = {
  agencyName: string;
  open: boolean;
  loading: boolean;
  initial: AgencyFeatures;
  onClose: () => void;
  onSave: (features: AgencyFeatures) => void;
};

export function AgencyFeaturesModal({
  agencyName,
  open,
  loading,
  initial,
  onClose,
  onSave,
}: Props) {
  const [features, setFeatures] = useState<AgencyFeatures>({
    ...DEFAULT_AGENCY_FEATURES,
    ...initial,
  });

  useEffect(() => {
    if (open) setFeatures({ ...DEFAULT_AGENCY_FEATURES, ...initial });
  }, [open, initial]);

  if (!open) return null;

  function toggle(key: keyof AgencyFeatures) {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
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
            disabled={loading}
            onClick={() => onSave(features)}
          >
            {loading ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
