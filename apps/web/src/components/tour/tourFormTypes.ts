import { transportLabelFor } from "../display/transportOptions";
import { resolveTourBasePriceLkr } from "../../lib/tourFormPricing";

export type TourKind = "READY_MADE" | "CUSTOM";

export type DayEntry = {
  id: string;
  time: string;
  entityId: string;
};

export type DayPlan = {
  id: string;
  dayNumber: number;
  entries: DayEntry[];
  transportVehicleId: string;
  transportRateLkr: number;
};

export type TourFormState = {
  title: string;
  summary: string;
  description: string;
  basePriceLkr: number;
  /** When true, tour price is computed from entity + vehicle rates in the itinerary. */
  priceFromCatalog: boolean;
  /** null = use agency default from Display settings */
  influencerCommissionPct: number | null;
  influencerInstructions: string;
  coverUrl: string;
  isPublished: boolean;
  days: DayPlan[];
};

export type AgencyTourDayItem = {
  scheduledTime: string | null;
  entityId: string | null;
  entityName: string | null;
  entityType?: string | null;
};

export type AgencyTourDay = {
  dayNumber: number;
  title: string | null;
  transportVehicleId?: string | null;
  transportLabel?: string | null;
  transportRateLkr?: number | null;
  items: AgencyTourDayItem[];
};

export type AgencyTourDetail = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description?: string | null;
  days: number;
  tourKind: TourKind;
  basePriceLkr: number;
  influencerCommissionPct?: number;
  tourInfluencerCommissionPct?: number | null;
  influencerInstructions?: string | null;
  influencerCommissionLkr?: number;
  publicPriceLkr?: number;
  coverUrl?: string | null;
  isPublished: boolean;
  tourDays?: AgencyTourDay[];
};

export function createEntry(time = "", entityId = ""): DayEntry {
  return { id: crypto.randomUUID(), time, entityId };
}

export function createDayPlan(dayNumber: number): DayPlan {
  return {
    id: crypto.randomUUID(),
    dayNumber,
    entries: [createEntry()],
    transportVehicleId: "",
    transportRateLkr: 0,
  };
}

export function defaultTourForm(): TourFormState {
  return {
    title: "",
    summary: "",
    description: "",
    basePriceLkr: 0,
    priceFromCatalog: true,
    influencerCommissionPct: null,
    influencerInstructions: "",
    coverUrl: "",
    isPublished: false,
    days: [createDayPlan(1)],
  };
}

export function normalizeTourForm(form: TourFormState): TourFormState {
  return {
    ...form,
    priceFromCatalog: form.priceFromCatalog ?? true,
    days: form.days.map((day) => ({
      ...day,
      transportVehicleId: day.transportVehicleId ?? "",
      transportRateLkr: day.transportRateLkr ?? 0,
    })),
  };
}

export function renumberDays(days: DayPlan[]): DayPlan[] {
  return days.map((d, i) => ({ ...d, dayNumber: i + 1 }));
}

export function isTourFormSavable(form: TourFormState): boolean {
  if (!form.title.trim()) return false;
  return form.days.every((day) => day.entries.some((entry) => entry.time && entry.entityId));
}

export function tourToFormState(tour: AgencyTourDetail): TourFormState {
  const days: DayPlan[] =
    tour.tourDays && tour.tourDays.length > 0
      ? tour.tourDays.map((day) => ({
          id: crypto.randomUUID(),
          dayNumber: day.dayNumber,
          transportVehicleId: day.transportVehicleId ?? "",
          transportRateLkr: day.transportRateLkr ?? 0,
          entries:
            day.items.length > 0
              ? day.items.map((item) =>
                  createEntry(item.scheduledTime ?? "", item.entityId ?? "")
                )
              : [createEntry()],
        }))
      : [createDayPlan(1)];

  return {
    title: tour.title,
    summary: tour.summary ?? "",
    description: tour.description ?? "",
    basePriceLkr: tour.basePriceLkr,
    priceFromCatalog: true,
    influencerCommissionPct: tour.tourInfluencerCommissionPct ?? null,
    influencerInstructions: tour.influencerInstructions ?? "",
    coverUrl: tour.coverUrl ?? "",
    isPublished: tour.isPublished,
    days,
  };
}

/** Prefill a new tour from an existing one — saved as draft with a copied title. */
export function tourToDuplicateFormState(tour: AgencyTourDetail): TourFormState {
  const base = tourToFormState(tour);
  const trimmed = tour.title.trim();
  const copyTitle = /^copy of /i.test(trimmed) ? trimmed : `Copy of ${trimmed}`;
  return {
    ...base,
    title: copyTitle,
    isPublished: false,
  };
}

export type EntityOption = {
  id: string;
  name: string;
  type: string;
  city?: string | null;
  priceHint?: number | null;
};

export type ItineraryPayload = {
  title: string;
  days: Array<{
    dayNumber: number;
    title?: string;
    items: Array<{
      entityId?: string;
      label: string;
      kind: "REQUIRED" | "OPTIONAL" | "UPGRADE";
      priceLkr?: number | null;
      priceOnRequest?: boolean;
      notes?: string;
    }>;
  }>;
};

export function buildItineraryFromTourForm(
  form: TourFormState,
  entities: EntityOption[]
): ItineraryPayload {
  const entityMap = new Map(entities.map((e) => [e.id, e]));
  const days = form.days
    .map((day) => ({
      dayNumber: day.dayNumber,
      title: `Day ${day.dayNumber}`,
      items: day.entries
        .filter((e) => e.entityId)
        .map((e) => {
          const ent = entityMap.get(e.entityId);
          return {
            entityId: e.entityId,
            label: ent?.name || "Activity",
            kind: "REQUIRED" as const,
            priceLkr: ent?.priceHint ?? null,
          };
        }),
    }))
    .filter((d) => d.items.length > 0);

  return {
    title: form.title.trim() || "Custom itinerary",
    days,
  };
}

export type GroupOption = {
  id: string;
  name: string;
  entityIds: string[];
};

export function filterGroupOptions(groups: GroupOption[], searchQuery = ""): GroupOption[] {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return groups;
  return groups.filter((g) => g.name.toLowerCase().includes(q));
}

export function filterEntityOptions(
  entities: EntityOption[],
  groups: GroupOption[],
  typeFilter: string,
  groupFilter: string,
  searchQuery = ""
): EntityOption[] {
  let list = entities;
  if (typeFilter !== "all") {
    list = list.filter((e) => e.type === typeFilter);
  }
  if (groupFilter !== "all") {
    const group = groups.find((g) => g.id === groupFilter);
    const ids = new Set(group?.entityIds ?? []);
    list = list.filter((e) => ids.has(e.id));
  }
  const q = searchQuery.trim().toLowerCase();
  if (q) {
    list = list.filter((e) => {
      const hay = `${e.name} ${e.type} ${e.city ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }
  return list;
}

export function entityOptionLabel(e: EntityOption) {
  const place = e.city ? ` · ${e.city}` : "";
  const type = e.type.charAt(0) + e.type.slice(1).toLowerCase();
  return `${e.name} (${type}${place})`;
}

export function buildTourPlanPayload(
  form: TourFormState,
  tourKind: TourKind,
  entities: EntityOption[] = []
) {
  const basePriceLkr = resolveTourBasePriceLkr(form, entities);

  return {
    title: form.title.trim(),
    tourKind,
    basePriceLkr,
    influencerCommissionPct: form.influencerCommissionPct,
    influencerInstructions: form.influencerInstructions.trim() || undefined,
    summary: form.summary.trim() || undefined,
    description: form.description.trim() || undefined,
    coverUrl: form.coverUrl.trim() || undefined,
    isPublished: form.isPublished,
    dayPlans: form.days.map((day) => ({
      dayNumber: day.dayNumber,
      transportVehicleId: day.transportVehicleId || undefined,
      transportLabel: day.transportVehicleId
        ? transportLabelFor(day.transportVehicleId)
        : undefined,
      transportRateLkr:
        day.transportVehicleId && day.transportRateLkr > 0 ? day.transportRateLkr : undefined,
      items: day.entries
        .filter((e) => e.entityId && e.time)
        .map((e, idx) => ({
          entityId: e.entityId,
          scheduledTime: e.time,
          sortOrder: idx,
        })),
    })),
  };
}
