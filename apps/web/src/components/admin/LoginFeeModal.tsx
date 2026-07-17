import { FormEvent, useEffect, useState } from "react";

type Props = {
  open: boolean;
  userName: string;
  role: string;
  /** Current effective fee shown for reference. */
  effectiveFee: number;
  /** null = using role default. */
  override: number | null;
  loading?: boolean;
  onClose: () => void;
  onSave: (loginFeeLkr: number | null) => void;
};

export function LoginFeeModal({
  open,
  userName,
  role,
  effectiveFee,
  override,
  loading,
  onClose,
  onSave,
}: Props) {
  const [useCustom, setUseCustom] = useState(override != null);
  const [amount, setAmount] = useState(String(override ?? effectiveFee));

  useEffect(() => {
    if (!open) return;
    setUseCustom(override != null);
    setAmount(String(override ?? effectiveFee));
  }, [open, override, effectiveFee]);

  if (!open) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!useCustom) {
      onSave(null);
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0) return;
    onSave(Math.round(n));
  }

  return (
    <div className="gov-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="gov-modal"
        role="dialog"
        aria-labelledby="loginFeeTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="loginFeeTitle">Login fee — {userName}</h3>
        <p className="muted">
          Role default applies unless you set a custom amount for this account ({role}).
          Current effective fee: LKR {effectiveFee.toLocaleString()}.
        </p>

        <form onSubmit={submit}>
          <label className="gov-check-row">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
            />
            <span>Use custom login fee for this user</span>
          </label>

          {useCustom && (
            <>
              <label htmlFor="login-fee-amount">Custom fee (LKR)</label>
              <input
                id="login-fee-amount"
                type="number"
                min={0}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </>
          )}

          <div className="gov-form-actions">
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
