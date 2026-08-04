import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type AuditEntityType =
  | "TOUR"
  | "OFFER"
  | "ENTITY"
  | "AGENCY_FEATURES"
  | "AGENCY_SUBSCRIPTION"
  | "PLATFORM_SETTINGS"
  | "CMS_PAGE"
  | "VOUCHER";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "PUBLISH" | "UNPUBLISH";

export type AuditActor = {
  id: string;
  role: UserRole;
  name?: string | null;
  phone?: string | null;
};

type AuditDb = Prisma.TransactionClient | typeof prisma;

export type RecordAuditInput = {
  actor?: AuditActor | null;
  agencyId?: string | null;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel?: string | null;
  action: AuditAction;
  summary: string;
  before?: unknown;
  after?: unknown;
  relatedInquiryId?: string | null;
};

/** JSON-safe snapshot (Decimals → number, Dates → ISO). */
export function toAuditJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (v != null && typeof v === "object" && typeof (v as { toNumber?: () => number }).toNumber === "function") {
        return (v as { toNumber: () => number }).toNumber();
      }
      if (v instanceof Date) return v.toISOString();
      return v;
    })
  ) as Prisma.InputJsonValue;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Flat field diffs for objects; nested objects compared as wholes when keys differ. */
export function buildAuditChanges(
  before: unknown,
  after: unknown
): Record<string, { from: unknown; to: unknown }> | null {
  if (before == null && after == null) return null;
  if (before == null || after == null || typeof before !== "object" || typeof after !== "object") {
    if (valuesEqual(before, after)) return null;
    return { value: { from: before ?? null, to: after ?? null } };
  }

  const beforeObj = before as Record<string, unknown>;
  const afterObj = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of keys) {
    if (valuesEqual(beforeObj[key], afterObj[key])) continue;
    changes[key] = { from: beforeObj[key] ?? null, to: afterObj[key] ?? null };
  }
  return Object.keys(changes).length ? changes : null;
}

export function snapshotTour(tour: {
  id: string;
  title: string;
  slug: string;
  days: number;
  tourKind: string;
  summary: string | null;
  description: string | null;
  coverUrl: string | null;
  basePriceLkr: unknown;
  influencerCommissionPct?: unknown;
  influencerCommissionLkr?: unknown;
  influencerInstructions?: string | null;
  isPublished: boolean;
  seasonTag?: string | null;
  tourDays?: Array<{
    dayNumber: number;
    title: string | null;
    transportLabel?: string | null;
    transportRateLkr?: unknown;
    transportSellingPriceLkr?: unknown;
    items?: Array<{
      entityId: string | null;
      label: string | null;
      kind?: string;
      priceLkr?: unknown;
      sellingPriceLkr?: unknown;
      scheduledTime?: string | null;
      sortOrder?: number;
      entity?: { id: string; name: string; type: string } | null;
    }>;
  }>;
}) {
  return {
    id: tour.id,
    title: tour.title,
    slug: tour.slug,
    days: tour.days,
    tourKind: tour.tourKind,
    summary: tour.summary,
    description: tour.description,
    coverUrl: tour.coverUrl,
    basePriceLkr: tour.basePriceLkr != null ? Number(tour.basePriceLkr) : null,
    influencerCommissionPct:
      tour.influencerCommissionPct != null ? Number(tour.influencerCommissionPct) : null,
    influencerCommissionLkr:
      tour.influencerCommissionLkr != null ? Number(tour.influencerCommissionLkr) : null,
    influencerInstructions: tour.influencerInstructions ?? null,
    isPublished: tour.isPublished,
    seasonTag: tour.seasonTag ?? null,
    dayPlans: (tour.tourDays ?? []).map((day) => ({
      dayNumber: day.dayNumber,
      title: day.title,
      transportLabel: day.transportLabel ?? null,
      transportRateLkr: day.transportRateLkr != null ? Number(day.transportRateLkr) : null,
      transportSellingPriceLkr:
        day.transportSellingPriceLkr != null ? Number(day.transportSellingPriceLkr) : null,
      items: (day.items ?? []).map((item) => ({
        entityId: item.entityId,
        entityName: item.entity?.name ?? item.label,
        label: item.label,
        kind: item.kind ?? null,
        priceLkr: item.priceLkr != null ? Number(item.priceLkr) : null,
        sellingPriceLkr: item.sellingPriceLkr != null ? Number(item.sellingPriceLkr) : null,
        scheduledTime: item.scheduledTime ?? null,
        sortOrder: item.sortOrder ?? 0,
      })),
    })),
  };
}

export function snapshotOffer(offer: {
  id: string;
  title: string;
  description?: string | null;
  rewardText?: string;
  offerMonth?: string | null;
  registrationCap: number;
  validFrom: Date;
  validUntil: Date;
  tourPriceLkr: unknown;
  discountedLkr?: unknown;
  isActive: boolean;
  agencyId?: string | null;
  tours?: Array<{ tourId: string }>;
  tourIds?: string[];
}) {
  return {
    id: offer.id,
    title: offer.title,
    description: offer.description ?? null,
    rewardText: offer.rewardText ?? null,
    offerMonth: offer.offerMonth ?? null,
    registrationCap: offer.registrationCap,
    validFrom: offer.validFrom instanceof Date ? offer.validFrom.toISOString() : offer.validFrom,
    validUntil: offer.validUntil instanceof Date ? offer.validUntil.toISOString() : offer.validUntil,
    tourPriceLkr: Number(offer.tourPriceLkr),
    discountedLkr: offer.discountedLkr != null ? Number(offer.discountedLkr) : null,
    isActive: offer.isActive,
    agencyId: offer.agencyId ?? null,
    tourIds: offer.tourIds ?? offer.tours?.map((t) => t.tourId) ?? [],
  };
}

export function snapshotEntity(entity: {
  id: string;
  name: string;
  type: string;
  city?: string | null;
  district?: string | null;
  description?: string | null;
  durationMin?: number | null;
  priceHint?: unknown;
  contact?: string | null;
}) {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    city: entity.city ?? null,
    district: entity.district ?? null,
    description: entity.description ?? null,
    durationMin: entity.durationMin ?? null,
    priceHint: entity.priceHint != null ? Number(entity.priceHint) : null,
    contact: entity.contact ?? null,
  };
}

export async function recordAuditEvent(input: RecordAuditInput, db: AuditDb = prisma) {
  const changes = buildAuditChanges(input.before ?? null, input.after ?? null);
  if (input.action === "UPDATE" && !changes && input.before != null && input.after != null) {
    return null;
  }

  let actorName = input.actor?.name ?? null;
  let actorPhone = input.actor?.phone ?? null;
  if (input.actor?.id && (actorName == null || actorPhone == null)) {
    const user = await db.user.findUnique({
      where: { id: input.actor.id },
      select: { name: true, phone: true },
    });
    actorName = actorName ?? user?.name ?? null;
    actorPhone = actorPhone ?? user?.phone ?? null;
  }

  try {
    return await db.auditEvent.create({
      data: {
        actorId: input.actor?.id ?? null,
        actorRole: input.actor?.role ?? null,
        actorName,
        actorPhone,
        agencyId: input.agencyId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        entityLabel: input.entityLabel?.slice(0, 255) ?? null,
        action: input.action,
        summary: input.summary.slice(0, 500),
        beforeJson: input.before !== undefined ? toAuditJson(input.before) : undefined,
        afterJson: input.after !== undefined ? toAuditJson(input.after) : undefined,
        changesJson: changes ? toAuditJson(changes) : undefined,
        relatedInquiryId: input.relatedInquiryId ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record event", err);
    return null;
  }
}
