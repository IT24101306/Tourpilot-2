import { transportLabelFor } from "../display/transportOptions";
import { newId } from "../../lib/newId";
import { resolveTourBasePriceLkr } from "../../lib/tourFormPricing";
import { isRichTextEmpty, normalizeRichHtml } from "@tourpilot/shared";

export type TourKind = "READY_MADE" | "CUSTOM";

export type DayEntry = {
  id: string;
  time: string;
  entityId: string;
  costLkr: number;
  sellingPriceLkr: number;
};

export type DayPlan = {
  id: string;
  dayNumber: number;
  entries: DayEntry[];
  transportVehicleId: string;
  transportRateLkr: number;
  transportSellingPriceLkr: number;
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
  priceLkr?: number | null;
  sellingPriceLkr?: number | null;
};

export type AgencyTourDay = {
  dayNumber: number;
  title: string | null;
  transportVehicleId?: string | null;
  transportLabel?: string | null;
  transportRateLkr?: number | null;
  transportSellingPriceLkr?: number | null;
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

export function createEntry(
  time = "",
  entityId = "",
  costLkr = 0,
  sellingPriceLkr = 0
): DayEntry {
  return { id: newId(), time, entityId, costLkr, sellingPriceLkr };
}

/** Next suggested clock time after the last filled entry (30‑min steps). */
export function suggestNextEntryTime(entries: DayEntry[]): string {
  const times = entries.map((e) => e.time).filter(Boolean);
  if (times.length === 0) return "09:00";
  const last = times[times.length - 1]!;
  const [hRaw, mRaw] = last.split(":").map((n) => Number(n));
  const h = Number.isFinite(hRaw) ? hRaw : 9;
  const m = Number.isFinite(mRaw) ? mRaw : 0;
  const total = Math.min(23 * 60 + 30, h * 60 + m + 30);
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

export function createDayPlan(dayNumber: number): DayPlan {
  return {
    id: newId(),
    dayNumber,
    entries: [createEntry("09:00")],
    transportVehicleId: "",
    transportRateLkr: 0,
    transportSellingPriceLkr: 0,
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
      transportSellingPriceLkr: day.transportSellingPriceLkr ?? 0,
      entries: day.entries.map((entry) => ({
        ...entry,
        costLkr: entry.costLkr ?? 0,
        sellingPriceLkr: entry.sellingPriceLkr ?? 0,
      })),
    })),
  };
}

export function renumberDays(days: DayPlan[]): DayPlan[] {
  return days.map((d, i) => ({ ...d, dayNumber: i + 1 }));
}

export function isTourFormSavable(form: TourFormState): boolean {
  if (!form.title.trim()) return false;
  return form.days.every((day) => {
    const complete = day.entries.filter((entry) => entry.time && entry.entityId);
    if (complete.length === 0) return false;
    // Any started row (time or entity) must be fully filled — otherwise it is silently dropped on save.
    return day.entries.every((entry) => {
      const started = Boolean(entry.time || entry.entityId);
      if (!started) return true;
      return Boolean(entry.time && entry.entityId);
    });
  });
}

/** Human-readable list of required fields still missing, for validation feedback. */
export function computeMissingRequirements(form: TourFormState): string[] {
  const missing: string[] = [];
  if (!form.title.trim()) missing.push("Tour title");
  form.days.forEach((day) => {
    const complete = day.entries.filter((entry) => entry.time && entry.entityId);
    if (complete.length === 0) {
      missing.push(`Day ${day.dayNumber}: add at least one entity with a scheduled time`);
      return;
    }
    day.entries.forEach((entry, idx) => {
      const started = Boolean(entry.time || entry.entityId);
      if (!started) return;
      if (!entry.entityId) {
        missing.push(`Day ${day.dayNumber}, row ${idx + 1}: select an entity`);
      }
      if (!entry.time) {
        missing.push(`Day ${day.dayNumber}, row ${idx + 1}: set a time`);
      }
    });
  });
  return missing;
}

export function tourToFormState(tour: AgencyTourDetail): TourFormState {
  const days: DayPlan[] =
    tour.tourDays && tour.tourDays.length > 0
      ? tour.tourDays.map((day) => ({
          id: newId(),
          dayNumber: day.dayNumber,
          transportVehicleId: day.transportVehicleId ?? "",
          transportRateLkr: day.transportRateLkr ?? 0,
          transportSellingPriceLkr: day.transportSellingPriceLkr ?? 0,
          entries:
            day.items.length > 0
              ? day.items.map((item) =>
                  createEntry(
                    item.scheduledTime ?? "",
                    item.entityId ?? "",
                    item.priceLkr ?? 0,
                    item.sellingPriceLkr ?? item.priceLkr ?? 0
                  )
                )
              : [createEntry("09:00")],
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
  /** Auto-selected site guide for tours (first available), if any. */
  guide?: { name: string; cost: number } | null;
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
            priceLkr: e.costLkr > 0 ? e.costLkr : ent?.priceHint ?? null,
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

/** Unique, sorted list of destinations (cities) across the given entities. */
export function entityDestinationOptions(entities: EntityOption[]): string[] {
  const set = new Set<string>();
  for (const e of entities) {
    const city = e.city?.trim();
    if (city) set.add(city);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function filterEntityOptions(
  entities: EntityOption[],
  groups: GroupOption[],
  typeFilter: string,
  groupFilter: string,
  searchQuery = "",
  cityFilter = "all"
): EntityOption[] {
  let list = entities;
  if (typeFilter !== "all") {
    list = list.filter((e) => e.type === typeFilter);
  }
  if (cityFilter !== "all") {
    const target = cityFilter.trim().toLowerCase();
    list = list.filter((e) => (e.city ?? "").trim().toLowerCase() === target);
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
    influencerInstructions: isRichTextEmpty(form.influencerInstructions)
      ? undefined
      : normalizeRichHtml(form.influencerInstructions, undefined) ?? undefined,
    summary: isRichTextEmpty(form.summary)
      ? undefined
      : normalizeRichHtml(form.summary, undefined) ?? undefined,
    description: isRichTextEmpty(form.description)
      ? undefined
      : normalizeRichHtml(form.description, undefined) ?? undefined,
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
      transportSellingPriceLkr:
        day.transportVehicleId && day.transportSellingPriceLkr > 0
          ? day.transportSellingPriceLkr
          : undefined,
      items: day.entries
        .filter((e) => e.entityId && e.time)
        .map((e, idx) => ({
          entityId: e.entityId,
          scheduledTime: e.time,
          sortOrder: idx,
          costLkr: e.costLkr > 0 ? e.costLkr : undefined,
          sellingPriceLkr: e.sellingPriceLkr > 0 ? e.sellingPriceLkr : undefined,
        })),
    })),
  };
}
