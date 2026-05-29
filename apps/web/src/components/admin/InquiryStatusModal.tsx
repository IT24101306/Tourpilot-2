import { FormEvent, useState } from "react";
import { INQUIRY_STATUSES } from "../../pages/admin/types";

type Props = {
  inquiryId: string;
  currentStatus: string;
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: (status: string, note: string) => void;
};

export function InquiryStatusModal({
  inquiryId,
  currentStatus,
  open,
  loading,
  onClose,
  onConfirm,
}: Props) {
  const [status, setStatus] = useState(currentStatus);
  const [note, setNote] = useState("");

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onConfirm(status, note.trim());
  }

  return (
    <div className="gov-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="gov-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Override inquiry status</h3>
        <p className="muted">Inquiry {inquiryId.slice(0, 8)}… — logged as platform admin action.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="inquiry-status">Status</label>
          <select
            id="inquiry-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {INQUIRY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <label htmlFor="inquiry-note">Note (optional)</label>
          <textarea
            id="inquiry-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this override…"
          />
          <div className="gov-form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Updating…" : "Update status"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
