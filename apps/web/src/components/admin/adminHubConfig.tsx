import type { AdminStats } from "../../pages/admin/types";

export type HubIconId =
  | "agency"
  | "users"
  | "inquiry"
  | "tour"
  | "commission"
  | "ledger"
  | "offer"
  | "review"
  | "driver"
  | "cms"
  | "settings"
  | "audit";

export type HubModule = {
  id: string;
  to: string;
  title: string;
  description: string;
  icon: HubIconId;
  /** Short label in the top nav dropdown */
  navLabel?: string;
  stat?: (s: AdminStats) => number | string;
};

export type HubSection = {
  id: "people" | "trips" | "money" | "content" | "platform";
  title: string;
  /** One-line purpose for the overview hub */
  blurb: string;
  modules: HubModule[];
};

export const HUB_SECTIONS: HubSection[] = [
  {
    id: "people",
    title: "People",
    blurb: "Accounts, agencies, and field partners",
    modules: [
      {
        id: "users",
        to: "/dashboard/admin/users",
        title: "Users",
        description: "Roles, wallets, login fees, and activation",
        icon: "users",
        stat: (s) => Object.values(s.users).reduce((a, b) => a + b, 0),
      },
      {
        id: "agencies",
        to: "/dashboard/admin/agencies",
        title: "Agencies",
        description: "Approve, reject, suspend, and feature flags",
        icon: "agency",
        stat: (s) => s.pendingAgencies,
      },
      {
        id: "influencers",
        to: "/dashboard/admin/influencers",
        title: "Influencers",
        description: "Referral partners, codes, and profiles",
        icon: "commission",
      },
      {
        id: "drivers",
        to: "/dashboard/admin/drivers",
        title: "Drivers",
        description: "Driver profiles and agency links",
        icon: "driver",
      },
    ],
  },
  {
    id: "trips",
    title: "Trips",
    blurb: "Inquiry pipeline, proposals, and catalog",
    modules: [
      {
        id: "inquiries",
        to: "/dashboard/admin/inquiries",
        title: "Inquiries",
        description: "Override status and open trip rooms",
        icon: "inquiry",
        stat: (s) =>
          (s.inquiries.NEW ?? 0) +
          (s.inquiries.AGENCY_REVIEWING ?? 0) +
          (s.inquiries.ITINERARY_DRAFT ?? 0),
      },
      {
        id: "itineraries",
        to: "/dashboard/admin/itineraries",
        title: "Itineraries",
        description: "Shared proposal links — revoke or regenerate",
        icon: "inquiry",
      },
      {
        id: "tours",
        to: "/dashboard/admin/tours",
        title: "Tours",
        description: "Publish control across agencies",
        icon: "tour",
      },
      {
        id: "reviews",
        to: "/dashboard/admin/reviews",
        title: "Reviews",
        description: "Moderate traveler feedback",
        icon: "review",
      },
    ],
  },
  {
    id: "money",
    title: "Money",
    blurb: "Credits, commissions, discounts, and campaigns",
    modules: [
      {
        id: "ledger",
        to: "/dashboard/admin/ledger",
        title: "Wallet ledger",
        description: "Login fees, top-ups, and adjustments",
        icon: "ledger",
        navLabel: "Ledger",
      },
      {
        id: "commissions",
        to: "/dashboard/admin/commissions",
        title: "Commissions",
        description: "Approve and mark partner payouts",
        icon: "commission",
        stat: (s) => s.commissions.PENDING ?? 0,
      },
      {
        id: "vouchers",
        to: "/dashboard/admin/vouchers",
        title: "Vouchers",
        description: "Discount codes for tourist invoices",
        icon: "ledger",
      },
      {
        id: "offers",
        to: "/dashboard/admin/offers",
        title: "Offers",
        description: "Loyalty campaigns and registrations",
        icon: "offer",
        stat: (s) => s.offers.active,
      },
    ],
  },
  {
    id: "content",
    title: "Content",
    blurb: "Public site copy, packages, and outreach",
    modules: [
      {
        id: "cms",
        to: "/dashboard/admin/cms",
        title: "CMS",
        description: "Landing and marketing pages",
        icon: "cms",
      },
      {
        id: "pricing",
        to: "/dashboard/admin/pricing",
        title: "Pricing",
        description: "Home packages, prices, and feature lines",
        icon: "cms",
      },
      {
        id: "promo-email",
        to: "/dashboard/admin/promo-email",
        title: "Promo email",
        description: "Send posters and offer links to users",
        icon: "cms",
        navLabel: "Promo email",
      },
    ],
  },
  {
    id: "platform",
    title: "Platform",
    blurb: "System defaults and change history",
    modules: [
      {
        id: "policy-flags",
        to: "/dashboard/admin/policy-flags",
        title: "Policy flags",
        description: "Contact-sharing blocked in trip chats",
        icon: "audit",
        navLabel: "Policy flags",
        stat: (s) => s.openPolicyViolations ?? 0,
      },
      {
        id: "support",
        to: "/dashboard/admin/support",
        title: "Live support",
        description: "Human chat with site visitors",
        icon: "settings",
        navLabel: "Support",
      },
      {
        id: "settings",
        to: "/dashboard/admin/settings",
        title: "Settings",
        description: "Fees, wallet limits, sessions, support, templates",
        icon: "settings",
      },
      {
        id: "audit",
        to: "/dashboard/admin/audit",
        title: "Audit trail",
        description: "Pricing and service change history",
        icon: "audit",
        navLabel: "Audit",
      },
    ],
  },
];

/** Flat list for path matching in the top nav. */
export const ALL_HUB_MODULES: HubModule[] = HUB_SECTIONS.flatMap((s) => s.modules);

export function hubContainingPath(pathname: string): HubSection | undefined {
  return HUB_SECTIONS.find((section) =>
    section.modules.some(
      (m) => pathname === m.to || pathname.startsWith(`${m.to}/`)
    )
  );
}
