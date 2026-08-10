import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/auth.js";
import { assertAgencyFeature } from "../lib/agencyFeatures.js";
import { topUpWallet } from "../services/wallet.js";

export const walletRouter = Router();

walletRouter.get("/balance", authRequired, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    res.json({ balance: Number(user.walletBalance) });
  } catch (e) {
    next(e);
  }
});

walletRouter.post("/topup", authRequired, async (req, res, next) => {
  try {
    // Agency product flag — tourists/influencers keep profile topup.
    if (req.user!.role === "AGENCY") {
      const denied = await assertAgencyFeature(req.user!.id, "walletTopup");
      if (denied) return res.status(denied.status).json({ error: denied.error });
    }

    const { amount } = z.object({ amount: z.number().positive() }).parse(req.body);
    const result = await topUpWallet(req.user!.id, amount);
    res.json(result);
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
