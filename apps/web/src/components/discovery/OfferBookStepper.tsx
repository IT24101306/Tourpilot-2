type Step = "tour" | "register" | "confirmed";

type Props = {
  step: Step;
};

const STEPS: { id: Step; label: string }[] = [
  { id: "tour", label: "Tour selected" },
  { id: "register", label: "Register" },
  { id: "confirmed", label: "Booking confirmed" },
];

function stepIndex(step: Step) {
  return STEPS.findIndex((item) => item.id === step);
}

export function OfferBookStepper({ step }: Props) {
  const activeIndex = stepIndex(step);

  return (
    <ol className="offer-book-stepper" aria-label="Booking progress">
      {STEPS.map((item, index) => {
        const state =
          index < activeIndex ? "complete" : index === activeIndex ? "active" : "upcoming";
        return (
          <li
            key={item.id}
            className={`offer-book-stepper__item offer-book-stepper__item--${state}`}
            aria-current={state === "active" ? "step" : undefined}
          >
            <span className="offer-book-stepper__dot" aria-hidden="true">
              {state === "complete" ? "✓" : index + 1}
            </span>
            <span className="offer-book-stepper__label">{item.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
