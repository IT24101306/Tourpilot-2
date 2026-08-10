import type { AgencyReferralInviteStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { isValidInternationalPhone, toStoredPhone } from "../utils/phone.js";
import { getAgencyReferralSettings } from "./platformSettings.js";
import { createNotification } from "./notifications.js";

function httpError(message: string, status: number) {
  const err = new Error(message);
  (err as Error & { status: number }).status = status;
  return err;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export async function countSuccessfulReferrals(referrerAgencyId: string): Promise<number> {
  return prisma.agencyReferralInvite.count({
    where: { referrerAgencyId, status: "APPROVED" },
  });
}

export async function createAgencyReferralInvite(params: {
  referrerAgencyId: string;
  referrerOwnerId: string;
  referrerOwnerPhone: string;
  referrerStatus: string;
  phoneRaw: string;
}) {
  const settings = await getAgencyReferralSettings();
  if (!settings.enabled) {
    throw httpError("Agency referrals are disabled", 403);
  }
  if (params.referrerStatus !== "APPROVED") {
    throw httpError("Only approved agencies can invite referrals", 403);
  }

  const phone = toStoredPhone(params.phoneRaw);
  if (!isValidInternationalPhone(phone)) {
    throw httpError(
      "Invalid phone number. Include country code (e.g. +94771234567).",
      400
    );
  }

  if (phone === params.referrerOwnerPhone) {
    throw httpError("You cannot refer your own phone number", 400);
  }

  const successful = await countSuccessfulReferrals(params.referrerAgencyId);
  if (successful >= settings.cap) {
    throw httpError(`Referral limit reached (${settings.cap} successful referrals)`, 400);
  }

  const existingUser = await prisma.user.findUnique({ where: { phone } });
  if (existingUser) {
    if (existingUser.role === "AGENCY") {
      throw httpError("An agency account already exists for this phone", 409);
    }
    throw httpError(
      "This phone already has an account. Referral invites require a new agency signup phone.",
      409
    );
  }

  const existingInvite = await prisma.agencyReferralInvite.findUnique({
    where: { inviteePhone: phone },
  });
  if (existingInvite) {
    if (existingInvite.status === "CANCELLED" || existingInvite.status === "EXPIRED") {
      // Allow re-invite only if cancelled/expired and still first-wins semantics: update to new referrer if cancelled
      if (existingInvite.referrerAgencyId !== params.referrerAgencyId) {
        throw httpError("This phone was already invited by another agency", 409);
      }
      return prisma.agencyReferralInvite.update({
        where: { id: existingInvite.id },
        data: {
          status: "PENDING",
          cancelledAt: null,
          registeredAgencyId: null,
        },
      });
    }
    throw httpError("This phone already has a referral invite", 409);
  }

  return prisma.agencyReferralInvite.create({
    data: {
      referrerAgencyId: params.referrerAgencyId,
      inviteePhone: phone,
      status: "PENDING",
    },
  });
}

export async function cancelAgencyReferralInvite(params: {
  referrerAgencyId: string;
  inviteId: string;
}) {
  const invite = await prisma.agencyReferralInvite.findFirst({
    where: { id: params.inviteId, referrerAgencyId: params.referrerAgencyId },
  });
  if (!invite) throw httpError("Invite not found", 404);
  if (invite.status !== "PENDING") {
    throw httpError("Only pending invites can be cancelled", 400);
  }
  return prisma.agencyReferralInvite.update({
    where: { id: invite.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
}

/** Bind invite on agency registration (same transaction). */
export async function bindReferralOnAgencyCreate(
  tx: Prisma.TransactionClient,
  params: {
    phone: string;
    agencyId: string;
  }
): Promise<{ referredByAgencyId: string } | null> {
  const invite = await tx.agencyReferralInvite.findUnique({
    where: { inviteePhone: params.phone },
  });
  if (!invite || invite.status !== "PENDING") return null;

  await tx.agency.update({
    where: { id: params.agencyId },
    data: {
      referredByAgencyId: invite.referrerAgencyId,
      referralRegistrantBenefitPending: true,
    },
  });

  await tx.agencyReferralInvite.update({
    where: { id: invite.id },
    data: {
      status: "REGISTERED",
      registeredAgencyId: params.agencyId,
    },
  });

  return { referredByAgencyId: invite.referrerAgencyId };
}

/** Start 12-month reward window when referred agency is approved. */
export async function activateReferralOnAgencyApproval(agencyId: string) {
  const settings = await getAgencyReferralSettings();
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      id: true,
      referredByAgencyId: true,
      referralApprovedAt: true,
      referralRewardEndsAt: true,
    },
  });
  if (!agency?.referredByAgencyId) return null;

  const now = new Date();
  // Only set window once (first approval).
  const approvedAt = agency.referralApprovedAt ?? now;
  const rewardEndsAt =
    agency.referralRewardEndsAt ?? addMonths(approvedAt, settings.rewardMonths);

  const updated = await prisma.agency.update({
    where: { id: agencyId },
    data: {
      referralApprovedAt: approvedAt,
      referralRewardEndsAt: rewardEndsAt,
    },
  });

  await prisma.agencyReferralInvite.updateMany({
    where: {
      registeredAgencyId: agencyId,
      status: { in: ["REGISTERED", "PENDING"] },
    },
    data: { status: "APPROVED" },
  });

  return updated;
}

export async function listAgencyReferrals(referrerAgencyId: string) {
  const settings = await getAgencyReferralSettings();
  const invites = await prisma.agencyReferralInvite.findMany({
    where: { referrerAgencyId },
    orderBy: { createdAt: "desc" },
    include: {
      registeredAgency: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          referralApprovedAt: true,
          referralRewardEndsAt: true,
        },
      },
    },
  });

  const successfulCount = invites.filter((i) => i.status === "APPROVED").length;
  const referrer = await prisma.agency.findUniqueOrThrow({
    where: { id: referrerAgencyId },
    select: { ownerId: true },
  });

  const earningsAgg = await prisma.walletLedger.aggregate({
    where: {
      userId: referrer.ownerId,
      type: "AGENCY_REFERRAL_REWARD",
    },
    _sum: { amountLkr: true },
  });

  return {
    enabled: settings.enabled,
    cap: settings.cap,
    loginFeePct: settings.loginFeePct,
    rewardMonths: settings.rewardMonths,
    successfulCount,
    remainingSlots: Math.max(0, settings.cap - successfulCount),
    totalEarningsLkr: Math.round(Number(earningsAgg._sum.amountLkr ?? 0)),
    invites: invites.map((i) => ({
      id: i.id,
      inviteePhone: i.inviteePhone,
      status: i.status as AgencyReferralInviteStatus,
      createdAt: i.createdAt.toISOString(),
      cancelledAt: i.cancelledAt?.toISOString() ?? null,
      registeredAgency: i.registeredAgency
        ? {
            id: i.registeredAgency.id,
            name: i.registeredAgency.name,
            slug: i.registeredAgency.slug,
            status: i.registeredAgency.status,
            referralApprovedAt: i.registeredAgency.referralApprovedAt?.toISOString() ?? null,
            referralRewardEndsAt:
              i.registeredAgency.referralRewardEndsAt?.toISOString() ?? null,
          }
        : null,
    })),
  };
}

/**
 * After a charged login fee on an agency owner, credit the referrer if within window.
 * Idempotent via ledger note containing sourceLedgerId.
 */
export async function creditAgencyReferralReward(params: {
  inviteeOwnerId: string;
  loginFeeCharged: number;
  sourceLedgerId: string;
}) {
  if (params.loginFeeCharged <= 0) return null;

  const settings = await getAgencyReferralSettings();
  if (!settings.enabled || settings.loginFeePct <= 0) return null;

  const inviteeAgency = await prisma.agency.findUnique({
    where: { ownerId: params.inviteeOwnerId },
    select: {
      id: true,
      name: true,
      referredByAgencyId: true,
      referralRewardEndsAt: true,
      status: true,
    },
  });

  if (
    !inviteeAgency?.referredByAgencyId ||
    inviteeAgency.status !== "APPROVED" ||
    !inviteeAgency.referralRewardEndsAt ||
    inviteeAgency.referralRewardEndsAt.getTime() < Date.now()
  ) {
    return null;
  }

  const reward = Math.floor((params.loginFeeCharged * settings.loginFeePct) / 100);
  if (reward <= 0) return null;

  const noteMarker = `sourceLedger:${params.sourceLedgerId}`;
  const already = await prisma.walletLedger.findFirst({
    where: {
      type: "AGENCY_REFERRAL_REWARD",
      note: { contains: noteMarker },
    },
  });
  if (already) return null;

  const referrer = await prisma.agency.findUnique({
    where: { id: inviteeAgency.referredByAgencyId },
    select: {
      id: true,
      name: true,
      owner: { select: { id: true, name: true, email: true, walletBalance: true } },
    },
  });
  if (!referrer) return null;

  const newBalance = Number(referrer.owner.walletBalance) + reward;

  const [ledger] = await prisma.$transaction([
    prisma.walletLedger.create({
      data: {
        userId: referrer.owner.id,
        type: "AGENCY_REFERRAL_REWARD",
        amountLkr: reward,
        balanceAfter: newBalance,
        note: `Agency referral ${settings.loginFeePct}% of login fee from ${inviteeAgency.name} (${noteMarker})`,
      },
    }),
    prisma.user.update({
      where: { id: referrer.owner.id },
      data: { walletBalance: newBalance },
    }),
  ]);

  void createNotification({
    userId: referrer.owner.id,
    type: "AGENCY_REFERRAL_REWARD",
    title: "Referral reward credited",
    body: `${reward.toLocaleString()} Credits from ${inviteeAgency.name}'s login fee.`,
    email: referrer.owner.email,
  }).catch((err) => console.error("[agency referral notify]", err));

  return { reward, ledgerId: ledger.id, referrerUserId: referrer.owner.id, balance: newBalance };
}
