import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";

export const savedTripPlansRouter = Router();

const tripPlanDaySchema = z.object({
  dayNumber: z.number().int().min(1),
  accommodation: z
    .object({ entityId: z.string(), name: z.string() })
    .nullable()
    .optional(),
  transport: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  activities: z.array(z.object({ entityId: z.string(), name: z.string() })).default([]),
  viewpoints: z.array(z.object({ entityId: z.string(), name: z.string() })).default([]),
  dining: z.array(z.object({ entityId: z.string(), name: z.string() })).default([]),
});

const tripPlanSchema = z.object({
  title: z.string().min(1).max(200),
  agencySlug: z.string().min(1),
  days: z.array(tripPlanDaySchema).min(1),
  estimatedTotalLkr: z.number().min(0).optional(),
});

function serializeSavedPlan(row: {
  id: string;
  title: string;
  plan: unknown;
  estimatedLkr: unknown;
  createdAt: Date;
  updatedAt: Date;
  agency: { id: string; name: string; slug: string };
}) {
  return {
    id: row.id,
    title: row.title,
    plan: row.plan,
    estimatedTotalLkr: row.estimatedLkr != null ? Number(row.estimatedLkr) : null,
    savedAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    agency: row.agency,
    buildPath: `/agencies/${row.agency.slug}/build-my-trip`,
  };
}

savedTripPlansRouter.get(
  "/mine",
  authRequired,
  requireRoles("TOURIST"),
  async (req, res, next) => {
    try {
      const rows = await prisma.savedTripPlan.findMany({
        where: { userId: req.user!.id },
        include: { agency: { select: { id: true, name: true, slug: true } } },
        orderBy: { updatedAt: "desc" },
      });
      res.json(rows.map(serializeSavedPlan));
    } catch (e) {
      next(e);
    }
  }
);

savedTripPlansRouter.post("/", authRequired, requireRoles("TOURIST"), async (req, res, next) => {
  try {
    const body = z
      .object({
        agencyId: z.string(),
        title: z.string().min(1).max(200).optional(),
        plan: tripPlanSchema,
      })
      .parse(req.body);

    const agency = await prisma.agency.findFirst({
      where: { id: body.agencyId, status: "APPROVED" },
      select: { id: true, slug: true },
    });
    if (!agency) return res.status(404).json({ error: "Agency not found" });
    if (agency.slug !== body.plan.agencySlug) {
      return res.status(400).json({ error: "Trip plan does not match this agency" });
    }

    const title = body.title?.trim() || body.plan.title.trim() || "My itinerary";
    const estimatedLkr = body.plan.estimatedTotalLkr ?? null;

    const saved = await prisma.savedTripPlan.create({
      data: {
        userId: req.user!.id,
        agencyId: agency.id,
        title,
        plan: body.plan,
        estimatedLkr,
      },
      include: { agency: { select: { id: true, name: true, slug: true } } },
    });

    res.status(201).json(serializeSavedPlan(saved));
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message || "Invalid trip plan" });
    }
    next(e);
  }
});

savedTripPlansRouter.delete(
  "/:id",
  authRequired,
  requireRoles("TOURIST"),
  async (req, res, next) => {
    try {
      await prisma.savedTripPlan.deleteMany({
        where: { id: req.params.id, userId: req.user!.id },
      });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  }
);
