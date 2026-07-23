import { Router } from "express";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { buildTrialStatus } from "../services/trial.js";
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
  async (_req, res) => {
    res.status(503).json({
      error:
        "Online payments are not available yet. Please contact the system administrator to activate your package.",
      mode: "manual_contact",
      contact: {
        company: "IYYO Solutions",
        email: "info@iyyosolutions.com",
        phone: "+94719990173",
        whatsapp: "+94720140224",
        website: "https://iyyosolutions.com",
      },
    });
  }
);
