import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { asJson } from "../utils/json.js";

export const adminRouter = Router();

adminRouter.use(authRequired, requireRoles("ADMIN"));

adminRouter.get("/agencies/pending", async (_req, res, next) => {
  try {
    const agencies = await prisma.agency.findMany({
      where: { status: "PENDING" },
      include: { owner: { select: { name: true, phone: true } } },
    });
    res.json(agencies);
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/agencies/:id/approve", async (req, res, next) => {
  try {
    const agency = await prisma.agency.update({
      where: { id: req.params.id },
      data: { status: "APPROVED" },
    });
    res.json(agency);
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/cms", async (_req, res, next) => {
  try {
    const pages = await prisma.cmsPage.findMany({ orderBy: { slug: "asc" } });
    res.json(pages);
  } catch (e) {
    next(e);
  }
});

adminRouter.put("/cms/:slug", async (req, res, next) => {
  try {
    const body = z
      .object({
        title: z.string(),
        blocks: z.array(z.record(z.unknown())),
        isPublished: z.boolean().optional(),
      })
      .parse(req.body);

    const page = await prisma.cmsPage.upsert({
      where: { slug: req.params.slug },
      create: {
        slug: req.params.slug,
        title: body.title,
        blocks: asJson(body.blocks),
        isPublished: body.isPublished,
      },
      update: {
        title: body.title,
        blocks: asJson(body.blocks),
        isPublished: body.isPublished,
      },
    });

    res.json(page);
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/offers/:id/registrations", async (req, res, next) => {
  try {
    const regs = await prisma.offerRegistration.findMany({
      where: { offerId: req.params.id },
      include: { user: { select: { id: true, name: true, phone: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(regs);
  } catch (e) {
    next(e);
  }
});
