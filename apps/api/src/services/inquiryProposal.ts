import { prisma } from "../lib/prisma.js";
import { resolveReferralCommissionLkr } from "../lib/referralCommission.js";
import { createInquiryItinerary, itineraryBodySchema } from "../routes/inquiryResponses.js";
import { createInquiryMessage } from "./inquiryMessages.js";
import { z } from "zod";

export const proposalBodySchema = z.object({
  message: z.string().min(1, "Message to the tourist is required"),
  readyMadeTourIds: z.array(z.string()).default([]),
  customItineraries: z.array(itineraryBodySchema).default([]),
});

export type ProposalBody = z.infer<typeof proposalBodySchema>;

const LOCKED_STATUSES = new Set(["ACCEPTED", "DECLINED", "EXPIRED"]);

export function isProposalEditable(status: string) {
  return !LOCKED_STATUSES.has(status);
}

const proposalInclude = {
  items: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      tour: {
        select: {
          id: true,
          title: true,
          slug: true,
          days: true,
          basePriceLkr: true,
          coverUrl: true,
          tourKind: true,
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
};

export async function upsertInquiryProposal(
  inquiryId: string,
  agencyId: string,
  authorId: string,
  body: ProposalBody
) {
  if (!body.readyMadeTourIds.length && !body.customItineraries.length) {
    throw new Error("Add at least one ready-made tour or custom itinerary");
  }

  const inquiry = await prisma.inquiry.findFirst({
    where: { id: inquiryId, agencyId },
    include: { proposal: { include: { items: true } } },
  });

  if (!inquiry) throw new Error("Inquiry not found");
  const hadProposal = Boolean(inquiry.proposal);
  if (!isProposalEditable(inquiry.status)) {
    throw new Error("This inquiry can no longer be edited — the tourist has already responded.");
  }

  const uniqueTourIds = [...new Set(body.readyMadeTourIds)];
  if (uniqueTourIds.length) {
    const tours = await prisma.tour.findMany({
      where: {
        id: { in: uniqueTourIds },
        agencyId,
        isPublished: true,
        tourKind: "READY_MADE",
      },
    });
    if (tours.length !== uniqueTourIds.length) {
      throw new Error("One or more selected tours are invalid");
    }
  }

  const proposal = await prisma.$transaction(async (tx) => {
    const existing = inquiry.proposal;

    if (existing) {
      const oldItineraryIds = existing.items
        .map((item) => item.itineraryId)
        .filter((id): id is string => Boolean(id));

      await tx.inquiryProposalItem.deleteMany({ where: { proposalId: existing.id } });

      if (oldItineraryIds.length) {
        await tx.itinerary.deleteMany({ where: { id: { in: oldItineraryIds } } });
      }

      await tx.inquiryProposal.update({
        where: { id: existing.id },
        data: { message: body.message.trim() },
      });
    } else {
      await tx.inquiryProposal.create({
        data: { inquiryId, message: body.message.trim() },
      });
    }

    const proposalRow = await tx.inquiryProposal.findUniqueOrThrow({
      where: { inquiryId },
    });

    let sortOrder = 0;

    for (const tourId of uniqueTourIds) {
      await tx.inquiryProposalItem.create({
        data: {
          proposalId: proposalRow.id,
          kind: "READY_MADE",
          tourId,
          sortOrder: sortOrder++,
        },
      });
    }

    for (const itineraryInput of body.customItineraries) {
      const { itinerary } = await createInquiryItinerary(inquiryId, itineraryInput, tx);
      await tx.inquiryProposalItem.create({
        data: {
          proposalId: proposalRow.id,
          kind: "CUSTOM",
          itineraryId: itinerary.id,
          sortOrder: sortOrder++,
        },
      });
    }

    await tx.inquiry.update({
      where: { id: inquiryId },
      data: {
        status: "SENT_TO_TOURIST",
        statusHistory: {
          create: {
            status: "SENT_TO_TOURIST",
            note: body.message.slice(0, 500),
            actorId: authorId,
          },
        },
      },
    });

    return tx.inquiryProposal.findUniqueOrThrow({
      where: { inquiryId },
      include: proposalInclude,
    });
  });

  await syncReferralCommission(inquiryId, inquiry.referralCodeId);

  await createInquiryMessage(
    inquiryId,
    authorId,
    "AGENCY",
    body.message.trim(),
    hadProposal ? "PROPOSAL_UPDATED" : "PROPOSAL_SENT"
  );

  const { notifyProposalSent } = await import("./notifications.js");
  void notifyProposalSent(inquiryId).catch(console.error);

  return proposal;
}

async function syncReferralCommission(inquiryId: string, referralCodeId: string | null) {
  if (!referralCodeId) return;

  const customItems = await prisma.inquiryProposalItem.findMany({
    where: { proposal: { inquiryId }, kind: "CUSTOM" },
    include: { itinerary: true },
  });

  const grandTotal = customItems.reduce(
    (sum, item) => sum + Number(item.itinerary?.grandMax ?? 0),
    0
  );

  if (grandTotal <= 0) return;

  const amount = await resolveReferralCommissionLkr(referralCodeId, grandTotal);
  if (amount <= 0) return;

  const ref = await prisma.referralCode.findUnique({ where: { id: referralCodeId } });
  if (!ref) return;

  await prisma.commission.upsert({
    where: { inquiryId },
    create: {
      inquiryId,
      referralCodeId: ref.id,
      influencerId: ref.influencerId,
      amountLkr: amount,
      status: "PENDING",
    },
    update: { amountLkr: amount },
  });
}

export function serializeProposal(proposal: {
  id: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    kind: string;
    sortOrder: number;
    tour?: {
      id: string;
      title: string;
      slug: string;
      days: number;
      basePriceLkr: unknown;
      coverUrl: string | null;
      tourKind: string;
    } | null;
    itinerary?: {
      id: string;
      title: string | null;
      grandMax: unknown;
      shareToken: string | null;
      isSent: boolean;
      days?: Array<{
        dayNumber: number;
        title: string | null;
        lineItems: Array<{
          label: string;
          kind: string;
          priceLkr: unknown;
          priceOnRequest: boolean;
          entity: { name: string; type: string } | null;
        }>;
      }>;
    } | null;
  }>;
}) {
  return {
    id: proposal.id,
    message: proposal.message,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
    items: proposal.items.map((item) => ({
      id: item.id,
      kind: item.kind,
      sortOrder: item.sortOrder,
      tour: item.tour
        ? { ...item.tour, basePriceLkr: Number(item.tour.basePriceLkr) }
        : null,
      itinerary: item.itinerary
        ? {
            id: item.itinerary.id,
            title: item.itinerary.title,
            grandMax: Number(item.itinerary.grandMax),
            shareToken: item.itinerary.shareToken,
            isSent: item.itinerary.isSent,
            days: item.itinerary.days?.map((d) => ({
              dayNumber: d.dayNumber,
              title: d.title,
              lineItems: d.lineItems.map((li) => ({
                label: li.label,
                kind: li.kind,
                priceLkr: li.priceLkr != null ? Number(li.priceLkr) : null,
                priceOnRequest: li.priceOnRequest,
                entity: li.entity,
              })),
            })),
          }
        : null,
    })),
  };
}

export { proposalInclude };
