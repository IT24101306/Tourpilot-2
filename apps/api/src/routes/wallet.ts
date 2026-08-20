import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/auth.js";
import { assertAgencyFeature } from "../lib/agencyFeatures.js";
import { config } from "../lib/config.js";
import {
  payHereCheckoutUrl,
  payHereCustomerFromUser,
  payHereNotConfiguredError,
  payHereConfigured,
  requirePayHereCheckoutFields,
  verifyPayHereNotify,
} from "../lib/payhere.js";
import { fulfillWalletTopup } from "../services/wallet.js";
import { resolveWalletTopupBounds } from "../services/platformSettings.js";
import { asJson } from "../utils/json.js";

export const walletRouter = Router();

walletRouter.get("/balance", authRequired, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    res.json({ balance: Number(user.walletBalance) });
  } catch (e) {
    next(e);
  }
});

export async function startWalletTopupCheckout(input: {
  userId: string;
  amount: number;
  returnUrl: string;
  cancelUrl: string;
}) {
  if (!payHereConfigured()) throw payHereNotConfiguredError();

  const { min, max } = await resolveWalletTopupBounds();
  if (input.amount < min) {
    const err = new Error(`Minimum top-up is LKR ${min}`);
    (err as Error & { status: number }).status = 400;
    throw err;
  }
  if (max != null && input.amount > max) {
    const err = new Error(`Maximum top-up is LKR ${max}`);
    (err as Error & { status: number }).status = 400;
    throw err;
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } });
  const topup = await prisma.walletTopup.create({
    data: {
      userId: user.id,
      amountLkr: input.amount,
      currency: "LKR",
      status: "PENDING",
      provider: "payhere",
    },
  });

  const fields = requirePayHereCheckoutFields({
    orderId: topup.id,
    amountLkr: input.amount,
    itemTitle: `TourPilot wallet top-up (${input.amount} Credits)`,
    returnUrl: input.returnUrl,
    cancelUrl: input.cancelUrl,
    notifyUrl: `${config.webAppUrl}/api/wallet/payhere/notify`,
    customer: payHereCustomerFromUser(user),
  });

  await prisma.walletTopup.update({
    where: { id: topup.id },
    data: {
      checkoutUrl: payHereCheckoutUrl(),
      metadata: asJson({ fields }),
    },
  });

  return {
    mode: "payhere" as const,
    paymentId: topup.id,
    checkoutUrl: payHereCheckoutUrl(),
    fields,
  };
}

walletRouter.post("/topup", authRequired, async (req, res, next) => {
  try {
    if (req.user!.role === "AGENCY") {
      const denied = await assertAgencyFeature(req.user!.id, "walletTopup");
      if (denied) return res.status(denied.status).json({ error: denied.error });
    }

    const { amount } = z.object({ amount: z.number().positive() }).parse(req.body);
    const origin = `${config.webAppUrl}/profile/billing/methods`;
    const result = await startWalletTopupCheckout({
      userId: req.user!.id,
      amount: Math.round(amount),
      returnUrl: `${origin}?topup=1`,
      cancelUrl: `${origin}?cancelled=1`,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

walletRouter.post("/payhere/notify", async (req, res, next) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const verified = verifyPayHereNotify(body);
    if (!verified.ok || !verified.orderId) {
      return res.status(403).send("invalid_signature");
    }

    const topup = await prisma.walletTopup.findUnique({ where: { id: verified.orderId } });
    if (!topup) return res.status(404).send("unknown order");

    if (verified.statusCode === "2") {
      await fulfillWalletTopup(topup.id, verified.providerPaymentId);
    } else if (verified.statusCode === "-1" || verified.statusCode === "-2") {
      await prisma.walletTopup.update({
        where: { id: topup.id },
        data: { status: "FAILED", metadata: asJson(body) },
      });
    }

    res.status(200).send("OK");
  } catch (e) {
    next(e);
  }
});

walletRouter.get("/ledger", authRequired, async (req, res, next) => {
  try {
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).optional().default(50),
        type: z
          .enum([
            "LOGIN_FEE",
            "TOPUP",
            "COMMISSION",
            "REFUND",
            "ADJUSTMENT",
            "AGENCY_REFERRAL_REWARD",
          ])
          .optional(),
      })
      .parse(req.query);

    const entries = await prisma.walletLedger.findMany({
      where: {
        userId: req.user!.id,
        ...(query.type ? { type: query.type } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: query.limit,
    });
    res.json(
      entries.map((e) => ({
        ...e,
        amountLkr: Number(e.amountLkr),
        balanceAfter: Number(e.balanceAfter),
      }))
    );
  } catch (e) {
    next(e);
  }
});
