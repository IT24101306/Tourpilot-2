import type { AgencyFeatures } from "../../context/AuthContext";
import { EmptyState } from "./EmptyState";

export type BlockedFeatureKey =
  | "offers"
  | "display"
  | "negotiationsBookings"
  | "readyMadeTours"
  | "driversAndPartners"
  | "customDomain"
  | "team";

const BLOCKED_COPY: Record<
  BlockedFeatureKey,
  { title: string; description: string; packageHint: string }
> = {
  offers: {
    title: "Offers not enabled",
    description: "Loyalty offers and campaign tools are turned off for this agency.",
    packageHint: "Ask TourPilot admin to enable Offers on your account.",
  },
  display: {
    title: "Display page not enabled",
    description: "Storefront display editing is turned off for this agency.",
    packageHint: "Ask TourPilot admin to enable Display on your account.",
  },
  negotiationsBookings: {
    title: "Negotiations & bookings not enabled",
    description: "Trip rooms, bookings, and negotiation tools are not on your package.",
    packageHint: "Ask TourPilot admin to enable Negotiations & bookings.",
  },
  readyMadeTours: {
    title: "Ready-made tours not enabled",
    description: "Publishing ready-made tour packages is turned off for this agency.",
    packageHint: "Ask TourPilot admin to enable Ready-made tours.",
  },
  driversAndPartners: {
    title: "Drivers & partners not enabled",
    description: "Driver roster and influencer partner tools are not on your package.",
    packageHint: "Ask TourPilot admin to enable Drivers & partners.",
  },
  customDomain: {
    title: "Custom domain not enabled",
    description: "Connecting your own domain is turned off for this agency.",
    packageHint: "Ask TourPilot admin to enable Custom domain.",
  },
  team: {
    title: "Team management is for owners",
    description: "Only the agency owner can invite or remove staff members.",
    packageHint: "Ask the account owner if you need team changes.",
  },
};

export function resolveAgencyBlockedFeature(
  pathname: string,
  features: AgencyFeatures,
  agencyMembership?: "owner" | "staff" | null
): BlockedFeatureKey | null {
  if (agencyMembership !== "owner" && pathname.startsWith("/dashboard/agency/team")) {
    return "team";
  }
  if (!features.offers && pathname.startsWith("/dashboard/agency/offers")) return "offers";
  if (!features.display && pathname.startsWith("/dashboard/agency/display")) return "display";
  if (
    !features.negotiationsBookings &&
    (pathname.startsWith("/dashboard/agency/negotiations") ||
      pathname.startsWith("/dashboard/agency/bookings") ||
      pathname.startsWith("/dashboard/agency/trip-room"))
  ) {
    return "negotiationsBookings";
  }
  if (!features.readyMadeTours && pathname.startsWith("/dashboard/agency/tours")) {
    return "readyMadeTours";
  }
  if (
    !features.driversAndPartners &&
    (pathname.startsWith("/dashboard/agency/drivers") ||
      pathname.startsWith("/dashboard/agency/partners"))
  ) {
    return "driversAndPartners";
  }
  if (!features.customDomain && pathname.startsWith("/dashboard/agency/domain")) {
    return "customDomain";
  }
  return null;
}

export function FeatureBlockedPanel({ feature }: { feature: BlockedFeatureKey }) {
  const copy = BLOCKED_COPY[feature];
  return (
    <EmptyState
      tone="blocked"
      title={copy.title}
      description={`${copy.description} ${copy.packageHint}`}
      action={{ label: "Back to overview", to: "/dashboard/agency" }}
      className="tp-empty-state--agency-blocked"
    />
  );
}
