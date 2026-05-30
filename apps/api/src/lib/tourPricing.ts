import { commissionLkrFromBase, tourCommissionLkr, tourPublicPriceLkr } from "@tourpilot/shared";

export { commissionLkrFromBase, tourCommissionLkr, tourPublicPriceLkr };

type TourWithAgency = {
  basePriceLkr: unknown;
  influencerCommissionLkr?: unknown;
  agency?: { influencerCommissionPct?: unknown } | null;
};

export function agencyCommissionPct(tour: TourWithAgency, fallbackPct?: number | null): number {
  const fromAgency = tour.agency?.influencerCommissionPct;
  if (fromAgency != null && Number(fromAgency) >= 0) return Number(fromAgency);
  if (fallbackPct != null && Number(fallbackPct) >= 0) return Number(fallbackPct);
  return 0;
}

export function attachTourPricing<T extends TourWithAgency>(
  tour: T,
  commissionPctOverride?: number | null
) {
  const basePriceLkr = Number(tour.basePriceLkr);
  const influencerCommissionPct = agencyCommissionPct(tour, commissionPctOverride);
  const influencerCommissionLkr = commissionLkrFromBase(basePriceLkr, influencerCommissionPct);
  const publicPriceLkr = tourPublicPriceLkr({
    basePriceLkr,
    influencerCommissionPct,
    influencerCommissionLkr,
  });
  return {
    basePriceLkr,
    influencerCommissionPct,
    influencerCommissionLkr,
    publicPriceLkr,
  };
}
