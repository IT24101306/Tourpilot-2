import type {
  ChatbotLeadHints,
  ChatbotLink,
  ChatbotMessage,
  TripPlannerResult,
} from "@tourpilot/shared";

export const CHAT_HANDOFF_KEY = "tourpilot.chatHandoff";
export const CHAT_HANDOFF_PARAM = "chatHandoff";
export const CHAT_SESSION_KEY = "tourpilot.chatSession";

export type ChatHandoffPayload = {
  agencySlug?: string;
  tourId?: string;
  pax?: number;
  days?: number | null;
  interests?: string[];
  budgetBand?: string | null;
  message: string;
  createdAt: string;
};

export type ChatSessionState = {
  messages: Array<ChatbotMessage & { links?: ChatbotLink[] }>;
  lead: ChatbotLeadHints;
  open?: boolean;
};

export function buildChatSummaryMessage(
  messages: ChatbotMessage[],
  lead: ChatbotLeadHints
): string {
  const lines: string[] = ["Request via TourPilot AI assistant."];

  if (lead.days) lines.push(`Trip length: about ${lead.days} days`);
  if (lead.pax) lines.push(`Travellers: ${lead.pax}`);
  if (lead.interests?.length) lines.push(`Interests: ${lead.interests.join(", ")}`);
  if (lead.budgetBand) lines.push(`Budget: ${lead.budgetBand}`);

  const recent = messages
    .filter((m) => m.role === "user")
    .slice(-6)
    .map((m) => `• ${m.content.trim()}`)
    .filter(Boolean);

  if (recent.length) {
    lines.push("", "What I told the assistant:", ...recent);
  }

  return lines.join("\n").slice(0, 3500);
}

export function formatTripPlanHandoffMessage(result: TripPlannerResult): string {
  const plan = result.draftTripPlan;
  const lines: string[] = [
    "Request via TourPilot AI Trip Planner.",
    result.summary?.trim() || "",
  ].filter(Boolean);

  if (plan?.title) lines.push("", `Plan: ${plan.title}`);
  if (plan?.estimatedTotalLkr != null) {
    lines.push(`Estimated total: LKR ${Math.round(plan.estimatedTotalLkr).toLocaleString()}`);
  }

  const days = plan?.days?.length
    ? plan.days
    : result.itinerary.map((d) => ({
        dayNumber: d.dayNumber,
        title: d.title,
        notes: d.highlights?.join("; "),
      }));

  if (days.length) {
    lines.push("", "Itinerary outline:");
    for (const d of days.slice(0, 21)) {
      const note = "notes" in d && d.notes ? ` — ${d.notes}` : "";
      lines.push(`Day ${d.dayNumber}: ${d.title}${note}`);
    }
  }

  if (result.destinations?.length) {
    lines.push(
      "",
      `Destinations: ${result.destinations.map((d) => d.name).join(", ")}`
    );
  }

  return lines.join("\n").slice(0, 3500);
}

export function saveChatHandoff(payload: ChatHandoffPayload): void {
  try {
    sessionStorage.setItem(CHAT_HANDOFF_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readChatHandoff(): ChatHandoffPayload | null {
  try {
    const raw = sessionStorage.getItem(CHAT_HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChatHandoffPayload;
    if (!parsed || typeof parsed.message !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearChatHandoff(): void {
  try {
    sessionStorage.removeItem(CHAT_HANDOFF_KEY);
  } catch {
    /* ignore */
  }
}

export function saveChatSession(state: ChatSessionState): void {
  try {
    sessionStorage.setItem(
      CHAT_SESSION_KEY,
      JSON.stringify({
        messages: state.messages.slice(-24),
        lead: state.lead,
        open: state.open,
      })
    );
  } catch {
    /* ignore */
  }
}

export function readChatSession(): ChatSessionState | null {
  try {
    const raw = sessionStorage.getItem(CHAT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChatSessionState;
    if (!parsed || !Array.isArray(parsed.messages)) return null;
    return {
      messages: parsed.messages.slice(-24),
      lead: parsed.lead && typeof parsed.lead === "object" ? parsed.lead : {},
      open: Boolean(parsed.open),
    };
  } catch {
    return null;
  }
}

export function clearChatSession(): void {
  try {
    sessionStorage.removeItem(CHAT_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function buildPlanPrefillPath(lead: ChatbotLeadHints, notes?: string): string {
  const params = new URLSearchParams();
  if (lead.days && lead.days >= 1) params.set("days", String(Math.min(30, Math.round(lead.days))));
  if (lead.pax && lead.pax >= 1) params.set("pax", String(Math.min(50, Math.round(lead.pax))));
  if (lead.interests?.length) params.set("interests", lead.interests.slice(0, 12).join("|"));
  if (notes?.trim()) params.set("notes", notes.trim().slice(0, 500));
  const q = params.toString();
  return q ? `/plan?${q}` : "/plan";
}

export function agencyInquiryHandoffPath(
  agencySlug: string,
  opts?: { tourId?: string }
): string {
  const params = new URLSearchParams();
  params.set(CHAT_HANDOFF_PARAM, "1");
  if (opts?.tourId) params.set("inquireTour", opts.tourId);
  return `/agencies/${agencySlug}?${params.toString()}#request-custom-tour`;
}

export function tourInquirePath(agencySlug: string, tourId: string): string {
  return agencyInquiryHandoffPath(agencySlug, { tourId });
}


/** Parse agency / tour targets from chatbot link hrefs. */
export function parseCatalogHref(href: string): {
  agencySlug: string;
  tourSlug?: string;
} | null {
  const agency = href.match(/^\/agencies\/([a-z0-9-]+)\/?(\?.*)?$/i);
  if (agency?.[1]) return { agencySlug: agency[1] };
  const tour = href.match(/^\/tours\/([a-z0-9-]+)\/([a-z0-9-]+)\/?(\?.*)?$/i);
  if (tour?.[1] && tour[2]) return { agencySlug: tour[1], tourSlug: tour[2] };
  return null;
}
