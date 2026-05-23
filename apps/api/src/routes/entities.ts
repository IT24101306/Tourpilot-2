import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, getAgencyForUser, requireRoles } from "../middleware/auth.js";
import { asJson } from "../utils/json.js";

export const entitiesRouter = Router();

entitiesRouter.get("/", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const type = req.query.type as string | undefined;
    const entities = await prisma.entity.findMany({
      where: {
        agencyId: agency.id,
        ...(type && type !== "all" ? { type: type as never } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(entities.map(serializeEntity));
  } catch (e) {
    next(e);
  }
});

entitiesRouter.post("/", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const body = z
      .object({
        name: z.string().min(2),
        type: z.enum([
          "HOTEL",
          "VIEWPOINT",
          "ACTIVITY",
          "RESTAURANT",
          "TRANSPORT",
          "FREE_TIME",
          "OTHER",
        ]),
        city: z.string().optional(),
        district: z.string().optional(),
        description: z.string().optional(),
        durationMin: z.number().optional(),
        priceHint: z.number().optional(),
        contact: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
        media: z.array(z.unknown()).optional(),
      })
      .parse(req.body);

    const entity = await prisma.entity.create({
      data: {
        agencyId: agency.id,
        ...body,
        media: body.media ? asJson(body.media) : undefined,
      },
    });

    res.status(201).json(serializeEntity(entity));
  } catch (e) {
    next(e);
  }
});

entitiesRouter.get("/groups", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const groups = await prisma.entityGroup.findMany({
      where: { agencyId: agency.id },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: { entity: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(groups);
  } catch (e) {
    next(e);
  }
});

entitiesRouter.post("/groups", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const body = z
      .object({
        name: z.string().min(2),
        description: z.string().optional(),
        entityIds: z.array(z.string()).default([]),
      })
      .parse(req.body);

    const group = await prisma.entityGroup.create({
      data: {
        agencyId: agency.id,
        name: body.name,
        description: body.description,
        items: {
          create: body.entityIds.map((entityId, idx) => ({
            entityId,
            sortOrder: idx,
          })),
        },
      },
      include: { items: { include: { entity: true } } },
    });

    res.status(201).json(group);
  } catch (e) {
    next(e);
  }
});

function serializeEntity(entity: {
  id: string;
  name: string;
  type: string;
  city: string | null;
  district: string | null;
  description: string | null;
  durationMin: number | null;
  priceHint: unknown;
  contact: string | null;
  lat: unknown;
  lng: unknown;
  media: unknown;
}) {
  return {
    ...entity,
    priceHint: entity.priceHint != null ? Number(entity.priceHint) : null,
    lat: entity.lat != null ? Number(entity.lat) : null,
    lng: entity.lng != null ? Number(entity.lng) : null,
  };
}
