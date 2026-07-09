import { FormEvent } from "react";
import type { EntityMediaItem } from "@tourpilot/shared";
import { type EntityFormState, type EntityTypeKey } from "./entityTypes";
import { EntityFormFields } from "./EntityFormFields";
import { EntityMediaFields } from "./EntityMediaFields";

type Props = {
  open: boolean;
  form: EntityFormState;
  mainImageUrl: string;
  gallery: EntityMediaItem[];
  token?: string | null;
  status: string;
  saving: boolean;
  /** Override the heading. Defaults to "Add <type>". */
  title?: string;
  /** Override the helper text under the heading. */
  subtitle?: string;
  /** Override the submit button label. Defaults to "Save". */
  submitLabel?: string;
  fieldErrors?: Record<string, string>;
  onClose: () => void;
  onChange: (next: EntityFormState) => void;
  onMainImageChange: (url: string) => void;
  onGalleryChange: (items: EntityMediaItem[]) => void;
  onSubmit: (e: FormEvent) => void;
};

const titleByType: Record<EntityTypeKey, string> = {
  HOTEL: "Add hotel",
  ACTIVITY: "Add activity",
  VIEWPOINT: "Add viewpoint",
  RESTAURANT: "Add restaurant",
};

export function EntityFormModal({
  open,
  form,
  mainImageUrl,
  gallery,
  token,
  status,
  saving,
  title,
  subtitle,
  submitLabel,
  fieldErrors,
  onClose,
  onChange,
  onMainImageChange,
  onGalleryChange,
  onSubmit,
}: Props) {
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
          <h3 id="entity-dialog-title">{title ?? titleByType[form.type]}</h3>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="dialog-sub muted">
          {subtitle ?? "Fields change based on entity type. Only the name is required."}
        </p>

        <form onSubmit={onSubmit}>
          <div className="entity-form-grid">
            <EntityFormFields form={form} onChange={onChange} typePicker="select" fieldErrors={fieldErrors} />
          </div>

          <EntityMediaFields
            mainImageUrl={mainImageUrl}
            onMainImageChange={onMainImageChange}
            gallery={gallery}
            onGalleryChange={onGalleryChange}
            token={token}
          />

          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : submitLabel ?? "Save"}
            </button>
          </div>
          {status && <p className="entity-status">{status}</p>}
        </form>
      </div>
    </div>
  );
}
