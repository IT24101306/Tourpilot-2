import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const cmsRouter = Router();

/** Public published CMS page by slug (home, terms, …). */
cmsRouter.get("/:slug", async (req, res, next) => {
  try {
    const page = await prisma.cmsPage.findUnique({
      where: { slug: req.params.slug },
    });
    if (!page || !page.isPublished) {
      return res.status(404).json({ error: "Page not found" });
    }
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
