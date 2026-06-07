import { FormEvent, useState } from "react";
import { useConfirmAction } from "../confirm/ConfirmActionContext";

type Props = {
  userName: string;
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: (amount: number, note: string) => void;
};

export function WalletAdjustModal({ userName, open, loading, onClose, onConfirm }: Props) {
  const { requestConfirm } = useConfirmAction();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value === 0 || note.trim().length < 3) return;
    requestConfirm({
      title: "Apply wallet adjustment?",
      description: "A ledger entry will be recorded for this user.",
      confirmLabel: "Apply adjustment",
      variant: value < 0 ? "danger" : "default",
      summary: [
        { label: "User", value: userName },
        {
          label: "Amount",
          value: `${value < 0 ? "−" : "+"}LKR ${Math.abs(value).toLocaleString()}`,
          tone: value < 0 ? "warning" : "default",
        },
        { label: "Note", value: note.trim() },
      ],
      onConfirm: () => onConfirm(value, note.trim()),
    });
  }

  return (
    <div className="gov-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="gov-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Adjust wallet — {userName}</h3>
        <p className="muted">Use negative amounts to debit. A ledger entry is recorded.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="adj-amount">Amount (LKR)</label>
          <input
            id="adj-amount"
            type="number"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 500 or -100"
            required
          />
          <label htmlFor="adj-note">Note (required)</label>
          <input
            id="adj-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason for adjustment"
            required
            minLength={3}
          />
          <div className="gov-form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Saving…" : "Apply adjustment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
