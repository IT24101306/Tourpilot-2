import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, getAgencyForUser, requireRoles } from "../middleware/auth.js";
import { asJson } from "../utils/json.js";
import { publicAgencyWhere } from "../lib/publicVisibility.js";
import { sanitizeOptionalRichText } from "../lib/sanitizeRichText.js";
import { recordAuditEvent, snapshotEntity } from "../services/auditLog.js";
import { sanitizeRichHtml, isRichTextEmpty } from "@tourpilot/shared";

function sanitizeEntityMetadata(meta: unknown): unknown {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return meta;
  const out = { ...(meta as Record<string, unknown>) };
  for (const key of ["otherInfo", "amenities"] as const) {
    if (typeof out[key] === "string") {
      const cleaned = sanitizeRichHtml(out[key] as string);
      out[key] = isRichTextEmpty(cleaned) ? undefined : cleaned;
    }
  }
  return out;
}

export const entitiesRouter = Router();

const publicEntityTypeSchema = z.enum(["HOTEL", "VIEWPOINT", "ACTIVITY", "RESTAURANT", "OTHER"]);

// Public: used by the tourist "Build my trip" page to browse an agency's catalog.
// NOTE: This intentionally does not require auth.
entitiesRouter.get("/public/:agencySlug", async (req, res, next) => {
  try {
    const typeParam = req.query.type;
    const type =
      typeof typeParam === "string" && typeParam !== "all"
        ? publicEntityTypeSchema.parse(typeParam)
        : null;

    const agency = await prisma.agency.findFirst({
      where: { slug: req.params.agencySlug, ...publicAgencyWhere() },
      select: { id: true },
    });

    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const entities = await prisma.entity.findMany({
      where: {
        agencyId: agency.id,
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(entities.map(serializeEntity));
  } catch (e) {
    next(e);
  }
});

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

    const body = entityBodySchema.parse(req.body);

    const entity = await prisma.entity.create({
      data: {
        agencyId: agency.id,
        name: body.name.trim(),
        type: body.type,
        city: body.city?.trim() || undefined,
        district: body.district?.trim() || undefined,
        description: sanitizeOptionalRichText(body.description) ?? undefined,
        durationMin: body.durationMin,
        priceHint: body.priceHint,
        contact: body.contact?.trim() || undefined,
        lat: body.lat,
        lng: body.lng,
        media: body.media ? asJson(body.media) : undefined,
        metadata: body.metadata ? asJson(sanitizeEntityMetadata(body.metadata)) : undefined,
      },
    });

    await recordAuditEvent({
      actor: req.user!,
      agencyId: agency.id,
      entityType: "ENTITY",
      entityId: entity.id,
      entityLabel: entity.name,
      action: "CREATE",
      summary: `Created service "${entity.name}" (${entity.type})`,
      after: snapshotEntity(entity),
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

    res.json(groups.map(serializeGroup));
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
        name: z.string().min(1, "Group name is required"),
        description: z.string().optional().nullable(),
        entityIds: z.array(z.string().min(1)).min(1, "Select at least one entity"),
      })
      .parse(req.body);

    const entityIds = [...new Set(body.entityIds.map((id) => id.trim()).filter(Boolean))];
    if (entityIds.length === 0) {
      return res.status(400).json({ error: "Select at least one entity" });
    }

    const owned = await prisma.entity.findMany({
      where: { agencyId: agency.id, id: { in: entityIds } },
      select: { id: true },
    });
    if (owned.length !== entityIds.length) {
      return res.status(400).json({
        error: "One or more selected entities are invalid or not in your catalog",
      });
    }

    const group = await prisma.entityGroup.create({
      data: {
        agencyId: agency.id,
        name: body.name.trim(),
        description: sanitizeOptionalRichText(body.description) ?? undefined,
        items: {
          create: entityIds.map((entityId, idx) => ({
            entityId,
            sortOrder: idx,
          })),
        },
      },
      include: { items: { include: { entity: true }, orderBy: { sortOrder: "asc" } } },
    });

    res.status(201).json(serializeGroup(group));
  } catch (e) {
    next(e);
  }
});

entitiesRouter.patch("/groups/:id", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const existing = await prisma.entityGroup.findFirst({
      where: { id: req.params.id, agencyId: agency.id },
    });
    if (!existing) return res.status(404).json({ error: "Group not found" });

    const body = z
      .object({
        name: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        entityIds: z.array(z.string().min(1)).min(1).optional(),
      })
      .parse(req.body);

    let entityIds = body.entityIds;
    if (entityIds) {
      entityIds = [...new Set(entityIds.map((id) => id.trim()).filter(Boolean))];
      const owned = await prisma.entity.findMany({
        where: { agencyId: agency.id, id: { in: entityIds } },
        select: { id: true },
      });
      if (owned.length !== entityIds.length) {
        return res.status(400).json({
          error: "One or more selected entities are invalid or not in your catalog",
        });
      }
    }

    const group = await prisma.$transaction(async (tx) => {
      if (entityIds) {
        await tx.entityGroupItem.deleteMany({ where: { groupId: existing.id } });
        await tx.entityGroupItem.createMany({
          data: entityIds.map((entityId, idx) => ({
            groupId: existing.id,
            entityId,
            sortOrder: idx,
          })),
        });
      }

      return tx.entityGroup.update({
        where: { id: existing.id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.description !== undefined
            ? { description: sanitizeOptionalRichText(body.description) ?? null }
            : {}),
        },
        include: { items: { include: { entity: true }, orderBy: { sortOrder: "asc" } } },
      });
    });

    res.json(serializeGroup(group));
  } catch (e) {
    next(e);
  }
});

entitiesRouter.delete("/groups/:id", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const existing = await prisma.entityGroup.findFirst({
      where: { id: req.params.id, agencyId: agency.id },
    });
    if (!existing) return res.status(404).json({ error: "Group not found" });

    await prisma.entityGroup.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

const entityMediaItemSchema = z.object({
  kind: z.enum(["image", "video", "link"]),
  url: z.string().min(1),
  label: z.string().optional(),
  role: z.literal("main").optional(),
});

const entityMediaSchema = z.union([
  z.array(z.unknown()),
  z.object({
    mainImageUrl: z.string().nullable().optional(),
    items: z.array(entityMediaItemSchema).optional().default([]),
  }),
]);

const siteGuideSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  contact: z.string().optional(),
  cost: z.number().optional(),
  available: z.boolean().optional(),
});

const entityBodySchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["HOTEL", "VIEWPOINT", "ACTIVITY", "RESTAURANT", "OTHER"]),
  city: z.string().optional(),
  district: z.string().optional(),
  description: z.string().optional(),
  durationMin: z.number().optional(),
  priceHint: z.number().optional(),
  contact: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  media: entityMediaSchema.optional(),
  metadata: z
    .record(
      z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.array(siteGuideSchema),
      ])
    )
    .optional(),
});

entitiesRouter.patch("/:id", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const existing = await prisma.entity.findFirst({
      where: { id: req.params.id, agencyId: agency.id },
    });
    if (!existing) return res.status(404).json({ error: "Entity not found" });

    const body = entityBodySchema.partial().parse(req.body);
    const beforeSnap = snapshotEntity(existing);
    const entity = await prisma.entity.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.city !== undefined ? { city: body.city?.trim() || null } : {}),
        ...(body.district !== undefined ? { district: body.district?.trim() || null } : {}),
        ...(body.description !== undefined
          ? { description: sanitizeOptionalRichText(body.description) ?? null }
          : {}),
        ...(body.durationMin !== undefined ? { durationMin: body.durationMin } : {}),
        ...(body.priceHint !== undefined ? { priceHint: body.priceHint } : {}),
        ...(body.contact !== undefined ? { contact: body.contact?.trim() || null } : {}),
        ...(body.lat !== undefined ? { lat: body.lat } : {}),
        ...(body.lng !== undefined ? { lng: body.lng } : {}),
        ...(body.media !== undefined ? { media: asJson(body.media) } : {}),
        ...(body.metadata !== undefined
          ? { metadata: asJson(sanitizeEntityMetadata(body.metadata)) }
          : {}),
      },
    });

    await recordAuditEvent({
      actor: req.user!,
      agencyId: agency.id,
      entityType: "ENTITY",
      entityId: entity.id,
      entityLabel: entity.name,
      action: "UPDATE",
      summary: `Updated service "${entity.name}"`,
      before: beforeSnap,
      after: snapshotEntity(entity),
    });

    res.json(serializeEntity(entity));
  } catch (e) {
    next(e);
  }
});

entitiesRouter.delete("/:id", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const existing = await prisma.entity.findFirst({
      where: { id: req.params.id, agencyId: agency.id },
    });
    if (!existing) return res.status(404).json({ error: "Entity not found" });

    await prisma.entity.delete({ where: { id: existing.id } });
    await recordAuditEvent({
      actor: req.user!,
      agencyId: agency.id,
      entityType: "ENTITY",
      entityId: existing.id,
      entityLabel: existing.name,
      action: "DELETE",
      summary: `Deleted service "${existing.name}"`,
      before: snapshotEntity(existing),
    });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

function serializeGroup(group: {
  id: string;
  name: string;
  description: string | null;
  items: Array<{
    id: string;
    sortOrder: number;
    entity: Parameters<typeof serializeEntity>[0];
  }>;
}) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    items: group.items.map((item) => ({
      id: item.id,
      sortOrder: item.sortOrder,
      entity: serializeEntity(item.entity),
    })),
  };
}

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
  metadata: unknown;
}) {
  return {
    ...entity,
    priceHint: entity.priceHint != null ? Number(entity.priceHint) : null,
    lat: entity.lat != null ? Number(entity.lat) : null,
    lng: entity.lng != null ? Number(entity.lng) : null,
    metadata: (entity.metadata as Record<string, unknown> | null) ?? null,
  };
}
