export type AccountProfileStep = {
  id: string;
  label: string;
  hint: string;
};

type Props = {
  steps: AccountProfileStep[];
  active: string;
  onChange: (id: string) => void;
  "aria-label"?: string;
};

export function AccountProfileStepNav({
  steps,
  active,
  onChange,
  "aria-label": ariaLabel = "Profile sections",
}: Props) {
  return (
    <nav className="account-profile-step-nav" aria-label={ariaLabel}>
      {steps.map((step) => (
        <button
          key={step.id}
          type="button"
          className={`account-profile-step-tab${active === step.id ? " active" : ""}`}
          onClick={() => onChange(step.id)}
          aria-current={active === step.id ? "step" : undefined}
        >
          <span className="account-profile-step-tab__label">{step.label}</span>
          <span className="account-profile-step-tab__hint">{step.hint}</span>
        </button>
      ))}
    </nav>
  );
}
