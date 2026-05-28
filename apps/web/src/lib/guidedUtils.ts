export type GuidedStep = {
  key: string;
  label: string;
  touristLabel: string;
};

export const GUIDED_STEPS: GuidedStep[] = [
  { key: "REQUEST", label: "Requested", touristLabel: "Request sent" },
  { key: "PLAN", label: "Planning", touristLabel: "Crafting your plan" },
  { key: "REVIEW", label: "Proposal", touristLabel: "Review options" },
  { key: "DECIDE", label: "Decision", touristLabel: "Your decision" },
  { key: "DONE", label: "Confirmed", touristLabel: "Trip confirmed" },
];

export function guidedStepIndex(status: string): number {
  if (status === "NEW" || status === "AGENCY_REVIEWING" || status === "ITINERARY_DRAFT") return 1;
  if (
    status === "SENT_TO_TOURIST" ||
    status === "TOURIST_VIEWED" ||
    status === "REVISION_REQUESTED"
  )
    return 3;
  if (status === "ACCEPTED") return 4;
  if (status === "DECLINED" || status === "EXPIRED") return 2;
  return 0;
}

export function guidedStatusCopy(status: string): { title: string; hint: string; cta?: string } {
  switch (status) {
    case "NEW":
      return {
        title: "We received your request",
        hint: "Your agency is reviewing the details. You can add notes in the trip room anytime.",
      };
    case "AGENCY_REVIEWING":
    case "ITINERARY_DRAFT":
      return {
        title: "Your agency is building options",
        hint: "They are shaping itineraries and pricing. Check back soon for proposals.",
      };
    case "SENT_TO_TOURIST":
    case "TOURIST_VIEWED":
      return {
        title: "Proposals are ready for you",
        hint: "Compare options, ask questions in chat, then accept or request changes.",
        cta: "Review proposals",
      };
    case "REVISION_REQUESTED":
      return {
        title: "Changes requested",
        hint: "Your agency is updating the proposal based on your feedback.",
      };
    case "ACCEPTED":
      return {
        title: "You are all set",
        hint: "Your trip is confirmed. Your agency will share final details before departure.",
      };
    case "DECLINED":
      return {
        title: "Proposal declined",
        hint: "You can message your agency in the trip room if you want to explore other options.",
      };
    case "EXPIRED":
      return {
        title: "This request expired",
        hint: "Start a new inquiry with an agency when you are ready to plan again.",
      };
    default:
      return {
        title: "Your trip is in progress",
        hint: "Open the trip room to see messages and proposals.",
      };
  }
}

export function guidedListCta(status: string): string {
  if (status === "SENT_TO_TOURIST" || status === "TOURIST_VIEWED") return "Review proposals";
  if (status === "ACCEPTED") return "View trip details";
  if (status === "REVISION_REQUESTED") return "View updates";
  return "Open trip room";
}
