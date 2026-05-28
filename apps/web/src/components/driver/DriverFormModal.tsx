import { FormEvent, type ReactNode } from "react";

export type DriverFormState = {
  name: string;
  licenseNo: string;
  phone: string;
  vehicle: string;
  status: "Available" | "On Tour" | "Off Duty";
};

export const defaultDriverForm = (): DriverFormState => ({
  name: "",
  licenseNo: "",
  phone: "",
  vehicle: "",
  status: "Available",
});

export const DRIVER_STATUS_OPTIONS: DriverFormState["status"][] = [
  "Available",
  "On Tour",
  "Off Duty",
];

type Props = {
  open: boolean;
  form: DriverFormState;
  status: string;
  saving: boolean;
  onClose: () => void;
  onChange: (next: DriverFormState) => void;
  onSubmit: (e: FormEvent) => void;
};

export function DriverFormModal({
  open,
  form,
  status,
  saving,
  onClose,
  onChange,
  onSubmit,
}: Props) {
  if (!open) return null;

  function setField<K extends keyof DriverFormState>(key: K, value: DriverFormState[K]) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className="entity-modal open" role="presentation" onClick={onClose}>
      <div
        className="entity-dialog driver-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-head">
          <h3>Add Driver Details</h3>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="dialog-sub muted">
          A TourPilot login is created automatically from the phone number. The driver only needs
          to open Login, enter this number, and verify OTP — no separate signup.
        </p>

        <form onSubmit={onSubmit}>
          <div className="entity-form-grid">
            <Field label="Driver Name">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Nimal Perera"
                required
                autoFocus
              />
            </Field>
            <Field label="License No">
              <input
                type="text"
                value={form.licenseNo}
                onChange={(e) => setField("licenseNo", e.target.value)}
                placeholder="B321-9845"
              />
            </Field>
            <Field label="Phone (required)">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder="+94771234567"
                required
              />
            </Field>
            <Field label="Vehicle">
              <input
                type="text"
                value={form.vehicle}
                onChange={(e) => setField("vehicle", e.target.value)}
                placeholder="Toyota KDH"
              />
            </Field>
            <Field label="Status" full>
              <select
                value={form.status}
                onChange={(e) => setField("status", e.target.value as DriverFormState["status"])}
              >
                {DRIVER_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !form.name.trim() || !form.phone.trim()}
            >
              {saving ? "Saving…" : "Save Driver"}
            </button>
          </div>
          {status && <p className="driver-status">{status}</p>}
        </form>
      </div>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: ReactNode }) {
  return (
    <div className={`field ${full ? "full" : ""}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}
