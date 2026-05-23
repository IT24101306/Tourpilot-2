import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/auth.js";
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
    const { amount } = z.object({ amount: z.number().positive() }).parse(req.body);
    const result = await topUpWallet(req.user!.id, amount);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

walletRouter.get("/ledger", authRequired, async (req, res, next) => {
  try {
    const entries = await prisma.walletLedger.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 50,
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
