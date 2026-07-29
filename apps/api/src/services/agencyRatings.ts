import { prisma } from "../lib/prisma.js";

/**
 * Agency public rating = visible manual reviews + public tourist reviews.
 */
export async function recalculateAgencyRatings(agencyId: string) {
  const [manual, tourist] = await Promise.all([
    prisma.review.findMany({
      where: { agencyId, isVisible: true },
      select: { rating: true },
    }),
    prisma.touristReview.findMany({
      where: { agencyId, isPublic: true },
      select: { rating: true },
    }),
  ]);

  const all = [...manual, ...tourist];
  const count = all.length;
  const avg = count > 0 ? all.reduce((sum, r) => sum + r.rating, 0) / count : 0;

  await prisma.agency.update({
    where: { id: agencyId },
    data: {
      reviewCount: count,
      avgRating: avg,
    },
  });

  return { reviewCount: count, avgRating: avg };
}
