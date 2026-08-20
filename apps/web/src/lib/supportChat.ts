/** Browser keys for live human support chat (persists until Clear). */

export const SUPPORT_GUEST_KEY = "tourpilot.supportGuestKey";
export const SUPPORT_SESSION_KEY = "tourpilot.supportSessionId";

export type SupportChatMessage = {
  id: string;
  sender: "USER" | "ADMIN" | "SYSTEM";
  body: string;
  authorName: string | null;
  createdAt: string;
};

export type SupportChatSession = {
  id: string;
  status: "OPEN" | "CLOSED";
  pagePath: string | null;
  contactName: string | null;
  contactEmail: string | null;
  chatbotSummary: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignedAdmin: { id: string; name: string } | null;
  user: { id: string; name: string; phone: string; email: string | null } | null;
  messages?: SupportChatMessage[];
  preview?: string | null;
};

function randomGuestKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export function getOrCreateSupportGuestKey(): string {
  try {
    const existing = localStorage.getItem(SUPPORT_GUEST_KEY);
    if (existing && existing.length >= 8) return existing;
    const next = randomGuestKey();
    localStorage.setItem(SUPPORT_GUEST_KEY, next);
    return next;
  } catch {
    return randomGuestKey();
  }
}

export function readSupportSessionId(): string | null {
  try {
    return localStorage.getItem(SUPPORT_SESSION_KEY);
  } catch {
    return null;
  }
}

export function saveSupportSessionId(id: string): void {
  try {
    localStorage.setItem(SUPPORT_SESSION_KEY, id);
  } catch {
    /* ignore */
  }
}

export function clearSupportSessionId(): void {
  try {
    localStorage.removeItem(SUPPORT_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
