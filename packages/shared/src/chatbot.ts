/** Public AI chatbot request/response shapes (LLM-backed). */

export type ChatbotMessageRole = "user" | "assistant";

export type ChatbotMessage = {
  role: ChatbotMessageRole;
  content: string;
};

export type ChatbotLink = {
  label: string;
  /** App-relative path only, e.g. /plan or /tours/{agency}/{tour} */
  href: string;
};

export type ChatbotLeadHints = {
  days?: number | null;
  pax?: number | null;
  interests?: string[];
  budgetBand?: string | null;
  preferredAgencySlug?: string | null;
  readyForInquiry?: boolean;
};

export type ChatbotRequest = {
  messages: ChatbotMessage[];
  /** Optional UI path for context, e.g. /offers */
  pagePath?: string | null;
};

export type ChatbotResult = {
  reply: string;
  links: ChatbotLink[];
  lead: ChatbotLeadHints;
};
