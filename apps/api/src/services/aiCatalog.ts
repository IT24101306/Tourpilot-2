import { prisma } from "../lib/prisma.js";
import { publicTourAgencyFilter } from "../lib/publicVisibility.js";

export type CatalogTour = {
  id: string;
  title: string;
  slug: string;
  days: number;
  priceFromLkr: number | null;
  agencyId: string;
  agencySlug: string;
  agencyName: string;
  districts: string[];
};

export async function loadPublishedTourCatalog(limit = 40): Promise<CatalogTour[]> {
  const tours = await prisma.tour.findMany({
    where: publicTourAgencyFilter(),
    take: limit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      days: true,
      basePriceLkr: true,
      districtTags: true,
      agency: { select: { id: true, slug: true, name: true } },
    },
  });

  return tours.map((t) => ({
    id: t.id,
    title: t.title,
    slug: t.slug,
    days: t.days,
    priceFromLkr: t.basePriceLkr != null ? Number(t.basePriceLkr) : null,
    agencyId: t.agency.id,
    agencySlug: t.agency.slug,
    agencyName: t.agency.name,
    districts: Array.isArray(t.districtTags)
      ? (t.districtTags as unknown[]).filter((d): d is string => typeof d === "string")
      : [],
  }));
}

export function catalogForPrompt(catalog: CatalogTour[]) {
  return catalog.map((t) => ({
    tourId: t.id,
    tourSlug: t.slug,
    title: t.title,
    days: t.days,
    priceFromLkr: t.priceFromLkr,
    agencyId: t.agencyId,
    agencySlug: t.agencySlug,
    agencyName: t.agencyName,
    districts: t.districts,
  }));
}
