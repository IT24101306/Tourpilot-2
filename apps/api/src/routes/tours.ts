import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { authRequired, getAgencyForUser, requireRoles } from "../middleware/auth.js";
import { attachTourPricing } from "../lib/tourPricing.js";
import {
  getLinkedOffersByTourIds,
  syncTourOfferLinksInTx,
  tourOfferLinkBodySchema,
  validateTourOfferLinkBody,
} from "../services/tourOfferLinks.js";
import { slugify } from "../utils/slug.js";

export const toursRouter = Router();

const dayPlanSchema = z.object({
  dayNumber: z.number().int().min(1),
  title: z.string().optional(),
  items: z.array(
    z.object({
      entityId: z.string(),
      scheduledTime: z.string().min(1),
      sortOrder: z.number().int().default(0),
    })
  ),
});

const withPlanBodySchema = z.object({
  title: z.string().min(1),
  tourKind: z.enum(["READY_MADE", "CUSTOM"]),
  basePriceLkr: z.number().nonnegative().optional(),
  influencerCommissionPct: z.number().min(0).max(50).nullable().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  coverUrl: z.string().optional(),
  isPublished: z.boolean().optional(),
  dayPlans: z.array(dayPlanSchema),
  offerLink: tourOfferLinkBodySchema,
});

type TourDb = Prisma.TransactionClient | typeof prisma;

async function getAgencyTour(agencyId: string, tourId: string, db: TourDb = prisma) {
  return db.tour.findFirst({
    where: { id: tourId, agencyId },
    include: {
      tourDays: {
        orderBy: { dayNumber: "asc" },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
            include: { entity: { select: { id: true, name: true, type: true } } },
          },
        },
      },
    },
  });
}

async function replaceTourDayPlans(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  agencyId: string,
  tourId: string,
  dayPlans: z.infer<typeof dayPlanSchema>[]
) {
  await tx.tourDay.deleteMany({ where: { tourId } });

  for (const day of dayPlans) {
    const entityIds = day.items.map((i) => i.entityId);
    const validEntities = await tx.entity.findMany({
      where: { agencyId, id: { in: entityIds } },
    });
    if (validEntities.length !== new Set(entityIds).size) {
      throw Object.assign(new Error("One or more entities are invalid for this agency"), {
        status: 400,
      });
    }

    const tourDay = await tx.tourDay.create({
      data: {
        tourId,
        dayNumber: day.dayNumber,
        title: day.title ?? `Day ${day.dayNumber}`,
      },
    });

    for (const item of day.items) {
      const entity = validEntities.find((e) => e.id === item.entityId)!;
      await tx.tourDayItem.create({
        data: {
          tourDayId: tourDay.id,
          entityId: item.entityId,
          scheduledTime: item.scheduledTime,
          sortOrder: item.sortOrder,
          label: entity.name,
          priceLkr: entity.priceHint,
        },
      });
    }
  }
}

toursRouter.get("/admin/all", authRequired, requireRoles("ADMIN"), async (_req, res, next) => {
  try {
    const tours = await prisma.tour.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        isPublished: true,
        basePriceLkr: true,
        agency: { select: { id: true, name: true, slug: true, influencerCommissionPct: true } },
      },
    });
    res.json(
      tours.map((t) => ({
        ...t,
        basePriceLkr: Number(t.basePriceLkr),
      }))
    );
  } catch (e) {
    next(e);
  }
});

toursRouter.get("/public/:agencySlug/:tourSlug", async (req, res, next) => {
  try {
    const agency = await prisma.agency.findFirst({
      where: { slug: req.params.agencySlug, status: "APPROVED" },
    });
    if (!agency) return res.status(404).json({ error: "Not found" });

    const tour = await prisma.tour.findFirst({
      where: { agencyId: agency.id, slug: req.params.tourSlug, isPublished: true },
      include: {
        tourDays: {
          orderBy: { dayNumber: "asc" },
          include: {
            items: {
              orderBy: { sortOrder: "asc" },
              include: { entity: true, group: true },
            },
          },
        },
        agency: { select: { id: true, name: true, slug: true, influencerCommissionPct: true } },
      },
    });

    if (!tour) return res.status(404).json({ error: "Tour not found" });
    res.json(serializeTourDetail(tour));
  } catch (e) {
    next(e);
  }
});

toursRouter.get("/agency/mine", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const tourKind = req.query.tourKind as string | undefined;
    const tours = await prisma.tour.findMany({
      where: {
        agencyId: agency.id,
        ...(tourKind && tourKind !== "all" ? { tourKind: tourKind as never } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        tourDays: {
          orderBy: { dayNumber: "asc" },
          include: {
            items: {
              orderBy: { sortOrder: "asc" },
              include: { entity: { select: { id: true, name: true, type: true } } },
            },
          },
        },
      },
    });
    const pct = Number(agency.influencerCommissionPct);
    const tourIds = tours.map((t) => t.id);
    const linkedMap = await getLinkedOffersByTourIds(agency.id, tourIds);
    res.json(
      tours.map((t) => serializeTourListItem(t, pct, linkedMap.get(t.id) ?? []))
    );
  } catch (e) {
    next(e);
  }
});

toursRouter.get("/agency/:id", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const tour = await getAgencyTour(agency.id, req.params.id);
    if (!tour) return res.status(404).json({ error: "Tour not found" });

    const linkedMap = await getLinkedOffersByTourIds(agency.id, [tour.id]);
    res.json(
      serializeTourAgencyDetail(tour, Number(agency.influencerCommissionPct), linkedMap.get(tour.id) ?? [])
    );
  } catch (e) {
    next(e);
  }
});

toursRouter.post("/with-plan", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const body = withPlanBodySchema.parse(req.body);

    if (body.dayPlans.length === 0) {
      return res.status(400).json({ error: "Add at least one day" });
    }

    for (const day of body.dayPlans) {
      if (day.items.length === 0) {
        return res.status(400).json({ error: `Day ${day.dayNumber} needs at least one timed entity` });
      }
    }

    let slug = slugify(body.title);
    const exists = await prisma.tour.findFirst({ where: { agencyId: agency.id, slug } });
    if (exists) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const dayCount = body.dayPlans.length;
    const kindLabel = body.tourKind === "READY_MADE" ? "Ready-Made" : "Custom";
    const willPublish = body.isPublished ?? body.tourKind === "READY_MADE";

    if (body.offerLink) {
      const linkErr = validateTourOfferLinkBody(body.offerLink, { isPublished: willPublish });
      if (linkErr) return res.status(400).json({ error: linkErr });
    }

    const tour = await prisma.$transaction(async (tx) => {
      const created = await tx.tour.create({
        data: {
          agencyId: agency.id,
          title: body.title.trim(),
          slug,
          days: dayCount,
          tourKind: body.tourKind,
          summary: body.summary?.trim() || `${kindLabel} ${dayCount} day tour`,
          description: body.description?.trim() || null,
          coverUrl: body.coverUrl?.trim() || null,
          basePriceLkr: body.basePriceLkr ?? 0,
          ...(body.influencerCommissionPct !== undefined
            ? { influencerCommissionPct: body.influencerCommissionPct }
            : {}),
          isPublished: willPublish,
        },
      });

      await replaceTourDayPlans(tx, agency.id, created.id, body.dayPlans);

      if (body.offerLink) {
        await syncTourOfferLinksInTx(tx, agency.id, created.id, body.offerLink);
      }

      const loaded = await getAgencyTour(agency.id, created.id, tx);
      if (!loaded) throw new Error("Tour not found after create");
      return loaded;
    });

    const linkedMap = await getLinkedOffersByTourIds(agency.id, [tour.id]);
    res
      .status(201)
      .json(
        serializeTourListItem(
          tour,
          Number(agency.influencerCommissionPct),
          linkedMap.get(tour.id) ?? []
        )
      );
  } catch (e) {
    const err = e as Error & { status?: number };
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(e);
  }
});

toursRouter.put("/:id/with-plan", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const existing = await getAgencyTour(agency.id, req.params.id);
    if (!existing) return res.status(404).json({ error: "Tour not found" });

    const body = withPlanBodySchema.parse(req.body);

    if (body.dayPlans.length === 0) {
      return res.status(400).json({ error: "Add at least one day" });
    }
    for (const day of body.dayPlans) {
      if (day.items.length === 0) {
        return res.status(400).json({ error: `Day ${day.dayNumber} needs at least one timed entity` });
      }
    }

    const dayCount = body.dayPlans.length;
    const kindLabel = body.tourKind === "READY_MADE" ? "Ready-Made" : "Custom";

    let slug = existing.slug;
    if (slugify(body.title) !== slugify(existing.title)) {
      slug = slugify(body.title);
      const clash = await prisma.tour.findFirst({
        where: { agencyId: agency.id, slug, NOT: { id: existing.id } },
      });
      if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    const willPublish = body.isPublished ?? existing.isPublished;

    if (body.offerLink) {
      const linkErr = validateTourOfferLinkBody(body.offerLink, { isPublished: willPublish });
      if (linkErr) return res.status(400).json({ error: linkErr });
    }

    const tour = await prisma.$transaction(async (tx) => {
      await tx.tour.update({
        where: { id: existing.id },
        data: {
          title: body.title.trim(),
          slug,
          days: dayCount,
          tourKind: body.tourKind,
          summary: body.summary?.trim() || `${kindLabel} ${dayCount} day tour`,
          description: body.description?.trim() || null,
          coverUrl: body.coverUrl?.trim() || null,
          basePriceLkr: body.basePriceLkr ?? Number(existing.basePriceLkr),
          ...(body.influencerCommissionPct !== undefined
            ? { influencerCommissionPct: body.influencerCommissionPct }
            : {}),
          ...(body.isPublished !== undefined ? { isPublished: body.isPublished } : {}),
        },
      });

      await replaceTourDayPlans(tx, agency.id, existing.id, body.dayPlans);

      if (body.offerLink) {
        await syncTourOfferLinksInTx(tx, agency.id, existing.id, body.offerLink);
      }

      const loaded = await getAgencyTour(agency.id, existing.id, tx);
      if (!loaded) throw new Error("Tour not found after update");
      return loaded;
    });

    const linkedMap = await getLinkedOffersByTourIds(agency.id, [tour.id]);
    res.json(
      serializeTourListItem(
        tour,
        Number(agency.influencerCommissionPct),
        linkedMap.get(tour.id) ?? []
      )
    );
  } catch (e) {
    const err = e as Error & { status?: number };
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(e);
  }
});

toursRouter.patch("/:id", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const existing = await prisma.tour.findFirst({
      where: { id: req.params.id, agencyId: agency.id },
    });
    if (!existing) return res.status(404).json({ error: "Tour not found" });

    const body = z
      .object({
        title: z.string().min(1).optional(),
        summary: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        basePriceLkr: z.number().nonnegative().optional(),
        seasonTag: z.string().nullable().optional(),
        districtTags: z.array(z.string()).optional(),
        coverUrl: z.string().nullable().optional(),
        isPublished: z.boolean().optional(),
        tourKind: z.enum(["READY_MADE", "CUSTOM"]).optional(),
      })
      .parse(req.body);

    let slug = existing.slug;
    if (body.title && slugify(body.title) !== slugify(existing.title)) {
      slug = slugify(body.title);
      const clash = await prisma.tour.findFirst({
        where: { agencyId: agency.id, slug, NOT: { id: existing.id } },
      });
      if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    const tour = await prisma.tour.update({
      where: { id: existing.id },
      data: {
        ...(body.title !== undefined ? { title: body.title.trim(), slug } : {}),
        ...(body.summary !== undefined ? { summary: body.summary } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.basePriceLkr !== undefined ? { basePriceLkr: body.basePriceLkr } : {}),
        ...(body.seasonTag !== undefined ? { seasonTag: body.seasonTag } : {}),
        ...(body.districtTags !== undefined ? { districtTags: body.districtTags } : {}),
        ...(body.coverUrl !== undefined ? { coverUrl: body.coverUrl } : {}),
        ...(body.isPublished !== undefined ? { isPublished: body.isPublished } : {}),
        ...(body.tourKind !== undefined ? { tourKind: body.tourKind } : {}),
      },
      include: {
        tourDays: {
          orderBy: { dayNumber: "asc" },
          include: {
            items: {
              orderBy: { sortOrder: "asc" },
              include: { entity: { select: { id: true, name: true, type: true } } },
            },
          },
        },
      },
    });

    res.json(serializeTourListItem(tour, Number(agency.influencerCommissionPct)));
  } catch (e) {
    next(e);
  }
});

toursRouter.delete("/:id", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const existing = await prisma.tour.findFirst({
      where: { id: req.params.id, agencyId: agency.id },
    });
    if (!existing) return res.status(404).json({ error: "Tour not found" });

    await prisma.tour.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

toursRouter.post("/", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const body = z
      .object({
        title: z.string().min(3),
        summary: z.string().optional(),
        description: z.string().optional(),
        days: z.number().int().min(1).default(1),
        basePriceLkr: z.number().nonnegative(),
        seasonTag: z.string().optional(),
        districtTags: z.array(z.string()).optional(),
        coverUrl: z.string().optional(),
        isPublished: z.boolean().optional(),
      })
      .parse(req.body);

    let slug = slugify(body.title);
    const exists = await prisma.tour.findFirst({ where: { agencyId: agency.id, slug } });
    if (exists) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const tour = await prisma.tour.create({
      data: {
        agencyId: agency.id,
        title: body.title,
        slug,
        summary: body.summary,
        description: body.description,
        days: body.days,
        basePriceLkr: body.basePriceLkr,
        seasonTag: body.seasonTag,
        districtTags: body.districtTags ?? [],
        coverUrl: body.coverUrl,
        isPublished: body.isPublished ?? false,
      },
    });

    res.status(201).json({ ...tour, basePriceLkr: Number(tour.basePriceLkr) });
  } catch (e) {
    next(e);
  }
});

toursRouter.post("/:id/days", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const body = z
      .object({
        dayNumber: z.number().int().min(1),
        title: z.string().optional(),
        items: z
          .array(
            z.object({
              entityId: z.string().optional(),
              groupId: z.string().optional(),
              kind: z.enum(["REQUIRED", "OPTIONAL", "UPGRADE"]).default("REQUIRED"),
              label: z.string().optional(),
              priceLkr: z.number().optional(),
              sortOrder: z.number().default(0),
              notes: z.string().optional(),
            })
          )
          .default([]),
      })
      .parse(req.body);

    const tour = await prisma.tour.findFirst({
      where: { id: req.params.id, agencyId: agency.id },
    });
    if (!tour) return res.status(404).json({ error: "Tour not found" });

    const day = await prisma.tourDay.upsert({
      where: { tourId_dayNumber: { tourId: tour.id, dayNumber: body.dayNumber } },
      create: {
        tourId: tour.id,
        dayNumber: body.dayNumber,
        title: body.title,
        items: {
          create: body.items.map((item) => ({
            entityId: item.entityId,
            groupId: item.groupId,
            kind: item.kind,
            label: item.label,
            priceLkr: item.priceLkr,
            sortOrder: item.sortOrder,
            notes: item.notes,
          })),
        },
      },
      update: {
        title: body.title,
        items: {
          deleteMany: {},
          create: body.items.map((item) => ({
            entityId: item.entityId,
            groupId: item.groupId,
            kind: item.kind,
            label: item.label,
            priceLkr: item.priceLkr,
            sortOrder: item.sortOrder,
            notes: item.notes,
          })),
        },
      },
      include: { items: { include: { entity: true, group: true } } },
    });

    res.json(day);
  } catch (e) {
    next(e);
  }
});

type LinkedOfferLite = { id: string; title: string; isActive: boolean };

function serializeTourListItem(
  tour: {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    description?: string | null;
    days: number;
    tourKind: string;
    basePriceLkr: unknown;
    influencerCommissionPct?: unknown | null;
    coverUrl?: string | null;
    seasonTag?: string | null;
    districtTags?: unknown;
    isPublished: boolean;
    updatedAt?: Date;
    agency?: { influencerCommissionPct?: unknown } | null;
    tourDays?: Array<{
      dayNumber: number;
      title: string | null;
      items: Array<{
        scheduledTime: string | null;
        entity: { id: string; name: string; type: string } | null;
        label: string | null;
      }>;
    }>;
  },
  commissionPctOverride?: number,
  linkedOffers: LinkedOfferLite[] = []
) {
  const pricing = attachTourPricing(tour, commissionPctOverride);
  const tourInfluencerCommissionPct =
    tour.influencerCommissionPct != null ? Number(tour.influencerCommissionPct) : null;
  return {
    id: tour.id,
    title: tour.title,
    slug: tour.slug,
    summary: tour.summary,
    description: tour.description ?? null,
    days: tour.days,
    tourKind: tour.tourKind,
    ...pricing,
    tourInfluencerCommissionPct,
    coverUrl: tour.coverUrl ?? null,
    seasonTag: tour.seasonTag ?? null,
    districtTags: tour.districtTags ?? null,
    isPublished: tour.isPublished,
    updatedAt: tour.updatedAt?.toISOString(),
    durationLabel:
      tour.summary ||
      `${tour.tourKind === "READY_MADE" ? "Ready-Made" : "Custom"} ${tour.days} Days`,
    tourDays: tour.tourDays?.map((d) => ({
      dayNumber: d.dayNumber,
      title: d.title,
      items: d.items.map((i) => ({
        scheduledTime: i.scheduledTime,
        entityId: i.entity?.id ?? null,
        entityName: i.entity?.name ?? i.label,
        entityType: i.entity?.type,
      })),
    })),
    linkedOffers,
  };
}

function serializeTourAgencyDetail(
  tour: Parameters<typeof serializeTourListItem>[0],
  commissionPctOverride?: number,
  linkedOffers: LinkedOfferLite[] = []
) {
  return serializeTourListItem(tour, commissionPctOverride, linkedOffers);
}

function serializeTourDetail(tour: {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  days: number;
  basePriceLkr: unknown;
  seasonTag: string | null;
  districtTags: unknown;
  coverUrl: string | null;
  media: unknown;
  agency: { id: string; name: string; slug: string; influencerCommissionPct?: unknown };
  tourDays: Array<{
    id: string;
    dayNumber: number;
    title: string | null;
    items: Array<{
      id: string;
      kind: string;
      label: string | null;
      priceLkr: unknown;
      notes: string | null;
      entity: { id: string; name: string; type: string; city: string | null } | null;
      group: { id: string; name: string } | null;
    }>;
  }>;
}) {
  const pricing = attachTourPricing(tour);
  return {
    id: tour.id,
    title: tour.title,
    slug: tour.slug,
    summary: tour.summary,
    description: tour.description,
    days: tour.days,
    basePriceLkr: pricing.publicPriceLkr,
    publicPriceLkr: pricing.publicPriceLkr,
    seasonTag: tour.seasonTag,
    districtTags: tour.districtTags,
    coverUrl: tour.coverUrl,
    media: tour.media,
    agency: tour.agency,
    tourDays: tour.tourDays.map((d) => ({
      ...d,
      items: d.items.map((i) => ({
        ...i,
        priceLkr: i.priceLkr != null ? Number(i.priceLkr) : null,
      })),
    })),
  };
}
