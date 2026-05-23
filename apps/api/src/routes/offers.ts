import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";

export const offersRouter = Router();

offersRouter.get("/active", async (_req, res, next) => {
  try {
    const now = new Date();
    const offers = await prisma.offer.findMany({
      where: { isActive: true, validFrom: { lte: now }, validUntil: { gte: now } },
      include: {
        tours: { include: { tour: { include: { agency: { select: { name: true, slug: true } } } } } },
        _count: { select: { registrations: true } },
      },
    });

    res.json(
      offers.map((o) => ({
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
        tours: o.tours.map((t) => ({
          ...t.tour,
          basePriceLkr: Number(t.tour.basePriceLkr),
          agency: t.tour.agency,
        })),
      }))
    );
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
        rewardText: z.string(),
        registrationCap: z.number().int().positive(),
        validFrom: z.string().datetime(),
        validUntil: z.string().datetime(),
        tourPriceLkr: z.number().nonnegative(),
        discountedLkr: z.number().optional(),
        tourIds: z.array(z.string()).default([]),
      })
      .parse(req.body);

    const offer = await prisma.offer.create({
      data: {
        title: body.title,
        description: body.description,
        rewardText: body.rewardText,
        registrationCap: body.registrationCap,
        validFrom: new Date(body.validFrom),
        validUntil: new Date(body.validUntil),
        tourPriceLkr: body.tourPriceLkr,
        discountedLkr: body.discountedLkr,
        tours: { create: body.tourIds.map((tourId) => ({ tourId })) },
      },
    });

    res.status(201).json(offer);
  } catch (e) {
    next(e);
  }
});
