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
    influencerCommissionLkr?: number;
    publicPriceLkr?: number;
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
  agency?: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
    features?: {
      readyMadeTours?: boolean;
      customInquiries?: boolean;
      negotiationsBookings?: boolean;
      offers?: boolean;
      display?: boolean;
    };
  };
  handlerInfluencer?: {
    id: string;
    slug: string | null;
    name: string;
    userId: string;
  } | null;
  whiteLabel?: boolean;
  tour?: { id: string; title: string; slug: string; days?: number; basePriceLkr?: number } | null;
  proposal?: {
    id: string;
    message: string;
    updatedAt?: string;
    items: ProposalItem[];
  } | null;
  thread?: ThreadMessage[];
  typing?: Array<{ userId: string; name: string; role: string; until: string }>;
  invoice?: {
    id: string;
    invoiceNumber: string;
    status: string;
    subtotalLkr: number;
    voucherCode: string | null;
    voucherDiscountLkr: number;
    totalLkr: number;
    sentAt: string | null;
    paidAt: string | null;
  } | null;
  touristReview?: {
    id: string;
    rating: number;
    body: string | null;
    isPublic: boolean;
    createdAt: string;
  } | null;
  hasReview?: boolean;
  pendingRevisionItemId?: string | null;
  pendingRevisionLabel?: string | null;
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
  handlerInfluencer?: { id: string; name: string; slug: string | null } | null;
  whiteLabel?: boolean;
  tour?: { title: string } | null;
  proposal?: { items: Array<{ id: string }> } | null;
  thread?: ThreadMessage[];
  hasReview?: boolean;
  touristReview?: {
    id: string;
    rating: number;
    body: string | null;
    isPublic: boolean;
    createdAt: string;
  } | null;
};
