import { Router } from "express";

import { DEFAULT_TOUR_COVER_URL, resolveImageUrl } from "@tourpilot/shared";

import { z } from "zod";

import { prisma } from "../lib/prisma.js";

import { authRequired, getAgencyForUser, requireRoles } from "../middleware/auth.js";

import { asJson } from "../utils/json.js";

import { storedImageUrlSchema } from "../lib/imageUrlSchema.js";
import {
  buildSectionsPayload,
  parseDisplayPayload,
  parseGallery,
  type DisplayPackage,
} from "../lib/displaySettings.js";
import {
  agencyOfferWhere,
  assertToursBelongToAgency,
  offerCreateBodySchema,
  offerIncludeActive,
  offerIncludeAdmin,
  offerUpdateBodySchema,
  serializeActiveOffer,
  serializeOfferAdmin,
  validateDiscount,
  validateOfferDates,
} from "../lib/offers.js";
import { applyOfferUpdate } from "../lib/offers.js";
import { attachTourPricing } from "../lib/tourPricing.js";



export const agenciesRouter = Router();



const galleryItemSchema = z.object({
  url: storedImageUrlSchema,
  label: z.string().default("Gallery"),
});



const packageSchema = z.object({

  title: z.string().min(1),

  location: z.string().default(""),

  priceLabel: z.string().default(""),

  imageUrl: storedImageUrlSchema,

  tourId: z.string().optional(),

});



const offerSchema = z.object({

  title: z.string().min(1),

  description: z.string().default(""),

  priceLabel: z.string().default(""),

  badge: z.string().optional(),

  imageUrl: storedImageUrlSchema.optional(),

});



const heroSlideSchema = z.object({
  url: storedImageUrlSchema,
  label: z.string().optional(),
});

const contentSchema = z.object({

  heroHeadline: z.string(),

  heroSubheadline: z.string().default(""),

  heroImages: z.array(heroSlideSchema).max(12).default([]),

  packagesTitle: z.string(),

  packagesSubtitle: z.string(),

  ratingScore: z.string(),

  ratingSuffix: z.string(),

  highlights: z.array(z.string()).max(6),

  ctaLabel: z.string(),

  featuredImageUrl: storedImageUrlSchema,

  featuredQuote: z.string(),

  packages: z.array(packageSchema).default([]),

  offers: z.array(offerSchema).default([]),

});



const enabledSchema = z.object({

  tours: z.boolean(),

  showcase: z.boolean(),

  reviews: z.boolean(),

  gallery: z.boolean(),

  offers: z.boolean(),

  inquiry: z.boolean(),

});



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

        influencerCommissionPct: z.number().min(0).max(50).optional(),

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

        ...(body.influencerCommissionPct !== undefined
          ? { influencerCommissionPct: body.influencerCommissionPct }
          : {}),

      },

    });



    res.json(updated);

  } catch (e) {

    next(e);

  }

});



agenciesRouter.get("/mine/display", authRequired, requireRoles("AGENCY"), async (req, res, next) => {

  try {

    const agency = await getAgencyForUser(req.user!.id);

    if (!agency) return res.status(404).json({ error: "Agency not found" });



    const full = await prisma.agency.findUniqueOrThrow({

      where: { id: agency.id },

      include: {

        displaySettings: true,

        reviews: { where: { isVisible: true }, orderBy: { createdAt: "desc" } },

        tours: {

          where: { isPublished: true },

          select: {

            id: true,

            title: true,

            slug: true,

            days: true,

            summary: true,

            basePriceLkr: true,

            coverUrl: true,

            districtTags: true,

          },

        },

      },

    });



    const display = parseDisplayPayload(full.displaySettings?.sections);



    res.json({

      slug: full.slug,

      logoUrl: full.logoUrl,

      coverUrl: full.coverUrl,

      influencerCommissionPct: Number(full.influencerCommissionPct),

      enabled: display.enabled,

      content: display.content,

      gallery: parseGallery(full.gallery),

      reviews: full.reviews.map((r) => ({

        id: r.id,

        authorName: r.authorName,

        rating: r.rating,

        body: r.body || "",

      })),

      publishedTours: full.tours.map((t) => {
        const pricing = attachTourPricing(t, Number(full.influencerCommissionPct));
        return {
        id: t.id,

        title: t.title,

        slug: t.slug,

        days: t.days,

        summary: t.summary,

        ...pricing,

        coverUrl: t.coverUrl,

        districtTags: t.districtTags,

      };
      }),

    });

  } catch (e) {

    next(e);

  }

});



agenciesRouter.put("/mine/display", authRequired, requireRoles("AGENCY"), async (req, res, next) => {

  try {

    const agency = await getAgencyForUser(req.user!.id);

    if (!agency) return res.status(404).json({ error: "Agency not found" });



    const body = z

      .object({

        enabled: enabledSchema,

        content: contentSchema,

        gallery: z.array(galleryItemSchema).default([]),

        reviews: z

          .array(

            z.object({

              authorName: z.string().min(1),

              rating: z.number().int().min(1).max(5),

              body: z.string().optional(),

            })

          )

          .default([]),

        influencerCommissionPct: z.number().min(0).max(50).optional(),

        logoUrl: storedImageUrlSchema.optional(),

      })

      .parse(req.body);



    const galleryItems = body.gallery

      .map((g) => ({ url: g.url.trim(), label: g.label.trim() || "Gallery" }))

      .filter((g) => g.url);



    await prisma.$transaction(async (tx) => {

      await tx.displaySettings.upsert({

        where: { agencyId: agency.id },

        create: {

          agencyId: agency.id,

          sections: asJson(buildSectionsPayload(body.enabled, body.content)),

          theme: asJson({}),

        },

        update: {

          sections: asJson(buildSectionsPayload(body.enabled, body.content)),

        },

      });



      const firstHeroUrl = body.content.heroImages[0]?.url?.trim();

      await tx.agency.update({

        where: { id: agency.id },

        data: {
          gallery: asJson(galleryItems),
          ...(body.influencerCommissionPct !== undefined
            ? { influencerCommissionPct: body.influencerCommissionPct }
            : {}),
          ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
          ...(firstHeroUrl ? { coverUrl: firstHeroUrl } : {}),
        },

      });



      await tx.review.deleteMany({ where: { agencyId: agency.id } });

      if (body.reviews.length > 0) {

        await tx.review.createMany({

          data: body.reviews.map((r) => ({

            agencyId: agency.id,

            authorName: r.authorName.trim(),

            rating: r.rating,

            body: r.body?.trim() || null,

            isVisible: true,

          })),

        });

      }



      const count = body.reviews.length;

      const avg =

        count > 0 ? body.reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;

      await tx.agency.update({

        where: { id: agency.id },

        data: { reviewCount: count, avgRating: count > 0 ? avg : 0 },

      });

    });



    const updated = await prisma.agency.findUniqueOrThrow({

      where: { id: agency.id },

      include: { reviews: { where: { isVisible: true }, orderBy: { createdAt: "desc" } } },

    });



    const withPct = await prisma.agency.findUniqueOrThrow({
      where: { id: agency.id },
      select: { influencerCommissionPct: true },
    });

    res.json({

      slug: updated.slug,

      logoUrl: updated.logoUrl,

      coverUrl: updated.coverUrl,

      influencerCommissionPct: Number(withPct.influencerCommissionPct),

      enabled: body.enabled,

      content: body.content,

      gallery: galleryItems,

      reviews: updated.reviews.map((r) => ({

        id: r.id,

        authorName: r.authorName,

        rating: r.rating,

        body: r.body || "",

      })),

    });

  } catch (e) {

    next(e);

  }

});

agenciesRouter.get("/mine/offers", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const offers = await prisma.offer.findMany({
      where: agencyOfferWhere(agency.id),
      orderBy: { createdAt: "desc" },
      include: offerIncludeAdmin,
    });
    res.json(offers.map(serializeOfferAdmin));
  } catch (e) {
    next(e);
  }
});

agenciesRouter.post("/mine/offers", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const body = offerCreateBodySchema.parse(req.body);
    const tourErr = await assertToursBelongToAgency(agency.id, body.tourIds);
    if (tourErr) return res.status(400).json({ error: tourErr });

    const validFrom = new Date(body.validFrom);
    const validUntil = new Date(body.validUntil);
    const dateErr = validateOfferDates(validFrom, validUntil);
    if (dateErr) return res.status(400).json({ error: dateErr });

    const discountErr = validateDiscount(body.tourPriceLkr, body.discountedLkr);
    if (discountErr) return res.status(400).json({ error: discountErr });

    const offer = await prisma.offer.create({
      data: {
        agencyId: agency.id,
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
      include: offerIncludeAdmin,
    });
    res.status(201).json(serializeOfferAdmin(withMeta));
  } catch (e) {
    next(e);
  }
});

agenciesRouter.patch(
  "/mine/offers/:id",
  authRequired,
  requireRoles("AGENCY"),
  async (req, res, next) => {
    try {
      const agency = await getAgencyForUser(req.user!.id);
      if (!agency) return res.status(404).json({ error: "Agency not found" });

      const existing = await prisma.offer.findUnique({
        where: { id: req.params.id },
        include: offerIncludeAdmin,
      });
      if (!existing || existing.agencyId !== agency.id) {
        return res.status(404).json({ error: "Offer not found" });
      }

      const body = offerUpdateBodySchema.parse(req.body);
      if (body.tourIds) {
        const tourErr = await assertToursBelongToAgency(agency.id, body.tourIds);
        if (tourErr) return res.status(400).json({ error: tourErr });
      }

      try {
        const updated = await applyOfferUpdate(existing, body);
        res.json(serializeOfferAdmin(updated));
      } catch (e) {
        const err = e as Error & { status?: number };
        if (err.status === 400) return res.status(400).json({ error: err.message });
        throw e;
      }
    } catch (e) {
      next(e);
    }
  }
);

agenciesRouter.delete(
  "/mine/offers/:id",
  authRequired,
  requireRoles("AGENCY"),
  async (req, res, next) => {
    try {
      const agency = await getAgencyForUser(req.user!.id);
      if (!agency) return res.status(404).json({ error: "Agency not found" });

      const existing = await prisma.offer.findUnique({ where: { id: req.params.id } });
      if (!existing || existing.agencyId !== agency.id) {
        return res.status(404).json({ error: "Offer not found" });
      }

      await prisma.offer.delete({ where: { id: existing.id } });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

agenciesRouter.get(
  "/mine/offers/:id/registrations",
  authRequired,
  requireRoles("AGENCY"),
  async (req, res, next) => {
    try {
      const agency = await getAgencyForUser(req.user!.id);
      if (!agency) return res.status(404).json({ error: "Agency not found" });

      const offer = await prisma.offer.findFirst({
        where: { id: req.params.id, agencyId: agency.id },
      });
      if (!offer) return res.status(404).json({ error: "Offer not found" });

      const regs = await prisma.offerRegistration.findMany({
        where: { offerId: offer.id },
        include: { user: { select: { id: true, name: true, phone: true, createdAt: true } } },
        orderBy: { createdAt: "desc" },
      });
      res.json(regs);
    } catch (e) {
      next(e);
    }
  }
);

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



    const display = parseDisplayPayload(agency.displaySettings?.sections);

    const gallery = parseGallery(agency.gallery);

    const packages = resolvePackages(
      display.content.packages,
      agency.tours,
      Number(agency.influencerCommissionPct)
    );

    const now = new Date();
    const loyaltyOffers = await prisma.offer.findMany({
      where: {
        ...agencyOfferWhere(agency.id),
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
      include: offerIncludeActive,
      orderBy: { validUntil: "asc" },
    });

    res.json({

      id: agency.id,

      name: agency.name,

      slug: agency.slug,

      tagline: agency.tagline,

      description: agency.description,

      logoUrl: agency.logoUrl,

      coverUrl: agency.coverUrl,

      district: agency.district,

      avgRating: Number(agency.avgRating),

      reviewCount: agency.reviewCount,

      tours: agency.tours.map((t) =>
        serializeTourCard(t, Number(agency.influencerCommissionPct))
      ),

      reviews: agency.reviews,

      display: { enabled: display.enabled, content: { ...display.content, packages } },

      gallery,

      loyaltyOffers: loyaltyOffers.map(serializeActiveOffer),

    });

  } catch (e) {

    next(e);

  }

});



function resolvePackages(
  custom: DisplayPackage[],
  tours: {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    days: number;
    basePriceLkr: unknown;
    coverUrl: string | null;
    districtTags: unknown;
  }[],
  commissionPct: number
): DisplayPackage[] {
  const tourById = new Map(tours.map((t) => [t.id, t]));

  if (custom.length > 0) {
    return custom.map((p) => {
      const tour = p.tourId ? tourById.get(p.tourId) : undefined;
      return {
        ...p,
        imageUrl: resolveImageUrl(p.imageUrl?.trim() || tour?.coverUrl, DEFAULT_TOUR_COVER_URL),
        tourId: p.tourId || tour?.id,
      };
    });
  }

  return tours.map((t) => {
    const districts = Array.isArray(t.districtTags)
      ? (t.districtTags as string[]).filter(Boolean)
      : [];
    return {
      title: t.title,
      location: districts[0] || `${t.days} day tour`,
      priceLabel: `LKR ${attachTourPricing(t, commissionPct).publicPriceLkr.toLocaleString()} / per person`,
      imageUrl: resolveImageUrl(t.coverUrl, DEFAULT_TOUR_COVER_URL),
      tourId: t.id,
    };
  });
}



export function serializeTourCard(
  tour: {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    days: number;
    basePriceLkr: unknown;
    coverUrl: string | null;
    seasonTag: string | null;
    districtTags: unknown;
  },
  commissionPct: number
) {
  const pricing = attachTourPricing(tour, commissionPct);

  return {

    id: tour.id,

    title: tour.title,

    slug: tour.slug,

    summary: tour.summary,

    days: tour.days,

    basePriceLkr: pricing.publicPriceLkr,

    publicPriceLkr: pricing.publicPriceLkr,

    coverUrl: tour.coverUrl,

    seasonTag: tour.seasonTag,

    districtTags: tour.districtTags,

  };

}


