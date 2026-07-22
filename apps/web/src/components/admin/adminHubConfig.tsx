import type { AdminStats } from "../../pages/admin/types";

export type HubModule = {
  id: string;
  to: string;
  category: string;
  title: string;
  description: string;
  icon: "agency" | "users" | "inquiry" | "tour" | "commission" | "ledger" | "offer" | "review" | "driver" | "cms" | "settings";
  stat?: (s: AdminStats) => number | string;
};

export const HUB_SECTIONS: { title: string; modules: HubModule[] }[] = [
  {
    title: "Marketplace & trips",
    modules: [
      {
        id: "agencies",
        to: "/dashboard/admin/agencies",
        category: "Marketplace",
        title: "Agencies",
        description: "Approve, reject, and suspend operators",
        icon: "agency",
        stat: (s) => s.pendingAgencies,
      },
      {
        id: "inquiries",
        to: "/dashboard/admin/inquiries",
        category: "Trips",
        title: "Inquiries",
        description: "Override status and open trip rooms",
        icon: "inquiry",
        stat: (s) =>
          (s.inquiries.NEW ?? 0) + (s.inquiries.AGENCY_REVIEWING ?? 0) + (s.inquiries.ITINERARY_DRAFT ?? 0),
      },
      {
        id: "tours",
        to: "/dashboard/admin/tours",
        category: "Catalog",
        title: "Tours",
        description: "Publish control across agencies",
        icon: "tour",
      },
      {
        id: "reviews",
        to: "/dashboard/admin/reviews",
        category: "Trust",
        title: "Reviews",
        description: "Moderate traveler feedback",
        icon: "review",
      },
    ],
  },
  {
    title: "People & payouts",
    modules: [
      {
        id: "users",
        to: "/dashboard/admin/users",
        category: "Access",
        title: "Users",
        description: "Roles, wallets, and activation",
        icon: "users",
        stat: (s) => Object.values(s.users).reduce((a, b) => a + b, 0),
      },
      {
        id: "commissions",
        to: "/dashboard/admin/commissions",
        category: "Partners",
        title: "Commissions",
        description: "Approve and mark partner payouts",
        icon: "commission",
        stat: (s) => s.commissions.PENDING ?? 0,
      },
      {
        id: "influencers",
        to: "/dashboard/admin/influencers",
        category: "Partners",
        title: "Influencers",
        description: "Referral partners, codes, and wallets",
        icon: "commission",
      },
      {
        id: "itineraries",
        to: "/dashboard/admin/itineraries",
        category: "Trips",
        title: "Itineraries",
        description: "Shared proposal links and revoke/regenerate",
        icon: "inquiry",
      },
      {
        id: "drivers",
        to: "/dashboard/admin/drivers",
        category: "Field ops",
        title: "Drivers",
        description: "Agency links and driver profiles",
        icon: "driver",
      },
    ],
  },
  {
    title: "Platform & content",
    modules: [
      {
        id: "settings",
        to: "/dashboard/admin/settings",
        category: "Control",
        title: "Settings",
        description: "Login fees, expiry, URL, and wallet limits",
        icon: "settings",
      },
      {
        id: "ledger",
        to: "/dashboard/admin/ledger",
        category: "Money",
        title: "Wallet ledger",
        description: "Fees, top-ups, and adjustments",
        icon: "ledger",
      },
      {
        id: "offers",
        to: "/dashboard/admin/offers",
        category: "Loyalty",
        title: "Offers",
        description: "Campaign caps and registrations",
        icon: "offer",
        stat: (s) => s.offers.active,
      },
      {
        id: "vouchers",
        to: "/dashboard/admin/vouchers",
        category: "Money",
        title: "Vouchers",
        description: "Custom discount codes for invoices",
        icon: "ledger",
      },
      {
        id: "cms",
        to: "/dashboard/admin/cms",
        category: "Content",
        title: "CMS",
        description: "Landing and marketing copy",
        icon: "cms",
      },
    ],
  },
];
