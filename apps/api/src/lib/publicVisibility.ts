import type { Prisma } from "@prisma/client";

/** Agency is publicly listable / reachable (directory, storefront, tours, offers). */
export function publicAgencyWhere(): Prisma.AgencyWhereInput {
  return {
    status: "APPROVED",
    owner: { isActive: true },
  };
}

/** Active public offers, excluding those owned by inactive / non-approved agencies. */
export function publicOfferWhere(now = new Date()): Prisma.OfferWhereInput {
  return {
    isActive: true,
    validFrom: { lte: now },
    validUntil: { gte: now },
    AND: [
      {
        OR: [{ agencyId: null }, { agency: publicAgencyWhere() }],
      },
    ],
  };
}

/** Published tours from publicly visible agencies with ready-made tours enabled. */
export function publicTourAgencyFilter(): Prisma.TourWhereInput {
  return {
    isPublished: true,
    agency: {
      ...publicAgencyWhere(),
      featureReadyMadeTours: true,
    },
  };
}
