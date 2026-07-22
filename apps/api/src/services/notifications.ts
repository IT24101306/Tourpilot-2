import { config } from "../lib/config.js";
import { prisma } from "../lib/prisma.js";
import {
  commissionPaidEmail,
  finalizeEmailTemplate,
  inquiryCreatedEmail,
  inquiryExpiredEmail,
  inquiryStatusEmail,
  proposalSentEmail,
  sendPlatformEmail,
} from "./email.js";
import { getPlatformSettings } from "./platformSettings.js";

export type NotifyInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  inquiryId?: string;
  email?: string | null;
  emailContent?: { subject: string; text: string; html?: string };
};

export async function createNotification(input: NotifyInput) {
  const row = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      inquiryId: input.inquiryId,
    },
  });

  if (input.email?.trim() && input.emailContent) {
    void sendPlatformEmail({
      to: input.email.trim(),
      ...input.emailContent,
    }).catch((err) => console.error("[notify email]", err));
  }

  return row;
}

async function appBaseUrl() {
  const settings = await getPlatformSettings().catch(() => null);
  return (settings?.webAppUrl?.trim() || config.webAppUrl).replace(/\/$/, "");
}

async function tripUrl(inquiryId: string, role: "agency" | "tourist" | "influencer") {
  const base = await appBaseUrl();
  if (role === "agency") return `${base}/dashboard/agency/trip-room/${inquiryId}`;
  if (role === "influencer") return `${base}/dashboard/i/trip-room/${inquiryId}`;
  return `${base}/trips/${inquiryId}`;
}

export async function notifyInquiryCreated(inquiryId: string) {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    include: {
      agency: { include: { owner: { select: { id: true, name: true, email: true } } } },
      tourist: { select: { id: true, name: true, email: true } },
      handlerInfluencer: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!inquiry) return;

  if (inquiry.handlerInfluencer) {
    const url = await tripUrl(inquiryId, "influencer");
    await createNotification({
      userId: inquiry.handlerInfluencer.user.id,
      type: "INQUIRY_CREATED",
      title: "New traveler inquiry",
      body: `${inquiry.tourist.name} inquired about a tour you shared.`,
      inquiryId,
      email: inquiry.handlerInfluencer.user.email,
      emailContent: {
        subject: `New inquiry via your TourPilot page`,
        text: [
          `Hello ${inquiry.handlerInfluencer.user.name},`,
          "",
          `${inquiry.tourist.name} sent an inquiry on a tour you share as yours.`,
          "",
          `Open chat: ${url}`,
          "",
          "— TourPilot",
        ].join("\n"),
      },
    });
  }

  const url = await tripUrl(inquiryId, "agency");
  const email = await finalizeEmailTemplate(
    "inquiryCreated",
    inquiryCreatedEmail({
      agencyName: inquiry.agency.name,
      touristName: inquiry.tourist.name,
      tripUrl: url,
    }),
    {
      agencyName: inquiry.agency.name,
      touristName: inquiry.tourist.name,
      tripUrl: url,
    }
  );

  await createNotification({
    userId: inquiry.agency.owner.id,
    type: "INQUIRY_CREATED",
    title: inquiry.handlerInfluencer
      ? "New inquiry (influencer-handled chat)"
      : "New trip inquiry",
    body: inquiry.handlerInfluencer
      ? `${inquiry.tourist.name} inquired via ${inquiry.handlerInfluencer.user.name}'s page.`
      : `${inquiry.tourist.name} submitted a new inquiry.`,
    inquiryId,
    email: inquiry.agency.owner.email ?? inquiry.agency.contactEmail,
    emailContent: email,
  });
}

export async function notifyInquiryChatMessage(
  inquiryId: string,
  authorId: string,
  body: string,
  kind: string
) {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    include: {
      agency: { include: { owner: { select: { id: true, email: true, name: true } } } },
      tourist: { select: { id: true, name: true, email: true } },
      handlerInfluencer: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!inquiry) return;

  const preview = body.length > 120 ? `${body.slice(0, 117)}…` : body;
  const recipients: Array<{ userId: string; email?: string | null; url: string }> = [];

  if (kind !== "TOURIST") {
    recipients.push({
      userId: inquiry.tourist.id,
      email: inquiry.tourist.email,
      url: await tripUrl(inquiryId, "tourist"),
    });
  }
  if (kind !== "AGENCY") {
    recipients.push({
      userId: inquiry.agency.owner.id,
      email: inquiry.agency.owner.email ?? inquiry.agency.contactEmail,
      url: await tripUrl(inquiryId, "agency"),
    });
  }
  if (inquiry.handlerInfluencer && kind !== "INFLUENCER") {
    recipients.push({
      userId: inquiry.handlerInfluencer.user.id,
      email: inquiry.handlerInfluencer.user.email,
      url: await tripUrl(inquiryId, "influencer"),
    });
  }

  for (const party of recipients) {
    if (party.userId === authorId) continue;
    await createNotification({
      userId: party.userId,
      type: "INQUIRY_CHAT",
      title: "New trip message",
      body: preview,
      inquiryId,
    });
  }
}

export async function notifyProposalSent(inquiryId: string) {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    include: {
      agency: { select: { name: true, ownerId: true } },
      tourist: { select: { id: true, name: true, email: true } },
    },
  });
  if (!inquiry) return;

  const url = await tripUrl(inquiryId, "tourist");
  const email = await finalizeEmailTemplate(
    "proposalSent",
    proposalSentEmail({
      touristName: inquiry.tourist.name,
      agencyName: inquiry.agency.name,
      tripUrl: url,
    }),
    {
      touristName: inquiry.tourist.name,
      agencyName: inquiry.agency.name,
      tripUrl: url,
    }
  );

  await createNotification({
    userId: inquiry.tourist.id,
    type: "PROPOSAL_SENT",
    title: "New tour proposal",
    body: `${inquiry.agency.name} sent you a tour proposal.`,
    inquiryId,
    email: inquiry.tourist.email,
    emailContent: email,
  });
}

export async function notifyInquiryStatusChange(
  inquiryId: string,
  status: string,
  note?: string
) {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    include: {
      agency: { include: { owner: { select: { id: true, name: true, email: true } } } },
      tourist: { select: { id: true, name: true, email: true } },
    },
  });
  if (!inquiry) return;

  const agencyUrl = await tripUrl(inquiryId, "agency");
  const touristUrl = await tripUrl(inquiryId, "tourist");
  const statusVars = {
    agencyName: inquiry.agency.name,
    touristName: inquiry.tourist.name,
    status,
    note: note || "",
  };

  const agencyEmail = await finalizeEmailTemplate(
    "inquiryStatus",
    inquiryStatusEmail({
      recipientName: inquiry.agency.owner.name,
      agencyName: inquiry.agency.name,
      touristName: inquiry.tourist.name,
      status,
      tripUrl: agencyUrl,
      note,
    }),
    { ...statusVars, recipientName: inquiry.agency.owner.name, tripUrl: agencyUrl }
  );

  await createNotification({
    userId: inquiry.agency.owner.id,
    type: "INQUIRY_STATUS",
    title: `Inquiry ${status.replace(/_/g, " ").toLowerCase()}`,
    body: note || `Status is now ${status}.`,
    inquiryId,
    email: inquiry.agency.owner.email ?? inquiry.agency.contactEmail,
    emailContent: agencyEmail,
  });

  const touristEmail = await finalizeEmailTemplate(
    "inquiryStatus",
    inquiryStatusEmail({
      recipientName: inquiry.tourist.name,
      agencyName: inquiry.agency.name,
      touristName: inquiry.tourist.name,
      status,
      tripUrl: touristUrl,
      note,
    }),
    { ...statusVars, recipientName: inquiry.tourist.name, tripUrl: touristUrl }
  );

  await createNotification({
    userId: inquiry.tourist.id,
    type: "INQUIRY_STATUS",
    title: `Inquiry ${status.replace(/_/g, " ").toLowerCase()}`,
    body: note || `Status is now ${status}.`,
    inquiryId,
    email: inquiry.tourist.email,
    emailContent: touristEmail,
  });
}

export async function notifyInquiryExpired(inquiryId: string) {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    include: {
      agency: { include: { owner: { select: { id: true, name: true, email: true } } } },
      tourist: { select: { id: true, name: true, email: true } },
    },
  });
  if (!inquiry) return;

  const agencyUrl = await tripUrl(inquiryId, "agency");
  const touristUrl = await tripUrl(inquiryId, "tourist");

  for (const party of [
    {
      userId: inquiry.agency.owner.id,
      name: inquiry.agency.owner.name,
      email: inquiry.agency.owner.email ?? inquiry.agency.contactEmail,
      url: agencyUrl,
    },
    {
      userId: inquiry.tourist.id,
      name: inquiry.tourist.name,
      email: inquiry.tourist.email,
      url: touristUrl,
    },
  ]) {
    const mail = await finalizeEmailTemplate(
      "inquiryExpired",
      inquiryExpiredEmail({
        recipientName: party.name,
        agencyName: inquiry.agency.name,
        tripUrl: party.url,
      }),
      {
        recipientName: party.name,
        agencyName: inquiry.agency.name,
        tripUrl: party.url,
      }
    );
    await createNotification({
      userId: party.userId,
      type: "INQUIRY_EXPIRED",
      title: "Trip inquiry expired",
      body: `Inquiry with ${inquiry.agency.name} expired due to inactivity.`,
      inquiryId,
      email: party.email,
      emailContent: mail,
    });
  }
}

export async function notifyAdminInquiryMessage(inquiryId: string, body: string) {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    include: {
      agency: { include: { owner: { select: { id: true, name: true, email: true } } } },
      tourist: { select: { id: true, name: true, email: true } },
    },
  });
  if (!inquiry) return;

  const preview = body.length > 120 ? `${body.slice(0, 117)}…` : body;
  const agencyUrl = `${config.webAppUrl}/dashboard/agency/trip-room/${inquiryId}`;
  const touristUrl = `${config.webAppUrl}/trips/${inquiryId}`;

  for (const party of [
    {
      userId: inquiry.agency.owner.id,
      name: inquiry.agency.owner.name,
      email: inquiry.agency.owner.email ?? inquiry.agency.contactEmail,
      url: agencyUrl,
    },
    {
      userId: inquiry.tourist.id,
      name: inquiry.tourist.name,
      email: inquiry.tourist.email,
      url: touristUrl,
    },
  ]) {
    await createNotification({
      userId: party.userId,
      type: "ADMIN_INQUIRY_MESSAGE",
      title: "Message from TourPilot",
      body: preview,
      inquiryId,
      email: party.email,
      emailContent: {
        subject: "TourPilot platform message on your trip inquiry",
        text: [
          `Hello ${party.name},`,
          "",
          "A TourPilot admin posted a message in your trip room:",
          "",
          body,
          "",
          `Open trip room: ${party.url}`,
          "",
          "— TourPilot",
        ].join("\n"),
      },
    });
  }
}

export async function notifyCommissionApproved(inquiryId: string) {
  const commission = await prisma.commission.findUnique({
    where: { inquiryId },
    include: {
      influencer: { include: { user: { select: { id: true, name: true, email: true } } } },
      inquiry: { include: { agency: { select: { name: true } }, tourist: { select: { name: true } } } },
    },
  });
  if (!commission) return;

  await createNotification({
    userId: commission.influencer.user.id,
    type: "COMMISSION_APPROVED",
    title: "Commission approved",
    body: `LKR ${Number(commission.amountLkr).toLocaleString()} approved for ${commission.inquiry.agency.name} inquiry.`,
    inquiryId,
    email: commission.influencer.user.email,
    emailContent: {
      subject: "TourPilot — referral commission approved",
      text: [
        `Hello ${commission.influencer.user.name},`,
        "",
        `Your referral commission of LKR ${Number(commission.amountLkr).toLocaleString()} was approved.`,
        `Tourist ${commission.inquiry.tourist.name} accepted the proposal from ${commission.inquiry.agency.name}.`,
        "",
        "Admin will credit your wallet when marked PAID.",
        "",
        "— TourPilot",
      ].join("\n"),
    },
  });
}

export async function notifyCommissionPaid(
  userId: string,
  influencerName: string,
  email: string | null | undefined,
  amountLkr: number,
  walletBalance: number
) {
  const mail = await finalizeEmailTemplate(
    "commissionPaid",
    commissionPaidEmail({ influencerName, amountLkr, walletBalance }),
    {
      influencerName,
      amountLkr: String(amountLkr),
      walletBalance: String(walletBalance),
    }
  );
  await createNotification({
    userId,
    type: "COMMISSION_PAID",
    title: "Commission credited",
    body: `LKR ${amountLkr.toLocaleString()} was added to your wallet.`,
    email,
    emailContent: mail,
  });
}
