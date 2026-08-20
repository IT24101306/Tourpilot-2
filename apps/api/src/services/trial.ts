import {
  TRIAL_DAYS,
  TRIAL_REMINDER_HOURS_BEFORE,
  buildTrialStatus,
  isTrialActive,
  isTrialExpiredUnpaid,
  trialEndsAtFrom,
  type PackageBilling,
  type SelectedPackageInput,
} from "@tourpilot/shared";
import type { Prisma, UserRole, WalletTxnType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { notifyTrialEnding } from "./notifications.js";
import { asJson } from "../utils/json.js";

export { buildTrialStatus, isTrialActive, isTrialExpiredUnpaid };

const PACKAGE_BILLINGS = new Set(["MONTHLY", "ONE_TIME", "PAYG", "CUSTOM"]);

export function parseSelectedPackage(raw: unknown): SelectedPackageInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const packageId = typeof o.packageId === "string" ? o.packageId.trim() : "";
  const packageName = typeof o.packageName === "string" ? o.packageName.trim() : "";
  if (!packageId || !packageName) return null;
  const priceLkr = Math.max(0, Math.round(Number(o.priceLkr) || 0));
  const priceLabel =
    typeof o.priceLabel === "string" && o.priceLabel.trim()
      ? o.priceLabel.trim()
      : priceLkr > 0
        ? `LKR ${priceLkr.toLocaleString("en-LK")}`
        : "Selected package";
  const billingRaw = typeof o.billing === "string" ? o.billing.toUpperCase() : "MONTHLY";
  const billing = (PACKAGE_BILLINGS.has(billingRaw) ? billingRaw : "CUSTOM") as PackageBilling;
  return { packageId, packageName, priceLkr, priceLabel, billing };
}

/** Full feature unlock during trial (and until admin changes flags). */
export const TRIAL_AGENCY_FEATURES = {
  featureDriversAndPartners: true,
  featureSupport: true,
  featureWalletTopup: true,
  featureOffers: true,
  featureDisplay: true,
  featureReadyMadeTours: true,
  featureCustomInquiries: true,
  featureNegotiationsBookings: true,
  featureCustomDomain: true,
  featureExternalStorefront: true,
  featureSessionInactivityTimeout: false,
} as const;

export function trialUserUpdateData(pkg: SelectedPackageInput) {
  const ends = trialEndsAtFrom(new Date(), TRIAL_DAYS);
  return {
    trialEndsAt: ends,
    trialReminderSentAt: null as Date | null,
    selectedPackageId: pkg.packageId,
    selectedPackageName: pkg.packageName,
    selectedPackagePriceLkr: pkg.priceLkr,
    selectedPackagePriceLabel: pkg.priceLabel,
    selectedPackageBilling: pkg.billing,
    packageActivatedAt: null as Date | null,
  };
}

export async function chargeLoginFeeIfDue(userId: string) {
  const { chargeLoginFee } = await import("./wallet.js");
  return chargeLoginFee(userId);
}

export async function activateSelectedPackage(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.packageActivatedAt) {
    return {
      ok: true as const,
      alreadyActive: true,
      balance: Number(user.walletBalance),
      trial: buildTrialStatus(user),
    };
  }
  if (!user.selectedPackageId) {
    const err = new Error("No package selected for this account");
    (err as Error & { status: number }).status = 400;
    throw err;
  }

  const billing = (user.selectedPackageBilling || "MONTHLY") as PackageBilling;
  const amount = Math.round(Number(user.selectedPackagePriceLkr ?? 0));
  const balance = Number(user.walletBalance);

  if (billing === "PAYG") {
    const loginFee = amount > 0 ? amount : 0;
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        packageActivatedAt: new Date(),
        subscriptionPeriodEnd: null,
        loginFeeLkr: loginFee > 0 ? loginFee : null,
      },
    });
    return {
      ok: true as const,
      alreadyActive: false,
      charged: 0,
      balance: Number(updated.walletBalance),
      trial: buildTrialStatus(updated),
      mode: "PAYG" as const,
    };
  }

  if (amount <= 0) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        packageActivatedAt: new Date(),
        subscriptionPeriodEnd: null,
      },
    });
    return {
      ok: true as const,
      alreadyActive: false,
      charged: 0,
      balance: Number(updated.walletBalance),
      trial: buildTrialStatus(updated),
      mode: "FREE" as const,
    };
  }

  if (balance < amount) {
    const err = new Error(
      `Insufficient wallet balance. Package due: ${amount.toLocaleString("en-LK")} Credits. Top up your wallet first.`
    );
    (err as Error & { status: number; code: string }).status = 402;
    (err as Error & { status: number; code: string }).code = "INSUFFICIENT_BALANCE";
    throw err;
  }

  const newBalance = balance - amount;
  const periodEnd = billing === "MONTHLY" ? addDays(new Date(), 30) : null;
  const [, updated] = await prisma.$transaction([
    prisma.walletLedger.create({
      data: {
        userId,
        type: "ADJUSTMENT" as WalletTxnType,
        amountLkr: -amount,
        balanceAfter: newBalance,
        note: `Package activation: ${user.selectedPackageName || user.selectedPackageId} (${billing})`,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        walletBalance: newBalance,
        packageActivatedAt: new Date(),
        subscriptionPeriodEnd: periodEnd,
      },
    }),
  ]);

  return {
    ok: true as const,
    alreadyActive: false,
    charged: amount,
    balance: Number(updated.walletBalance),
    trial: buildTrialStatus(updated),
    mode: billing,
  };
}

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export function subscriptionPeriodEndForBilling(
  billing: PackageBilling | string | null | undefined,
  from = new Date()
): Date | null {
  if (billing === "MONTHLY") return addDays(from, 30);
  return null;
}

/** Mark package active after a successful SubscriptionPayment (PayHere / demo). */
export async function fulfillSubscriptionPayment(
  paymentId: string,
  opts?: { providerRef?: string; metadata?: object }
) {
  const payment = await prisma.subscriptionPayment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    const err = new Error("Subscription payment not found");
    (err as Error & { status: number }).status = 404;
    throw err;
  }
  if (payment.status === "COMPLETED") {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: payment.userId } });
    return { payment, user, alreadyPaid: true as const };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: payment.userId } });
  const billing = (user.selectedPackageBilling || "MONTHLY") as PackageBilling;
  const now = new Date();
  const base =
    user.subscriptionPeriodEnd && user.subscriptionPeriodEnd.getTime() > now.getTime()
      ? user.subscriptionPeriodEnd
      : now;
  const periodEnd = subscriptionPeriodEndForBilling(billing, base);

  const data: {
    packageActivatedAt: Date;
    subscriptionPeriodEnd: Date | null;
    loginFeeLkr?: number | null;
  } = {
    packageActivatedAt: user.packageActivatedAt ?? now,
    subscriptionPeriodEnd: periodEnd,
  };

  if (billing === "PAYG") {
    const fee = Math.round(Number(user.selectedPackagePriceLkr ?? 0));
    data.loginFeeLkr = fee > 0 ? fee : null;
  }

  const [, updatedUser] = await prisma.$transaction([
    prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: "COMPLETED",
        paidAt: now,
        payhereOrderId: opts?.providerRef || payment.payhereOrderId,
        ...(opts?.metadata ? { metadata: asJson(opts.metadata) } : {}),
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data,
    }),
  ]);

  return {
    payment: { ...payment, status: "COMPLETED" as const, paidAt: now },
    user: updatedUser,
    alreadyPaid: false as const,
  };
}

export async function sendDueTrialReminders() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + TRIAL_REMINDER_HOURS_BEFORE * 60 * 60 * 1000);

  const due = await prisma.user.findMany({
    where: {
      trialEndsAt: { gt: now, lte: windowEnd },
      packageActivatedAt: null,
      trialReminderSentAt: null,
      role: { in: ["AGENCY", "INFLUENCER", "DRIVER"] as UserRole[] },
    },
    take: 50,
  });

  let sent = 0;
  for (const user of due) {
    await notifyTrialEnding(user);
    await prisma.user.update({
      where: { id: user.id },
      data: { trialReminderSentAt: new Date() },
    });
    sent += 1;
  }
  if (sent > 0) console.log(`[trial] Sent ${sent} trial-ending reminder(s)`);
  return sent;
}

export function startTrialReminderScheduler(intervalMs = 60 * 60 * 1000) {
  const run = () => {
    sendDueTrialReminders().catch((err) => console.error("[trial-reminder]", err));
  };
  run();
  return setInterval(run, intervalMs);
}

export type AdminSubscriptionPatch = {
  packageId?: string | null;
  packageName?: string | null;
  priceLkr?: number | null;
  priceLabel?: string | null;
  billing?: PackageBilling | null;
  /** ISO date string or null to clear */
  trialEndsAt?: string | null;
  /** Extend trial from max(now, current end) by N days */
  extendTrialDays?: number;
  /** Restart a fresh TRIAL_DAYS trial and clear activation */
  restartTrial?: boolean;
  /** Mark package activated now without charging wallet */
  activate?: boolean;
  /** Clear packageActivatedAt (treat as unpaid again) */
  deactivate?: boolean;
  /** ISO date string or null to clear */
  packageActivatedAt?: string | null;
  /** ISO date string or null to clear */
  subscriptionPeriodEnd?: string | null;
  subscriptionAutoRenew?: boolean;
  /** When activating MONTHLY without explicit period end, set +30 days */
  setDefaultPeriodOnActivate?: boolean;
  /** Apply full trial feature unlock on the agency */
  applyTrialFeatures?: boolean;
};

export function serializeUserSubscription(user: {
  id: string;
  walletBalance: unknown;
  trialEndsAt?: Date | string | null;
  packageActivatedAt?: Date | string | null;
  selectedPackageId?: string | null;
  selectedPackageName?: string | null;
  selectedPackagePriceLkr?: unknown;
  selectedPackagePriceLabel?: string | null;
  selectedPackageBilling?: string | null;
  subscriptionAutoRenew?: boolean;
  subscriptionPeriodEnd?: Date | string | null;
  loginFeeLkr?: unknown;
}) {
  const periodEnd = user.subscriptionPeriodEnd
    ? typeof user.subscriptionPeriodEnd === "string"
      ? user.subscriptionPeriodEnd
      : user.subscriptionPeriodEnd.toISOString()
    : null;
  return {
    ownerId: user.id,
    walletBalance: Number(user.walletBalance),
    autoRenew: Boolean(user.subscriptionAutoRenew),
    periodEnd,
    loginFeeLkr:
      user.loginFeeLkr != null && Number.isFinite(Number(user.loginFeeLkr))
        ? Math.round(Number(user.loginFeeLkr))
        : null,
    trial: buildTrialStatus(user),
  };
}

function parseOptionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const err = new Error("Invalid date");
    (err as Error & { status: number }).status = 400;
    throw err;
  }
  return d;
}

/** Admin override: set package/trial/activation on an agency owner without charging wallet. */
export async function adminUpdateOwnerSubscription(
  ownerId: string,
  agencyId: string,
  patch: AdminSubscriptionPatch
) {
  const owner = await prisma.user.findUnique({ where: { id: ownerId } });
  if (!owner) {
    const err = new Error("Owner not found");
    (err as Error & { status: number }).status = 404;
    throw err;
  }

  const data: Prisma.UserUpdateInput = {};

  if (patch.packageId !== undefined) data.selectedPackageId = patch.packageId;
  if (patch.packageName !== undefined) data.selectedPackageName = patch.packageName;
  if (patch.priceLkr !== undefined) {
    data.selectedPackagePriceLkr =
      patch.priceLkr == null ? null : Math.max(0, Math.round(patch.priceLkr));
  }
  if (patch.priceLabel !== undefined) data.selectedPackagePriceLabel = patch.priceLabel;
  if (patch.billing !== undefined) data.selectedPackageBilling = patch.billing;

  if (patch.subscriptionAutoRenew !== undefined) {
    data.subscriptionAutoRenew = patch.subscriptionAutoRenew;
  }

  const periodEnd = parseOptionalDate(patch.subscriptionPeriodEnd);
  if (periodEnd !== undefined) data.subscriptionPeriodEnd = periodEnd;

  const activatedAt = parseOptionalDate(patch.packageActivatedAt);
  if (activatedAt !== undefined) data.packageActivatedAt = activatedAt;

  if (patch.restartTrial) {
    const ends = trialEndsAtFrom(new Date(), TRIAL_DAYS);
    data.trialEndsAt = ends;
    data.trialReminderSentAt = null;
    data.packageActivatedAt = null;
    data.subscriptionPeriodEnd = null;
  } else if (patch.extendTrialDays != null && patch.extendTrialDays > 0) {
    const now = new Date();
    const current =
      owner.trialEndsAt && owner.trialEndsAt.getTime() > now.getTime()
        ? owner.trialEndsAt
        : now;
    data.trialEndsAt = addDays(current, patch.extendTrialDays);
    data.trialReminderSentAt = null;
  } else {
    const trialEnds = parseOptionalDate(patch.trialEndsAt);
    if (trialEnds !== undefined) {
      data.trialEndsAt = trialEnds;
      if (trialEnds) data.trialReminderSentAt = null;
    }
  }

  if (patch.deactivate) {
    data.packageActivatedAt = null;
  }

  if (patch.activate) {
    const now = new Date();
    data.packageActivatedAt = now;
    const billing = (patch.billing ?? owner.selectedPackageBilling ?? "MONTHLY") as PackageBilling;
    if (patch.setDefaultPeriodOnActivate !== false && billing === "MONTHLY") {
      if (periodEnd === undefined) {
        const base =
          owner.subscriptionPeriodEnd && owner.subscriptionPeriodEnd.getTime() > now.getTime()
            ? owner.subscriptionPeriodEnd
            : now;
        data.subscriptionPeriodEnd = subscriptionPeriodEndForBilling(billing, base);
      }
    }
    if (billing === "PAYG") {
      const fee = Math.round(
        Number(patch.priceLkr ?? owner.selectedPackagePriceLkr ?? 0)
      );
      if (fee > 0) data.loginFeeLkr = fee;
    }
  }

  const updated = await prisma.user.update({
    where: { id: ownerId },
    data,
  });

  if (patch.applyTrialFeatures || patch.restartTrial) {
    await prisma.agency.update({
      where: { id: agencyId },
      data: { ...TRIAL_AGENCY_FEATURES },
    });
  }

  return serializeUserSubscription(updated);
}

export function trialExemptPath(url: string): boolean {
  const path = url.split("?")[0] || "";
  return (
    path === "/api/auth/me" ||
    path.startsWith("/api/wallet") ||
    path.startsWith("/api/billing") ||
    path.startsWith("/api/subscription") ||
    path.startsWith("/api/support") ||
    path.startsWith("/api/uploads")
  );
}
