import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { buildDisplayPayload, parseInfluencerDisplay, pruneTourSettings } from "../lib/influencerDisplay.js";
import {
  resolveInfluencerTourCommissionPct,
} from "../lib/influencerCommissionRequests.js";
import {
  applyCommissionRequestAction,
  createCommissionRequest,
  getInfluencerCommissionRequests,
} from "../services/commissionNegotiation.js";
import { ensureUniqueInfluencerSlug } from "../lib/influencerSlug.js";
import {
  agencyActiveOfferWhere,
  loadActiveOffers,
  serializeActiveOffer,
} from "../lib/offers.js";
import { attachTourPricing } from "../lib/tourPricing.js";
import { buildReferralSharePath, buildReferralShareUrl, publicWebOrigin } from "../lib/referralShare.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { config } from "../lib/config.js";
import {
  dnsExpectedHint,
  HOSTNAME_RE,
  isDomainTaken,
  normalizeDomainInput,
  serializeDomain,
  verifyDomainDns,
} from "../lib/customDomain.js";

export const influencerRouter = Router();

function serializeTour(tour: {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  days: number;
  tourKind: string;
  basePriceLkr: unknown;
  coverUrl: string | null;
  seasonTag: string | null;
  agency: { id: string; name: string; slug: string; influencerCommissionPct?: unknown };
}) {
  const pricing = attachTourPricing(tour);
  return {
    id: tour.id,
    title: tour.title,
    slug: tour.slug,
    summary: tour.summary,
    days: tour.days,
    tourKind: tour.tourKind,
    ...pricing,
    coverUrl: tour.coverUrl,
    seasonTag: tour.seasonTag,
    agency: tour.agency,
  };
}

function serializeCode(
  code: {
    id: string;
    code: string;
    commissionPct: unknown;
    clickCount: number;
    isActive: boolean;
    createdAt: Date;
    tour: Parameters<typeof serializeTour>[0] | null;
    _count: { inquiries: number; commissions: number };
  },
  origin?: string
) {
  const tour = code.tour ? serializeTour(code.tour) : null;
  return {
    id: code.id,
    code: code.code,
    clickCount: code.clickCount,
    isActive: code.isActive,
    createdAt: code.createdAt,
    tour,
    inquiryCount: code._count.inquiries,
    commissionCount: code._count.commissions,
    sharePath: `${buildReferralSharePath(tour)}?ref=${code.code}`,
    shareUrl: origin ? buildReferralShareUrl(origin, tour, code.code) : undefined,
  };
}

influencerRouter.get("/dashboard", authRequired, requireRoles("INFLUENCER"), async (req, res, next) => {
  try {
    const profile = await prisma.influencerProfile.findUnique({
      where: { userId: req.user!.id },
      include: {
        user: { select: { name: true, walletBalance: true, email: true } },
        codes: {
          include: {
            tour: {
              include: {
                agency: { select: { id: true, name: true, slug: true, influencerCommissionPct: true } },
              },
            },
            _count: { select: { inquiries: true, commissions: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        commissions: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            inquiry: {
              select: {
                id: true,
                status: true,
                tourist: { select: { name: true } },
              },
            },
            referralCode: { select: { code: true } },
          },
        },
      },
    });

    if (!profile) return res.status(404).json({ error: "Profile not found" });

    const origin = publicWebOrigin(req);

    const [earnedAgg, pendingAgg, paidAgg, clicksAgg] = await Promise.all([
      prisma.commission.aggregate({
        where: { influencerId: profile.id, status: { in: ["APPROVED", "PAID"] } },
        _sum: { amountLkr: true },
      }),
      prisma.commission.aggregate({
        where: { influencerId: profile.id, status: "PENDING" },
        _sum: { amountLkr: true },
      }),
      prisma.commission.aggregate({
        where: { influencerId: profile.id, status: "PAID" },
        _sum: { amountLkr: true },
      }),
      prisma.referralCode.aggregate({
        where: { influencerId: profile.id },
        _sum: { clickCount: true },
      }),
    ]);

    const codes = profile.codes.map((c) => serializeCode(c, origin));
    const totalInquiries = codes.reduce((sum, c) => sum + c.inquiryCount, 0);

    res.json({
      profile: {
        id: profile.id,
        name: profile.user.name,
        bio: profile.bio,
        walletBalance: Number(profile.user.walletBalance),
      },
      stats: {
        totalEarned: Number(earnedAgg._sum.amountLkr ?? 0),
        pendingCommission: Number(pendingAgg._sum.amountLkr ?? 0),
        paidToWallet: Number(paidAgg._sum.amountLkr ?? 0),
        walletBalance: Number(profile.user.walletBalance),
        totalClicks: Number(clicksAgg._sum.clickCount ?? 0),
        activeCodes: codes.filter((c) => c.isActive).length,
        totalInquiries,
      },
      codes,
      commissions: profile.commissions.map((c) => ({
        id: c.id,
        amountLkr: Number(c.amountLkr),
        status: c.status,
        createdAt: c.createdAt,
        code: c.referralCode.code,
        inquiry: c.inquiry,
      })),
    });
  } catch (e) {
    next(e);
  }
});

influencerRouter.post("/codes", authRequired, requireRoles("INFLUENCER"), async (req, res, next) => {
  try {
    const profile = await prisma.influencerProfile.findUniqueOrThrow({
      where: { userId: req.user!.id },
    });

    const body = z
      .object({
        tourId: z.string().min(1, "Select a ready-made tour to promote"),
        code: z.string().min(4).max(20).optional(),
      })
      .parse(req.body);

    const tour = await prisma.tour.findFirst({
      where: {
        id: body.tourId,
        isPublished: true,
        tourKind: "READY_MADE",
      },
      include: { agency: { select: { id: true, name: true, slug: true, influencerCommissionPct: true } } },
    });

    if (!tour) {
      return res.status(400).json({ error: "Tour not found or not available for promotion" });
    }

    const tourCommissionPct = await resolveInfluencerTourCommissionPct(profile.id, tour);

    const existingForTour = await prisma.referralCode.findFirst({
      where: { influencerId: profile.id, tourId: tour.id, isActive: true },
    });

    const codeValue =
      body.code?.toUpperCase().replace(/[^A-Z0-9]/g, "") ||
      `TP${tour.slug.slice(0, 4).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const origin = publicWebOrigin(req);

    if (existingForTour) {
      if (body.code) {
        const taken = await prisma.referralCode.findFirst({
          where: { code: codeValue, NOT: { id: existingForTour.id } },
        });
        if (taken) {
          return res.status(409).json({ error: "This code is already taken. Choose another." });
        }
      }

      const updated = await prisma.referralCode.update({
        where: { id: existingForTour.id },
        data: {
          ...(body.code ? { code: codeValue } : {}),
          commissionPct: tourCommissionPct,
        },
        include: {
          tour: {
            include: { agency: { select: { id: true, name: true, slug: true, influencerCommissionPct: true } } },
          },
          _count: { select: { inquiries: true, commissions: true } },
        },
      });
      return res.json(serializeCode(updated, origin));
    }

    const taken = await prisma.referralCode.findUnique({ where: { code: codeValue } });
    if (taken) {
      return res.status(409).json({ error: "This code is already taken. Choose another." });
    }

    const created = await prisma.referralCode.create({
      data: {
        influencerId: profile.id,
        tourId: tour.id,
        code: codeValue,
        commissionPct: tourCommissionPct,
      },
      include: {
        tour: {
          include: { agency: { select: { id: true, name: true, slug: true, influencerCommissionPct: true } } },
        },
        _count: { select: { inquiries: true, commissions: true } },
      },
    });

    res.status(201).json(serializeCode(created, origin));
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message || "Invalid input" });
    }
    next(e);
  }
});

async function getInfluencerProfileForUser(userId: string) {
  let profile = await prisma.influencerProfile.findUnique({
    where: { userId },
    include: { user: { select: { name: true } } },
  });
  if (!profile) return null;

  if (!profile.slug) {
    const slug = await ensureUniqueInfluencerSlug(prisma, profile.user.name, profile.id);
    profile = await prisma.influencerProfile.update({
      where: { id: profile.id },
      data: { slug },
      include: { user: { select: { name: true } } },
    });
  }
  return profile;
}

influencerRouter.get("/mine/domain", authRequired, requireRoles("INFLUENCER"), async (req, res, next) => {
  try {
    const profile = await getInfluencerProfileForUser(req.user!.id);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.json(serializeDomain(profile));
  } catch (e) {
    next(e);
  }
});

influencerRouter.post("/mine/domain", authRequired, requireRoles("INFLUENCER"), async (req, res, next) => {
  try {
    const profile = await getInfluencerProfileForUser(req.user!.id);
    if (!profile) return res.status(404).json({ error: "Profile not found" });

    const body = z.object({ domain: z.string().min(1) }).parse(req.body);
    const domain = normalizeDomainInput(body.domain);

    if (!HOSTNAME_RE.test(domain)) {
      return res.status(400).json({ error: "Enter a valid domain, e.g. mybrand.com" });
    }
    const bare = domain.replace(/^www\./, "");
    if (config.customDomain.platformDomains.includes(bare)) {
      return res.status(400).json({ error: "That domain belongs to the platform." });
    }

    if (await isDomainTaken(domain, { influencerId: profile.id })) {
      return res.status(409).json({ error: "That domain is already connected to another account." });
    }

    const updated = await prisma.influencerProfile.update({
      where: { id: profile.id },
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
});

influencerRouter.post(
  "/mine/domain/verify",
  authRequired,
  requireRoles("INFLUENCER"),
  async (req, res, next) => {
    try {
      const profile = await getInfluencerProfileForUser(req.user!.id);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      if (!profile.customDomain) {
        return res.status(400).json({ error: "Add a domain before verifying." });
      }

      const { ok, resolved } = await verifyDomainDns(profile.customDomain);
      if (!ok) {
        await prisma.influencerProfile.update({
          where: { id: profile.id },
          data: { customDomainStatus: "ERROR", customDomainVerifiedAt: null },
        });
        return res.status(400).json({
          error: `DNS is not pointing here yet. Add ${dnsExpectedHint()}, then verify again. DNS changes can take a while to propagate.`,
          resolved,
        });
      }

      const updated = await prisma.influencerProfile.update({
        where: { id: profile.id },
        data: { customDomainStatus: "ACTIVE", customDomainVerifiedAt: new Date() },
      });
      res.json(serializeDomain(updated));
    } catch (e) {
      next(e);
    }
  }
);

influencerRouter.delete("/mine/domain", authRequired, requireRoles("INFLUENCER"), async (req, res, next) => {
  try {
    const profile = await getInfluencerProfileForUser(req.user!.id);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    const updated = await prisma.influencerProfile.update({
      where: { id: profile.id },
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
});

influencerRouter.get("/mine/display", authRequired, requireRoles("INFLUENCER"), async (req, res, next) => {
  try {
    const profile = await getInfluencerProfileForUser(req.user!.id);
    if (!profile) return res.status(404).json({ error: "Profile not found" });

    const display = parseInfluencerDisplay(profile.display, profile.user.name);
    const tours = await prisma.tour.findMany({
      where: { isPublished: true, tourKind: "READY_MADE" },
      include: { agency: { select: { id: true, name: true, slug: true, influencerCommissionPct: true } } },
      orderBy: [{ agency: { name: "asc" } }, { title: "asc" }],
    });

    const commissionRequests = await prisma.influencerCommissionRequest.findMany({
      where: { influencerId: profile.id },
      orderBy: { updatedAt: "desc" },
    });
    const requestByTourId = new Map<string, (typeof commissionRequests)[number]>();
    for (const req of commissionRequests) {
      if (!requestByTourId.has(req.tourId)) requestByTourId.set(req.tourId, req);
    }

    const approvedPctByTourId = new Map<string, number>();
    for (const req of commissionRequests) {
      if (req.status === "APPROVED" && req.approvedPct != null && !approvedPctByTourId.has(req.tourId)) {
        approvedPctByTourId.set(req.tourId, Number(req.approvedPct));
      }
    }

    const codes = await prisma.referralCode.findMany({
      where: { influencerId: profile.id, isActive: true, tourId: { not: null } },
      select: { tourId: true, code: true },
    });
    const codeByTourId = new Map(
      codes.filter((c): c is typeof c & { tourId: string } => Boolean(c.tourId)).map((c) => [c.tourId, c.code])
    );

    const activeOffers = await loadActiveOffers(agencyActiveOfferWhere());

    res.json({
      slug: profile.slug,
      publicPath: `/i/${profile.slug}`,
      display,
      availableOffers: activeOffers.map(serializeActiveOffer),
      availableTours: await Promise.all(
        tours.map(async (t) => {
          const customPct = approvedPctByTourId.get(t.id);
          const pricing = attachTourPricing(t, customPct);
          const req = requestByTourId.get(t.id);
          return {
            id: t.id,
            title: t.title,
            slug: t.slug,
            summary: t.summary,
            days: t.days,
            publicPriceLkr: pricing.publicPriceLkr,
            minDisplayPriceLkr: pricing.publicPriceLkr,
            influencerCommissionLkr: pricing.influencerCommissionLkr,
            influencerCommissionPct: pricing.influencerCommissionPct,
            influencerInstructions: t.influencerInstructions?.trim() || null,
            coverUrl: t.coverUrl,
            agency: t.agency,
            hasReferralCode: codeByTourId.has(t.id),
            referralCode: codeByTourId.get(t.id) ?? null,
            commissionRequest: req
              ? {
                  id: req.id,
                  status: req.status,
                  requestedPct: Number(req.requestedPct),
                  currentOfferPct: Number(req.currentOfferPct ?? req.requestedPct),
                  pendingActor: req.pendingActor,
                  offerByRole: req.offerByRole,
                  approvedPct: req.approvedPct != null ? Number(req.approvedPct) : null,
                  message: req.message,
                  agencyNote: req.agencyNote,
                }
              : null,
          };
        })
      ),
    });
  } catch (e) {
    next(e);
  }
});

influencerRouter.put("/mine/display", authRequired, requireRoles("INFLUENCER"), async (req, res, next) => {
  try {
    const profile = await getInfluencerProfileForUser(req.user!.id);
    if (!profile) return res.status(404).json({ error: "Profile not found" });

    const body = z
      .object({
        headline: z.string().min(1).max(200),
        tagline: z.string().max(500),
        tourIds: z.array(z.string()).max(48),
        offerIds: z.array(z.string()).max(24),
        heroImages: z
          .array(
            z.object({
              url: z.string().url().max(500),
              label: z.string().max(80).optional(),
            })
          )
          .max(10)
          .optional()
          .default([]),
        aboutTitle: z.string().max(80).optional().default("About the creator"),
        aboutDescription: z.string().max(1200).optional().default(""),
        socialLinks: z
          .array(
            z.object({
              platform: z.string().min(1).max(32),
              url: z.string().url().max(500),
              label: z.string().max(80).optional(),
            })
          )
          .max(12)
          .optional()
          .default([]),
        socialTagHandle: z.string().max(80).optional().default(""),
        tourSettings: z
          .record(
            z.string(),
            z.object({
              termsAcceptedAt: z.string().optional(),
              hideAgencyName: z.boolean().optional(),
              shareAsMine: z.boolean().optional(),
              displayPriceLkr: z.number().positive().optional(),
              coverUrl: z.string().url().max(500).optional(),
              galleryImages: z
                .array(
                  z.object({
                    url: z.string().url().max(500),
                    label: z.string().max(80).optional(),
                  })
                )
                .max(8)
                .optional(),
            })
          )
          .optional()
          .default({}),
      })
      .parse(req.body);

    const validTours = await prisma.tour.findMany({
      where: {
        id: { in: body.tourIds },
        isPublished: true,
        tourKind: "READY_MADE",
      },
      include: { agency: { select: { influencerCommissionPct: true } } },
    });
    const validTourIds = new Set(validTours.map((t) => t.id));
    const tourIds = body.tourIds.filter((id) => validTourIds.has(id));

    const approvedPctByTourId = new Map<string, number>();
    const approvedRequests = await prisma.influencerCommissionRequest.findMany({
      where: { influencerId: profile.id, status: "APPROVED", tourId: { in: tourIds } },
      orderBy: { updatedAt: "desc" },
    });
    for (const req of approvedRequests) {
      if (req.approvedPct != null && !approvedPctByTourId.has(req.tourId)) {
        approvedPctByTourId.set(req.tourId, Number(req.approvedPct));
      }
    }

    const tourSettings: Record<
      string,
      {
        termsAcceptedAt?: string;
        hideAgencyName?: boolean;
        shareAsMine?: boolean;
        displayPriceLkr?: number;
        coverUrl?: string;
        galleryImages?: { url: string; label?: string }[];
      }
    > = {};
    for (const tourId of tourIds) {
      const settings = body.tourSettings[tourId];
      if (!settings?.termsAcceptedAt?.trim()) {
        return res.status(400).json({
          error: "Accept the terms and conditions for each tour you feature on your display page.",
        });
      }
      const tour = validTours.find((t) => t.id === tourId);
      if (!tour) continue;
      const pricing = attachTourPricing(tour, approvedPctByTourId.get(tourId));
      const minPrice = pricing.publicPriceLkr;
      if (settings.displayPriceLkr != null && settings.displayPriceLkr < minPrice) {
        return res.status(400).json({
          error: `Displayed price for "${tour.title}" cannot be lower than LKR ${minPrice.toLocaleString()}.`,
        });
      }
      const shareAsMine = settings.shareAsMine === true || settings.hideAgencyName === true;
      tourSettings[tourId] = {
        termsAcceptedAt: settings.termsAcceptedAt.trim(),
        ...(shareAsMine ? { shareAsMine: true, hideAgencyName: true } : {}),
        ...(settings.displayPriceLkr != null && settings.displayPriceLkr >= minPrice
          ? { displayPriceLkr: Math.round(settings.displayPriceLkr) }
          : {}),
        ...(settings.coverUrl?.trim() ? { coverUrl: settings.coverUrl.trim() } : {}),
        ...(settings.galleryImages?.length
          ? {
              galleryImages: settings.galleryImages
                .map((image) => ({
                  url: image.url.trim(),
                  ...(image.label?.trim() ? { label: image.label.trim() } : {}),
                }))
                .filter((image) => image.url)
                .slice(0, 8),
            }
          : {}),
      };
    }

    const now = new Date();
    const validOffers = await prisma.offer.findMany({
      where: {
        id: { in: body.offerIds },
        ...agencyActiveOfferWhere(now),
      },
      select: { id: true },
    });
    const validOfferIds = new Set(validOffers.map((o) => o.id));
    const offerIds = body.offerIds.filter((id) => validOfferIds.has(id));

    const content = parseInfluencerDisplay(
      {
        headline: body.headline.trim(),
        tagline: body.tagline.trim(),
        tourIds,
        offerIds,
        heroImages: body.heroImages,
        aboutTitle: body.aboutTitle,
        aboutDescription: body.aboutDescription,
        socialLinks: body.socialLinks,
        socialTagHandle: body.socialTagHandle,
        tourSettings,
      },
      profile.user.name
    );
    content.tourSettings = pruneTourSettings(content.tourSettings, tourIds);

    await prisma.influencerProfile.update({
      where: { id: profile.id },
      data: { display: buildDisplayPayload(content) },
    });

    res.json({
      slug: profile.slug,
      publicPath: `/i/${profile.slug}`,
      display: content,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message || "Invalid input" });
    }
    next(e);
  }
});

influencerRouter.post(
  "/commission-requests",
  authRequired,
  requireRoles("INFLUENCER"),
  async (req, res, next) => {
    try {
      const profile = await getInfluencerProfileForUser(req.user!.id);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      const body = z
        .object({
          tourId: z.string().min(1),
          requestedPct: z.number().min(0).max(50),
          message: z.string().min(10).max(2000),
        })
        .parse(req.body);

      const tour = await prisma.tour.findFirst({
        where: { id: body.tourId, isPublished: true, tourKind: "READY_MADE" },
        include: { agency: { select: { id: true, name: true, ownerId: true } } },
      });
      if (!tour) return res.status(400).json({ error: "Tour not found or not available" });

      const created = await createCommissionRequest({
        influencerId: profile.id,
        influencerUserId: req.user!.id,
        tourId: tour.id,
        agencyId: tour.agencyId,
        requestedPct: body.requestedPct,
        message: body.message.trim(),
        tourTitle: tour.title,
        influencerName: profile.user.name,
        agencyOwnerId: tour.agency.ownerId,
        agencyName: tour.agency.name,
      });

      res.status(201).json(created);
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

influencerRouter.get(
  "/commission-requests",
  authRequired,
  requireRoles("INFLUENCER"),
  async (req, res, next) => {
    try {
      const profile = await getInfluencerProfileForUser(req.user!.id);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      res.json(await getInfluencerCommissionRequests(profile.id));
    } catch (e) {
      next(e);
    }
  }
);

influencerRouter.patch(
  "/commission-requests/:id",
  authRequired,
  requireRoles("INFLUENCER"),
  async (req, res, next) => {
    try {
      const profile = await getInfluencerProfileForUser(req.user!.id);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      const body = z
        .object({
          action: z.enum(["AGREE", "REJECT", "NEGOTIATE"]),
          proposedPct: z.number().min(0).max(50).optional(),
          message: z.string().max(2000).optional(),
        })
        .parse(req.body);

      const row = await prisma.influencerCommissionRequest.findFirst({
        where: { id: req.params.id, influencerId: profile.id },
        select: { id: true },
      });
      if (!row) return res.status(404).json({ error: "Request not found" });

      const updated = await applyCommissionRequestAction({
        requestId: row.id,
        actorRole: "INFLUENCER",
        actorUserId: req.user!.id,
        action: body.action,
        proposedPct: body.proposedPct,
        body: body.message,
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

influencerRouter.get("/tours", authRequired, requireRoles("INFLUENCER"), async (_req, res, next) => {
  try {
    const tours = await prisma.tour.findMany({
      where: { isPublished: true, tourKind: "READY_MADE" },
      include: { agency: { select: { id: true, name: true, slug: true, influencerCommissionPct: true } } },
      orderBy: [{ agency: { name: "asc" } }, { title: "asc" }],
    });
    res.json(tours.map(serializeTour));
  } catch (e) {
    next(e);
  }
});

influencerRouter.post("/track/:code", async (req, res, next) => {
  try {
    const code = await prisma.referralCode.findUnique({
      where: { code: req.params.code.toUpperCase() },
      include: { tour: { include: { agency: { select: { slug: true } } } } },
    });
    if (!code || !code.isActive) return res.status(404).json({ error: "Invalid code" });

    await prisma.$transaction([
      prisma.referralCode.update({
        where: { id: code.id },
        data: { clickCount: { increment: 1 } },
      }),
      prisma.referralAttribution.create({
        data: {
          referralCodeId: code.id,
          sessionId: String(req.body?.sessionId || req.ip || "anon"),
        },
      }),
    ]);

    res.json({
      ok: true,
      tourId: code.tourId,
      redirectPath: code.tour
        ? `/tours/${code.tour.agency.slug}/${code.tour.slug}?ref=${code.code}`
        : `/agencies?ref=${code.code}`,
    });
  } catch (e) {
    next(e);
  }
});
