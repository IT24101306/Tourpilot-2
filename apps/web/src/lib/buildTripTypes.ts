import { AGENCY_TRANSPORT_OPTIONS } from "../components/display/transportOptions";

export type DayCategoryId =
  | "accommodation"
  | "transport"
  | "activities"
  | "viewpoints"
  | "dining";

export const DAY_CATEGORIES: Array<{
  id: DayCategoryId;
  label: string;
  hint: string;
}> = [
  { id: "accommodation", label: "Accommodation", hint: "Optional — where you stay this night" },
  { id: "transport", label: "Transport", hint: "Optional — vehicle for this day" },
  { id: "activities", label: "Activities", hint: "Optional — experiences and things to do" },
  { id: "viewpoints", label: "Viewpoints", hint: "Optional — scenic stops" },
  { id: "dining", label: "Dining & others", hint: "Optional — restaurants and more" },
];

export type AgencyEntityType = "HOTEL" | "ACTIVITY" | "VIEWPOINT" | "RESTAURANT" | "OTHER";

export type BuildTripEntity = {
  id: string;
  name: string;
  type: AgencyEntityType;
  city: string | null;
  district: string | null;
  priceHint: number | null;
  media?: unknown;
};

export type DaySelections = {
  dayId: string;
  dayNumber: number;
  accommodation: string | null;
  transport: string | null;
  activities: string[];
  viewpoints: string[];
  dining: string[];
};

export type TripPlanState = {
  title: string;
  days: DaySelections[];
};

export type SerializedTripPlanDay = {
  dayNumber: number;
  accommodation?: { entityId: string; name: string } | null;
  transport?: { id: string; name: string } | null;
  activities: Array<{ entityId: string; name: string }>;
  viewpoints: Array<{ entityId: string; name: string }>;
  dining: Array<{ entityId: string; name: string }>;
};

export type SerializedTripPlan = {
  title: string;
  agencySlug: string;
  days: SerializedTripPlanDay[];
  estimatedTotalLkr: number;
};

export function createDaySelections(dayNumber: number): DaySelections {
  return {
    dayId: crypto.randomUUID(),
    dayNumber,
    accommodation: null,
    transport: null,
    activities: [],
    viewpoints: [],
    dining: [],
  };
}

export function defaultTripPlan(): TripPlanState {
  return { title: "My itinerary", days: [createDaySelections(1)] };
}

export function renumberTripDays(days: DaySelections[]): DaySelections[] {
  return days.map((d, i) => ({ ...d, dayNumber: i + 1 }));
}

export function entitiesForCategory(
  entities: BuildTripEntity[],
  category: DayCategoryId
): BuildTripEntity[] {
  switch (category) {
    case "accommodation":
      return entities.filter((e) => e.type === "HOTEL");
    case "activities":
      return entities.filter((e) => e.type === "ACTIVITY");
    case "viewpoints":
      return entities.filter((e) => e.type === "VIEWPOINT");
    case "dining":
      return entities.filter((e) => e.type === "RESTAURANT" || e.type === "OTHER");
    default:
      return [];
  }
}

export function dayHasSelections(day: DaySelections): boolean {
  return Boolean(
    day.accommodation ||
      day.transport ||
      day.activities.length > 0 ||
      day.viewpoints.length > 0 ||
      day.dining.length > 0
  );
}

export function planHasSelections(plan: TripPlanState): boolean {
  return plan.days.some(dayHasSelections);
}

export function computeTripTotal(plan: TripPlanState, entities: BuildTripEntity[]): number {
  let total = 0;
  for (const day of plan.days) {
    if (day.accommodation) {
      const ent = entities.find((e) => e.id === day.accommodation);
      if (ent?.priceHint != null) total += ent.priceHint;
    }
    if (day.transport) {
      // Transport options have no listed price in catalog
    }
    for (const id of [...day.activities, ...day.viewpoints, ...day.dining]) {
      const ent = entities.find((e) => e.id === id);
      if (ent?.priceHint != null) total += ent.priceHint;
    }
  }
  return total;
}

export function countOnRequestItems(plan: TripPlanState, entities: BuildTripEntity[]): number {
  let count = 0;
  for (const day of plan.days) {
    const ids = [
      day.accommodation,
      ...day.activities,
      ...day.viewpoints,
      ...day.dining,
    ].filter(Boolean) as string[];
    for (const id of ids) {
      const ent = entities.find((e) => e.id === id);
      if (ent && ent.priceHint == null) count += 1;
    }
  }
  return count;
}

export function serializeTripPlan(
  plan: TripPlanState,
  agencySlug: string,
  entities: BuildTripEntity[]
): SerializedTripPlan {
  const entityName = (id: string) => entities.find((e) => e.id === id)?.name ?? "Unknown";
  const transportName = (id: string) =>
    AGENCY_TRANSPORT_OPTIONS.find((t) => t.id === id)?.name ?? "Transport";

  return {
    title: plan.title.trim() || "My itinerary",
    agencySlug,
    estimatedTotalLkr: computeTripTotal(plan, entities),
    days: plan.days.map((day) => ({
      dayNumber: day.dayNumber,
      accommodation: day.accommodation
        ? { entityId: day.accommodation, name: entityName(day.accommodation) }
        : null,
      transport: day.transport ? { id: day.transport, name: transportName(day.transport) } : null,
      activities: day.activities.map((id) => ({ entityId: id, name: entityName(id) })),
      viewpoints: day.viewpoints.map((id) => ({ entityId: id, name: entityName(id) })),
      dining: day.dining.map((id) => ({ entityId: id, name: entityName(id) })),
    })),
  };
}

export function tripPlanFromSerialized(
  serialized: SerializedTripPlan,
  existingId?: string
): TripPlanState {
  return {
    title: serialized.title,
    days: serialized.days.map((day) => ({
      dayId: existingId ?? crypto.randomUUID(),
      dayNumber: day.dayNumber,
      accommodation: day.accommodation?.entityId ?? null,
      transport: day.transport?.id ?? null,
      activities: day.activities.map((a) => a.entityId),
      viewpoints: day.viewpoints.map((v) => v.entityId),
      dining: day.dining.map((d) => d.entityId),
    })),
  };
}

export function entityLocation(e: Pick<BuildTripEntity, "city" | "district">) {
  const parts = [e.city, e.district].filter(Boolean) as string[];
  return parts.join(", ") || "—";
}

export function categorySelectionCount(day: DaySelections, category: DayCategoryId): number {
  switch (category) {
    case "accommodation":
      return day.accommodation ? 1 : 0;
    case "transport":
      return day.transport ? 1 : 0;
    case "activities":
      return day.activities.length;
    case "viewpoints":
      return day.viewpoints.length;
    case "dining":
      return day.dining.length;
    default:
      return 0;
  }
}
