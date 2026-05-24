import type { InquiryResponseKind } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { calculateItineraryTotals } from "../utils/pricing.js";
import { createShareToken } from "../services/otp.js";
import { z } from "zod";

export const itineraryBodySchema = z.object({
  title: z.string().optional(),
  notes: z.string().optional(),
  days: z.array(
    z.object({
      dayNumber: z.number(),
      title: z.string().optional(),
      items: z.array(
        z.object({
          entityId: z.string().optional(),
          label: z.string(),
          kind: z.enum(["REQUIRED", "OPTIONAL", "UPGRADE"]).default("REQUIRED"),
          priceLkr: z.number().nullable().optional(),
          priceOnRequest: z.boolean().optional(),
          notes: z.string().optional(),
        })
      ),
    })
  ),
});

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function createInquiryItinerary(
  inquiryId: string,
  body: z.infer<typeof itineraryBodySchema>,
  existingTx?: TxClient
) {
  const db = existingTx ?? prisma;

  const lastVersion = await db.itinerary.findFirst({
    where: { inquiryId },
    orderBy: { version: "desc" },
  });
  const version = (lastVersion?.version ?? 0) + 1;

  const flatLines = body.days.flatMap((d) => d.items);
  const totals = calculateItineraryTotals(
    flatLines.map((l) => ({
      kind: l.kind,
      priceLkr: l.priceOnRequest ? null : (l.priceLkr ?? 0),
      priceOnRequest: l.priceOnRequest,
    }))
  );

  const shareToken = createShareToken();

  const run = async (tx: TxClient) => {
    const created = await tx.itinerary.create({
      data: {
        inquiryId,
        version,
        title: body.title,
        notes: body.notes,
        baseTotal: totals.baseTotal,
        optionalTotal: totals.optionalTotal,
        grandMax: totals.grandMax,
        isSent: true,
        sentAt: new Date(),
        shareToken,
      },
    });

    for (const day of body.days) {
      const dayRow = await tx.itineraryDay.create({
        data: {
          itineraryId: created.id,
          dayNumber: day.dayNumber,
          title: day.title,
        },
      });

      for (const [idx, item] of day.items.entries()) {
        await tx.itineraryLineItem.create({
          data: {
            itineraryId: created.id,
            dayId: dayRow.id,
            label: item.label,
            entityId: item.entityId,
            kind: item.kind,
            priceLkr: item.priceOnRequest ? null : item.priceLkr,
            priceOnRequest: item.priceOnRequest ?? false,
            sortOrder: idx,
            notes: item.notes,
          },
        });
      }
    }

    return created;
  };

  const itinerary = existingTx ? await run(existingTx) : await prisma.$transaction(run);

  return { itinerary, totals, shareToken };
}

export const replyBodySchema = z.object({
  message: z.string().min(1, "Reply message is required"),
  replyType: z.enum(["message", "ready_made", "custom"]),
  tourId: z.string().optional(),
  itinerary: itineraryBodySchema.optional(),
});

export function mapReplyKind(replyType: string): InquiryResponseKind {
  if (replyType === "ready_made") return "READY_MADE";
  if (replyType === "custom") return "CUSTOM_ITINERARY";
  return "MESSAGE";
}
