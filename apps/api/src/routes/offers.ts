import { Router } from "express";
import { z } from "zod";
import { storedImageUrlSchema } from "../lib/imageUrlSchema.js";
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
import { publicOfferWhere } from "../lib/publicVisibility.js";
import { getPublicSmartFeatures } from "../services/platformSettings.js";
import { recordAuditEvent, snapshotOffer } from "../services/auditLog.js";

export const offersRouter = Router();

async function publicOffersDisabled(res: { status: (n: number) => { json: (b: unknown) => void } }) {
  const flags = await getPublicSmartFeatures();
  if (flags.publicOffersEnabled) return false;
  res.status(403).json({ error: "Public offers are turned off", code: "FEATURE_DISABLED" });
  return true;
}

const offerRegisterBodySchema = z.object({
  screenshotUrl: storedImageUrlSchema,
  termsAccepted: z.literal(true),
  tourId: z.string().min(1),
  message: z.string().max(2000).optional(),
});

offersRouter.get("/active", async (_req, res, next) => {
  try {
    if (await publicOffersDisabled(res)) return;
    const now = new Date();
    const offers = await prisma.offer.findMany({
      where: publicOfferWhere(now),
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
    if (await publicOffersDisabled(res)) return;
    const limit = Math.min(10, Math.max(1, Number(req.query.limit) || 3));
    const now = new Date();
    const offers = await prisma.offer.findMany({
      where: publicOfferWhere(now),
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

/** Public: registered tourists for an active offer (name + avatar for social proof). */
offersRouter.get("/:id/registrations", async (req, res, next) => {
  try {
    if (await publicOffersDisabled(res)) return;
    const offer = await prisma.offer.findFirst({
      where: { id: req.params.id, ...publicOfferWhere() },
    });
    if (!offer) {
      return res.status(404).json({ error: "Offer not found" });
    }

    const regs = await prisma.offerRegistration.findMany({
      where: { offerId: offer.id },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json(
      regs.map((r) => ({
        id: r.id,
        registeredAt: r.createdAt,
        user: {
          id: r.user.id,
          name: r.user.name,
          avatarUrl: r.user.avatarUrl,
        },
      }))
    );
  } catch (e) {
    next(e);
  }
});

offersRouter.get("/:id", async (req, res, next) => {
  try {
    if (await publicOffersDisabled(res)) return;
    const now = new Date();
    const offer = await prisma.offer.findFirst({
      where: {
        id: req.params.id,
        ...publicOfferWhere(now),
      },
      include: offerIncludeActive,
    });
    if (!offer) {
      return res.status(404).json({ error: "Offer not found" });
    }
    res.json(serializeActiveOffer(offer));
  } catch (e) {
    next(e);
  }
});

offersRouter.post("/:id/register", authRequired, async (req, res, next) => {
  try {
    if (await publicOffersDisabled(res)) return;
    const body = offerRegisterBodySchema.parse(req.body);
    const now = new Date();
    const offer = await prisma.offer.findFirst({
      where: { id: req.params.id, ...publicOfferWhere(now) },
      include: {
        _count: { select: { registrations: true } },
        tours: { select: { tourId: true } },
      },
    });

    if (!offer) {
      return res.status(404).json({ error: "Offer not found" });
    }

    if (offer.validFrom > now || offer.validUntil < now) {
      return res.status(410).json({ error: "This offer is no longer available" });
    }

    if (offer._count.registrations >= offer.registrationCap) {
      return res.status(409).json({ error: "Offer registration cap reached" });
    }

    if (!body.tourId) {
      return res.status(400).json({ error: "Choose a tour to register for" });
    }

    const tourWhere: { id: string; isPublished: true; agencyId?: string } = {
      id: body.tourId,
      isPublished: true,
    };
    if (offer.agencyId) {
      tourWhere.agencyId = offer.agencyId;
    }

    const tour = await prisma.tour.findFirst({
      where: tourWhere,
      select: { id: true },
    });
    if (!tour) {
      return res.status(400).json({ error: "Selected tour is not available for this offer" });
    }

    const reg = await prisma.$transaction(async (tx) => {
      const created = await tx.offerRegistration.create({
        data: {
          offerId: offer.id,
          userId: req.user!.id,
          tourId: body.tourId ?? null,
          screenshotUrl: body.screenshotUrl,
          message: body.message?.trim() ?? "",
          termsAcceptedAt: now,
        },
      });
      const registrationNumber = await tx.offerRegistration.count({
        where: { offerId: offer.id, createdAt: { lte: created.createdAt } },
      });
      return { created, registrationNumber };
    });

    res.status(201).json({
      id: reg.created.id,
      offerId: reg.created.offerId,
      tourId: reg.created.tourId,
      registrationNumber: reg.registrationNumber,
      createdAt: reg.created.createdAt,
    });
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
    await recordAuditEvent({
      actor: req.user!,
      agencyId: null,
      entityType: "OFFER",
      entityId: withMeta.id,
      entityLabel: withMeta.title,
      action: "CREATE",
      summary: `Created platform offer "${withMeta.title}" (LKR ${Number(withMeta.tourPriceLkr)})`,
      after: snapshotOffer(withMeta),
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

    const beforeSnap = snapshotOffer(existing);
    const updated = await applyOfferUpdate(existing, body);
    await recordAuditEvent({
      actor: req.user!,
      agencyId: null,
      entityType: "OFFER",
      entityId: updated.id,
      entityLabel: updated.title,
      action: "UPDATE",
      summary: `Updated platform offer "${updated.title}"`,
      before: beforeSnap,
      after: snapshotOffer(updated),
    });
    res.json(serializeOfferAdmin(updated));
  } catch (e) {
    next(e);
  }
});

offersRouter.delete("/:id", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const existing = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: offerIncludeAdmin,
    });
    if (!existing || existing.agencyId != null) {
      return res.status(404).json({ error: "Offer not found" });
    }

    await prisma.offer.delete({ where: { id: existing.id } });
    await recordAuditEvent({
      actor: req.user!,
      agencyId: null,
      entityType: "OFFER",
      entityId: existing.id,
      entityLabel: existing.title,
      action: "DELETE",
      summary: `Deleted platform offer "${existing.title}"`,
      before: snapshotOffer(existing),
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
