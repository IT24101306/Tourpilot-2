import { config } from "../lib/config.js";
import { prisma } from "../lib/prisma.js";
import {
  agencyApprovedEmail,
  commissionPaidEmail,
  finalizeEmailTemplate,
  inquiryCreatedEmail,
  inquiryExpiredEmail,
  inquiryStatusEmail,
  proposalSentEmail,
  sendPlatformEmail,
  tripMessageEmail,
  trialEndingEmail,
  walletReceiptEmail,
  welcomeEmail,
} from "./email.js";
import { getPlatformSettings } from "./platformSettings.js";
import { buildTrialStatus, chatPolicyCategoryLabel, type ChatPolicyCategory } from "@tourpilot/shared";

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

  const { scheduleAgencyReplyNudge } = await import("./followUps.js");
  void scheduleAgencyReplyNudge(inquiryId).catch(console.error);
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
  const recipients: Array<{
    userId: string;
    name: string;
    email?: string | null;
    url: string;
  }> = [];

  if (kind !== "TOURIST") {
    recipients.push({
      userId: inquiry.tourist.id,
      name: inquiry.tourist.name,
      email: inquiry.tourist.email,
      url: await tripUrl(inquiryId, "tourist"),
    });
  }
  if (kind !== "AGENCY") {
    recipients.push({
      userId: inquiry.agency.owner.id,
      name: inquiry.agency.owner.name,
      email: inquiry.agency.owner.email ?? inquiry.agency.contactEmail,
      url: await tripUrl(inquiryId, "agency"),
    });
  }
  if (inquiry.handlerInfluencer && kind !== "INFLUENCER") {
    recipients.push({
      userId: inquiry.handlerInfluencer.user.id,
      name: inquiry.handlerInfluencer.user.name,
      email: inquiry.handlerInfluencer.user.email,
      url: await tripUrl(inquiryId, "influencer"),
    });
  }

  for (const party of recipients) {
    if (party.userId === authorId) continue;
    const mail = await finalizeEmailTemplate(
      "tripMessage",
      tripMessageEmail({
        recipientName: party.name,
        preview,
        tripUrl: party.url,
      }),
      {
        recipientName: party.name,
        preview,
        tripUrl: party.url,
      }
    );
    await createNotification({
      userId: party.userId,
      type: "INQUIRY_CHAT",
      title: "New trip message",
      body: preview,
      inquiryId,
      email: party.email,
      emailContent: mail,
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

  const { scheduleProposalFollowUps } = await import("./followUps.js");
  void scheduleProposalFollowUps(inquiryId).catch(console.error);
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

  if (status === "ACCEPTED") {
    const { schedulePreTripReminder, cancelFollowUpsForInquiry } = await import("./followUps.js");
    void cancelFollowUpsForInquiry(inquiryId, [
      "PROPOSAL_NUDGE_TOURIST",
      "AGENCY_REPLY_NUDGE",
    ]).catch(console.error);
    void schedulePreTripReminder(inquiryId, inquiry.startDate).catch(console.error);
  }
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

export async function notifyWelcome(user: {
  id: string;
  name: string;
  email: string | null;
  role: string;
}) {
  if (!user.email?.trim()) return;
  const base = await appBaseUrl();
  const mail = await finalizeEmailTemplate(
    "welcome",
    welcomeEmail({ name: user.name, role: user.role, appUrl: base }),
    {
      name: user.name,
      role: user.role,
      appUrl: base,
    }
  );
  await createNotification({
    userId: user.id,
    type: "WELCOME",
    title: "Welcome to TourPilot",
    body: "Your account is ready. Explore tours and offers anytime.",
    email: user.email,
    emailContent: mail,
  });
}

export async function notifyTrialEnding(user: {
  id: string;
  name: string;
  email: string | null;
  trialEndsAt?: Date | null;
  selectedPackageName?: string | null;
  selectedPackagePriceLabel?: string | null;
  selectedPackagePriceLkr?: unknown;
  selectedPackageId?: string | null;
  selectedPackageBilling?: string | null;
  packageActivatedAt?: Date | null;
}) {
  const trial = buildTrialStatus(user);
  const packageName = trial.packageName || "your package";
  const priceLabel =
    trial.priceLabel ||
    (trial.priceLkr != null ? `LKR ${trial.priceLkr.toLocaleString("en-LK")}` : "your selected plan");
  const endsAtLabel = trial.endsAt
    ? new Date(trial.endsAt).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })
    : "soon";
  const base = await appBaseUrl();
  const activateUrl = `${base}/billing/activate`;
  const mail = await finalizeEmailTemplate(
    "trialEnding",
    trialEndingEmail({
      name: user.name,
      packageName,
      priceLabel,
      endsAtLabel,
      activateUrl,
    }),
    {
      name: user.name,
      packageName,
      priceLabel,
      endsAtLabel,
      activateUrl,
    }
  );
  await createNotification({
    userId: user.id,
    type: "TRIAL_ENDING",
    title: "Free trial ending soon",
    body: `Your trial for ${packageName} ends on ${endsAtLabel}. Activate to keep access.`,
    email: user.email,
    emailContent: mail,
  });
}

export async function notifyAgencyApproved(agencyId: string) {
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    include: { owner: { select: { id: true, name: true, email: true } } },
  });
  if (!agency) return;

  const base = await appBaseUrl();
  const dashboardUrl = `${base}/dashboard/agency`;
  const to = agency.contactEmail?.trim() || agency.owner.email?.trim() || "";
  const mail = await finalizeEmailTemplate(
    "agencyApproved",
    agencyApprovedEmail({
      agencyName: agency.name,
      ownerName: agency.owner.name,
      dashboardUrl,
    }),
    {
      agencyName: agency.name,
      ownerName: agency.owner.name,
      dashboardUrl,
    }
  );

  await createNotification({
    userId: agency.owner.id,
    type: "AGENCY_APPROVED",
    title: "Agency approved",
    body: `${agency.name} is now live on TourPilot.`,
    email: to || null,
    emailContent: mail,
  });
}

export async function notifyWalletReceipt(params: {
  userId: string;
  name: string;
  email: string | null | undefined;
  kind: "LOGIN_FEE" | "TOPUP";
  amountLkr: number;
  balanceLkr: number;
}) {
  if (!params.email?.trim() || params.amountLkr <= 0) return;
  const mail = await finalizeEmailTemplate(
    "walletReceipt",
    walletReceiptEmail({
      recipientName: params.name,
      kind: params.kind,
      amountLkr: params.amountLkr,
      balanceLkr: params.balanceLkr,
    }),
    {
      recipientName: params.name,
      kind: params.kind,
      amountLkr: String(params.amountLkr),
      balanceLkr: String(params.balanceLkr),
    }
  );
  await createNotification({
    userId: params.userId,
    type: params.kind === "LOGIN_FEE" ? "LOGIN_FEE_RECEIPT" : "WALLET_TOPUP_RECEIPT",
    title: params.kind === "LOGIN_FEE" ? "Login fee charged" : "Wallet topped up",
    body:
      params.kind === "LOGIN_FEE"
        ? `${params.amountLkr.toLocaleString()} Credits login fee charged.`
        : `${params.amountLkr.toLocaleString()} Credits added to your wallet.`,
    email: params.email,
    emailContent: mail,
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
    body: `${amountLkr.toLocaleString()} Credits was added to your wallet.`,
    email,
    emailContent: mail,
  });
}

export async function notifyAdminsChatPolicyViolation(input: {
  violationId: string;
  inquiryId: string;
  offenderUserId: string;
  categories: ChatPolicyCategory[];
}) {
  const [offender, inquiry, admins] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.offenderUserId },
      select: { id: true, name: true, role: true, phone: true, email: true },
    }),
    prisma.inquiry.findUnique({
      where: { id: input.inquiryId },
      select: {
        id: true,
        tourist: { select: { name: true } },
        agency: { select: { name: true, slug: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true, name: true, email: true },
    }),
  ]);
  if (!offender || !inquiry) return;

  const settings = await getPlatformSettings().catch(() => null);
  const base = (settings?.webAppUrl?.trim() || config.webAppUrl).replace(/\/$/, "");
  const reviewUrl = `${base}/dashboard/admin/policy-flags`;
  const tripUrl = `${base}/dashboard/admin/inquiries/${inquiry.id}/trip-room`;
  const labels = input.categories.map(chatPolicyCategoryLabel).join(", ");
  const title = "Trip chat policy violation";
  const body = `${offender.name} (${offender.role.toLowerCase()}) shared ${labels} in the ${inquiry.agency.name} × ${inquiry.tourist.name} trip room. Chat is paused.`;

  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      type: "POLICY_VIOLATION",
      title,
      body,
      inquiryId: inquiry.id,
      email: admin.email,
      emailContent: {
        subject: `Policy flag — ${offender.name} (${offender.role})`,
        text: [
          `Hello ${admin.name},`,
          "",
          "A trip-room message was blocked for sharing personal contact details.",
          "",
          `Person: ${offender.name} (${offender.role})`,
          `Phone: ${offender.phone}`,
          `Detected: ${labels}`,
          `Trip: ${inquiry.tourist.name} × ${inquiry.agency.name}`,
          "",
          `Review queue: ${reviewUrl}`,
          `Trip room: ${tripUrl}`,
          "",
          "The original message was not shown to the other person.",
          "",
          "— TourPilot",
        ].join("\n"),
      },
    });
  }
}
