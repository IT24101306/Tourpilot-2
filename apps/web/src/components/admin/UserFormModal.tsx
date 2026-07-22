import { FormEvent, useEffect, useState } from "react";

const ROLES = ["TOURIST", "AGENCY", "INFLUENCER", "DRIVER", "ADMIN"] as const;

export type UserFormValues = {
  name: string;
  phone: string;
  email: string;
  role: (typeof ROLES)[number];
  isActive: boolean;
  walletBalance?: string;
  /** Custom login fee override; empty string = role default. */
  loginFeeLkr?: string;
};

type Props = {
  open: boolean;
  mode: "create" | "edit" | "duplicate";
  loading: boolean;
  initial?: Partial<UserFormValues> | null;
  /** Shown when duplicating so admin knows which account is the source. */
  sourceLabel?: string | null;
  onClose: () => void;
  onSave: (values: UserFormValues) => void;
};

const EMPTY: UserFormValues = {
  name: "",
  phone: "",
  email: "",
  role: "TOURIST",
  isActive: true,
  walletBalance: "0",
  loginFeeLkr: "",
};

export function UserFormModal({
  open,
  mode,
  loading,
  initial,
  sourceLabel,
  onClose,
  onSave,
}: Props) {
  const [form, setForm] = useState<UserFormValues>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...EMPTY,
      ...initial,
      email: initial?.email ?? "",
      phone: mode === "duplicate" ? "" : (initial?.phone ?? ""),
      walletBalance: initial?.walletBalance ?? "0",
      loginFeeLkr: initial?.loginFeeLkr ?? "",
      isActive: initial?.isActive ?? true,
      role: (initial?.role as UserFormValues["role"]) || "TOURIST",
    });
  }, [open, initial, mode]);

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    onSave({
      ...form,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
    });
  }

  const title =
    mode === "edit" ? "Edit user" : mode === "duplicate" ? "Duplicate user" : "Create user";

  const hint =
    mode === "edit"
      ? "Update profile fields. Changing phone updates login identity."
      : mode === "duplicate"
        ? "Copies role and settings from the source account. Enter a new phone number — it must be unique."
        : "Creates an account immediately (no OTP). Phone must include country code.";

  return (
    <div className="gov-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="gov-modal"
        role="dialog"
        aria-labelledby="user-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="user-form-title">{title}</h3>
        <p className="muted">{hint}</p>
        {mode === "duplicate" && sourceLabel ? (
          <p className="muted">
            Duplicating: <strong>{sourceLabel}</strong>
          </p>
        ) : null}
        <form onSubmit={handleSubmit}>
          <label htmlFor="user-name">Name</label>
          <input
            id="user-name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
            maxLength={120}
          />

          <label htmlFor="user-phone">
            Phone (E.164){mode === "duplicate" ? " — required, new number" : ""}
          </label>
          <input
            id="user-phone"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            placeholder="+94771234567"
            required
            autoFocus={mode === "duplicate"}
          />

          <label htmlFor="user-email">Email (optional)</label>
          <input
            id="user-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            placeholder="name@example.com"
          />

          <label htmlFor="user-role">Role</label>
          <select
            id="user-role"
            className="agency-filter"
            value={form.role}
            onChange={(e) =>
              setForm((p) => ({ ...p, role: e.target.value as UserFormValues["role"] }))
            }
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {(mode === "create" || mode === "duplicate") && (
            <>
              <label htmlFor="user-wallet">Opening wallet (LKR)</label>
              <input
                id="user-wallet"
                type="number"
                min={0}
                step={1}
                value={form.walletBalance}
                onChange={(e) => setForm((p) => ({ ...p, walletBalance: e.target.value }))}
              />
              <label htmlFor="user-login-fee">Custom login fee (LKR, blank = role default)</label>
              <input
                id="user-login-fee"
                type="number"
                min={0}
                step={1}
                value={form.loginFeeLkr}
                onChange={(e) => setForm((p) => ({ ...p, loginFeeLkr: e.target.value }))}
                placeholder="Role default"
              />
            </>
          )}

          <label className="gov-check-row">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
            />
            <span>Active (can sign in)</span>
          </label>

          <div className="gov-form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading
                ? "Saving…"
                : mode === "edit"
                  ? "Save changes"
                  : mode === "duplicate"
                    ? "Create duplicate"
                    : "Create user"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
