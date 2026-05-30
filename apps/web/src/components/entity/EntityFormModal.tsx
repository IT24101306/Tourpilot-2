import { FormEvent } from "react";
import { type EntityFormState, type EntityTypeKey } from "./entityTypes";
import { EntityFormFields } from "./EntityFormFields";

type Props = {
  open: boolean;
  form: EntityFormState;
  status: string;
  saving: boolean;
  onClose: () => void;
  onChange: (next: EntityFormState) => void;
  onSubmit: (e: FormEvent) => void;
};

const titleByType: Record<EntityTypeKey, string> = {
  HOTEL: "Add hotel",
  ACTIVITY: "Add activity",
  VIEWPOINT: "Add viewpoint",
  RESTAURANT: "Add restaurant",
};

export function EntityFormModal({ open, form, status, saving, onClose, onChange, onSubmit }: Props) {
  if (!open) return null;

  return (
    <div className="entity-modal open" role="presentation" onClick={onClose}>
      <div
        className="entity-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entity-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-head">
          <h3 id="entity-dialog-title">{titleByType[form.type]}</h3>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="dialog-sub muted">Fields change based on entity type. Only the name is required.</p>

        <form onSubmit={onSubmit}>
          <div className="entity-form-grid">
            <EntityFormFields form={form} onChange={onChange} typePicker="select" />
          </div>

          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
          {status && <p className="entity-status">{status}</p>}
        </form>
      </div>
    </div>
  );
}
