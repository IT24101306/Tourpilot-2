export type TourPriceFields = {
  basePriceLkr: number;
  influencerCommissionPct?: number | null;
  influencerCommissionLkr?: number | null;
  publicPriceLkr?: number | null;
};

/** Commission in LKR from agency % applied to base tour price. */
export function commissionLkrFromBase(
  basePriceLkr: number,
  influencerCommissionPct: number
): number {
  const base = Number(basePriceLkr);
  const pct = Number(influencerCommissionPct);
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(pct) || pct <= 0) return 0;
  return Math.round((base * pct) / 100);
}

export function tourCommissionLkr(tour: TourPriceFields): number {
  const pct = Number(tour.influencerCommissionPct ?? 0);
  if (pct > 0) {
    return commissionLkrFromBase(Number(tour.basePriceLkr ?? 0), pct);
  }
  const legacy = Number(tour.influencerCommissionLkr ?? 0);
  return Number.isFinite(legacy) && legacy > 0 ? legacy : 0;
}

/** Listed price for tourists (base + influencer commission). */
export function tourPublicPriceLkr(tour: TourPriceFields): number {
  if (tour.publicPriceLkr != null) {
    const listed = Number(tour.publicPriceLkr);
    if (Number.isFinite(listed) && listed >= 0) return listed;
  }
  const base = Number(tour.basePriceLkr ?? 0);
  return Math.max(0, (Number.isFinite(base) ? base : 0) + tourCommissionLkr(tour));
}

export function displayTourPrice(tour: TourPriceFields): number {
  return tourPublicPriceLkr(tour);
}
