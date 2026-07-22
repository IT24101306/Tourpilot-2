import { Router } from "express";

import {
  DEFAULT_TOUR_COVER_URL,
  formatDisplayMoney,
  MAX_AGENCY_HERO_SLIDES,
  MEDIA,
  resolveImageUrl,
} from "@tourpilot/shared";

import { z } from "zod";

import { prisma } from "../lib/prisma.js";

import { authRequired, getAgencyForUser, requireRoles } from "../middleware/auth.js";

import { agencyHasFeature, requireAgencyFeature, serializeAgencyFeatures } from "../lib/agencyFeatures.js";

import { asJson } from "../utils/json.js";

import { storedImageUrlSchema, storedImageUrlWithFallback, optionalImageUrlSchema } from "../lib/imageUrlSchema.js";
import {
  buildSectionsPayload,
  enrichGalleryWithEntities,
  parseDisplayPayload,
  parseGallery,
  type DisplayPackage,
  type GalleryEntitySnapshot,
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
import { publicAgencyWhere } from "../lib/publicVisibility.js";
import { config } from "../lib/config.js";
import { promises as dns } from "node:dns";
import {
  applyCommissionRequestAction,
  getAgencyCommissionRequests,
} from "../services/commissionNegotiation.js";



export const agenciesRouter = Router();

/**
 * Strip internal-only metadata (e.g. site guide names, contact numbers, and
 * costs) before exposing an entity on public, traveler-facing responses.
 */
function publicEntityMetadata(metadata: unknown): Record<string, unknown> | null {
  const m = (metadata as Record<string, unknown> | null) ?? null;
  if (!m) return null;
  const clone = { ...m };
  delete clone.siteGuides;
  return clone;
}



const galleryItemSchema = z.object({
  url: storedImageUrlSchema,
  label: z.string().default("Gallery"),
  entityId: z.string().min(1).max(25),
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

const socialLinkSchema = z.object({
  platform: z.string().min(1),
  url: z.string().min(1),
  label: z.string().optional(),
});

const whoWeAreImageSchema = z.object({
  url: storedImageUrlSchema,
  label: z.string().optional(),
  alt: z.string().optional(),
});

const transportOptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  variant: z.string().optional(),
  description: z.string().default(""),
  seating: z.string().default(""),
  luggage: z.string().default(""),
});

const contentSchema = z.object({

  heroHeadline: z.string(),

  heroSubheadline: z.string().default(""),

  heroImages: z
    .array(heroSlideSchema)
    .max(MAX_AGENCY_HERO_SLIDES, `You can add up to ${MAX_AGENCY_HERO_SLIDES} hero slides`)
    .default([]),

  whoWeAreTitle: z.string().default("WHO WE ARE"),

  whoWeAreDescription: z.string().default(""),

  whoWeAreSocialLinks: z.array(socialLinkSchema).max(12).default([]),

  socialTagHandle: z.string().max(80).default(""),

  whoWeAreImages: z.array(whoWeAreImageSchema).max(8).default([]),

  packagesTitle: z.string(),

  packagesSubtitle: z.string(),

  ratingScore: z.string(),

  ratingSuffix: z.string(),

  highlights: z.array(z.string()).max(6),

  ctaLabel: z.string(),

  featuredImageUrl: storedImageUrlWithFallback(MEDIA.hero),

  featuredQuote: z.string(),

  packages: z.array(packageSchema).default([]),

  offers: z.array(offerSchema).default([]),

  transportOptions: z.array(transportOptionSchema).max(12).default([]),

  offerBannerStyle: z.enum(["card", "strip"]).default("card"),

});



const enabledSchema = z.object({

  branding: z.boolean().default(true),

  whoWeAre: z.boolean().default(true),

  tours: z.boolean(),

  showcase: z.boolean(),

  reviews: z.boolean(),

  gallery: z.boolean(),

  offers: z.boolean(),

  inquiry: z.boolean(),

  transport: z.boolean().default(true),

});



agenciesRouter.get("/", async (_req, res, next) => {

  try {

    const agencies = await prisma.agency.findMany({

      where: publicAgencyWhere(),

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

        logoUrl: optionalImageUrlSchema,

        coverUrl: optionalImageUrlSchema,

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

type DomainAgency = {
  customDomain: string | null;
  customDomainStatus: string;
  customDomainVerifiedAt: Date | null;
};

function normalizeDomainInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
    .split(":")[0];
}

const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

function serializeDomain(agency: DomainAgency) {
  const { aTarget, cnameTarget } = config.customDomain;
  return {
    domain: agency.customDomain,
    status: agency.customDomainStatus,
    verifiedAt: agency.customDomainVerifiedAt,
    instructions: {
      aRecord: aTarget
        ? { type: "A", host: "@", value: aTarget }
        : null,
      cname: cnameTarget
        ? { type: "CNAME", host: "www", value: cnameTarget }
        : null,
    },
  };
}

agenciesRouter.get(
  "/mine/domain",
  authRequired,
  requireRoles("AGENCY"),
  requireAgencyFeature("customDomain"),
  async (req, res, next) => {
    try {
      const agency = await getAgencyForUser(req.user!.id);
      if (!agency) return res.status(404).json({ error: "Agency not found" });
      res.json(serializeDomain(agency));
    } catch (e) {
      next(e);
    }
  }
);

agenciesRouter.post(
  "/mine/domain",
  authRequired,
  requireRoles("AGENCY"),
  requireAgencyFeature("customDomain"),
  async (req, res, next) => {
    try {
      const agency = await getAgencyForUser(req.user!.id);
      if (!agency) return res.status(404).json({ error: "Agency not found" });

      const body = z.object({ domain: z.string().min(1) }).parse(req.body);
      const domain = normalizeDomainInput(body.domain);

      if (!HOSTNAME_RE.test(domain)) {
        return res.status(400).json({ error: "Enter a valid domain, e.g. myagency.com" });
      }
      const bare = domain.replace(/^www\./, "");
      if (config.customDomain.platformDomains.includes(bare)) {
        return res.status(400).json({ error: "That domain belongs to the platform." });
      }

      const taken = await prisma.agency.findFirst({
        where: { customDomain: domain, NOT: { id: agency.id } },
        select: { id: true },
      });
      if (taken) {
        return res.status(409).json({ error: "That domain is already connected to another agency." });
      }

      const updated = await prisma.agency.update({
        where: { id: agency.id },
        data: {
          customDomain: domain,
          customDomainStatus: "PENDING",
          customDomainVerifiedAt: null,
        },
      });
      res.json(serializeDomain(updated));
    } catch (e) {
      next(e);
    }
  }
);

agenciesRouter.post(
  "/mine/domain/verify",
  authRequired,
  requireRoles("AGENCY"),
  requireAgencyFeature("customDomain"),
  async (req, res, next) => {
    try {
      const agency = await getAgencyForUser(req.user!.id);
      if (!agency) return res.status(404).json({ error: "Agency not found" });
      if (!agency.customDomain) {
        return res.status(400).json({ error: "Add a domain before verifying." });
      }

      const { aTarget, cnameTarget } = config.customDomain;
      const host = agency.customDomain;

      const addrs = await dns.resolve4(host).catch(() => [] as string[]);
      let ok = false;
      if (aTarget && addrs.includes(aTarget)) {
        ok = true;
      } else if (cnameTarget) {
        const cnames = await dns.resolveCname(host).catch(() => [] as string[]);
        ok = cnames.some((c) => c.replace(/\.$/, "").toLowerCase() === cnameTarget.toLowerCase());
      }

      if (!ok) {
        await prisma.agency.update({
          where: { id: agency.id },
          data: { customDomainStatus: "ERROR", customDomainVerifiedAt: null },
        });
        const expected = aTarget
          ? `an A record pointing to ${aTarget}`
          : cnameTarget
            ? `a CNAME pointing to ${cnameTarget}`
            : "the DNS record we provided";
        return res.status(400).json({
          error: `DNS is not pointing here yet. Add ${expected}, then verify again. DNS changes can take a while to propagate.`,
          resolved: addrs,
        });
      }

      const updated = await prisma.agency.update({
        where: { id: agency.id },
        data: { customDomainStatus: "ACTIVE", customDomainVerifiedAt: new Date() },
      });
      res.json(serializeDomain(updated));
    } catch (e) {
      next(e);
    }
  }
);

agenciesRouter.delete(
  "/mine/domain",
  authRequired,
  requireRoles("AGENCY"),
  requireAgencyFeature("customDomain"),
  async (req, res, next) => {
    try {
      const agency = await getAgencyForUser(req.user!.id);
      if (!agency) return res.status(404).json({ error: "Agency not found" });
      const updated = await prisma.agency.update({
        where: { id: agency.id },
        data: {
          customDomain: null,
          customDomainStatus: "NONE",
          customDomainVerifiedAt: null,
        },
      });
      res.json(serializeDomain(updated));
    } catch (e) {
      next(e);
    }
  }
);



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



agenciesRouter.put(
  "/mine/display",
  authRequired,
  requireRoles("AGENCY"),
  requireAgencyFeature("display"),
  async (req, res, next) => {

  try {

    const agency = await getAgencyForUser(req.user!.id);

    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const requestBody =
      req.body && typeof req.body === "object"
        ? {
            ...(req.body as Record<string, unknown>),
            gallery: Array.isArray((req.body as { gallery?: unknown }).gallery)
              ? (req.body as { gallery: unknown[] }).gallery.filter((entry) => {
                  if (!entry || typeof entry !== "object") return false;
                  const row = entry as Record<string, unknown>;
                  return Boolean(String(row.entityId || "").trim());
                })
              : [],
          }
        : req.body;

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

      .parse(requestBody);



    const galleryItems = body.gallery
      .map((g) => ({
        url: g.url.trim(),
        label: g.label.trim() || "Gallery",
        entityId: g.entityId.trim(),
      }))
      .filter((g) => g.url && g.entityId);

    const galleryEntityIds = [...new Set(galleryItems.map((g) => g.entityId))];
    if (galleryEntityIds.length > 0) {
      const ownedCount = await prisma.entity.count({
        where: { agencyId: agency.id, id: { in: galleryEntityIds } },
      });
      if (ownedCount !== galleryEntityIds.length) {
        return res.status(400).json({
          error: "Each gallery image must link to one of your catalog entities.",
        });
      }
    }



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

      include: {
        reviews: { where: { isVisible: true }, orderBy: { createdAt: "desc" } },
        displaySettings: true,
      },

    });



    const withPct = await prisma.agency.findUniqueOrThrow({
      where: { id: agency.id },
      select: { influencerCommissionPct: true },
    });

    const savedDisplay = parseDisplayPayload(updated.displaySettings?.sections);

    res.json({

      slug: updated.slug,

      logoUrl: updated.logoUrl,

      coverUrl: updated.coverUrl,

      influencerCommissionPct: Number(withPct.influencerCommissionPct),

      enabled: savedDisplay.enabled,

      content: savedDisplay.content,

      gallery: galleryItems,

      reviews: updated.reviews.map((r) => ({

        id: r.id,

        authorName: r.authorName,

        rating: r.rating,

        body: r.body || "",

      })),

    });

  } catch (e) {

    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message || "Invalid display settings" });
    }
    next(e);

  }

});

agenciesRouter.get("/mine/offers", authRequired, requireRoles("AGENCY"), requireAgencyFeature("offers"), async (req, res, next) => {
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

agenciesRouter.post("/mine/offers", authRequired, requireRoles("AGENCY"), requireAgencyFeature("offers"), async (req, res, next) => {
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
        offerMonth: body.offerMonth ?? null,
        rewardTiers: body.rewardTiers ?? [],
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
  requireRoles("AGENCY"), requireAgencyFeature("offers"),
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
  requireRoles("AGENCY"), requireAgencyFeature("offers"),
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
  requireRoles("AGENCY"), requireAgencyFeature("offers"),
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

agenciesRouter.get(
  "/mine/influencer-commission-requests",
  authRequired,
  requireRoles("AGENCY"), requireAgencyFeature("driversAndPartners"),
  async (req, res, next) => {
    try {
      const agency = await getAgencyForUser(req.user!.id);
      if (!agency) return res.status(404).json({ error: "Agency not found" });

      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      res.json(await getAgencyCommissionRequests(agency.id, status));
    } catch (e) {
      next(e);
    }
  }
);

agenciesRouter.patch(
  "/mine/influencer-commission-requests/:id",
  authRequired,
  requireRoles("AGENCY"), requireAgencyFeature("driversAndPartners"),
  async (req, res, next) => {
    try {
      const agency = await getAgencyForUser(req.user!.id);
      if (!agency) return res.status(404).json({ error: "Agency not found" });

      const body = z
        .object({
          action: z.enum(["AGREE", "REJECT", "NEGOTIATE"]),
          proposedPct: z.number().min(0).max(50).optional(),
          message: z.string().max(2000).optional(),
        })
        .parse(req.body);

      const row = await prisma.influencerCommissionRequest.findFirst({
        where: { id: req.params.id, agencyId: agency.id },
        select: { id: true },
      });
      if (!row) return res.status(404).json({ error: "Request not found" });

      const updated = await applyCommissionRequestAction({
        requestId: row.id,
        actorRole: "AGENCY",
        actorUserId: req.user!.id,
        action: body.action,
        proposedPct: body.proposedPct,
        body: body.message,
        agencyName: agency.name,
      });

      res.json(updated);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status) return res.status(err.status).json({ error: err.message });
      if (e instanceof z.ZodError) {
        return res.status(400).json({ error: e.errors[0]?.message || "Invalid input" });
      }
      next(e);
    }
  }
);

agenciesRouter.get("/:slug/headless-config", async (req, res, next) => {
  try {
    const agency = await prisma.agency.findFirst({
      where: { slug: req.params.slug, ...publicAgencyWhere() },
      select: {
        id: true,
        name: true,
        slug: true,
        featureDriversAndPartners: true,
        featureSupport: true,
        featureWalletTopup: true,
        featureOffers: true,
        featureDisplay: true,
        featureReadyMadeTours: true,
        featureCustomInquiries: true,
        featureNegotiationsBookings: true,
        featureCustomDomain: true,
        featureExternalStorefront: true,
      },
    });
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const features = serializeAgencyFeatures(agency);
    const webAppUrl = config.webAppUrl;
    // Prefer public absolute API base from WEB_APP_URL (same origin /api in prod).
    const apiBase = `${webAppUrl}/api`;

    res.json({
      agencyId: agency.id,
      slug: agency.slug,
      name: agency.name,
      apiBase,
      webAppUrl,
      features,
      entitled: features.externalStorefront,
      tripRoomUrlTemplate: `${webAppUrl}/trips?room={inquiryId}`,
      endpoints: {
        agency: `${apiBase}/agencies/${agency.slug}`,
        headlessConfig: `${apiBase}/agencies/${agency.slug}/headless-config`,
        tourPublic: `${apiBase}/tours/public/${agency.slug}/:tourSlug`,
        entitiesPublic: `${apiBase}/entities/public/${agency.slug}`,
        loginStart: `${apiBase}/auth/login-start`,
        verifyOtp: `${apiBase}/auth/verify-otp`,
        registerRequest: `${apiBase}/auth/register-request`,
        verifyRegistration: `${apiBase}/auth/verify-registration`,
        me: `${apiBase}/auth/me`,
        createInquiry: `${apiBase}/inquiries`,
      },
    });
  } catch (e) {
    next(e);
  }
});

agenciesRouter.get("/:slug", async (req, res, next) => {

  try {

    const agency = await prisma.agency.findFirst({

      where: { slug: req.params.slug, ...publicAgencyWhere() },

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

    const features = {
      readyMadeTours: agencyHasFeature(agency, "readyMadeTours"),
      customInquiries: agencyHasFeature(agency, "customInquiries"),
      negotiationsBookings: agencyHasFeature(agency, "negotiationsBookings"),
      offers: agencyHasFeature(agency, "offers"),
      display: agencyHasFeature(agency, "display"),
    };

    // Display / packages / offers stay visible to travelers even when the agency
    // feature is off (they just can't manage them). Inquiry/booking actions are gated separately.
    const publicTours = agency.tours;

    const display = parseDisplayPayload(agency.displaySettings?.sections);

    const rawGallery = parseGallery(agency.gallery);
    const galleryEntityIds = [...new Set(rawGallery.map((g) => g.entityId))];

    const galleryEntities =
      galleryEntityIds.length > 0
        ? await prisma.entity.findMany({
            where: { agencyId: agency.id, id: { in: galleryEntityIds } },
          })
        : [];

    const galleryEntityMap = new Map<string, GalleryEntitySnapshot>(
      galleryEntities.map((entity) => [
        entity.id,
        {
          id: entity.id,
          name: entity.name,
          type: entity.type,
          city: entity.city,
          district: entity.district,
          description: entity.description,
          durationMin: entity.durationMin,
          priceHint: entity.priceHint != null ? Number(entity.priceHint) : null,
          media: entity.media,
          metadata: publicEntityMetadata(entity.metadata),
        },
      ])
    );

    const gallery = enrichGalleryWithEntities(rawGallery, galleryEntityMap);

    const packages = resolvePackages(
      display.content.packages,
      publicTours,
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

      tours: publicTours.map((t) =>
        serializeTourCard(t, Number(agency.influencerCommissionPct))
      ),

      reviews: agency.reviews,

      display: { enabled: display.enabled, content: { ...display.content, packages } },

      gallery,

      loyaltyOffers: loyaltyOffers.map(serializeActiveOffer),

      features,

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
      priceLabel: `${formatDisplayMoney(attachTourPricing(t, commissionPct).publicPriceLkr, "USD")} / per person`,
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


