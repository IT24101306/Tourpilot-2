import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, type AgencyFeatures } from "../../context/AuthContext";
import { SupportAgentsModal } from "../support/SupportAgentsModal";

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
  { title: string; description: string; featureLabel: string | null }
> = {
  offers: {
    title: "Offers not enabled",
    description: "Loyalty offers and campaign tools are not on your current package.",
    featureLabel: "Offers",
  },
  display: {
    title: "Display page not enabled",
    description: "Storefront display editing is not on your current package.",
    featureLabel: "Display",
  },
  negotiationsBookings: {
    title: "Negotiations & bookings not enabled",
    description: "Trip rooms, bookings, and negotiation tools are not on your current package.",
    featureLabel: "Negotiations & bookings",
  },
  readyMadeTours: {
    title: "Ready-made tours not enabled",
    description: "Publishing ready-made tour packages is not on your current package.",
    featureLabel: "Ready-made tours",
  },
  driversAndPartners: {
    title: "Drivers & partners not enabled",
    description: "Driver roster and influencer partner tools are not on your current package.",
    featureLabel: "Drivers & partners",
  },
  customDomain: {
    title: "Custom domain not enabled",
    description: "Connecting your own domain is not on your current package.",
    featureLabel: "Custom domain",
  },
  team: {
    title: "Team management is for owners",
    description: "Only the agency owner can invite or remove staff members.",
    featureLabel: null,
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
  const { user } = useAuth();
  const copy = BLOCKED_COPY[feature];
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const isTeamOnly = feature === "team";

  const trial = user?.trial;
  const hasPackage = Boolean(trial?.packageId || trial?.packageName);
  const trialExpired = Boolean(trial?.expiredUnpaid);
  const trialActive = Boolean(trial?.active);

  let description: string;
  if (isTeamOnly) {
    description = `${copy.description} Ask the account owner if you need team changes.`;
  } else if (!hasPackage) {
    description = `${copy.description} You don’t have a subscription yet — pick a plan that includes ${copy.featureLabel}, then activate it from billing.`;
  } else if (trialExpired) {
    description = `${copy.description} Your ${trial?.packageName ?? "plan"} has ended. Renew or upgrade so ${copy.featureLabel} can be enabled.`;
  } else if (trialActive && trial?.packageName) {
    description = `${copy.description} Your current plan is ${trial.packageName}. Add ${copy.featureLabel} to your subscription so you can use this feature.`;
  } else {
    description = `${copy.description} Add ${copy.featureLabel} to your subscription so you can use this feature.`;
  }

  const primaryBilling = {
    to: "/profile/billing/subscriptions",
    label: "Manage subscription",
  };

  return (
    <div className="tp-empty-state tp-empty-state--blocked tp-empty-state--agency-blocked" role="status">
      <h3 className="tp-empty-state__title">{copy.title}</h3>
      <p className="tp-empty-state__desc">{description}</p>

      {!isTeamOnly && (
        <Link to="/pricing" className="tp-feature-pricing-path">
          <span className="tp-feature-pricing-path__eyebrow">Not sure which plan?</span>
          <strong className="tp-feature-pricing-path__title">Compare packages on Pricing</strong>
          <span className="tp-feature-pricing-path__hint">
            See what includes {copy.featureLabel}
            <span aria-hidden="true"> →</span>
          </span>
        </Link>
      )}

      <div className="tp-empty-state__actions">
        {!isTeamOnly && (
          <>
            <Link to={primaryBilling.to} className="btn btn-primary">
              {primaryBilling.label}
            </Link>
            <button type="button" className="btn btn-ghost" onClick={() => setInquiryOpen(true)}>
              Send inquiry
            </button>
          </>
        )}
        <Link
          to="/dashboard/agency"
          className={isTeamOnly ? "btn btn-primary" : "btn btn-ghost"}
        >
          Back to overview
        </Link>
      </div>
      <SupportAgentsModal open={inquiryOpen} onClose={() => setInquiryOpen(false)} />
    </div>
  );
}
