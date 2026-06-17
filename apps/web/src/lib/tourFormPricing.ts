import { tourPublicPriceLkr, tourCommissionLkr } from "@tourpilot/shared";
import { transportLabelFor } from "../components/display/transportOptions";
import type { EntityOption, TourFormState } from "../components/tour/tourFormTypes";

export type TourDayPricing = {
  dayNumber: number;
  entitiesLkr: number;
  transportLkr: number;
  transportLabel: string | null;
  onRequestCount: number;
};

export type TourFormPricing = {
  dayBreakdown: TourDayPricing[];
  entitiesSubtotal: number;
  transportSubtotal: number;
  catalogSubtotal: number;
  onRequestEntityCount: number;
  basePriceLkr: number;
  commissionLkr: number;
  listedPriceLkr: number;
};

export function computeTourFormPricing(
  form: TourFormState,
  entities: EntityOption[],
  agencyCommissionPct: number
): TourFormPricing {
  const entityMap = new Map(entities.map((e) => [e.id, e]));
  let entitiesSubtotal = 0;
  let transportSubtotal = 0;
  let onRequestEntityCount = 0;

  const dayBreakdown = form.days.map((day) => {
    let entitiesLkr = 0;
    let dayOnRequest = 0;

    for (const entry of day.entries) {
      if (!entry.entityId) continue;
      const ent = entityMap.get(entry.entityId);
      if (ent?.priceHint != null) {
        entitiesLkr += ent.priceHint;
      } else {
        dayOnRequest += 1;
      }
    }

    const transportLkr =
      day.transportVehicleId && day.transportRateLkr > 0 ? day.transportRateLkr : 0;
    const transportLabel = day.transportVehicleId
      ? transportLabelFor(day.transportVehicleId)
      : null;

    entitiesSubtotal += entitiesLkr;
    transportSubtotal += transportLkr;
    onRequestEntityCount += dayOnRequest;

    return {
      dayNumber: day.dayNumber,
      entitiesLkr,
      transportLkr,
      transportLabel,
      onRequestCount: dayOnRequest,
    };
  });

  const catalogSubtotal = entitiesSubtotal + transportSubtotal;
  const basePriceLkr = form.priceFromCatalog ? catalogSubtotal : form.basePriceLkr;
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
    transportSubtotal,
    catalogSubtotal,
    onRequestEntityCount,
    basePriceLkr,
    commissionLkr,
    listedPriceLkr,
  };
}

export function resolveTourBasePriceLkr(form: TourFormState, entities: EntityOption[]): number {
  return computeTourFormPricing(form, entities, 0).basePriceLkr;
}
