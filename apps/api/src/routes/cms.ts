import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getPlatformSettings } from "../services/platformSettings.js";

export const cmsRouter = Router();

/** Public published CMS page by slug (landing, terms, etc.). */
cmsRouter.get("/:slug", async (req, res, next) => {
  try {
    const page = await prisma.cmsPage.findFirst({
      where: { slug: req.params.slug, isPublished: true },
    });
    if (!page) return res.status(404).json({ error: "Page not found" });
    res.json({
      slug: page.slug,
      title: page.title,
      blocks: page.blocks,
      updatedAt: page.updatedAt,
    });
  } catch (e) {
    next(e);
  }
});

export const publicSettingsRouter = Router();

/** Role login fee defaults + wallet top-up bounds (for login UI). */
publicSettingsRouter.get("/", async (_req, res, next) => {
  try {
    const settings = await getPlatformSettings();
    res.json({
      loginFees: settings.loginFees,
      walletTopupMinLkr: settings.walletTopupMinLkr,
      walletTopupMaxLkr: settings.walletTopupMaxLkr,
    });
  } catch (e) {
    next(e);
  }
});
