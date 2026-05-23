import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";

export const influencerRouter = Router();

influencerRouter.get("/dashboard", authRequired, requireRoles("INFLUENCER"), async (req, res, next) => {
  try {
    const profile = await prisma.influencerProfile.findUnique({
      where: { userId: req.user!.id },
      include: {
        codes: { include: { tour: true, _count: { select: { inquiries: true, commissions: true } } } },
        commissions: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    if (!profile) return res.status(404).json({ error: "Profile not found" });

    const totalEarned = await prisma.commission.aggregate({
      where: { influencerId: profile.id, status: { in: ["APPROVED", "PAID"] } },
      _sum: { amountLkr: true },
    });

    res.json({
      profile,
      totalEarned: Number(totalEarned._sum.amountLkr ?? 0),
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
        tourId: z.string().optional(),
        code: z.string().min(4).max(20).optional(),
        commissionPct: z.number().min(1).max(50).default(5),
      })
      .parse(req.body);

    const code =
      body.code?.toUpperCase() ||
      `TP${profile.id.slice(-4).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const created = await prisma.referralCode.create({
      data: {
        influencerId: profile.id,
        tourId: body.tourId,
        code,
        commissionPct: body.commissionPct,
      },
      include: { tour: true },
    });

    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

influencerRouter.get("/tours", authRequired, requireRoles("INFLUENCER"), async (_req, res, next) => {
  try {
    const tours = await prisma.tour.findMany({
      where: { isPublished: true },
      include: { agency: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(tours.map((t) => ({ ...t, basePriceLkr: Number(t.basePriceLkr) })));
  } catch (e) {
    next(e);
  }
});

influencerRouter.post("/track/:code", async (req, res, next) => {
  try {
    const code = await prisma.referralCode.findUnique({
      where: { code: req.params.code.toUpperCase() },
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

    res.json({ ok: true, tourId: code.tourId });
  } catch (e) {
    next(e);
  }
});
