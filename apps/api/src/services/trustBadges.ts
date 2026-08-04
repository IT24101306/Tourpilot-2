import { evaluateTrustBadges, type EarnedTrustBadge, type TrustBadgeStats } from "@tourpilot/shared";
import { prisma } from "../lib/prisma.js";

function hasKycPayload(kyc: unknown): boolean {
  if (!kyc || typeof kyc !== "object") return false;
  const o = kyc as Record<string, unknown>;
  return Boolean(o.submittedAt || o.legalBusinessName || o.registrationNumber);
}

export async function loadAgencyTrustBadges(agencyId: string): Promise<{
  badges: EarnedTrustBadge[];
  earned: EarnedTrustBadge[];
  stats: TrustBadgeStats;
}> {
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      status: true,
      kyc: true,
      avgRating: true,
      reviewCount: true,
      trustFlags: true,
      _count: {
        select: {
          entities: true,
          tours: { where: { isPublished: true } },
        },
      },
    },
  });

  if (!agency) {
    const empty: TrustBadgeStats = {
      status: "PENDING",
      hasKyc: false,
      avgRating: 0,
      reviewCount: 0,
      publishedTourCount: 0,
      entityCount: 0,
      fastReplyRate: 0,
      proposalSampleSize: 0,
      completedTripCount: 0,
    };
    const badges = evaluateTrustBadges(empty);
    return { badges, earned: [], stats: empty };
  }

  const withProposal = await prisma.inquiry.findMany({
    where: { agencyId, proposal: { isNot: null } },
    select: {
      createdAt: true,
      proposal: { select: { createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  let fast = 0;
  for (const row of withProposal) {
    const sentAt = row.proposal?.createdAt;
    if (!sentAt) continue;
    const hours = (sentAt.getTime() - row.createdAt.getTime()) / (1000 * 60 * 60);
    if (hours <= 24) fast += 1;
  }

  const completedTripCount = await prisma.inquiry.count({
    where: {
      agencyId,
      status: { in: ["ACCEPTED", "IN_PROGRESS", "COMPLETED"] },
    },
  });

  const flags =
    agency.trustFlags && typeof agency.trustFlags === "object" && !Array.isArray(agency.trustFlags)
      ? (agency.trustFlags as Record<string, unknown>)
      : {};

  const stats: TrustBadgeStats = {
    status: agency.status,
    hasKyc: hasKycPayload(agency.kyc),
    avgRating: Number(agency.avgRating) || 0,
    reviewCount: agency.reviewCount || 0,
    publishedTourCount: agency._count.tours,
    entityCount: agency._count.entities,
    fastReplyRate: withProposal.length ? fast / withProposal.length : 0,
    proposalSampleSize: withProposal.length,
    completedTripCount,
    featured: Boolean(flags.featuredHost),
  };

  const badges = evaluateTrustBadges(stats);
  return { badges, earned: badges.filter((b) => b.earned), stats };
}
