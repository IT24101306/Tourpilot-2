import type { ReactNode } from "react";

export type DisplayStep = "hero" | "packages" | "showcase" | "gallery" | "settings";

export const DISPLAY_STEPS: { id: DisplayStep; label: string; hint: string }[] = [
  { id: "hero", label: "Hero", hint: "Banner, logo & headline" },
  { id: "packages", label: "Packages", hint: "Tour cards on your page" },
  { id: "showcase", label: "Showcase", hint: "Rating, quotes & reviews" },
  { id: "gallery", label: "Gallery & offers", hint: "Photos & promo cards" },
  { id: "settings", label: "Settings", hint: "Inquiry & commissions" },
];

type StepNavProps = {
  active: DisplayStep;
  onChange: (step: DisplayStep) => void;
};

export function DisplayStepNav({ active, onChange }: StepNavProps) {
  return (
    <nav className="display-step-nav" aria-label="Display editor sections">
      {DISPLAY_STEPS.map((step) => (
        <button
          key={step.id}
          type="button"
          className={`display-step-tab${active === step.id ? " active" : ""}`}
          onClick={() => onChange(step.id)}
          aria-current={active === step.id ? "step" : undefined}
        >
          <span className="display-step-tab-label">{step.label}</span>
          <span className="display-step-tab-hint">{step.hint}</span>
        </button>
      ))}
    </nav>
  );
}

type VisibilityProps = {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function DisplayVisibilityToggle({ label, hint, checked, onChange }: VisibilityProps) {
  return (
    <label className="display-visibility">
      <span className="display-visibility-copy">
        <strong>{label}</strong>
        {hint && <span className="muted">{hint}</span>}
      </span>
      <span className="display-visibility-switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span aria-hidden="true" />
      </span>
    </label>
  );
}

type CompactRowProps = {
  thumb?: ReactNode;
  title: string;
  meta?: ReactNode;
  onEdit: () => void;
};

export function DisplayCompactRow({ thumb, title, meta, onEdit }: CompactRowProps) {
  return (
    <div className="display-compact-row">
      {thumb ?? <div className="display-compact-row-thumb display-compact-row-thumb--empty" />}
      <div className="display-compact-row-body">
        <strong>{title}</strong>
        {meta && <div className="display-compact-row-meta">{meta}</div>}
      </div>
      <button type="button" className="btn btn-lite display-compact-row-edit" onClick={onEdit}>
        Edit
      </button>
    </div>
  );
}

export function DisplayStepPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="display-step-panel">
      <header className="display-step-panel-head">
        <h3>{title}</h3>
        {description && <p className="muted">{description}</p>}
      </header>
      <div className="display-step-panel-body">{children}</div>
    </section>
  );
}

export function DisplaySectionActions({ children }: { children: ReactNode }) {
  return <div className="display-section-actions">{children}</div>;
}

export function DisplayFieldHint({ children }: { children: ReactNode }) {
  return <p className="display-field-hint">{children}</p>;
}
