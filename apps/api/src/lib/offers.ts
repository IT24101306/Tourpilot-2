import { z } from "zod";
import { DEFAULT_TOUR_COVER_URL, resolveImageUrl } from "@tourpilot/shared";
import { optionalImageUrlSchema } from "./imageUrlSchema.js";
import { prisma } from "./prisma.js";

export const offerCreateBodySchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  imageUrl: optionalImageUrlSchema,
  rewardText: z.string(),
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

export function serializeOfferAdmin(o: {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  rewardText: string;
  registrationCap: number;
  validFrom: Date;
  validUntil: Date;
  tourPriceLkr: unknown;
  discountedLkr: unknown;
  isActive: boolean;
  tours: { tourId: string }[];
  _count: { registrations: number };
}) {
  return {
    id: o.id,
    title: o.title,
    description: o.description,
    imageUrl: o.imageUrl,
    rewardText: o.rewardText,
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

export function serializeActiveOffer(o: {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  rewardText: string;
  registrationCap: number;
  validUntil: Date;
  tourPriceLkr: unknown;
  discountedLkr: unknown;
  _count: { registrations: number };
  tours: Array<{
    tour: {
      id: string;
      title: string;
      slug: string;
      coverUrl: string | null;
      basePriceLkr: unknown;
      agency: { name: string; slug: string };
    };
  }>;
}) {
  const primary = o.tours[0]?.tour;

  return {
    id: o.id,
    title: o.title,
    description: o.description,
    rewardText: o.rewardText,
    registrationCap: o.registrationCap,
    validUntil: o.validUntil,
    tourPriceLkr: Number(o.tourPriceLkr),
    discountedLkr: o.discountedLkr != null ? Number(o.discountedLkr) : null,
    spotsLeft: Math.max(0, o.registrationCap - o._count.registrations),
    registeredCount: o._count.registrations,
    imageUrl: resolveOfferImageUrl(o.imageUrl, primary?.coverUrl),
    offerImageUrl: o.imageUrl,
    agencyName: primary?.agency.name ?? null,
    agencySlug: primary?.agency.slug ?? null,
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

type OfferRow = {
  id: string;
  validFrom: Date;
  validUntil: Date;
  tourPriceLkr: unknown;
  discountedLkr: unknown;
  tours: { tourId: string }[];
  _count: { registrations: number };
};

export async function applyOfferUpdate(
  existing: OfferRow,
  body: z.infer<typeof offerUpdateBodySchema>
) {
  const nextValidFrom = body.validFrom ? new Date(body.validFrom) : existing.validFrom;
  const nextValidUntil = body.validUntil ? new Date(body.validUntil) : existing.validUntil;
  const dateErr = validateOfferDates(nextValidFrom, nextValidUntil);
  if (dateErr) {
    const err = new Error(dateErr);
    (err as Error & { status: number }).status = 400;
    throw err;
  }

  const nextTourPrice = body.tourPriceLkr ?? Number(existing.tourPriceLkr);
  const nextDiscounted =
    body.discountedLkr === undefined
      ? existing.discountedLkr
      : body.discountedLkr === null
        ? null
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
  tours: {
    include: {
      tour: {
        select: {
          id: true,
          title: true,
          slug: true,
          coverUrl: true,
          basePriceLkr: true,
          agency: { select: { name: true, slug: true } },
        },
      },
    },
  },
  _count: { select: { registrations: true } },
} as const;
