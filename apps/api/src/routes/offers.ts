import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import {
  applyOfferUpdate,
  offerCreateBodySchema,
  offerIncludeActive,
  offerIncludeAdmin,
  offerUpdateBodySchema,
  serializeActiveOffer,
  serializeOfferAdmin,
  validateDiscount,
  validateOfferDates,
} from "../lib/offers.js";
import { authRequired, requireRoles } from "../middleware/auth.js";

export const offersRouter = Router();

offersRouter.get("/active", async (_req, res, next) => {
  try {
    const now = new Date();
    const offers = await prisma.offer.findMany({
      where: { isActive: true, validFrom: { lte: now }, validUntil: { gte: now } },
      include: offerIncludeActive,
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
      include: offerIncludeActive,
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

/** Admin: platform offers only (no agencyId). */
offersRouter.get("/", authRequired, requireRoles("ADMIN"), async (_req, res, next) => {
  try {
    const offers = await prisma.offer.findMany({
      where: { agencyId: null },
      orderBy: { createdAt: "desc" },
      include: offerIncludeAdmin,
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
    const body = offerCreateBodySchema.parse(req.body);

    const validFrom = new Date(body.validFrom);
    const validUntil = new Date(body.validUntil);
    const dateErr = validateOfferDates(validFrom, validUntil);
    if (dateErr) return res.status(400).json({ error: dateErr });

    const discountErr = validateDiscount(body.tourPriceLkr, body.discountedLkr);
    if (discountErr) return res.status(400).json({ error: discountErr });

    const offer = await prisma.offer.create({
      data: {
        agencyId: null,
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

offersRouter.patch("/:id", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const body = offerUpdateBodySchema.parse(req.body);

    const existing = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: offerIncludeAdmin,
    });
    if (!existing || existing.agencyId != null) {
      return res.status(404).json({ error: "Offer not found" });
    }

    const updated = await applyOfferUpdate(existing, body);
    res.json(serializeOfferAdmin(updated));
  } catch (e) {
    next(e);
  }
});

offersRouter.delete("/:id", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const existing = await prisma.offer.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.agencyId != null) {
      return res.status(404).json({ error: "Offer not found" });
    }

    await prisma.offer.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
