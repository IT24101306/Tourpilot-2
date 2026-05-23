import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, getAgencyForUser, requireRoles } from "../middleware/auth.js";
import { asJson } from "../utils/json.js";

export const agenciesRouter = Router();

agenciesRouter.get("/", async (_req, res, next) => {
  try {
    const agencies = await prisma.agency.findMany({
      where: { status: "APPROVED" },
      orderBy: { avgRating: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        tagline: true,
        logoUrl: true,
        coverUrl: true,
        district: true,
        avgRating: true,
        reviewCount: true,
        _count: { select: { tours: { where: { isPublished: true } } } },
      },
    });
    res.json(
      agencies.map((a) => ({
        ...a,
        avgRating: Number(a.avgRating),
        tourCount: a._count.tours,
      }))
    );
  } catch (e) {
    next(e);
  }
});

agenciesRouter.get("/:slug", async (req, res, next) => {
  try {
    const agency = await prisma.agency.findFirst({
      where: { slug: req.params.slug, status: "APPROVED" },
      include: {
        tours: {
          where: { isPublished: true },
          orderBy: { createdAt: "desc" },
        },
        reviews: { where: { isVisible: true }, orderBy: { createdAt: "desc" }, take: 20 },
        displaySettings: true,
      },
    });

    if (!agency) return res.status(404).json({ error: "Agency not found" });

    res.json({
      ...agency,
      avgRating: Number(agency.avgRating),
      tours: agency.tours.map(serializeTourCard),
    });
  } catch (e) {
    next(e);
  }
});

agenciesRouter.patch("/mine", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const body = z
      .object({
        name: z.string().optional(),
        tagline: z.string().optional(),
        description: z.string().optional(),
        logoUrl: z.string().optional(),
        coverUrl: z.string().optional(),
        district: z.string().optional(),
        contactPhone: z.string().optional(),
        contactEmail: z.string().email().optional(),
        gallery: z.array(z.unknown()).optional(),
        pageConfig: z.record(z.unknown()).optional(),
      })
      .parse(req.body);

    const updated = await prisma.agency.update({
      where: { id: agency.id },
      data: {
        ...body,
        pageConfig: body.pageConfig ? asJson(body.pageConfig) : undefined,
        gallery: body.gallery ? asJson(body.gallery) : undefined,
      },
    });

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

agenciesRouter.put("/mine/display", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const { sections, theme } = z
      .object({
        sections: z.array(z.record(z.unknown())),
        theme: z.record(z.unknown()).optional(),
      })
      .parse(req.body);

    const settings = await prisma.displaySettings.upsert({
      where: { agencyId: agency.id },
      create: { agencyId: agency.id, sections: asJson(sections), theme: asJson(theme ?? {}) },
      update: { sections: asJson(sections), theme: asJson(theme ?? {}) },
    });

    res.json(settings);
  } catch (e) {
    next(e);
  }
});

export function serializeTourCard(tour: {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  days: number;
  basePriceLkr: unknown;
  coverUrl: string | null;
  seasonTag: string | null;
  districtTags: unknown;
}) {
  return {
    id: tour.id,
    title: tour.title,
    slug: tour.slug,
    summary: tour.summary,
    days: tour.days,
    basePriceLkr: Number(tour.basePriceLkr),
    coverUrl: tour.coverUrl,
    seasonTag: tour.seasonTag,
    districtTags: tour.districtTags,
  };
}
