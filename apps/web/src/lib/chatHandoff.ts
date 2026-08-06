import type { ChatbotLeadHints, ChatbotMessage } from "@tourpilot/shared";

export const CHAT_HANDOFF_KEY = "tourpilot.chatHandoff";
export const CHAT_HANDOFF_PARAM = "chatHandoff";

export type ChatHandoffPayload = {
  agencySlug?: string;
  pax?: number;
  days?: number | null;
  interests?: string[];
  budgetBand?: string | null;
  message: string;
  createdAt: string;
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

export function buildPlanPrefillPath(lead: ChatbotLeadHints, notes?: string): string {
  const params = new URLSearchParams();
  if (lead.days && lead.days >= 1) params.set("days", String(Math.min(30, Math.round(lead.days))));
  if (lead.pax && lead.pax >= 1) params.set("pax", String(Math.min(50, Math.round(lead.pax))));
  if (lead.interests?.length) params.set("interests", lead.interests.slice(0, 12).join("|"));
  if (notes?.trim()) params.set("notes", notes.trim().slice(0, 500));
  const q = params.toString();
  return q ? `/plan?${q}` : "/plan";
}

export function agencyInquiryHandoffPath(agencySlug: string): string {
  return `/agencies/${agencySlug}?${CHAT_HANDOFF_PARAM}=1#request-custom-tour`;
}
