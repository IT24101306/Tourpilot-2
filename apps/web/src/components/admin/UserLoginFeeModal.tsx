import { FormEvent, useEffect, useState } from "react";

type Props = {
  userName: string;
  role: string;
  roleDefaultFee: number;
  currentOverride: number | null;
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onSave: (loginFeeLkr: number | null) => void;
};

export function UserLoginFeeModal({
  userName,
  role,
  roleDefaultFee,
  currentOverride,
  open,
  loading,
  onClose,
  onSave,
}: Props) {
  const [useCustom, setUseCustom] = useState(currentOverride != null);
  const [amount, setAmount] = useState(
    currentOverride != null ? String(currentOverride) : String(roleDefaultFee)
  );

  useEffect(() => {
    if (!open) return;
    setUseCustom(currentOverride != null);
    setAmount(currentOverride != null ? String(currentOverride) : String(roleDefaultFee));
  }, [open, currentOverride, roleDefaultFee]);

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!useCustom) {
      onSave(null);
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) return;
    onSave(value);
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-labelledby="login-fee-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="login-fee-title">Login fee — {userName}</h2>
        <p className="muted">
          Role default for {role}: LKR {roleDefaultFee.toLocaleString()}
        </p>
        <form onSubmit={handleSubmit}>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
            />
            Use custom fee for this user
          </label>
          <label htmlFor="user-login-fee">
            Custom fee (LKR)
            <input
              id="user-login-fee"
              type="number"
              min={0}
              step={1}
              disabled={!useCustom}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
