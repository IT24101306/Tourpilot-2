import { FormEvent } from "react";

type Props = {
  open: boolean;
  name: string;
  status: string;
  saving: boolean;
  onClose: () => void;
  onChange: (name: string) => void;
  onSubmit: (e: FormEvent) => void;
};

export function GroupFormModal({ open, name, status, saving, onClose, onChange, onSubmit }: Props) {
  if (!open) return null;

  return (
    <div className="entity-modal open" role="presentation" onClick={onClose}>
      <div
        className="entity-dialog group-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="groupDialogTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-head">
          <h3 id="groupDialogTitle">Create Group</h3>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="dialog-sub muted">Type a name for this group before saving selected entries.</p>

        <form onSubmit={onSubmit}>
          <div className="field full">
            <label htmlFor="groupName">Group Name</label>
            <input
              id="groupName"
              type="text"
              value={name}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Example: Ella Premium Picks"
              maxLength={60}
              required
              autoFocus
            />
          </div>
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
              {saving ? "Creating…" : "Create Group"}
            </button>
          </div>
          {status && <p className="entity-status">{status}</p>}
        </form>
      </div>
    </div>
  );
}
