import { z } from "zod";
import type { Prisma } from "@prisma/client";
import {
  DEFAULT_TOUR_COVER_URL,
  parseOfferRewardTiers,
  resolveImageUrl,
  resolveSocialTagHandle,
  type OfferRewardTier,
} from "@tourpilot/shared";
import { optionalImageUrlSchema } from "./imageUrlSchema.js";
import { parseDisplayPayload } from "./displaySettings.js";
import { prisma } from "./prisma.js";

const offerMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "offerMonth must be YYYY-MM")
  .optional()
  .nullable();

const rewardTierSchema = z.object({
  registrationsRequired: z.number().int().positive(),
  winnersCount: z.number().int().positive(),
  rewardLabel: z.string().min(1),
});

export const offerCreateBodySchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  imageUrl: optionalImageUrlSchema,
  rewardText: z.string(),
  offerMonth: offerMonthSchema,
  rewardTiers: z.array(rewardTierSchema).optional().default([]),
  registrationCap: z.number().int().positive(),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
  tourPriceLkr: z.number().nonnegative(),
  discountedLkr: z.number().optional(),
  tourIds: z.array(z.string()).default([]),
});

export const offerUpdateBodySchema = z.object({
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  imageUrl: optionalImageUrlSchema.optional(),
  rewardText: z.string().optional(),
  offerMonth: offerMonthSchema,
  rewardTiers: z.array(rewardTierSchema).optional(),
  registrationCap: z.number().int().positive().optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  tourPriceLkr: z.number().nonnegative().optional(),
  discountedLkr: z.number().nullable().optional(),
  isActive: z.boolean().optional(),
  tourIds: z.array(z.string()).optional(),
});

export function resolveOfferImageUrl(
  offerImageUrl: string | null | undefined,
  tourCoverUrl: string | null | undefined
) {
  return resolveImageUrl(offerImageUrl, resolveImageUrl(tourCoverUrl, DEFAULT_TOUR_COVER_URL));
}

function serializeRewardTiers(value: unknown): OfferRewardTier[] {
  return parseOfferRewardTiers(value);
}

export function serializeOfferAdmin(o: OfferWithAdminInclude) {
  return {
    id: o.id,
    title: o.title,
    description: o.description,
    imageUrl: o.imageUrl,
    rewardText: o.rewardText,
    offerMonth: o.offerMonth,
    rewardTiers: serializeRewardTiers(o.rewardTiers),
    registrationCap: o.registrationCap,
    validFrom: o.validFrom,
    validUntil: o.validUntil,
    tourPriceLkr: Number(o.tourPriceLkr),
    discountedLkr: o.discountedLkr != null ? Number(o.discountedLkr) : null,
    isActive: o.isActive,
    tourIds: o.tours.map((t) => t.tourId),
    registeredCount: o._count.registrations,
    spotsLeft: Math.max(0, o.registrationCap - o._count.registrations),
  };
}

export function serializeActiveOffer(o: OfferWithActiveInclude) {
  const primary = o.tours[0]?.tour;
  const agency = o.agency ?? primary?.agency ?? null;
  const pageConfig = o.agency?.pageConfig ?? primary?.agency?.pageConfig ?? null;
  const agencyDisplay = pageConfig ? parseDisplayPayload(pageConfig) : null;
  const socialTagHandle = agencyDisplay
    ? resolveSocialTagHandle(
        agencyDisplay.content.socialTagHandle,
        agencyDisplay.content.whoWeAreSocialLinks
      )
    : null;

  return {
    id: o.id,
    title: o.title,
    description: o.description,
    rewardText: o.rewardText,
    offerMonth: o.offerMonth,
    rewardTiers: serializeRewardTiers(o.rewardTiers),
    registrationCap: o.registrationCap,
    validUntil: o.validUntil,
    tourPriceLkr: Number(o.tourPriceLkr),
    discountedLkr: o.discountedLkr != null ? Number(o.discountedLkr) : null,
    spotsLeft: Math.max(0, o.registrationCap - o._count.registrations),
    registeredCount: o._count.registrations,
    imageUrl: resolveOfferImageUrl(o.imageUrl, primary?.coverUrl),
    offerImageUrl: o.imageUrl,
    agency: agency ? { id: agency.id, name: agency.name, slug: agency.slug } : null,
    agencyName: agency?.name ?? null,
    agencySlug: agency?.slug ?? null,
    socialTagHandle,
    tourSlug: primary?.slug ?? null,
    tours: o.tours.map((t) => ({
      ...t.tour,
      basePriceLkr: Number(t.tour.basePriceLkr),
      agency: t.tour.agency,
    })),
  };
}

export function validateOfferDates(validFrom: Date, validUntil: Date) {
  if (validFrom.getTime() > validUntil.getTime()) {
    return "validFrom must be before validUntil";
  }
  return null;
}

export function validateDiscount(tourPriceLkr: number, discountedLkr: number | null | undefined) {
  if (discountedLkr != null && discountedLkr > tourPriceLkr) {
    return "discountedLkr must be <= tourPriceLkr";
  }
  return null;
}

/** Active offers owned by an agency (direct link or via linked tours). */
export function agencyOfferWhere(agencyId: string): Prisma.OfferWhereInput {
  return {
    OR: [
      { agencyId },
      { tours: { some: { tour: { agencyId } } } },
    ],
  };
}

export async function assertToursBelongToAgency(agencyId: string, tourIds: string[]) {
  if (tourIds.length === 0) return null;
  const tours = await prisma.tour.findMany({
    where: { id: { in: tourIds }, agencyId },
    select: { id: true },
  });
  if (tours.length !== tourIds.length) {
    return "One or more tours do not belong to your agency";
  }
  return null;
}

export const offerIncludeAdmin = {
  tours: { select: { tourId: true } },
  _count: { select: { registrations: true } },
} as const;

export type OfferWithAdminInclude = Prisma.OfferGetPayload<{
  include: typeof offerIncludeAdmin;
}>;

export async function applyOfferUpdate(
  existing: OfferWithAdminInclude,
  body: z.infer<typeof offerUpdateBodySchema>
): Promise<OfferWithAdminInclude> {
  const nextValidFrom = body.validFrom ? new Date(body.validFrom) : existing.validFrom;
  const nextValidUntil = body.validUntil ? new Date(body.validUntil) : existing.validUntil;
  const dateErr = validateOfferDates(nextValidFrom, nextValidUntil);
  if (dateErr) {
    const err = new Error(dateErr);
    (err as Error & { status: number }).status = 400;
    throw err;
  }

  const nextTourPrice = body.tourPriceLkr ?? Number(existing.tourPriceLkr);
  const nextDiscounted: number | null =
    body.discountedLkr === undefined
      ? existing.discountedLkr != null
        ? Number(existing.discountedLkr)
        : null
      : body.discountedLkr;

  const discountErr = validateDiscount(
    nextTourPrice,
    nextDiscounted != null ? Number(nextDiscounted) : null
  );
  if (discountErr) {
    const err = new Error(discountErr);
    (err as Error & { status: number }).status = 400;
    throw err;
  }

  return await prisma.$transaction(async (tx) => {
    if (body.tourIds) {
      await tx.offerTour.deleteMany({ where: { offerId: existing.id } });
      if (body.tourIds.length > 0) {
        await tx.offerTour.createMany({
          data: body.tourIds.map((tourId) => ({ offerId: existing.id, tourId })),
          skipDuplicates: true,
        });
      }
    }

    return await tx.offer.update({
      where: { id: existing.id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
        ...(body.rewardText !== undefined ? { rewardText: body.rewardText } : {}),
        ...(body.offerMonth !== undefined ? { offerMonth: body.offerMonth } : {}),
        ...(body.rewardTiers !== undefined
          ? { rewardTiers: body.rewardTiers as Prisma.InputJsonValue }
          : {}),
        ...(body.registrationCap !== undefined ? { registrationCap: body.registrationCap } : {}),
        ...(body.validFrom !== undefined ? { validFrom: nextValidFrom } : {}),
        ...(body.validUntil !== undefined ? { validUntil: nextValidUntil } : {}),
        ...(body.tourPriceLkr !== undefined ? { tourPriceLkr: body.tourPriceLkr } : {}),
        ...(body.discountedLkr !== undefined ? { discountedLkr: nextDiscounted } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
      include: offerIncludeAdmin,
    });
  });
}

export const offerIncludeActive = {
  agency: { select: { id: true, name: true, slug: true, pageConfig: true } },
  tours: {
    include: {
      tour: {
        select: {
          id: true,
          title: true,
          slug: true,
          coverUrl: true,
          basePriceLkr: true,
          agency: { select: { id: true, name: true, slug: true, pageConfig: true } },
        },
      },
    },
  },
  _count: { select: { registrations: true } },
} as const;

export type OfferWithActiveInclude = Prisma.OfferGetPayload<{
  include: typeof offerIncludeActive;
}>;

export function activeOfferWhere(now = new Date()): Prisma.OfferWhereInput {
  return {
    isActive: true,
    validFrom: { lte: now },
    validUntil: { gte: now },
  };
}

/** Active offers from agencies (direct or via linked tours). */
export function agencyActiveOfferWhere(now = new Date()): Prisma.OfferWhereInput {
  return {
    ...activeOfferWhere(now),
    OR: [{ agencyId: { not: null } }, { tours: { some: {} } }],
  };
}

export async function loadActiveOffers(
  where: Prisma.OfferWhereInput = activeOfferWhere(),
  db: typeof prisma = prisma
) {
  return db.offer.findMany({
    where,
    include: offerIncludeActive,
    orderBy: [{ validUntil: "asc" }, { title: "asc" }],
  });
}
