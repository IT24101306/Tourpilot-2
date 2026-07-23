import { Router } from "express";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { activateSelectedPackage, buildTrialStatus } from "../services/trial.js";
import { prisma } from "../lib/prisma.js";

export const billingRouter = Router();

billingRouter.get("/trial", authRequired, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    res.json({ trial: buildTrialStatus(user), walletBalance: Number(user.walletBalance) });
  } catch (e) {
    next(e);
  }
});

billingRouter.post(
  "/activate-package",
  authRequired,
  requireRoles("AGENCY", "INFLUENCER", "DRIVER"),
  async (req, res, next) => {
    try {
      const result = await activateSelectedPackage(req.user!.id);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);
