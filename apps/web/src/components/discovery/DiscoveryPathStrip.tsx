const STEPS = [
  { n: "1", title: "Explore", hint: "Browse verified agencies and tours" },
  { n: "2", title: "Compare", hint: "Transparent pricing and itineraries" },
  { n: "3", title: "Plan together", hint: "Inquire and refine your trip in one place" },
] as const;

export function DiscoveryPathStrip() {
  return (
    <ol className="disc-path" aria-label="How TourPilot works">
      {STEPS.map((step) => (
        <li key={step.n} className="disc-path-step">
          <span className="disc-path-num" aria-hidden="true">
            {step.n}
          </span>
          <strong>{step.title}</strong>
          <p>{step.hint}</p>
        </li>
      ))}
    </ol>
  );
}
