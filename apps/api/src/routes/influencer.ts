import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { buildReferralSharePath, buildReferralShareUrl } from "../lib/referralShare.js";
import { authRequired, requireRoles } from "../middleware/auth.js";

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
  agency: { id: string; name: string; slug: string };
}) {
  return {
    id: tour.id,
    title: tour.title,
    slug: tour.slug,
    summary: tour.summary,
    days: tour.days,
    tourKind: tour.tourKind,
    basePriceLkr: Number(tour.basePriceLkr),
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
    commissionPct: Number(code.commissionPct),
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
        user: { select: { name: true } },
        codes: {
          include: {
            tour: { include: { agency: { select: { id: true, name: true, slug: true } } } },
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

    const origin = String(req.headers.origin || "http://localhost:5173");

    const [earnedAgg, pendingAgg, clicksAgg] = await Promise.all([
      prisma.commission.aggregate({
        where: { influencerId: profile.id, status: { in: ["APPROVED", "PAID"] } },
        _sum: { amountLkr: true },
      }),
      prisma.commission.aggregate({
        where: { influencerId: profile.id, status: "PENDING" },
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
      },
      stats: {
        totalEarned: Number(earnedAgg._sum.amountLkr ?? 0),
        pendingCommission: Number(pendingAgg._sum.amountLkr ?? 0),
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
        commissionPct: z.number().min(1).max(50).default(8),
      })
      .parse(req.body);

    const tour = await prisma.tour.findFirst({
      where: {
        id: body.tourId,
        isPublished: true,
        tourKind: "READY_MADE",
      },
      include: { agency: { select: { id: true, name: true, slug: true } } },
    });

    if (!tour) {
      return res.status(400).json({ error: "Tour not found or not available for promotion" });
    }

    const existingForTour = await prisma.referralCode.findFirst({
      where: { influencerId: profile.id, tourId: tour.id, isActive: true },
    });

    const codeValue =
      body.code?.toUpperCase().replace(/[^A-Z0-9]/g, "") ||
      `TP${tour.slug.slice(0, 4).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const origin = String(req.headers.origin || "http://localhost:5173");

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
          commissionPct: body.commissionPct,
        },
        include: {
          tour: { include: { agency: { select: { id: true, name: true, slug: true } } } },
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
        commissionPct: body.commissionPct,
      },
      include: {
        tour: { include: { agency: { select: { id: true, name: true, slug: true } } } },
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

influencerRouter.get("/tours", authRequired, requireRoles("INFLUENCER"), async (_req, res, next) => {
  try {
    const tours = await prisma.tour.findMany({
      where: { isPublished: true, tourKind: "READY_MADE" },
      include: { agency: { select: { id: true, name: true, slug: true } } },
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
