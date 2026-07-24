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
import type { UserRole, WalletTxnType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { notifyTrialEnding } from "./notifications.js";

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
export async function fulfillSubscriptionPayment(paymentId: string) {
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
      data: { status: "COMPLETED", paidAt: now },
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
