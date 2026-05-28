const STEPS = [
  {
    title: "Browse agency tours",
    body: "Only published ready-made packages appear in your catalog — pick what fits your audience.",
  },
  {
    title: "Create a referral code",
    body: "Each tour gets a unique link like /tours/agency/tour?ref=YOURCODE with your commission rate.",
  },
  {
    title: "Share with your audience",
    body: "Clicks are tracked when someone opens your link — no extra setup required.",
  },
  {
    title: "Tourist inquires",
    body: "They submit an inquiry on the agency site with your code attached automatically.",
  },
  {
    title: "Earn commission",
    body: "When the agency sends an itinerary, you earn at your agreed percentage — pending until approved.",
  },
] as const;

export function GrowthJourney() {
  return (
    <ol className="partner-journey">
      {STEPS.map((step, i) => (
        <li key={step.title} className="partner-journey-step">
          <span className="partner-journey-num" aria-hidden="true">
            {i + 1}
          </span>
          <div>
            <strong>{step.title}</strong>
            <p>{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
