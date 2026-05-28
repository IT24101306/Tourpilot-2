import type { ThreadMessage } from "../components/inquiry/InquiryThread";

export type ProposalItem = {
  id: string;
  kind: string;
  tour?: {
    id: string;
    title: string;
    slug: string;
    days: number;
    basePriceLkr: number;
    coverUrl?: string | null;
  } | null;
  itinerary?: {
    id: string;
    title: string | null;
    grandMax: number;
    shareToken: string | null;
    days?: Array<{
      dayNumber: number;
      title: string | null;
      lineItems: Array<{ label: string; priceLkr: number | null }>;
    }>;
  } | null;
};

export type InquiryDetail = {
  id: string;
  status: string;
  type: string;
  pax: number;
  message: string | null;
  budgetBand: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  proposalEditable?: boolean;
  tourist?: { id: string; name: string; phone: string; email?: string | null };
  agency?: { id: string; name: string; slug: string; logoUrl?: string | null };
  tour?: { id: string; title: string; slug: string; days?: number; basePriceLkr?: number } | null;
  proposal?: {
    id: string;
    message: string;
    updatedAt?: string;
    items: ProposalItem[];
  } | null;
  thread?: ThreadMessage[];
};

export type NegotiationListItem = {
  id: string;
  status: string;
  type: string;
  pax: number;
  message: string | null;
  createdAt: string;
  tourist?: { id: string; name: string; phone: string };
  agency?: { id: string; name: string; slug: string };
  tour?: { title: string } | null;
  proposal?: { items: Array<{ id: string }> } | null;
  thread?: ThreadMessage[];
};
