/** Earnable trust signals shown on agency storefronts and discovery. */

export type TrustBadgeKey =
  | "VERIFIED"
  | "TOP_RATED"
  | "RESPONSIVE"
  | "WELL_STOCKED"
  | "TRIP_PROVEN"
  | "FEATURED_HOST";

export type TrustBadgeDef = {
  key: TrustBadgeKey;
  label: string;
  shortLabel: string;
  description: string;
  /** Human-readable how to earn it */
  howToEarn: string;
};

export const TRUST_BADGE_DEFS: TrustBadgeDef[] = [
  {
    key: "VERIFIED",
    label: "Verified agency",
    shortLabel: "Verified",
    description: "Approved on TourPilot with business details on file.",
    howToEarn: "Get approved and complete KYC / business profile.",
  },
  {
    key: "TOP_RATED",
    label: "Top rated",
    shortLabel: "Top rated",
    description: "Strong traveler ratings from real trips.",
    howToEarn: "Maintain 4.5+ average with at least 5 public reviews.",
  },
  {
    key: "RESPONSIVE",
    label: "Responsive host",
    shortLabel: "Fast reply",
    description: "Usually sends a proposal quickly after an inquiry.",
    howToEarn: "Send proposals within 24 hours on most recent inquiries.",
  },
  {
    key: "WELL_STOCKED",
    label: "Rich catalog",
    shortLabel: "Full catalog",
    description: "Enough places and packages to plan real trips.",
    howToEarn: "Publish 3+ tours and keep 8+ entities in your library.",
  },
  {
    key: "TRIP_PROVEN",
    label: "Trip proven",
    shortLabel: "Proven",
    description: "Has completed trips with travelers on the platform.",
    howToEarn: "Complete at least 3 accepted trips (ACCEPTED / IN_PROGRESS / COMPLETED).",
  },
  {
    key: "FEATURED_HOST",
    label: "Featured host",
    shortLabel: "Featured",
    description: "Standout partner highlighted by TourPilot.",
    howToEarn: "Earned when TourPilot features your agency (admin).",
  },
];

export type TrustBadgeStats = {
  status: string;
  hasKyc: boolean;
  avgRating: number;
  reviewCount: number;
  publishedTourCount: number;
  entityCount: number;
  /** Inquiries where a proposal was sent within 24h / total with proposals (0–1). */
  fastReplyRate: number;
  /** Minimum sample size for RESPONSIVE */
  proposalSampleSize: number;
  completedTripCount: number;
  featured?: boolean;
};

export type EarnedTrustBadge = TrustBadgeDef & { earned: boolean; progressHint?: string };

export function evaluateTrustBadges(stats: TrustBadgeStats): EarnedTrustBadge[] {
  return TRUST_BADGE_DEFS.map((def) => {
    switch (def.key) {
      case "VERIFIED": {
        const earned = stats.status === "APPROVED" && stats.hasKyc;
        return {
          ...def,
          earned,
          progressHint: earned
            ? undefined
            : stats.status !== "APPROVED"
              ? "Awaiting approval"
              : "Complete business / KYC details",
        };
      }
      case "TOP_RATED": {
        const earned = stats.avgRating >= 4.5 && stats.reviewCount >= 5;
        return {
          ...def,
          earned,
          progressHint: earned
            ? undefined
            : `${stats.avgRating.toFixed(1)}★ · ${stats.reviewCount}/5 reviews`,
        };
      }
      case "RESPONSIVE": {
        const earned = stats.proposalSampleSize >= 3 && stats.fastReplyRate >= 0.7;
        return {
          ...def,
          earned,
          progressHint: earned
            ? undefined
            : stats.proposalSampleSize < 3
              ? `Send ${3 - stats.proposalSampleSize} more proposals`
              : `${Math.round(stats.fastReplyRate * 100)}% replied in 24h (need 70%)`,
        };
      }
      case "WELL_STOCKED": {
        const earned = stats.publishedTourCount >= 3 && stats.entityCount >= 8;
        return {
          ...def,
          earned,
          progressHint: earned
            ? undefined
            : `${stats.publishedTourCount}/3 tours · ${stats.entityCount}/8 entities`,
        };
      }
      case "TRIP_PROVEN": {
        const earned = stats.completedTripCount >= 3;
        return {
          ...def,
          earned,
          progressHint: earned ? undefined : `${stats.completedTripCount}/3 trips underway or done`,
        };
      }
      case "FEATURED_HOST": {
        return { ...def, earned: Boolean(stats.featured), progressHint: undefined };
      }
      default:
        return { ...def, earned: false };
    }
  });
}

export function earnedBadgeKeys(stats: TrustBadgeStats): TrustBadgeKey[] {
  return evaluateTrustBadges(stats)
    .filter((b) => b.earned)
    .map((b) => b.key);
}
