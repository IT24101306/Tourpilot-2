import { tourPublicPriceLkr, tourCommissionLkr } from "@tourpilot/shared";
import { transportLabelFor } from "../components/display/transportOptions";
import type { EntityOption, TourFormState } from "../components/tour/tourFormTypes";

export type TourDayPricing = {
  dayNumber: number;
  entitiesCostLkr: number;
  entitiesSellingLkr: number;
  transportCostLkr: number;
  transportSellingLkr: number;
  costSubtotal: number;
  sellingSubtotal: number;
  transportLabel: string | null;
  onRequestCount: number;
};

export type TourFormPricing = {
  dayBreakdown: TourDayPricing[];
  entitiesSubtotal: number;
  entitiesSellingSubtotal: number;
  transportSubtotal: number;
  transportSellingSubtotal: number;
  catalogSubtotal: number;
  sellingTotal: number;
  onRequestEntityCount: number;
  basePriceLkr: number;
  commissionLkr: number;
  listedPriceLkr: number;
};

export function computeTourFormPricing(
  form: TourFormState,
  _entities: EntityOption[],
  agencyCommissionPct: number
): TourFormPricing {
  let entitiesSubtotal = 0;
  let entitiesSellingSubtotal = 0;
  let transportSubtotal = 0;
  let transportSellingSubtotal = 0;
  let onRequestEntityCount = 0;

  const dayBreakdown = form.days.map((day) => {
    let entitiesCostLkr = 0;
    let entitiesSellingLkr = 0;
    let dayOnRequest = 0;

    for (const entry of day.entries) {
      if (!entry.entityId) continue;
      entitiesCostLkr += entry.costLkr;
      entitiesSellingLkr += entry.sellingPriceLkr;
      // A row is excluded from the auto totals when it has no selling rate.
      if (entry.sellingPriceLkr <= 0) {
        dayOnRequest += 1;
      }
    }

    const transportCostLkr =
      day.transportVehicleId && day.transportRateLkr > 0 ? day.transportRateLkr : 0;
    const transportSellingLkr =
      day.transportVehicleId && day.transportSellingPriceLkr > 0
        ? day.transportSellingPriceLkr
        : 0;
    const transportLabel = day.transportVehicleId
      ? transportLabelFor(day.transportVehicleId)
      : null;

    entitiesSubtotal += entitiesCostLkr;
    entitiesSellingSubtotal += entitiesSellingLkr;
    transportSubtotal += transportCostLkr;
    transportSellingSubtotal += transportSellingLkr;
    onRequestEntityCount += dayOnRequest;

    return {
      dayNumber: day.dayNumber,
      entitiesCostLkr,
      entitiesSellingLkr,
      transportCostLkr,
      transportSellingLkr,
      costSubtotal: entitiesCostLkr + transportCostLkr,
      sellingSubtotal: entitiesSellingLkr + transportSellingLkr,
      transportLabel,
      onRequestCount: dayOnRequest,
    };
  });

  const catalogSubtotal = entitiesSubtotal + transportSubtotal;
  const sellingTotal = entitiesSellingSubtotal + transportSellingSubtotal;
  // Tour base price is the agency's selling total (not internal cost); the
  // listed tourist price then adds influencer commission on top.
  const basePriceLkr = form.priceFromCatalog ? sellingTotal : form.basePriceLkr;
  const effectiveCommissionPct = form.influencerCommissionPct ?? agencyCommissionPct;
  const commissionLkr = tourCommissionLkr({
    basePriceLkr,
    influencerCommissionPct: effectiveCommissionPct,
  });
  const listedPriceLkr = tourPublicPriceLkr({
    basePriceLkr,
    influencerCommissionPct: effectiveCommissionPct,
  });

  return {
    dayBreakdown,
    entitiesSubtotal,
    entitiesSellingSubtotal,
    transportSubtotal,
    transportSellingSubtotal,
    catalogSubtotal,
    sellingTotal,
    onRequestEntityCount,
    basePriceLkr,
    commissionLkr,
    listedPriceLkr,
  };
}

export function resolveTourBasePriceLkr(form: TourFormState, entities: EntityOption[]): number {
  return computeTourFormPricing(form, entities, 0).basePriceLkr;
}
