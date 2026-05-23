import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, getAgencyForUser, requireRoles } from "../middleware/auth.js";
import { calculateItineraryTotals } from "../utils/pricing.js";
import { createShareToken } from "../services/otp.js";

export const inquiriesRouter = Router();

inquiriesRouter.post("/", authRequired, requireRoles("TOURIST"), async (req, res, next) => {
  try {
    const body = z
      .object({
        agencyId: z.string(),
        tourId: z.string().optional(),
        type: z.enum(["READY_MADE", "CUSTOM"]),
        pax: z.number().int().min(1).default(2),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        budgetBand: z.string().optional(),
        interests: z.array(z.string()).optional(),
        message: z.string().optional(),
        refCode: z.string().optional(),
      })
      .parse(req.body);

    let referralCodeId: string | undefined;
    if (body.refCode) {
      const code = await prisma.referralCode.findUnique({
        where: { code: body.refCode.toUpperCase() },
      });
      if (code?.isActive) referralCodeId = code.id;
    }

    const inquiry = await prisma.inquiry.create({
      data: {
        touristId: req.user!.id,
        agencyId: body.agencyId,
        tourId: body.tourId,
        type: body.type,
        pax: body.pax,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        budgetBand: body.budgetBand,
        interests: body.interests ?? [],
        message: body.message,
        referralCodeId,
        statusHistory: { create: { status: "NEW", actorId: req.user!.id } },
      },
      include: { agency: true, tour: true },
    });

    res.status(201).json(inquiry);
  } catch (e) {
    next(e);
  }
});

inquiriesRouter.get("/mine", authRequired, async (req, res, next) => {
  try {
    if (req.user!.role === "TOURIST") {
      const list = await prisma.inquiry.findMany({
        where: { touristId: req.user!.id },
        include: { agency: true, tour: true, itineraries: { orderBy: { version: "desc" }, take: 1 } },
        orderBy: { createdAt: "desc" },
      });
      return res.json(list);
    }

    if (req.user!.role === "AGENCY") {
      const agency = await getAgencyForUser(req.user!.id);
      if (!agency) return res.status(404).json({ error: "Agency not found" });

      const list = await prisma.inquiry.findMany({
        where: { agencyId: agency.id },
        include: { tourist: { select: { id: true, name: true, phone: true } }, tour: true },
        orderBy: { createdAt: "desc" },
      });
      return res.json(list);
    }

    res.status(403).json({ error: "Forbidden" });
  } catch (e) {
    next(e);
  }
});

inquiriesRouter.patch("/:id/status", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const { status, note } = z
      .object({
        status: z.enum([
          "AGENCY_REVIEWING",
          "ITINERARY_DRAFT",
          "SENT_TO_TOURIST",
          "DECLINED",
        ]),
        note: z.string().optional(),
      })
      .parse(req.body);

    const inquiry = await prisma.inquiry.update({
      where: { id: req.params.id, agencyId: agency.id },
      data: {
        status,
        statusHistory: { create: { status, note, actorId: req.user!.id } },
      },
    });

    res.json(inquiry);
  } catch (e) {
    next(e);
  }
});

inquiriesRouter.post("/:id/itinerary", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const inquiry = await prisma.inquiry.findFirst({
      where: { id: req.params.id, agencyId: agency.id },
    });
    if (!inquiry) return res.status(404).json({ error: "Inquiry not found" });

    const body = z
      .object({
        title: z.string().optional(),
        notes: z.string().optional(),
        days: z.array(
          z.object({
            dayNumber: z.number(),
            title: z.string().optional(),
            items: z.array(
              z.object({
                entityId: z.string().optional(),
                label: z.string(),
                kind: z.enum(["REQUIRED", "OPTIONAL", "UPGRADE"]).default("REQUIRED"),
                priceLkr: z.number().nullable().optional(),
                priceOnRequest: z.boolean().optional(),
                notes: z.string().optional(),
              })
            ),
          })
        ),
        send: z.boolean().default(false),
      })
      .parse(req.body);

    const lastVersion = await prisma.itinerary.findFirst({
      where: { inquiryId: inquiry.id },
      orderBy: { version: "desc" },
    });
    const version = (lastVersion?.version ?? 0) + 1;

    const flatLines = body.days.flatMap((d) => d.items);
    const totals = calculateItineraryTotals(
      flatLines.map((l) => ({
        kind: l.kind,
        priceLkr: l.priceOnRequest ? null : (l.priceLkr ?? 0),
        priceOnRequest: l.priceOnRequest,
      }))
    );

    const itinerary = await prisma.$transaction(async (tx) => {
      const created = await tx.itinerary.create({
        data: {
          inquiryId: inquiry.id,
          version,
          title: body.title,
          notes: body.notes,
          baseTotal: totals.baseTotal,
          optionalTotal: totals.optionalTotal,
          grandMax: totals.grandMax,
          isSent: body.send,
          sentAt: body.send ? new Date() : null,
          shareToken: body.send ? createShareToken() : null,
        },
      });

      for (const day of body.days) {
        const dayRow = await tx.itineraryDay.create({
          data: {
            itineraryId: created.id,
            dayNumber: day.dayNumber,
            title: day.title,
          },
        });

        for (const [idx, item] of day.items.entries()) {
          await tx.itineraryLineItem.create({
            data: {
              itineraryId: created.id,
              dayId: dayRow.id,
              label: item.label,
              entityId: item.entityId,
              kind: item.kind,
              priceLkr: item.priceOnRequest ? null : item.priceLkr,
              priceOnRequest: item.priceOnRequest ?? false,
              sortOrder: idx,
              notes: item.notes,
            },
          });
        }
      }

      return tx.itinerary.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          days: { orderBy: { dayNumber: "asc" }, include: { lineItems: { include: { entity: true } } } },
        },
      });
    });

    if (body.send) {
      await prisma.inquiry.update({
        where: { id: inquiry.id },
        data: {
          status: "SENT_TO_TOURIST",
          statusHistory: {
            create: { status: "SENT_TO_TOURIST", actorId: req.user!.id },
          },
        },
      });

      if (inquiry.referralCodeId) {
        const ref = await prisma.referralCode.findUnique({
          where: { id: inquiry.referralCodeId },
          include: { influencer: true },
        });
        if (ref) {
          const amount = (totals.grandMax * Number(ref.commissionPct)) / 100;
          await prisma.commission.upsert({
            where: { inquiryId: inquiry.id },
            create: {
              inquiryId: inquiry.id,
              referralCodeId: ref.id,
              influencerId: ref.influencerId,
              amountLkr: amount,
              status: "PENDING",
            },
            update: { amountLkr: amount },
          });
        }
      }
    } else {
      await prisma.inquiry.update({
        where: { id: inquiry.id },
        data: { status: "ITINERARY_DRAFT" },
      });
    }

    res.status(201).json(serializeItinerary(itinerary));
  } catch (e) {
    next(e);
  }
});

inquiriesRouter.get("/share/:token", async (req, res, next) => {
  try {
    const itinerary = await prisma.itinerary.findFirst({
      where: { shareToken: req.params.token, isSent: true },
      include: {
        days: { include: { lineItems: { include: { entity: true } } } },
        inquiry: { include: { agency: true, tourist: { select: { name: true } } } },
      },
    });
    if (!itinerary) return res.status(404).json({ error: "Not found" });
    res.json({
      ...serializeItinerary(itinerary),
      inquiry: { id: itinerary.inquiry.id, agency: itinerary.inquiry.agency },
    });
  } catch (e) {
    next(e);
  }
});

inquiriesRouter.post("/:id/respond", authRequired, requireRoles("TOURIST"), async (req, res, next) => {
  try {
    const { action, note } = z
      .object({
        action: z.enum(["accept", "revision", "decline"]),
        note: z.string().optional(),
      })
      .parse(req.body);

    const statusMap = {
      accept: "ACCEPTED",
      revision: "REVISION_REQUESTED",
      decline: "DECLINED",
    } as const;

    const inquiry = await prisma.inquiry.update({
      where: { id: req.params.id, touristId: req.user!.id },
      data: {
        status: statusMap[action],
        statusHistory: { create: { status: statusMap[action], note, actorId: req.user!.id } },
      },
    });

    if (action === "accept" && inquiry.referralCodeId) {
      await prisma.commission.updateMany({
        where: { inquiryId: inquiry.id },
        data: { status: "APPROVED" },
      });
    }

    res.json(inquiry);
  } catch (e) {
    next(e);
  }
});

function serializeItinerary(itinerary: {
  id: string;
  version: number;
  title: string | null;
  notes: string | null;
  baseTotal: unknown;
  optionalTotal: unknown;
  grandMax: unknown;
  isSent: boolean;
  shareToken: string | null;
  days?: Array<{
    dayNumber: number;
    title: string | null;
    lineItems: Array<{
      label: string;
      kind: string;
      priceLkr: unknown;
      priceOnRequest: boolean;
      notes: string | null;
      entity: { name: string; type: string } | null;
    }>;
  }>;
}) {
  return {
    ...itinerary,
    baseTotal: Number(itinerary.baseTotal),
    optionalTotal: Number(itinerary.optionalTotal),
    grandMax: Number(itinerary.grandMax),
    days: itinerary.days?.map((d) => ({
      ...d,
      lineItems: d.lineItems.map((li) => ({
        ...li,
        priceLkr: li.priceLkr != null ? Number(li.priceLkr) : null,
      })),
    })),
  };
}
