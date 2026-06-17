import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { syncReferralCodeCommissionPct } from "../lib/influencerCommissionRequests.js";

export type CommissionRequestAction = "AGREE" | "REJECT" | "NEGOTIATE";

const activeStatuses = ["PENDING", "NEGOTIATING"] as const;

export type SerializedCommissionMessage = {
  id: string;
  authorRole: "INFLUENCER" | "AGENCY";
  action: "REQUEST" | "NEGOTIATE" | "AGREE" | "REJECT";
  proposedPct: number | null;
  body: string;
  createdAt: string;
};

export type SerializedCommissionRequest = {
  id: string;
  status: "PENDING" | "NEGOTIATING" | "APPROVED" | "REJECTED";
  requestedPct: number;
  currentOfferPct: number;
  pendingActor: "INFLUENCER" | "AGENCY";
  offerByRole: "INFLUENCER" | "AGENCY" | null;
  approvedPct: number | null;
  message: string;
  agencyNote: string | null;
  createdAt: string;
  updatedAt: string;
  tour: { id: string; title: string; slug: string };
  influencer: { id: string; name: string; phone: string };
  agency: { id: string; name: string };
  messages: SerializedCommissionMessage[];
};

const requestInclude = {
  tour: { select: { id: true, title: true, slug: true } },
  agency: { select: { id: true, name: true, ownerId: true } },
  influencer: {
    include: { user: { select: { id: true, name: true, phone: true } } },
  },
  messages: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.InfluencerCommissionRequestInclude;

type RequestRow = Prisma.InfluencerCommissionRequestGetPayload<{ include: typeof requestInclude }>;

export function serializeCommissionRequest(row: RequestRow): SerializedCommissionRequest {
  return {
    id: row.id,
    status: row.status,
    requestedPct: Number(row.requestedPct),
    currentOfferPct: Number(row.currentOfferPct ?? row.requestedPct),
    pendingActor: row.pendingActor,
    offerByRole: row.offerByRole,
    approvedPct: row.approvedPct != null ? Number(row.approvedPct) : null,
    message: row.message,
    agencyNote: row.agencyNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    tour: row.tour,
    agency: row.agency,
    influencer: {
      id: row.influencer.id,
      name: row.influencer.user.name,
      phone: row.influencer.user.phone,
    },
    messages: row.messages.map((m) => ({
      id: m.id,
      authorRole: m.authorRole,
      action: m.action,
      proposedPct: m.proposedPct != null ? Number(m.proposedPct) : null,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export async function createCommissionRequest(input: {
  influencerId: string;
  influencerUserId: string;
  tourId: string;
  agencyId: string;
  requestedPct: number;
  message: string;
  tourTitle: string;
  influencerName: string;
  agencyOwnerId: string;
  agencyName: string;
}) {
  const existing = await prisma.influencerCommissionRequest.findFirst({
    where: {
      influencerId: input.influencerId,
      tourId: input.tourId,
      status: { in: [...activeStatuses] },
    },
  });
  if (existing) {
    throw Object.assign(new Error("You already have an open commission negotiation for this tour."), {
      status: 409,
    });
  }

  const created = await prisma.$transaction(async (tx) => {
    const request = await tx.influencerCommissionRequest.create({
      data: {
        influencerId: input.influencerId,
        tourId: input.tourId,
        agencyId: input.agencyId,
        requestedPct: input.requestedPct,
        currentOfferPct: input.requestedPct,
        message: input.message,
        status: "PENDING",
        pendingActor: "AGENCY",
        offerByRole: "INFLUENCER",
        messages: {
          create: {
            authorRole: "INFLUENCER",
            authorId: input.influencerUserId,
            action: "REQUEST",
            proposedPct: input.requestedPct,
            body: input.message,
          },
        },
      },
      include: requestInclude,
    });

    await tx.notification.create({
      data: {
        userId: input.agencyOwnerId,
        type: "COMMISSION_REQUEST",
        title: "Influencer commission request",
        body: `${input.influencerName} requested ${input.requestedPct}% commission on "${input.tourTitle}".`,
      },
    });

    return request;
  });

  return serializeCommissionRequest(created);
}

export async function applyCommissionRequestAction(input: {
  requestId: string;
  actorRole: "INFLUENCER" | "AGENCY";
  actorUserId: string;
  action: CommissionRequestAction;
  proposedPct?: number;
  body?: string;
  agencyName?: string;
  influencerUserId?: string;
}) {
  const row = await prisma.influencerCommissionRequest.findUnique({
    where: { id: input.requestId },
    include: requestInclude,
  });
  if (!row) throw Object.assign(new Error("Request not found"), { status: 404 });

  if (!activeStatuses.includes(row.status as (typeof activeStatuses)[number])) {
    throw Object.assign(new Error("This negotiation is already closed."), { status: 400 });
  }

  if (row.pendingActor !== input.actorRole) {
    throw Object.assign(new Error("It is not your turn to respond."), { status: 400 });
  }

  const note = input.body?.trim() || "";
  const otherRole = input.actorRole === "AGENCY" ? "INFLUENCER" : "AGENCY";

  if (input.action === "REJECT") {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.influencerCommissionMessage.create({
        data: {
          requestId: row.id,
          authorRole: input.actorRole,
          authorId: input.actorUserId,
          action: "REJECT",
          body: note || "Declined this commission negotiation.",
        },
      });

      const request = await tx.influencerCommissionRequest.update({
        where: { id: row.id },
        data: {
          status: "REJECTED",
          agencyNote: input.actorRole === "AGENCY" ? note || row.agencyNote : row.agencyNote,
        },
        include: requestInclude,
      });

      const notifyUserId =
        input.actorRole === "AGENCY" ? row.influencer.userId : row.agency.ownerId;
      const actorLabel = input.actorRole === "AGENCY" ? input.agencyName ?? "The agency" : "The influencer";
      await tx.notification.create({
        data: {
          userId: notifyUserId,
          type: "COMMISSION_REQUEST",
          title: "Commission negotiation ended",
          body: `${actorLabel} declined the commission request for "${row.tour.title}".`,
        },
      });

      return request;
    });

    return serializeCommissionRequest(updated);
  }

  if (input.action === "AGREE") {
    const approvedPct = Number(row.currentOfferPct ?? row.requestedPct);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.influencerCommissionMessage.create({
        data: {
          requestId: row.id,
          authorRole: input.actorRole,
          authorId: input.actorUserId,
          action: "AGREE",
          proposedPct: approvedPct,
          body: note || `Agreed to ${approvedPct}% commission.`,
        },
      });

      const request = await tx.influencerCommissionRequest.update({
        where: { id: row.id },
        data: {
          status: "APPROVED",
          approvedPct,
          agencyNote: input.actorRole === "AGENCY" ? note || row.agencyNote : row.agencyNote,
        },
        include: requestInclude,
      });

      await syncReferralCodeCommissionPct(row.influencerId, row.tourId, approvedPct);

      const notifyUserId =
        input.actorRole === "AGENCY" ? row.influencer.userId : row.agency.ownerId;
      const actorLabel = input.actorRole === "AGENCY" ? input.agencyName ?? "The agency" : "The influencer";
      await tx.notification.create({
        data: {
          userId: notifyUserId,
          type: "COMMISSION_REQUEST",
          title: "Commission agreed",
          body: `${actorLabel} agreed to ${approvedPct}% commission on "${row.tour.title}".`,
        },
      });

      return request;
    });

    return serializeCommissionRequest(updated);
  }

  if (input.action === "NEGOTIATE") {
    const pct = input.proposedPct;
    if (pct == null || !Number.isFinite(pct) || pct < 0 || pct > 50) {
      throw Object.assign(new Error("Enter a commission percentage between 0 and 50."), {
        status: 400,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.influencerCommissionMessage.create({
        data: {
          requestId: row.id,
          authorRole: input.actorRole,
          authorId: input.actorUserId,
          action: "NEGOTIATE",
          proposedPct: pct,
          body: note || `Proposed ${pct}% commission.`,
        },
      });

      const request = await tx.influencerCommissionRequest.update({
        where: { id: row.id },
        data: {
          status: "NEGOTIATING",
          currentOfferPct: pct,
          offerByRole: input.actorRole,
          pendingActor: otherRole,
          agencyNote: input.actorRole === "AGENCY" ? note || row.agencyNote : row.agencyNote,
        },
        include: requestInclude,
      });

      const notifyUserId =
        input.actorRole === "AGENCY" ? row.influencer.userId : row.agency.ownerId;
      const actorLabel = input.actorRole === "AGENCY" ? input.agencyName ?? "The agency" : "The influencer";
      await tx.notification.create({
        data: {
          userId: notifyUserId,
          type: "COMMISSION_REQUEST",
          title: "Commission counter-offer",
          body: `${actorLabel} proposed ${pct}% commission on "${row.tour.title}".`,
        },
      });

      return request;
    });

    return serializeCommissionRequest(updated);
  }

  throw Object.assign(new Error("Invalid action"), { status: 400 });
}

export async function getAgencyCommissionRequests(agencyId: string, status?: string) {
  const rows = await prisma.influencerCommissionRequest.findMany({
    where: {
      agencyId,
      ...(status && status !== "all"
        ? { status: status as Prisma.EnumInfluencerCommissionRequestStatusFilter }
        : {}),
    },
    include: requestInclude,
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return rows.map(serializeCommissionRequest);
}

export async function getInfluencerCommissionRequests(influencerId: string) {
  const rows = await prisma.influencerCommissionRequest.findMany({
    where: { influencerId },
    include: requestInclude,
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return rows.map(serializeCommissionRequest);
}

export async function getOpenAgencyCommissionRequestCount(agencyId: string) {
  return prisma.influencerCommissionRequest.count({
    where: {
      agencyId,
      status: { in: [...activeStatuses] },
      pendingActor: "AGENCY",
    },
  });
}
