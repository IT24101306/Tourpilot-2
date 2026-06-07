import { FormEvent, useState } from "react";
import { useConfirmAction } from "../confirm/ConfirmActionContext";

type Props = {
  agencyName: string;
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: (reason: string, sendEmail: boolean) => void;
};

export function RejectAgencyModal({ agencyName, open, loading, onClose, onConfirm }: Props) {
  const { requestConfirm } = useConfirmAction();
  const [reason, setReason] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) return;
    requestConfirm({
      title: "Reject agency?",
      description: "The owner will see your reason on their dashboard.",
      variant: "danger",
      confirmLabel: "Reject agency",
      summary: [
        { label: "Agency", value: agencyName },
        { label: "Reason", value: reason.trim() },
        { label: "Email", value: sendEmail ? "Send rejection email" : "No email" },
      ],
      onConfirm: () => onConfirm(reason.trim(), sendEmail),
    });
  }

  return (
    <div className="gov-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="gov-modal"
        role="dialog"
        aria-labelledby="reject-agency-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="reject-agency-title">Reject {agencyName}</h3>
        <p className="muted">The owner will see this reason. Email sends to agency contact or owner email.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="reject-reason">Rejection reason</label>
          <textarea
            id="reject-reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain what is missing or needs to change…"
            required
            minLength={3}
          />
          <label className="gov-check-row">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
            Send rejection email
          </label>
          <div className="gov-form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary gov-btn-danger" disabled={loading}>
              {loading ? "Rejecting…" : "Reject agency"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
