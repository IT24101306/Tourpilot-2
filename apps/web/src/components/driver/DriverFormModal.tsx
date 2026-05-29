import { FormEvent, useEffect, useRef, type ReactNode } from "react";
import { api } from "../../api/client";

export type DriverFormState = {
  name: string;
  licenseNo: string;
  phone: string;
  vehicle: string;
  status: "Available" | "On Tour" | "Off Duty";
  /** Profile fields came from an existing driver account and must not be edited */
  profileLocked?: boolean;
  lookupHint?: string;
  lookupError?: string;
};

export type DriverPhoneLookup = {
  found: boolean;
  locked?: boolean;
  invalidPhone?: boolean;
  conflict?: "wrong_role";
  alreadyOnRoster?: boolean;
  linkedToOtherAgency?: boolean;
  otherAgencyName?: string | null;
  name?: string;
  phone?: string;
  licenseNo?: string;
  vehicle?: string;
  message?: string;
};

export const defaultDriverForm = (): DriverFormState => ({
  name: "",
  licenseNo: "",
  phone: "",
  vehicle: "",
  status: "Available",
  profileLocked: false,
  lookupHint: "",
  lookupError: "",
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
  token?: string | null;
  onClose: () => void;
  onChange: (next: DriverFormState) => void;
  onSubmit: (e: FormEvent) => void;
};

export function DriverFormModal({
  open,
  form,
  status,
  saving,
  token,
  onClose,
  onChange,
  onSubmit,
}: Props) {
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupSeq = useRef(0);
  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    return () => {
      if (lookupTimer.current) clearTimeout(lookupTimer.current);
    };
  }, []);

  if (!open) return null;

  function setField<K extends keyof DriverFormState>(key: K, value: DriverFormState[K]) {
    onChange({ ...form, [key]: value });
  }

  function setPhone(value: string) {
    if (form.profileLocked) {
      onChange({
        ...defaultDriverForm(),
        phone: value,
        status: form.status,
      });
      scheduleLookup(value);
      return;
    }

    onChange({
      ...form,
      phone: value,
      lookupHint: "",
      lookupError: "",
    });
    scheduleLookup(value);
  }

  function scheduleLookup(phone: string) {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    const trimmed = phone.trim();
    if (!token || trimmed.length < 8) return;

    lookupTimer.current = setTimeout(() => {
      void runLookup(trimmed);
    }, 450);
  }

  async function runLookup(phone: string) {
    if (!token) return;
    const seq = ++lookupSeq.current;

    try {
      const result = await api<DriverPhoneLookup>(
        `/drivers/agency/lookup-by-phone?phone=${encodeURIComponent(phone)}`,
        { token }
      );

      if (seq !== lookupSeq.current) return;

      if (result.invalidPhone) {
        onChange({
          ...formRef.current,
          phone,
          profileLocked: false,
          lookupHint: "",
          lookupError: "",
        });
        return;
      }

      if (!result.found) {
        onChange({
          ...formRef.current,
          phone,
          profileLocked: false,
          lookupHint: "",
          lookupError: "",
        });
        return;
      }

      if (result.conflict === "wrong_role") {
        onChange({
          ...formRef.current,
          phone,
          profileLocked: false,
          lookupHint: "",
          lookupError: result.message || "This phone belongs to a non-driver account.",
        });
        return;
      }

      if (result.alreadyOnRoster || result.linkedToOtherAgency) {
        onChange({
          ...formRef.current,
          phone,
          name: result.name ?? "",
          licenseNo: result.licenseNo ?? "",
          vehicle: result.vehicle ?? "",
          profileLocked: true,
          lookupHint: "",
          lookupError: result.message || "This driver cannot be added.",
        });
        return;
      }

      onChange({
        ...formRef.current,
        phone,
        name: result.name ?? "",
        licenseNo: result.licenseNo ?? "",
        vehicle: result.vehicle ?? "",
        profileLocked: true,
        lookupHint: result.message || "Existing driver — details from their profile.",
        lookupError: "",
      });
    } catch {
      if (seq !== lookupSeq.current) return;
      onChange({
        ...formRef.current,
        phone,
        lookupError: "Could not look up this phone number. Try again.",
      });
    }
  }

  const canSave =
    Boolean(form.phone.trim()) &&
    !form.lookupError &&
    (form.profileLocked || Boolean(form.name.trim()));

  const locked = Boolean(form.profileLocked && !form.lookupError);

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
          Enter the driver&apos;s phone number first. If they already have a TourPilot driver account,
          their profile details are filled in automatically. They log in at /login with OTP — no
          separate signup.
        </p>

        <form onSubmit={onSubmit}>
          <div className="entity-form-grid">
            <Field label="Phone (required)" full>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => {
                  const trimmed = form.phone.trim();
                  if (trimmed.length >= 8) void runLookup(trimmed);
                }}
                placeholder="+94771234567"
                required
                autoFocus
              />
            </Field>

            {form.lookupHint && !form.lookupError && (
              <p className="driver-lookup-hint muted full">{form.lookupHint}</p>
            )}
            {form.lookupError && (
              <p className="driver-lookup-error full" role="alert">
                {form.lookupError}
              </p>
            )}

            <Field label="Driver Name">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Nimal Perera"
                required={!locked}
                readOnly={locked}
                className={locked ? "input-readonly" : undefined}
              />
            </Field>
            <Field label="License No">
              <input
                type="text"
                value={form.licenseNo}
                onChange={(e) => setField("licenseNo", e.target.value)}
                placeholder="B321-9845"
                readOnly={locked}
                className={locked ? "input-readonly" : undefined}
              />
            </Field>
            <Field label="Vehicle">
              <input
                type="text"
                value={form.vehicle}
                onChange={(e) => setField("vehicle", e.target.value)}
                placeholder="Toyota KDH"
                readOnly={locked}
                className={locked ? "input-readonly" : undefined}
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
            <button type="submit" className="btn btn-primary" disabled={saving || !canSave}>
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
