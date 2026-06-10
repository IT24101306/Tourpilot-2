import { commissionLkrFromBase } from "@tourpilot/shared";
import { agencyCommissionPct } from "./tourPricing.js";
import { prisma } from "./prisma.js";

/** Influencer earns agency % of the tour base price (ready-made); else % of booking total. */
export async function resolveReferralCommissionLkr(
  referralCodeId: string,
  grandTotal: number
): Promise<number> {
  const ref = await prisma.referralCode.findUnique({
    where: { id: referralCodeId },
    include: {
      tour: {
        select: {
          basePriceLkr: true,
          influencerCommissionPct: true,
          agency: { select: { influencerCommissionPct: true } },
        },
      },
    },
  });
  if (!ref) return 0;

  if (ref.tour) {
    const base = Number(ref.tour.basePriceLkr);
    const pct = agencyCommissionPct(ref.tour);
    const fromTourBase = commissionLkrFromBase(base, pct);
    if (fromTourBase > 0) return fromTourBase;
  }

  const pct = Number(ref.commissionPct);
  if (grandTotal > 0 && pct > 0) {
    return Math.round((grandTotal * pct) / 100);
  }
  return 0;
}
