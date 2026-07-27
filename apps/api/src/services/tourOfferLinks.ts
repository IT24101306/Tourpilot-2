import { z } from "zod";
import type { Prisma } from "@prisma/client";
import {
  assertToursBelongToAgency,
  validateDiscount,
  validateOfferDates,
} from "../lib/offers.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeOptionalRichText } from "../lib/sanitizeRichText.js";

export const tourOfferNewBodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  rewardText: z.string().min(1),
  registrationCap: z.number().int().positive(),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
  tourPriceLkr: z.number().nonnegative(),
  discountedLkr: z.number().optional(),
});

export const tourOfferLinkBodySchema = z
  .object({
    enabled: z.boolean(),
    existingOfferIds: z.array(z.string()).default([]),
    createNew: z.boolean().default(false),
    newOffer: tourOfferNewBodySchema.optional(),
    initialLinkedOfferIds: z.array(z.string()).default([]),
  })
  .optional();

export type TourOfferLinkBody = z.infer<typeof tourOfferLinkBodySchema>;

type Tx = Prisma.TransactionClient;

export function validateTourOfferLinkBody(
  link: NonNullable<TourOfferLinkBody>,
  opts?: { isPublished?: boolean }
): string | null {
  if (!link.enabled) return null;

  if (!link.createNew && link.existingOfferIds.length === 0) {
    return "Select at least one existing offer or enable create new offer";
  }

  if (link.createNew) {
    const d = link.newOffer;
    if (!d) return "New offer details are required";
    if (!d.title.trim()) return "Offer title is required";
    if (!d.rewardText.trim()) return "Reward text is required";

    const validFrom = new Date(d.validFrom);
    const validUntil = new Date(d.validUntil);
    const dateErr = validateOfferDates(validFrom, validUntil);
    if (dateErr) return dateErr;

    const discountErr = validateDiscount(d.tourPriceLkr, d.discountedLkr);
    if (discountErr) return discountErr;
  }

  if (opts?.isPublished === false) {
    return "Publish the tour before linking it to a loyalty offer, or save as draft without offer links";
  }

  return null;
}

export async function getLinkedOffersByTourIds(agencyId: string, tourIds: string[]) {
  const map = new Map<string, Array<{ id: string; title: string; isActive: boolean }>>();
  if (tourIds.length === 0) return map;

  const rows = await prisma.offerTour.findMany({
    where: {
      tourId: { in: tourIds },
      offer: { agencyId },
    },
    select: {
      tourId: true,
      offer: { select: { id: true, title: true, isActive: true } },
    },
  });

  for (const row of rows) {
    const list = map.get(row.tourId) ?? [];
    list.push(row.offer);
    map.set(row.tourId, list);
  }
  return map;
}

async function loadAgencyOfferTourIds(tx: Tx, agencyId: string, offerId: string) {
  const offer = await tx.offer.findFirst({
    where: { id: offerId, agencyId },
    include: { tours: { select: { tourId: true } } },
  });
  if (!offer) {
    throw Object.assign(new Error("Offer not found"), { status: 404 });
  }
  return offer.tours.map((t) => t.tourId);
}

async function setOfferTourIds(tx: Tx, agencyId: string, offerId: string, tourIds: string[]) {
  if (tourIds.length === 0) {
    const offer = await tx.offer.findFirst({
      where: { id: offerId, agencyId },
      select: { title: true },
    });
    throw Object.assign(
      new Error(
        `Cannot remove the last tour from offer "${offer?.title ?? offerId}". Add another tour on the Offers page first.`
      ),
      { status: 400 }
    );
  }

  const tourErr = await assertToursBelongToAgency(agencyId, tourIds);
  if (tourErr) {
    throw Object.assign(new Error(tourErr), { status: 400 });
  }

  await tx.offerTour.deleteMany({ where: { offerId } });
  if (tourIds.length > 0) {
    await tx.offerTour.createMany({
      data: tourIds.map((tid) => ({ offerId, tourId: tid })),
      skipDuplicates: true,
    });
  }

}

export async function syncTourOfferLinksInTx(
  tx: Tx,
  agencyId: string,
  tourId: string,
  link: NonNullable<TourOfferLinkBody>
) {
  const initial = new Set(link.initialLinkedOfferIds);
  const selected = new Set(link.existingOfferIds);

  if (!link.enabled) {
    for (const offerId of initial) {
      const tourIds = (await loadAgencyOfferTourIds(tx, agencyId, offerId)).filter(
        (id) => id !== tourId
      );
      await setOfferTourIds(tx, agencyId, offerId, tourIds);
    }
    return;
  }

  for (const offerId of initial) {
    if (selected.has(offerId)) continue;
    const tourIds = (await loadAgencyOfferTourIds(tx, agencyId, offerId)).filter(
      (id) => id !== tourId
    );
    await setOfferTourIds(tx, agencyId, offerId, tourIds);
  }

  for (const offerId of link.existingOfferIds) {
    const current = await loadAgencyOfferTourIds(tx, agencyId, offerId);
    if (current.includes(tourId)) continue;
    await setOfferTourIds(tx, agencyId, offerId, [...current, tourId]);
  }

  if (link.createNew && link.newOffer) {
    const d = link.newOffer;
    const validFrom = new Date(d.validFrom);
    const validUntil = new Date(d.validUntil);

    await tx.offer.create({
      data: {
        agencyId,
        title: d.title.trim(),
        description: sanitizeOptionalRichText(d.description) ?? null,
        imageUrl: d.imageUrl?.trim() || null,
        rewardText: d.rewardText.trim(),
        registrationCap: d.registrationCap,
        validFrom,
        validUntil,
        tourPriceLkr: d.tourPriceLkr,
        discountedLkr: d.discountedLkr ?? null,
        tours: { create: [{ tourId }] },
      },
    });
  }
}
