const STEPS = [
  { key: "NEW", label: "Requested" },
  { key: "PLANNING", label: "Planning" },
  { key: "PROPOSAL", label: "Proposal" },
  { key: "DECISION", label: "Decision" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "ACTIVE", label: "Active" },
  { key: "DONE", label: "Completed" },
] as const;

function stepIndex(status: string): number {
  if (status === "NEW" || status === "AGENCY_REVIEWING" || status === "ITINERARY_DRAFT") return 1;
  if (status === "SENT_TO_TOURIST" || status === "TOURIST_VIEWED" || status === "REVISION_REQUESTED")
    return 3;
  if (status === "ACCEPTED") return 4;
  if (status === "IN_PROGRESS") return 5;
  if (status === "COMPLETED") return 6;
  if (status === "DECLINED" || status === "EXPIRED") return 2;
  return 0;
}

type Props = { status: string };

export function NegotiationStepper({ status }: Props) {
  const active = stepIndex(status);
  const terminal = status === "DECLINED" || status === "EXPIRED";

  return (
    <div className="neg-stepper-wrap">
      <ol className="neg-stepper" aria-label="Trip planning progress">
      {STEPS.map((step, i) => {
        const done = i < active || (i === 6 && status === "COMPLETED");
        const current = i === active;
        return (
          <li
            key={step.key}
            className={`neg-step${done ? " done" : ""}${current ? " current" : ""}${terminal && i > 1 ? " muted-step" : ""}`}
          >
            <span className="neg-step-dot" aria-hidden="true" />
            <span className="neg-step-label">{step.label}</span>
          </li>
        );
      })}
      </ol>
    </div>
  );
}
