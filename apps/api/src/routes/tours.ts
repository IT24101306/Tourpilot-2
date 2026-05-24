import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, getAgencyForUser, requireRoles } from "../middleware/auth.js";
import { slugify } from "../utils/slug.js";
export const toursRouter = Router();

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
        agency: { select: { id: true, name: true, slug: true } },
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
    res.json(tours.map(serializeTourListItem));
  } catch (e) {
    next(e);
  }
});

toursRouter.post("/with-plan", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const body = z
      .object({
        title: z.string().min(1),
        tourKind: z.enum(["READY_MADE", "CUSTOM"]),
        basePriceLkr: z.number().nonnegative().optional(),
        isPublished: z.boolean().optional(),
        dayPlans: z.array(
          z.object({
            dayNumber: z.number().int().min(1),
            title: z.string().optional(),
            items: z.array(
              z.object({
                entityId: z.string(),
                scheduledTime: z.string().min(1),
                sortOrder: z.number().int().default(0),
              })
            ),
          })
        ),
      })
      .parse(req.body);

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

    const tour = await prisma.$transaction(async (tx) => {
      const created = await tx.tour.create({
        data: {
          agencyId: agency.id,
          title: body.title.trim(),
          slug,
          days: dayCount,
          tourKind: body.tourKind,
          summary: `${kindLabel} ${dayCount} day tour`,
          basePriceLkr: body.basePriceLkr ?? 0,
          isPublished: body.isPublished ?? body.tourKind === "READY_MADE",
        },
      });

      for (const day of body.dayPlans) {
        const entityIds = day.items.map((i) => i.entityId);
        const validEntities = await tx.entity.findMany({
          where: { agencyId: agency.id, id: { in: entityIds } },
        });
        if (validEntities.length !== new Set(entityIds).size) {
          throw Object.assign(new Error("One or more entities are invalid for this agency"), {
            status: 400,
          });
        }

        const tourDay = await tx.tourDay.create({
          data: {
            tourId: created.id,
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

      return tx.tour.findUniqueOrThrow({
        where: { id: created.id },
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
    });

    res.status(201).json(serializeTourListItem(tour));
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

function serializeTourListItem(tour: {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  days: number;
  tourKind: string;
  basePriceLkr: unknown;
  isPublished: boolean;
  tourDays?: Array<{
    dayNumber: number;
    title: string | null;
    items: Array<{
      scheduledTime: string | null;
      entity: { id: string; name: string; type: string } | null;
      label: string | null;
    }>;
  }>;
}) {
  return {
    id: tour.id,
    title: tour.title,
    slug: tour.slug,
    summary: tour.summary,
    days: tour.days,
    tourKind: tour.tourKind,
    basePriceLkr: Number(tour.basePriceLkr),
    isPublished: tour.isPublished,
    durationLabel:
      tour.summary ||
      `${tour.tourKind === "READY_MADE" ? "Ready-Made" : "Custom"} ${tour.days} Days`,
    tourDays: tour.tourDays?.map((d) => ({
      dayNumber: d.dayNumber,
      title: d.title,
      items: d.items.map((i) => ({
        scheduledTime: i.scheduledTime,
        entityName: i.entity?.name ?? i.label,
        entityType: i.entity?.type,
      })),
    })),
  };
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
  agency: { id: string; name: string; slug: string };
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
  return {
    id: tour.id,
    title: tour.title,
    slug: tour.slug,
    summary: tour.summary,
    description: tour.description,
    days: tour.days,
    basePriceLkr: Number(tour.basePriceLkr),
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
