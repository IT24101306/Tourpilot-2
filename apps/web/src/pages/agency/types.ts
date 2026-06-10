export type AgencyInquiry = {
  id: string;
  status: string;
  type: string;
  pax: number;
  message: string | null;
  createdAt: string;
  tourist?: { id: string; name: string; phone: string; email?: string | null };
  tour?: { title: string } | null;
};

export type AgencyEntity = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  district: string | null;
  description?: string | null;
  durationMin?: number | null;
  priceHint: number | null;
  contact?: string | null;
  lat?: number | null;
  lng?: number | null;
  media?: unknown[] | null;
  metadata?: Record<string, unknown> | null;
};

export type AgencyTourDayItem = {
  scheduledTime: string | null;
  entityId: string | null;
  entityName: string | null;
  entityType?: string | null;
};

export type AgencyTourDay = {
  dayNumber: number;
  title: string | null;
  items: AgencyTourDayItem[];
};

export type LinkedOfferLite = {
  id: string;
  title: string;
  isActive: boolean;
};

export type AgencyTour = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description?: string | null;
  days: number;
  tourKind: "READY_MADE" | "CUSTOM";
  basePriceLkr: number;
  influencerCommissionPct?: number;
  tourInfluencerCommissionPct?: number | null;
  influencerCommissionLkr?: number;
  publicPriceLkr?: number;
  coverUrl?: string | null;
  isPublished: boolean;
  durationLabel?: string;
  updatedAt?: string;
  tourDays?: AgencyTourDay[];
  linkedOffers?: LinkedOfferLite[];
};

export type AgencyGroup = {
  id: string;
  name: string;
  description: string | null;
  items: Array<{ entity: { id: string; name: string; type: string; city: string | null } }>;
};

export function inquiryStatusClass(status: string): string {
  if (status === "ACCEPTED" || status === "SENT_TO_TOURIST") return "ok";
  if (status === "NEW" || status === "AGENCY_REVIEWING") return "warn";
  if (status === "REVISION_REQUESTED" || status === "DECLINED") return "late";
  return "warn";
}

export function formatInquiryStatus(status: string): string {
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
