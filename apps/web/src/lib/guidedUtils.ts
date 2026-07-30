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
  { key: "CONFIRMED", label: "Confirmed", touristLabel: "Trip confirmed" },
  { key: "ACTIVE", label: "Active", touristLabel: "Trip in progress" },
  { key: "DONE", label: "Completed", touristLabel: "Trip completed" },
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
  if (status === "IN_PROGRESS") return 5;
  if (status === "COMPLETED") return 6;
  if (status === "DECLINED" || status === "EXPIRED") return 2;
  return 0;
}

type GuidedCopyOptions = {
  partnerName?: string | null;
};

function partnerLabel(partnerName?: string | null, fallback = "your travel partner") {
  const name = partnerName?.trim();
  return name || fallback;
}

export function guidedStatusCopy(
  status: string,
  options: GuidedCopyOptions = {}
): { title: string; hint: string; cta?: string } {
  const partner = partnerLabel(options.partnerName);

  switch (status) {
    case "NEW":
      return {
        title: "We received your request",
        hint: `${partner} is reviewing the details. Visit the chat room anytime to add notes.`,
      };
    case "AGENCY_REVIEWING":
    case "ITINERARY_DRAFT":
      return {
        title: `${partner} is building options`,
        hint: "They are shaping itineraries and pricing. Check back soon for proposals.",
      };
    case "SENT_TO_TOURIST":
    case "TOURIST_VIEWED":
      return {
        title: "Proposals are ready for you",
        hint: "Compare options, ask questions in the chat room, then accept or request changes.",
        cta: "Review proposals",
      };
    case "REVISION_REQUESTED":
      return {
        title: "Changes requested",
        hint: `${partner} is updating the proposal based on your feedback.`,
      };
    case "ACCEPTED":
      return {
        title: "You are all set",
        hint: `Your trip is confirmed. ${partner} will share final details before departure.`,
      };
    case "IN_PROGRESS":
      return {
        title: "Your trip is underway",
        hint: `Enjoy your trip! Use the chat room if you need anything from ${partner}.`,
      };
    case "COMPLETED":
      return {
        title: "Trip completed",
        hint: "We hope you had a wonderful experience. Leave a review to help other travelers.",
        cta: "Leave a review",
      };
    case "DECLINED":
      return {
        title: "Proposal declined",
        hint: `You can message ${partner} in the chat room if you want to explore other options.`,
      };
    case "EXPIRED":
      return {
        title: "This request expired",
        hint: "Start a new inquiry when you are ready to plan again.",
      };
    default:
      return {
        title: "Your trip is in progress",
        hint: "Visit the chat room to see messages and proposals.",
      };
  }
}

export function guidedListCta(status: string): string {
  if (status === "SENT_TO_TOURIST" || status === "TOURIST_VIEWED") return "Review proposals";
  if (status === "ACCEPTED") return "View trip details";
  if (status === "IN_PROGRESS") return "Open trip room";
  if (status === "COMPLETED") return "View trip & review";
  if (status === "REVISION_REQUESTED") return "View updates";
  return "Visit the chat room";
}
