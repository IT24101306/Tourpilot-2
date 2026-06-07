import type { UserRole, WalletTxnType } from "@prisma/client";
import { LOGIN_FEE_LKR } from "@tourpilot/shared";
import { prisma } from "../lib/prisma.js";

export async function chargeLoginFee(userId: string, role: UserRole) {
  const fee = LOGIN_FEE_LKR[role as keyof typeof LOGIN_FEE_LKR] ?? 0;
  if (fee <= 0) return { charged: 0, balance: null as number | null };

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const balance = Number(user.walletBalance);

  if (balance < fee) {
    const err = new Error(`Insufficient wallet balance. Login fee: LKR ${fee}`);
    (err as Error & { status: number }).status = 402;
    throw err;
  }

  const newBalance = balance - fee;
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { walletBalance: newBalance },
    }),
    prisma.walletLedger.create({
      data: {
        userId,
        type: "LOGIN_FEE" as WalletTxnType,
        amountLkr: -fee,
        balanceAfter: newBalance,
        note: `Login fee (${role})`,
      },
    }),
  ]);

  return { charged: fee, balance: newBalance };
}

export async function topUpWallet(userId: string, amount: number) {
  if (amount <= 0) {
    const err = new Error("Amount must be positive");
    (err as Error & { status: number }).status = 400;
    throw err;
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const newBalance = Number(user.walletBalance) + amount;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { walletBalance: newBalance },
    }),
    prisma.walletLedger.create({
      data: {
        userId,
        type: "TOPUP",
        amountLkr: amount,
        balanceAfter: newBalance,
        note: "Wallet top-up",
      },
    }),
  ]);

  return { balance: newBalance };
}

/** Credit influencer wallet when admin marks a commission PAID. Idempotent per commission id. */
export async function creditCommissionPayout(commissionId: string) {
  const commission = await prisma.commission.findUnique({
    where: { id: commissionId },
    include: {
      influencer: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  if (!commission) {
    const err = new Error("Commission not found");
    (err as Error & { status: number }).status = 404;
    throw err;
  }

  const userId = commission.influencer.user.id;
  const amount = Number(commission.amountLkr);

  if (commission.status === "PAID") {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { alreadyPaid: true, balance: Number(user.walletBalance) };
  }
  if (commission.status === "CANCELLED") {
    const err = new Error("Cannot pay a cancelled commission");
    (err as Error & { status: number }).status = 400;
    throw err;
  }

  const existing = await prisma.walletLedger.findFirst({
    where: { userId, note: { contains: commissionId } },
  });
  if (existing) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { alreadyPaid: true, balance: Number(user.walletBalance) };
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const newBalance = Number(user.walletBalance) + amount;

    await tx.user.update({
      where: { id: userId },
      data: { walletBalance: newBalance },
    });

    await tx.walletLedger.create({
      data: {
        userId,
        type: "COMMISSION",
        amountLkr: amount,
        balanceAfter: newBalance,
        note: `Commission payout ${commissionId}`,
      },
    });

    const updated = await tx.commission.update({
      where: { id: commissionId },
      data: { status: "PAID" },
    });

    return { balance: newBalance, commission: updated, user: commission.influencer.user };
  });

  return { alreadyPaid: false, balance: result.balance, user: result.user, amountLkr: amount };
}
