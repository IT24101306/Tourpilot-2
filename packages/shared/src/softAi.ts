/** Soft AI / assist copy — rule-based now; same shapes for future LLM. */

export type SoftAiMoment = {
  id: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaAction?: string;
};

export type ChatAssistSuggestion = {
  id: string;
  label: string;
  draft: string;
};

export type PipelineNextAction = {
  status: string;
  title: string;
  hint: string;
  ctaLabel?: string;
  forRole: "AGENCY" | "TOURIST" | "BOTH";
};

const PIPELINE: PipelineNextAction[] = [
  {
    status: "NEW",
    title: "Review this inquiry",
    hint: "Open the trip room, confirm dates/pax, then draft a proposal.",
    ctaLabel: "Start proposal",
    forRole: "AGENCY",
  },
  {
    status: "AGENCY_REVIEWING",
    title: "Build options",
    hint: "Add ready-made tours or a custom itinerary, then send.",
    ctaLabel: "Continue proposal",
    forRole: "AGENCY",
  },
  {
    status: "ITINERARY_DRAFT",
    title: "Finish & send",
    hint: "Your draft is waiting — send it so the traveler can review.",
    ctaLabel: "Send proposal",
    forRole: "AGENCY",
  },
  {
    status: "SENT_TO_TOURIST",
    title: "Waiting on traveler",
    hint: "They haven't decided yet. A friendly follow-up in chat helps.",
    ctaLabel: "Nudge in chat",
    forRole: "AGENCY",
  },
  {
    status: "TOURIST_VIEWED",
    title: "They opened your proposal",
    hint: "Answer questions quickly — interest is warm.",
    ctaLabel: "Reply now",
    forRole: "AGENCY",
  },
  {
    status: "REVISION_REQUESTED",
    title: "Update the proposal",
    hint: "Apply their change request and resend.",
    ctaLabel: "Revise proposal",
    forRole: "AGENCY",
  },
  {
    status: "ACCEPTED",
    title: "Confirm logistics",
    hint: "Send invoice if needed, assign a driver, share final meeting details.",
    ctaLabel: "Next steps",
    forRole: "AGENCY",
  },
  {
    status: "IN_PROGRESS",
    title: "Trip is live",
    hint: "Stay reachable in chat; check tomorrow's plan with the traveler.",
    forRole: "BOTH",
  },
  {
    status: "SENT_TO_TOURIST",
    title: "Review your options",
    hint: "Compare proposals, ask questions, then accept or request changes.",
    ctaLabel: "Review proposals",
    forRole: "TOURIST",
  },
  {
    status: "TOURIST_VIEWED",
    title: "Ready to decide?",
    hint: "Accept when you're happy, or request changes in one click.",
    ctaLabel: "Decide",
    forRole: "TOURIST",
  },
  {
    status: "ACCEPTED",
    title: "You're booked",
    hint: "Watch for invoice and day-of details from your partner.",
    forRole: "TOURIST",
  },
];

export function pipelineNextActions(
  status: string,
  role: "AGENCY" | "TOURIST"
): PipelineNextAction | null {
  const match = PIPELINE.find(
    (p) => p.status === status && (p.forRole === role || p.forRole === "BOTH")
  );
  return match ?? null;
}

export function softAiMomentsForContext(ctx: {
  role: "AGENCY" | "TOURIST" | "INFLUENCER";
  status?: string;
  hasProposal?: boolean;
  entityCount?: number;
}): SoftAiMoment[] {
  const moments: SoftAiMoment[] = [];

  if (ctx.role === "AGENCY") {
    if ((ctx.entityCount ?? 0) > 0 && (ctx.entityCount ?? 0) < 8) {
      moments.push({
        id: "add-entities",
        title: "Grow your catalog",
        body: "Agencies with 8+ places win the “Rich catalog” trust badge and plan faster.",
        ctaLabel: "Add entities",
        ctaAction: "entities",
      });
    }
    if (ctx.status === "NEW" || ctx.status === "AGENCY_REVIEWING") {
      moments.push({
        id: "draft-fast",
        title: "Reply within 24 hours",
        body: "Fast proposals unlock the Responsive host badge and convert more travelers.",
        ctaLabel: "Suggest reply",
        ctaAction: "chat-assist",
      });
    }
    if (ctx.status === "SENT_TO_TOURIST" || ctx.status === "TOURIST_VIEWED") {
      moments.push({
        id: "gentle-nudge",
        title: "Soft follow-up idea",
        body: "Ask if they have questions about Day 1 or pricing — short messages get replies.",
        ctaLabel: "Insert nudge",
        ctaAction: "insert-nudge",
      });
    }
  }

  if (ctx.role === "TOURIST" && (ctx.status === "SENT_TO_TOURIST" || ctx.status === "TOURIST_VIEWED")) {
    moments.push({
      id: "compare",
      title: "Compare calmly",
      body: "Check what's included each day, then ask one clear question in chat before deciding.",
    });
  }

  if (ctx.role === "INFLUENCER") {
    moments.push({
      id: "kit",
      title: "Share your kit",
      body: "Copy your referral link + a ready caption — consistency beats one viral post.",
      ctaLabel: "Open kit",
      ctaAction: "influencer-kit",
    });
  }

  return moments;
}

export function chatAssistSuggestions(input: {
  partnerName?: string | null;
  tourTitle?: string | null;
  status?: string;
  pax?: number;
  budgetBand?: string | null;
}): ChatAssistSuggestion[] {
  const who = input.partnerName?.trim() || "there";
  const tour = input.tourTitle?.trim();
  const pax = input.pax && input.pax > 0 ? input.pax : null;
  const budget = input.budgetBand?.trim();

  const suggestions: ChatAssistSuggestion[] = [
    {
      id: "ack",
      label: "Acknowledge inquiry",
      draft: `Hi ${who}! Thanks for reaching out${tour ? ` about ${tour}` : ""}. We're putting options together${pax ? ` for ${pax} travelers` : ""} and will share a proposal shortly.`,
    },
    {
      id: "clarify",
      label: "Clarify dates & pace",
      draft: `Quick check so we tailor this well — are your dates flexible, and do you prefer a relaxed pace or packing more into each day?`,
    },
    {
      id: "nudge",
      label: "Gentle follow-up",
      draft: `Just checking in — any questions on the proposal? Happy to adjust a day, hotel, or budget${budget ? ` (you mentioned ${budget})` : ""} if needed.`,
    },
    {
      id: "logistics",
      label: "Share logistics",
      draft: `Great news you're confirmed! We'll send meeting point, driver details, and Day 1 timing next. Anything you need before then?`,
    },
  ];

  if (input.status === "REVISION_REQUESTED") {
    suggestions.unshift({
      id: "revision",
      label: "Confirm revision",
      draft: `We've noted your change request and are updating the proposal. We'll ping you here as soon as the new option is ready.`,
    });
  }

  return suggestions;
}

export function draftProposalIntro(input: {
  touristName?: string | null;
  tourTitle?: string | null;
  pax?: number;
  interests?: string[];
}): string {
  const name = input.touristName?.trim() || "there";
  const tour = input.tourTitle?.trim();
  const interests =
    input.interests && input.interests.length
      ? ` We leaned into ${input.interests.slice(0, 3).join(", ")}.`
      : "";
  return `Hi ${name} — thank you for your inquiry${tour ? ` on ${tour}` : ""}. Here are tailored options${input.pax ? ` for ${input.pax} guests` : ""}.${interests} Let us know what you'd like to adjust.`;
}
