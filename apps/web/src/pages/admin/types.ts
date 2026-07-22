export type AdminStats = {
  users: Record<string, number>;
  agencies: Record<string, number>;
  inquiries: Record<string, number>;
  commissions: Record<string, number>;
  offers: { total: number; active: number };
  ledgerVolumeLkr: number;
  pendingAgencies: number;
};

export type AdminAgency = {
  id: string;
  name: string;
  slug: string;
  status: string;
  district: string | null;
  contactEmail: string | null;
  rejectionReason: string | null;
  rejectedAt: string | null;
  avgRating: number;
  reviewCount: number;
  owner: { id: string; name: string; phone: string; email: string | null };
  tourCount: number;
  inquiryCount: number;
  kyc: Record<string, unknown> | null;
  kycSubmittedAt: string | null;
  createdAt: string;
  features?: {
    driversAndPartners: boolean;
    support: boolean;
    walletTopup: boolean;
    offers: boolean;
    display: boolean;
  };
};

export type AdminUser = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  walletBalance: number;
  /** Effective fee charged on login. */
  loginFee: number;
  /** null = role default from platform settings. */
  loginFeeOverride: number | null;
  isActive: boolean;
  createdAt: string;
  agency: {
    id: string;
    name: string;
    slug: string;
    status: string;
    features?: {
      driversAndPartners: boolean;
      support: boolean;
      walletTopup: boolean;
      offers: boolean;
      display: boolean;
    };
  } | null;
};

export type AdminTour = {
  id: string;
  title: string;
  slug: string;
  days: number;
  isPublished: boolean;
  basePriceLkr: number;
  coverUrl: string | null;
  updatedAt: string;
  agency: { id: string; name: string; slug: string; status: string };
};

export type AdminInquiry = {
  id: string;
  status: string;
  type: string;
  pax: number;
  startDate: string | null;
  createdAt: string;
  updatedAt: string;
  tourist: { id: string; name: string; phone: string };
  agency: { id: string; name: string; slug: string };
  tour: { id: string; title: string; slug: string } | null;
};

export type AdminCommission = {
  id: string;
  amountLkr: number;
  status: string;
  createdAt: string;
  code: string;
  influencer: { id: string; name: string; phone: string };
  inquiry: {
    id: string;
    status: string;
    agency: { name: string };
    tourist: { name: string };
  };
};

export type AdminLedgerRow = {
  id: string;
  type: string;
  amountLkr: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
  user: { id: string; name: string; phone: string; role: string };
};

export type AdminReview = {
  id: string;
  authorName: string;
  rating: number;
  body: string | null;
  isVisible: boolean;
  createdAt: string;
  agency: { id: string; name: string; slug: string };
};

export type AdminCmsPage = {
  id: string;
  slug: string;
  title: string;
  blocks: unknown;
  isPublished: boolean;
  updatedAt: string;
};

export const INQUIRY_STATUSES = [
  "NEW",
  "AGENCY_REVIEWING",
  "ITINERARY_DRAFT",
  "SENT_TO_TOURIST",
  "TOURIST_VIEWED",
  "REVISION_REQUESTED",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
] as const;

export const COMMISSION_STATUSES = ["PENDING", "APPROVED", "PAID", "CANCELLED"] as const;
