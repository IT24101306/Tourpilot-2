import { FormEvent } from "react";
import {
  ENTITY_TYPE_OPTIONS,
  FIELDS_BY_TYPE,
  type EntityFormState,
  type EntityTypeKey,
  type FieldDef,
} from "./entityTypes";

type Props = {
  open: boolean;
  form: EntityFormState;
  status: string;
  saving: boolean;
  onClose: () => void;
  onChange: (next: EntityFormState) => void;
  onSubmit: (e: FormEvent) => void;
};

export function EntityFormModal({ open, form, status, saving, onClose, onChange, onSubmit }: Props) {
  if (!open) return null;

  const fields = FIELDS_BY_TYPE[form.type];
  const titleByType: Record<EntityTypeKey, string> = {
    HOTEL: "Add hotel",
    ACTIVITY: "Add activity",
    VIEWPOINT: "Add viewpoint",
    RESTAURANT: "Add restaurant",
  };

  function setField(key: keyof EntityFormState, value: string) {
    onChange({ ...form, [key]: value });
  }

  function onTypeChange(type: EntityTypeKey) {
    onChange({ ...form, type });
  }

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
        <p className="dialog-sub muted">Only the name is required. Other fields are optional.</p>

        <form onSubmit={onSubmit}>
          <div className="entity-form-grid">
            <div className="field">
              <label htmlFor="entity-name">Name *</label>
              <input
                id="entity-name"
                type="text"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Entity name"
                required
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="entity-type">Type</label>
              <select
                id="entity-type"
                value={form.type}
                onChange={(e) => onTypeChange(e.target.value as EntityTypeKey)}
              >
                {ENTITY_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {fields.map((field) => (
              <FieldInput
                key={`${form.type}-${field.key}`}
                field={field}
                value={form[field.key]}
                onChange={(v) => setField(field.key, v)}
              />
            ))}
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

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `entity-${field.key}`;
  const className = field.fullWidth ? "field full" : "field";

  if (field.input === "textarea") {
    return (
      <div className={className}>
        <label htmlFor={id}>{field.label}</label>
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <label htmlFor={id}>{field.label}</label>
      <input
        id={id}
        type={field.input || "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        min={field.input === "number" ? 0 : undefined}
        step={field.input === "number" ? "any" : undefined}
      />
    </div>
  );
}
