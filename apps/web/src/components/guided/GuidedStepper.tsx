import { GUIDED_STEPS, guidedStepIndex } from "../../lib/guidedUtils";

type Props = { status: string };

export function GuidedStepper({ status }: Props) {
  const active = guidedStepIndex(status);
  const terminal = status === "DECLINED" || status === "EXPIRED";

  return (
    <div className="guided-stepper-wrap">
      <ol className="guided-stepper" aria-label="Your trip progress">
      {GUIDED_STEPS.map((step, i) => {
        const done = i < active || (i === 4 && status === "ACCEPTED");
        const current = i === active;
        return (
          <li
            key={step.key}
            className={`guided-step${done ? " done" : ""}${current ? " current" : ""}${terminal && i > 1 ? " muted-step" : ""}`}
          >
            <span className="guided-step-dot" aria-hidden="true" />
            <span className="guided-step-label">{step.touristLabel}</span>
          </li>
        );
      })}
      </ol>
    </div>
  );
}
