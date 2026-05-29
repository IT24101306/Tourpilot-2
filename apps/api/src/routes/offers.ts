import { Router } from "express";
import { z } from "zod";
import { DEFAULT_TOUR_COVER_URL, resolveImageUrl } from "@tourpilot/shared";
import { optionalImageUrlSchema } from "../lib/imageUrlSchema.js";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";

export const offersRouter = Router();

/** Offer image → linked tour cover → verified stock default (skips invalid stored URLs). */
function resolveOfferImageUrl(
  offerImageUrl: string | null | undefined,
  tourCoverUrl: string | null | undefined
) {
  return resolveImageUrl(offerImageUrl, resolveImageUrl(tourCoverUrl, DEFAULT_TOUR_COVER_URL));
}

function serializeOfferAdmin(o: {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  rewardText: string;
  registrationCap: number;
  validFrom: Date;
  validUntil: Date;
  tourPriceLkr: unknown;
  discountedLkr: unknown;
  isActive: boolean;
  tours: { tourId: string }[];
  _count: { registrations: number };
}) {
  return {
    id: o.id,
    title: o.title,
    description: o.description,
    imageUrl: o.imageUrl,
    rewardText: o.rewardText,
    registrationCap: o.registrationCap,
    validFrom: o.validFrom,
    validUntil: o.validUntil,
    tourPriceLkr: Number(o.tourPriceLkr),
    discountedLkr: o.discountedLkr != null ? Number(o.discountedLkr) : null,
    isActive: o.isActive,
    tourIds: o.tours.map((t) => t.tourId),
    registeredCount: o._count.registrations,
    spotsLeft: Math.max(0, o.registrationCap - o._count.registrations),
  };
}

function serializeActiveOffer(o: {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  rewardText: string;
  registrationCap: number;
  validUntil: Date;
  tourPriceLkr: unknown;
  discountedLkr: unknown;
  _count: { registrations: number };
  tours: Array<{
    tour: {
      id: string;
      title: string;
      slug: string;
      coverUrl: string | null;
      basePriceLkr: unknown;
      agency: { name: string; slug: string };
    };
  }>;
}) {
  const primary = o.tours[0]?.tour;

  return {
    id: o.id,
    title: o.title,
    description: o.description,
    rewardText: o.rewardText,
    registrationCap: o.registrationCap,
    validUntil: o.validUntil,
    tourPriceLkr: Number(o.tourPriceLkr),
    discountedLkr: o.discountedLkr != null ? Number(o.discountedLkr) : null,
    spotsLeft: Math.max(0, o.registrationCap - o._count.registrations),
    registeredCount: o._count.registrations,
    imageUrl: resolveOfferImageUrl(o.imageUrl, primary?.coverUrl),
    offerImageUrl: o.imageUrl,
    agencyName: primary?.agency.name ?? null,
    agencySlug: primary?.agency.slug ?? null,
    tourSlug: primary?.slug ?? null,
    tours: o.tours.map((t) => ({
      ...t.tour,
      basePriceLkr: Number(t.tour.basePriceLkr),
      agency: t.tour.agency,
    })),
  };
}

offersRouter.get("/active", async (_req, res, next) => {
  try {
    const now = new Date();
    const offers = await prisma.offer.findMany({
      where: { isActive: true, validFrom: { lte: now }, validUntil: { gte: now } },
      include: {
        tours: {
          include: {
            tour: {
              select: {
                id: true,
                title: true,
                slug: true,
                coverUrl: true,
                basePriceLkr: true,
                agency: { select: { name: true, slug: true } },
              },
            },
          },
        },
        _count: { select: { registrations: true } },
      },
      orderBy: { validUntil: "asc" },
    });

    res.json(offers.map(serializeActiveOffer));
  } catch (e) {
    next(e);
  }
});

/** Public: active offers ending soonest (for hero / urgency banners). */
offersRouter.get("/ending-soon", async (req, res, next) => {
  try {
    const limit = Math.min(10, Math.max(1, Number(req.query.limit) || 3));
    const now = new Date();
    const offers = await prisma.offer.findMany({
      where: { isActive: true, validFrom: { lte: now }, validUntil: { gte: now } },
      include: {
        tours: {
          include: {
            tour: {
              select: {
                id: true,
                title: true,
                slug: true,
                coverUrl: true,
                basePriceLkr: true,
                agency: { select: { name: true, slug: true } },
              },
            },
          },
        },
        _count: { select: { registrations: true } },
      },
      orderBy: { validUntil: "asc" },
      take: limit * 2,
    });

    const endingSoon = offers
      .map(serializeActiveOffer)
      .filter((o) => o.spotsLeft > 0)
      .slice(0, limit);

    res.json(endingSoon);
  } catch (e) {
    next(e);
  }
});

/** Admin: list all offers (active and inactive). */
offersRouter.get("/", authRequired, requireRoles("ADMIN"), async (_req, res, next) => {
  try {
    const offers = await prisma.offer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        tours: { select: { tourId: true } },
        _count: { select: { registrations: true } },
      },
    });
    res.json(offers.map(serializeOfferAdmin));
  } catch (e) {
    next(e);
  }
});

offersRouter.post("/:id/register", authRequired, async (req, res, next) => {
  try {
    const offer = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { registrations: true } } },
    });

    if (!offer || !offer.isActive) {
      return res.status(404).json({ error: "Offer not found" });
    }

    if (offer._count.registrations >= offer.registrationCap) {
      return res.status(409).json({ error: "Offer registration cap reached" });
    }

    const reg = await prisma.offerRegistration.create({
      data: { offerId: offer.id, userId: req.user!.id },
    });

    res.status(201).json(reg);
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return res.status(409).json({ error: "Already registered" });
    }
    next(e);
  }
});

offersRouter.post("/", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const body = z
      .object({
        title: z.string(),
        description: z.string().optional(),
        imageUrl: optionalImageUrlSchema,
        rewardText: z.string(),
        registrationCap: z.number().int().positive(),
        validFrom: z.string().datetime(),
        validUntil: z.string().datetime(),
        tourPriceLkr: z.number().nonnegative(),
        discountedLkr: z.number().optional(),
        tourIds: z.array(z.string()).default([]),
      })
      .parse(req.body);

    const validFrom = new Date(body.validFrom);
    const validUntil = new Date(body.validUntil);
    if (validFrom.getTime() > validUntil.getTime()) {
      return res.status(400).json({ error: "validFrom must be before validUntil" });
    }
    if (body.discountedLkr != null && body.discountedLkr > body.tourPriceLkr) {
      return res.status(400).json({ error: "discountedLkr must be <= tourPriceLkr" });
    }

    const offer = await prisma.offer.create({
      data: {
        title: body.title,
        description: body.description,
        imageUrl: body.imageUrl,
        rewardText: body.rewardText,
        registrationCap: body.registrationCap,
        validFrom,
        validUntil,
        tourPriceLkr: body.tourPriceLkr,
        discountedLkr: body.discountedLkr,
        tours: { create: body.tourIds.map((tourId) => ({ tourId })) },
      },
    });

    const withMeta = await prisma.offer.findUniqueOrThrow({
      where: { id: offer.id },
      include: {
        tours: { select: { tourId: true } },
        _count: { select: { registrations: true } },
      },
    });
    res.status(201).json(serializeOfferAdmin(withMeta));
  } catch (e) {
    next(e);
  }
});

/** Admin: update an offer (including active flag and tour links). */
offersRouter.patch("/:id", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const body = z
      .object({
        title: z.string().optional(),
        description: z.string().nullable().optional(),
        imageUrl: optionalImageUrlSchema.optional(),
        rewardText: z.string().optional(),
        registrationCap: z.number().int().positive().optional(),
        validFrom: z.string().datetime().optional(),
        validUntil: z.string().datetime().optional(),
        tourPriceLkr: z.number().nonnegative().optional(),
        discountedLkr: z.number().nullable().optional(),
        isActive: z.boolean().optional(),
        tourIds: z.array(z.string()).optional(),
      })
      .parse(req.body);

    const existing = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: {
        tours: { select: { tourId: true } },
        _count: { select: { registrations: true } },
      },
    });
    if (!existing) return res.status(404).json({ error: "Offer not found" });

    const nextValidFrom = body.validFrom ? new Date(body.validFrom) : existing.validFrom;
    const nextValidUntil = body.validUntil ? new Date(body.validUntil) : existing.validUntil;
    if (nextValidFrom.getTime() > nextValidUntil.getTime()) {
      return res.status(400).json({ error: "validFrom must be before validUntil" });
    }

    const nextTourPrice = body.tourPriceLkr ?? Number(existing.tourPriceLkr);
    const nextDiscounted =
      body.discountedLkr === undefined
        ? existing.discountedLkr
        : body.discountedLkr === null
          ? null
          : body.discountedLkr;

    if (nextDiscounted != null && Number(nextDiscounted) > nextTourPrice) {
      return res.status(400).json({ error: "discountedLkr must be <= tourPriceLkr" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (body.tourIds) {
        await tx.offerTour.deleteMany({ where: { offerId: existing.id } });
        if (body.tourIds.length > 0) {
          await tx.offerTour.createMany({
            data: body.tourIds.map((tourId) => ({ offerId: existing.id, tourId })),
            skipDuplicates: true,
          });
        }
      }

      return await tx.offer.update({
        where: { id: existing.id },
        data: {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
          ...(body.rewardText !== undefined ? { rewardText: body.rewardText } : {}),
          ...(body.registrationCap !== undefined ? { registrationCap: body.registrationCap } : {}),
          ...(body.validFrom !== undefined ? { validFrom: nextValidFrom } : {}),
          ...(body.validUntil !== undefined ? { validUntil: nextValidUntil } : {}),
          ...(body.tourPriceLkr !== undefined ? { tourPriceLkr: body.tourPriceLkr } : {}),
          ...(body.discountedLkr !== undefined ? { discountedLkr: nextDiscounted } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
        include: {
          tours: { select: { tourId: true } },
          _count: { select: { registrations: true } },
        },
      });
    });

    res.json(serializeOfferAdmin(updated));
  } catch (e) {
    next(e);
  }
});

/** Admin: delete an offer. Cascades to tours + registrations via FK rules. */
offersRouter.delete("/:id", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const existing = await prisma.offer.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Offer not found" });

    await prisma.offer.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
