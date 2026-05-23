export type AgencyInquiry = {
  id: string;
  status: string;
  type: string;
  pax: number;
  message: string | null;
  createdAt: string;
  tourist?: { id: string; name: string; phone: string };
  tour?: { title: string } | null;
};

export type AgencyEntity = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  district: string | null;
  priceHint: number | null;
};

export type AgencyTour = {
  id: string;
  title: string;
  slug: string;
  days: number;
  basePriceLkr: number;
  isPublished: boolean;
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
