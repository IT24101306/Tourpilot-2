import {
  ENTITY_TYPE_OPTIONS,
  FIELDS_BY_TYPE,
  type EntityFormState,
  type EntityTypeKey,
  type FieldDef,
} from "./entityTypes";

type Props = {
  form: EntityFormState;
  onChange: (next: EntityFormState) => void;
  typePicker?: "select" | "chips";
  showName?: boolean;
  nameRequired?: boolean;
};

const TYPE_ICONS: Record<EntityTypeKey, string> = {
  HOTEL: "🏨",
  VIEWPOINT: "🏔️",
  ACTIVITY: "🎯",
  RESTAURANT: "🍽️",
};

export function EntityFormFields({
  form,
  onChange,
  typePicker = "select",
  showName = true,
  nameRequired = true,
}: Props) {
  const fields = FIELDS_BY_TYPE[form.type];

  function setField(key: keyof EntityFormState, value: string) {
    onChange({ ...form, [key]: value });
  }

  function onTypeChange(type: EntityTypeKey) {
    onChange({ ...form, type });
  }

  return (
    <>
      {showName && (
        <div className={typePicker === "chips" ? "field full" : "field"}>
          <label htmlFor="entity-name">Name{ nameRequired ? " *" : ""}</label>
          <input
            id="entity-name"
            type="text"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="Entity name"
            required={nameRequired}
          />
        </div>
      )}

      <div className={typePicker === "chips" ? "field full" : "field"}>
        {typePicker === "chips" ? (
          <>
            <span className="field-label">Type</span>
            <div className="entities-type-picker">
              {ENTITY_TYPE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`entities-type-chip ${form.type === t.value ? "selected" : ""}`}
                  onClick={() => onTypeChange(t.value)}
                >
                  <span className="entities-type-chip-icon" aria-hidden="true">
                    {TYPE_ICONS[t.value]}
                  </span>
                  {t.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {fields.map((field) => (
        <FieldInput
          key={`${form.type}-${field.key}`}
          field={field}
          value={form[field.key]}
          onChange={(v) => setField(field.key, v)}
        />
      ))}
    </>
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

  if (field.input === "checkbox") {
    return (
      <div className={`${className} entity-field-checkbox`}>
        <label htmlFor={id} className="entity-checkbox-label">
          <input
            id={id}
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "false")}
          />
          <span>{field.label}</span>
        </label>
      </div>
    );
  }

  if (field.input === "textarea") {
    return (
      <div className={className}>
        <label htmlFor={id}>{field.label}</label>
        <textarea
          id={id}
          rows={3}
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
        min={field.min ?? (field.input === "number" ? 0 : undefined)}
        max={field.max}
        step={field.input === "number" ? (field.key === "starRating" ? 1 : "any") : undefined}
      />
    </div>
  );
}
