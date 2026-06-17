import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { resolveReferralCommissionLkr } from "../lib/referralCommission.js";
import { authRequired, getAgencyForUser, requireRoles } from "../middleware/auth.js";
import { calculateItineraryTotals } from "../utils/pricing.js";
import { createShareToken } from "../services/otp.js";
import {
  createInquiryItinerary,
  mapReplyKind,
  replyBodySchema,
} from "./inquiryResponses.js";
import {
  isProposalEditable,
  proposalBodySchema,
  proposalInclude,
  serializeProposal,
  upsertInquiryProposal,
} from "../services/inquiryProposal.js";
import { serializeItineraryEntity } from "../lib/entitySerialize.js";
import {
  buildInquiryThread,
  createInquiryMessage,
  inquiryMessagesInclude,
  serializeInquiryMessage,
} from "../services/inquiryMessages.js";
import {
  notifyCommissionApproved,
  notifyInquiryCreated,
  notifyInquiryStatusChange,
  notifyProposalSent,
} from "../services/notifications.js";

export const inquiriesRouter = Router();

type TripPlanInquiryPayload = {
  title: string;
  agencySlug: string;
  days: Array<Record<string, unknown>>;
  estimatedTotalLkr?: number;
};

function formatTripPlanInquiryMessage(plan: TripPlanInquiryPayload): string {
  const lines: string[] = [
    `I'd like to inquire about my custom itinerary: "${plan.title}".`,
    "",
  ];

  for (const day of plan.days) {
    const dayNumber = typeof day.dayNumber === "number" ? day.dayNumber : "?";
    lines.push(`Day ${dayNumber}:`);

    const sections: Array<[string, unknown]> = [
      ["Accommodation", day.accommodation],
      ["Transport", day.transport],
      ["Activities", day.activities],
      ["Viewpoints", day.viewpoints],
      ["Dining & others", day.dining],
    ];

    for (const [label, value] of sections) {
      if (!value) continue;
      if (Array.isArray(value)) {
        const names = value
          .map((item) =>
            item && typeof item === "object" && "name" in item ? String(item.name) : null
          )
          .filter(Boolean);
        if (names.length > 0) lines.push(`  • ${label}: ${names.join(", ")}`);
      } else if (typeof value === "object" && value !== null && "name" in value) {
        lines.push(`  • ${label}: ${String((value as { name: string }).name)}`);
      }
    }

    lines.push("");
  }

  if (plan.estimatedTotalLkr != null) {
    lines.push(`Estimated total from listed prices: LKR ${plan.estimatedTotalLkr.toLocaleString()}`);
    lines.push("");
  }

  lines.push("Please confirm availability, final pricing, and next steps.");
  return lines.join("\n").trim();
}

const inquiryIncludeForAgency = {
  tourist: { select: { id: true, name: true, phone: true, email: true, role: true } },
  tour: { select: { id: true, title: true, slug: true, days: true, basePriceLkr: true } },
  responses: {
    orderBy: { createdAt: "asc" as const },
    include: {
      author: { select: { id: true, name: true, role: true } },
      tour: {
        select: {
          id: true,
          title: true,
          slug: true,
          days: true,
          basePriceLkr: true,
          coverUrl: true,
        },
      },
      itinerary: {
        include: {
          days: {
            orderBy: { dayNumber: "asc" as const },
            include: { lineItems: { include: { entity: true } } },
          },
        },
      },
    },
  },
  statusHistory: { orderBy: { createdAt: "desc" as const }, take: 10 },
  proposal: { include: proposalInclude },
  messages: inquiryMessagesInclude,
};

const inquiryIncludeForTourist = {
  agency: { select: { id: true, name: true, slug: true, logoUrl: true } },
  tourist: { select: { id: true, name: true, role: true } },
  tour: { select: { id: true, title: true, slug: true, days: true, basePriceLkr: true } },
  responses: {
    orderBy: { createdAt: "asc" as const },
    include: {
      author: { select: { id: true, name: true, role: true } },
      tour: { select: { id: true, title: true, slug: true, days: true, basePriceLkr: true } },
      itinerary: {
        include: {
          days: {
            orderBy: { dayNumber: "asc" as const },
            include: { lineItems: true },
          },
        },
      },
    },
  },
  proposal: { include: proposalInclude },
  messages: inquiryMessagesInclude,
};

inquiriesRouter.post("/", authRequired, requireRoles("TOURIST"), async (req, res, next) => {
  try {
    const body = z
      .object({
        agencyId: z.string(),
        tourId: z.string().optional(),
        type: z.enum(["READY_MADE", "CUSTOM"]),
        pax: z.number().int().min(1).default(2),
        startDate: z.union([z.string().datetime(), z.string().date()]).optional(),
        endDate: z.union([z.string().datetime(), z.string().date()]).optional(),
        budgetBand: z.string().optional(),
        interests: z.union([z.array(z.string()), z.record(z.unknown())]).optional(),
        tripPlan: z
          .object({
            title: z.string().min(1),
            agencySlug: z.string().min(1),
            days: z.array(z.record(z.unknown())).min(1),
            estimatedTotalLkr: z.number().min(0).optional(),
          })
          .optional(),
        message: z.string().optional(),
        email: z.string().email("A valid email address is required"),
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

    let tourId: string | undefined = body.tripPlan ? undefined : body.tourId;
    let inquiryType = body.tripPlan ? "CUSTOM" : body.type;

    if (tourId) {
      const tour = await prisma.tour.findFirst({
        where: { id: tourId, agencyId: body.agencyId, isPublished: true, tourKind: "READY_MADE" },
        select: { id: true, title: true, days: true },
      });
      if (!tour) {
        return res.status(400).json({ error: "Selected tour is not available for inquiry" });
      }
      inquiryType = "READY_MADE";
    } else if (inquiryType === "READY_MADE") {
      return res.status(400).json({ error: "Select a tour for a ready-made inquiry" });
    }

    const messageBody =
      body.message?.trim() ||
      (body.tripPlan
        ? formatTripPlanInquiryMessage(body.tripPlan)
        : tourId
          ? `I'm interested in this ready-made tour. Please share availability and next steps.`
          : undefined);

    if (!messageBody) {
      return res.status(400).json({ error: "Please describe your trip requirements" });
    }

    const interestsPayload = body.tripPlan
      ? {
          _kind: "trip_plan" as const,
          plan: body.tripPlan,
          tags: Array.isArray(body.interests) ? body.interests : [],
        }
      : body.interests;

    const contactEmail = body.email.trim().toLowerCase();

    const inquiry = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: req.user!.id },
        data: { email: contactEmail },
      });

      const created = await tx.inquiry.create({
        data: {
          touristId: req.user!.id,
          agencyId: body.agencyId,
          tourId,
          type: inquiryType,
          pax: body.pax,
          startDate: body.startDate ? new Date(body.startDate) : undefined,
          endDate: body.endDate ? new Date(body.endDate) : undefined,
          budgetBand: body.budgetBand,
          interests: interestsPayload ?? [],
          message: messageBody,
          referralCodeId,
          statusHistory: { create: { status: "NEW", actorId: req.user!.id } },
        },
        include: { agency: true, tour: true },
      });

      await tx.inquiryMessage.create({
        data: {
          inquiryId: created.id,
          authorId: req.user!.id,
          kind: "TOURIST",
          body: messageBody,
          action: tourId ? "TOUR_INQUIRY" : "INQUIRY_CREATED",
        },
      });

      return created;
    });

    void notifyInquiryCreated(inquiry.id).catch(console.error);

    res.status(201).json(inquiry);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message || "Invalid inquiry data" });
    }
    next(e);
  }
});

inquiriesRouter.get("/mine", authRequired, async (req, res, next) => {
  try {
    if (req.user!.role === "TOURIST") {
      const list = await prisma.inquiry.findMany({
        where: { touristId: req.user!.id },
        include: inquiryIncludeForTourist,
        orderBy: { createdAt: "desc" },
      });
      return res.json(list.map(serializeInquiryForClient));
    }

    if (req.user!.role === "AGENCY") {
      const agency = await getAgencyForUser(req.user!.id);
      if (!agency) return res.status(404).json({ error: "Agency not found" });

      const list = await prisma.inquiry.findMany({
        where: { agencyId: agency.id },
        include: inquiryIncludeForAgency,
        orderBy: { createdAt: "desc" },
      });
      return res.json(list.map(serializeInquiryForClient));
    }

    res.status(403).json({ error: "Forbidden" });
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
      inquiry: {
        id: itinerary.inquiry.id,
        agency: itinerary.inquiry.agency,
        tourist: itinerary.inquiry.tourist,
      },
    });
  } catch (e) {
    next(e);
  }
});

inquiriesRouter.get("/:id", authRequired, async (req, res, next) => {
  try {
    const role = req.user!.role;
    const inquiry = await prisma.inquiry.findUnique({
      where: { id: req.params.id },
      include:
        role === "AGENCY" || role === "ADMIN"
          ? inquiryIncludeForAgency
          : inquiryIncludeForTourist,
    });

    if (!inquiry) return res.status(404).json({ error: "Inquiry not found" });

    if (role === "TOURIST" && inquiry.touristId !== req.user!.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (role === "AGENCY") {
      const agency = await getAgencyForUser(req.user!.id);
      if (!agency || inquiry.agencyId !== agency.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    res.json(serializeInquiryForClient(inquiry));
  } catch (e) {
    next(e);
  }
});

inquiriesRouter.put("/:id/proposal", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const body = proposalBodySchema.parse(req.body);
    const proposal = await upsertInquiryProposal(
      req.params.id,
      agency.id,
      req.user!.id,
      body
    );

    res.json(serializeProposal(proposal));
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message || "Invalid input" });
    }
    if (e instanceof Error && e.message) {
      return res.status(400).json({ error: e.message });
    }
    next(e);
  }
});

inquiriesRouter.post("/:id/reply", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const inquiry = await prisma.inquiry.findFirst({
      where: { id: req.params.id, agencyId: agency.id },
    });
    if (!inquiry) return res.status(404).json({ error: "Inquiry not found" });

    const body = replyBodySchema.parse(req.body);

    if (body.replyType === "ready_made") {
      if (!body.tourId) return res.status(400).json({ error: "Select a tour to send" });
      const tour = await prisma.tour.findFirst({
        where: { id: body.tourId, agencyId: agency.id, isPublished: true },
      });
      if (!tour) return res.status(400).json({ error: "Invalid tour" });
    }

    if (body.replyType === "custom") {
      if (!body.itinerary?.days?.length) {
        return res.status(400).json({ error: "Custom itinerary requires at least one day" });
      }
    }

    let itineraryId: string | undefined;

    if (body.replyType === "custom" && body.itinerary) {
      const { itinerary, totals } = await createInquiryItinerary(inquiry.id, body.itinerary);

      itineraryId = itinerary.id;

      if (inquiry.referralCodeId) {
        const amount = await resolveReferralCommissionLkr(
          inquiry.referralCodeId,
          totals.grandMax
        );
        if (amount > 0) {
          const ref = await prisma.referralCode.findUnique({
            where: { id: inquiry.referralCodeId },
          });
          if (ref) {
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
      }
    }

    const response = await prisma.inquiryResponse.create({
      data: {
        inquiryId: inquiry.id,
        authorId: req.user!.id,
        message: body.message.trim(),
        kind: mapReplyKind(body.replyType),
        tourId: body.replyType === "ready_made" ? body.tourId : undefined,
        itineraryId,
      },
      include: {
        tour: { select: { id: true, title: true, slug: true, days: true, basePriceLkr: true } },
        itinerary: {
          include: {
            days: {
              orderBy: { dayNumber: "asc" },
              include: { lineItems: true },
            },
          },
        },
      },
    });

    await prisma.inquiry.update({
      where: { id: inquiry.id },
      data: {
        status: "SENT_TO_TOURIST",
        statusHistory: {
          create: {
            status: "SENT_TO_TOURIST",
            note: body.message.slice(0, 500),
            actorId: req.user!.id,
          },
        },
      },
    });

    await createInquiryMessage(
      inquiry.id,
      req.user!.id,
      "AGENCY",
      body.message.trim(),
      "PROPOSAL_SENT"
    );

    void notifyProposalSent(inquiry.id).catch(console.error);

    res.status(201).json(serializeResponse(response));
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
        const amount = await resolveReferralCommissionLkr(
          inquiry.referralCodeId,
          totals.grandMax
        );
        if (amount > 0) {
          const ref = await prisma.referralCode.findUnique({
            where: { id: inquiry.referralCodeId },
          });
          if (ref) {
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

inquiriesRouter.post("/:id/respond", authRequired, requireRoles("TOURIST"), async (req, res, next) => {
  try {
    const { action, note } = z
      .object({
        action: z.enum(["accept", "revision", "decline"]),
        note: z.string().optional(),
      })
      .parse(req.body);

    if (action === "revision" && !note?.trim()) {
      return res.status(400).json({ error: "Please describe what you would like changed." });
    }

    const statusMap = {
      accept: "ACCEPTED",
      revision: "REVISION_REQUESTED",
      decline: "DECLINED",
    } as const;

    const actionLabel = {
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

    const messageBody =
      note?.trim() ||
      (action === "accept"
        ? "I accept this proposal."
        : action === "decline"
          ? "I decline this proposal."
          : "");

    if (messageBody) {
      await createInquiryMessage(
        inquiry.id,
        req.user!.id,
        "TOURIST",
        messageBody,
        actionLabel[action]
      );
    }

    if (action === "accept" && inquiry.referralCodeId) {
      await prisma.commission.updateMany({
        where: { inquiryId: inquiry.id },
        data: { status: "APPROVED" },
      });
      void notifyCommissionApproved(inquiry.id).catch(console.error);
    }

    void notifyInquiryStatusChange(inquiry.id, statusMap[action], note).catch(console.error);

    res.json(inquiry);
  } catch (e) {
    next(e);
  }
});

function serializeInquiryForClient(inquiry: {
  id: string;
  status: string;
  type: string;
  pax: number;
  message: string | null;
  budgetBand: string | null;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tourist?: { id: string; name: string; phone?: string; email?: string | null; role?: string };
  agency?: { id: string; name: string; slug: string; logoUrl?: string | null };
  tour?: {
    id: string;
    title: string;
    slug: string;
    days?: number;
    basePriceLkr?: unknown;
  } | null;
  responses?: Array<{
    id: string;
    message: string;
    kind: string;
    createdAt: Date;
    authorId: string;
    author?: { id: string; name: string; role: string };
    tour?: {
      id: string;
      title: string;
      slug: string;
      days: number;
      basePriceLkr: unknown;
      coverUrl?: string | null;
    } | null;
    itinerary?: Parameters<typeof serializeItinerary>[0] | null;
  }>;
  proposal?: Parameters<typeof serializeProposal>[0] | null;
  messages?: Array<Parameters<typeof serializeInquiryMessage>[0]>;
}) {
  return {
    id: inquiry.id,
    status: inquiry.status,
    type: inquiry.type,
    pax: inquiry.pax,
    message: inquiry.message,
    budgetBand: inquiry.budgetBand,
    startDate: inquiry.startDate,
    endDate: inquiry.endDate,
    createdAt: inquiry.createdAt,
    updatedAt: inquiry.updatedAt,
    tourist: inquiry.tourist,
    agency: inquiry.agency,
    tour: inquiry.tour
      ? {
          ...inquiry.tour,
          basePriceLkr:
            inquiry.tour.basePriceLkr != null ? Number(inquiry.tour.basePriceLkr) : undefined,
        }
      : null,
    responses: inquiry.responses?.map(serializeResponse) ?? [],
    proposal: inquiry.proposal ? serializeProposal(inquiry.proposal) : null,
    proposalEditable: isProposalEditable(inquiry.status),
    thread: buildInquiryThread(inquiry),
  };
}

function serializeResponse(response: {
  id: string;
  message: string;
  kind: string;
  createdAt: Date;
  tour?: {
    id: string;
    title: string;
    slug: string;
    days: number;
    basePriceLkr: unknown;
    coverUrl?: string | null;
  } | null;
  itinerary?: Parameters<typeof serializeItinerary>[0] | null;
}) {
  return {
    id: response.id,
    message: response.message,
    kind: response.kind,
    createdAt: response.createdAt,
    tour: response.tour
      ? { ...response.tour, basePriceLkr: Number(response.tour.basePriceLkr) }
      : null,
    itinerary: response.itinerary ? serializeItinerary(response.itinerary) : null,
  };
}

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
      entity: {
        name: string;
        type: string;
        description: string | null;
        media: unknown;
      } | null;
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
        entity: serializeItineraryEntity(li.entity),
      })),
    })),
  };
}
