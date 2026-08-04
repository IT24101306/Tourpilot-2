import { prisma } from "../lib/prisma.js";
import { createNotification } from "./notifications.js";
import { inquiryStatusEmail, finalizeEmailTemplate } from "./email.js";
import { config } from "../lib/config.js";
import { getPlatformSettings } from "./platformSettings.js";

const MS_HOUR = 60 * 60 * 1000;

async function appBaseUrl() {
  const settings = await getPlatformSettings().catch(() => null);
  return (settings?.webAppUrl?.trim() || config.webAppUrl).replace(/\/$/, "");
}

/** Schedule standard follow-ups after a proposal is sent. */
export async function scheduleProposalFollowUps(inquiryId: string) {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    select: { id: true, agencyId: true, touristId: true },
  });
  if (!inquiry) return;

  await prisma.followUpJob.updateMany({
    where: {
      inquiryId,
      kind: { in: ["PROPOSAL_NUDGE_TOURIST", "AGENCY_REPLY_NUDGE"] },
      status: "PENDING",
    },
    data: { status: "CANCELLED" },
  });

  await prisma.followUpJob.create({
    data: {
      inquiryId,
      agencyId: inquiry.agencyId,
      kind: "PROPOSAL_NUDGE_TOURIST",
      dueAt: new Date(Date.now() + 24 * MS_HOUR),
      payload: { touristId: inquiry.touristId },
    },
  });
}

/** If agency is slow to reply to a new inquiry, nudge them. */
export async function scheduleAgencyReplyNudge(inquiryId: string) {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    select: {
      id: true,
      agencyId: true,
      status: true,
      agency: { select: { ownerId: true } },
    },
  });
  if (!inquiry) return;
  if (!["NEW", "AGENCY_REVIEWING"].includes(inquiry.status)) return;

  await prisma.followUpJob.updateMany({
    where: { inquiryId, kind: "AGENCY_REPLY_NUDGE", status: "PENDING" },
    data: { status: "CANCELLED" },
  });

  await prisma.followUpJob.create({
    data: {
      inquiryId,
      agencyId: inquiry.agencyId,
      kind: "AGENCY_REPLY_NUDGE",
      dueAt: new Date(Date.now() + 12 * MS_HOUR),
      payload: { ownerId: inquiry.agency.ownerId },
    },
  });
}

export async function schedulePreTripReminder(inquiryId: string, startDate: Date | null) {
  if (!startDate) return;
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    select: { id: true, agencyId: true },
  });
  if (!inquiry) return;

  const dueAt = new Date(startDate.getTime() - 24 * MS_HOUR);
  if (dueAt.getTime() <= Date.now()) return;

  await prisma.followUpJob.updateMany({
    where: { inquiryId, kind: "PRE_TRIP_REMINDER", status: "PENDING" },
    data: { status: "CANCELLED" },
  });

  await prisma.followUpJob.create({
    data: {
      inquiryId,
      agencyId: inquiry.agencyId,
      kind: "PRE_TRIP_REMINDER",
      dueAt,
    },
  });
}

export async function cancelFollowUpsForInquiry(inquiryId: string, kinds?: string[]) {
  await prisma.followUpJob.updateMany({
    where: {
      inquiryId,
      status: "PENDING",
      ...(kinds?.length ? { kind: { in: kinds } } : {}),
    },
    data: { status: "CANCELLED" },
  });
}

async function processJob(job: {
  id: string;
  kind: string;
  inquiryId: string;
  agencyId: string;
}) {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: job.inquiryId },
    include: {
      tourist: { select: { id: true, name: true, email: true } },
      agency: { select: { id: true, name: true, ownerId: true } },
      tour: { select: { title: true } },
      proposal: { select: { id: true } },
    },
  });
  if (!inquiry) {
    await prisma.followUpJob.update({
      where: { id: job.id },
      data: { status: "CANCELLED", error: "Inquiry missing" },
    });
    return;
  }

  const base = await appBaseUrl();

  if (job.kind === "PROPOSAL_NUDGE_TOURIST") {
    if (!["SENT_TO_TOURIST", "TOURIST_VIEWED"].includes(inquiry.status)) {
      await prisma.followUpJob.update({
        where: { id: job.id },
        data: { status: "CANCELLED", error: "No longer awaiting tourist" },
      });
      return;
    }
    const tripUrl = `${base}/trips?room=${inquiry.id}`;
    const title = "Friendly reminder about your trip proposal";
    const body = `${inquiry.agency.name} is waiting for your decision${
      inquiry.tour?.title ? ` on ${inquiry.tour.title}` : ""
    }. Open your trip room to accept, revise, or ask a question.`;
    const email = await finalizeEmailTemplate(
      "inquiryStatus",
      inquiryStatusEmail({
        recipientName: inquiry.tourist.name,
        agencyName: inquiry.agency.name,
        touristName: inquiry.tourist.name,
        status: "FOLLOW_UP",
        note: body,
        tripUrl,
      }),
      {
        recipientName: inquiry.tourist.name,
        agencyName: inquiry.agency.name,
        touristName: inquiry.tourist.name,
        status: "FOLLOW_UP",
        note: body,
        tripUrl,
      }
    );
    await createNotification({
      userId: inquiry.tourist.id,
      type: "FOLLOW_UP",
      title,
      body,
      inquiryId: inquiry.id,
      email: inquiry.tourist.email,
      emailContent: email,
    });
  }

  if (job.kind === "AGENCY_REPLY_NUDGE") {
    if (inquiry.proposal || !["NEW", "AGENCY_REVIEWING", "ITINERARY_DRAFT"].includes(inquiry.status)) {
      await prisma.followUpJob.update({
        where: { id: job.id },
        data: { status: "CANCELLED", error: "Already handled" },
      });
      return;
    }
    await createNotification({
      userId: inquiry.agency.ownerId,
      type: "FOLLOW_UP",
      title: "Inquiry still needs a proposal",
      body: `${inquiry.tourist.name} is waiting. Reply within 24h to earn the Responsive host badge.`,
      inquiryId: inquiry.id,
    });
  }

  if (job.kind === "PRE_TRIP_REMINDER") {
    if (!["ACCEPTED", "IN_PROGRESS"].includes(inquiry.status)) {
      await prisma.followUpJob.update({
        where: { id: job.id },
        data: { status: "CANCELLED", error: "Trip not active" },
      });
      return;
    }
    await createNotification({
      userId: inquiry.tourist.id,
      type: "FOLLOW_UP",
      title: "Your trip is coming up",
      body: `Check your trip companion for Day 1 details and message ${inquiry.agency.name} if you need anything.`,
      inquiryId: inquiry.id,
    });
  }

  await prisma.followUpJob.update({
    where: { id: job.id },
    data: { status: "SENT", sentAt: new Date() },
  });
}

export async function processDueFollowUps() {
  const due = await prisma.followUpJob.findMany({
    where: { status: "PENDING", dueAt: { lte: new Date() } },
    take: 40,
    orderBy: { dueAt: "asc" },
  });
  let n = 0;
  for (const job of due) {
    try {
      await processJob(job);
      n += 1;
    } catch (err) {
      await prisma.followUpJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error: err instanceof Error ? err.message : "Follow-up failed",
        },
      });
    }
  }
  return n;
}

export function startFollowUpScheduler() {
  const tick = () => {
    processDueFollowUps().catch((err) => console.error("[follow-ups]", err));
  };
  tick();
  setInterval(tick, 15 * 60 * 1000);
}
