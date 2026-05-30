import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { attachTourPricing } from "../lib/tourPricing.js";
import { authRequired, requireRoles } from "../middleware/auth.js";

export const savedToursRouter = Router();

const tourForSaved = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  days: true,
  basePriceLkr: true,
  coverUrl: true,
  agency: { select: { id: true, name: true, slug: true, influencerCommissionPct: true } },
} as const;

function serializeSaved(row: {
  id: string;
  createdAt: Date;
  tour: {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    days: number;
    basePriceLkr: unknown;
    coverUrl: string | null;
    agency: { id: string; name: string; slug: string; influencerCommissionPct?: unknown };
  };
}) {
  const pricing = attachTourPricing(row.tour);
  const { slug: agencySlug } = row.tour.agency;
  return {
    id: row.id,
    savedAt: row.createdAt.toISOString(),
    tour: {
      id: row.tour.id,
      title: row.tour.title,
      slug: row.tour.slug,
      summary: row.tour.summary,
      days: row.tour.days,
      publicPriceLkr: pricing.publicPriceLkr,
      coverUrl: row.tour.coverUrl,
      agency: row.tour.agency,
      tourPath: `/tours/${agencySlug}/${row.tour.slug}`,
    },
  };
}

savedToursRouter.get(
  "/mine",
  authRequired,
  requireRoles("TOURIST"),
  async (req, res, next) => {
    try {
      const rows = await prisma.savedTour.findMany({
        where: { userId: req.user!.id },
        include: { tour: { select: tourForSaved } },
        orderBy: { createdAt: "desc" },
      });
      res.json(rows.map(serializeSaved));
    } catch (e) {
      next(e);
    }
  }
);

savedToursRouter.get(
  "/ids",
  authRequired,
  requireRoles("TOURIST"),
  async (req, res, next) => {
    try {
      const rows = await prisma.savedTour.findMany({
        where: { userId: req.user!.id },
        select: { tourId: true },
      });
      res.json({ tourIds: rows.map((r) => r.tourId) });
    } catch (e) {
      next(e);
    }
  }
);

savedToursRouter.post(
  "/:tourId",
  authRequired,
  requireRoles("TOURIST"),
  async (req, res, next) => {
    try {
      const tour = await prisma.tour.findFirst({
        where: { id: req.params.tourId, isPublished: true },
        select: { id: true },
      });
      if (!tour) return res.status(404).json({ error: "Tour not found" });

      const saved = await prisma.savedTour.upsert({
        where: {
          userId_tourId: { userId: req.user!.id, tourId: tour.id },
        },
        create: { userId: req.user!.id, tourId: tour.id },
        update: {},
        include: { tour: { select: tourForSaved } },
      });

      res.status(201).json(serializeSaved(saved));
    } catch (e) {
      next(e);
    }
  }
);

savedToursRouter.delete(
  "/:tourId",
  authRequired,
  requireRoles("TOURIST"),
  async (req, res, next) => {
    try {
      await prisma.savedTour.deleteMany({
        where: { userId: req.user!.id, tourId: req.params.tourId },
      });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  }
);
