import { Router } from "express";
import { z } from "zod";
import { isDisplayCurrency } from "@tourpilot/shared";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";

export const touristRouter = Router();

const displayCurrencySchema = z.object({
  displayCurrency: z.string().refine(isDisplayCurrency, {
    message: "displayCurrency must be a supported currency code",
  }),
});

touristRouter.patch("/me/display-currency", authRequired, requireRoles("TOURIST"), async (req, res, next) => {
  try {
    const body = displayCurrencySchema.parse(req.body);

    const profile = await prisma.touristProfile.upsert({
      where: { userId: req.user!.id },
      update: { displayCurrency: body.displayCurrency } as { displayCurrency: string },
      create: {
        userId: req.user!.id,
        displayCurrency: body.displayCurrency,
      } as { userId: string; displayCurrency: string },
    });

    const saved = profile as typeof profile & { displayCurrency: string };
    res.json({ displayCurrency: saved.displayCurrency ?? body.displayCurrency });
  } catch (e) {
    next(e);
  }
});
