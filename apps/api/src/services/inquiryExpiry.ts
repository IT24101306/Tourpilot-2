import type { InquiryStatus } from "@prisma/client";
import { config } from "../lib/config.js";
import { prisma } from "../lib/prisma.js";
import { notifyInquiryExpired } from "./notifications.js";

const EXPIRABLE: InquiryStatus[] = [
  "NEW",
  "AGENCY_REVIEWING",
  "ITINERARY_DRAFT",
  "SENT_TO_TOURIST",
  "TOURIST_VIEWED",
  "REVISION_REQUESTED",
];

export async function expireStaleInquiries() {
  const cutoff = new Date(Date.now() - config.inquiryExpiryDays * 24 * 60 * 60 * 1000);

  const stale = await prisma.inquiry.findMany({
    where: {
      status: { in: EXPIRABLE },
      updatedAt: { lt: cutoff },
    },
    select: { id: true },
    take: 50,
  });

  if (stale.length === 0) return 0;

  let count = 0;
  for (const row of stale) {
    await prisma.inquiry.update({
      where: { id: row.id },
      data: {
        status: "EXPIRED",
        statusHistory: {
          create: {
            status: "EXPIRED",
            note: `Auto-expired after ${config.inquiryExpiryDays} days of inactivity`,
          },
        },
      },
    });
    await notifyInquiryExpired(row.id);
    count += 1;
  }

  if (count > 0) {
    console.log(`[inquiry-expiry] Expired ${count} inquiry(s)`);
  }
  return count;
}

export function startInquiryExpiryScheduler() {
  const run = () => {
    expireStaleInquiries().catch((err) => console.error("[inquiry-expiry]", err));
  };
  run();
  return setInterval(run, config.inquiryExpiryIntervalMs);
}
