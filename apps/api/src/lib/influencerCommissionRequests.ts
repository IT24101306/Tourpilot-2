import { prisma } from "./prisma.js";
import { agencyCommissionPct } from "./tourPricing.js";

type TourWithAgency = {
  id: string;
  influencerCommissionPct?: unknown | null;
  agency?: { influencerCommissionPct?: unknown } | null;
};

export async function resolveInfluencerTourCommissionPct(
  influencerId: string,
  tour: TourWithAgency
): Promise<number> {
  const approved = await prisma.influencerCommissionRequest.findFirst({
    where: { influencerId, tourId: tour.id, status: "APPROVED" },
    orderBy: { updatedAt: "desc" },
  });
  if (approved?.approvedPct != null) return Number(approved.approvedPct);
  return agencyCommissionPct(tour);
}

export async function syncReferralCodeCommissionPct(
  influencerId: string,
  tourId: string,
  commissionPct: number
) {
  await prisma.referralCode.updateMany({
    where: { influencerId, tourId, isActive: true },
    data: { commissionPct },
  });
}
