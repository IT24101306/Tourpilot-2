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
};

export type TourFormState = {
  title: string;
  summary: string;
  description: string;
  basePriceLkr: number;
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
  coverUrl?: string | null;
  isPublished: boolean;
  tourDays?: AgencyTourDay[];
};

export function createEntry(time = "", entityId = ""): DayEntry {
  return { id: crypto.randomUUID(), time, entityId };
}

export function createDayPlan(dayNumber: number): DayPlan {
  return { id: crypto.randomUUID(), dayNumber, entries: [createEntry()] };
}

export function defaultTourForm(): TourFormState {
  return {
    title: "",
    summary: "",
    description: "",
    basePriceLkr: 0,
    coverUrl: "",
    isPublished: false,
    days: [createDayPlan(1)],
  };
}

export function renumberDays(days: DayPlan[]): DayPlan[] {
  return days.map((d, i) => ({ ...d, dayNumber: i + 1 }));
}

export function tourToFormState(tour: AgencyTourDetail): TourFormState {
  const days: DayPlan[] =
    tour.tourDays && tour.tourDays.length > 0
      ? tour.tourDays.map((day) => ({
          id: crypto.randomUUID(),
          dayNumber: day.dayNumber,
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
    coverUrl: tour.coverUrl ?? "",
    isPublished: tour.isPublished,
    days,
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

export function filterEntityOptions(
  entities: EntityOption[],
  groups: GroupOption[],
  typeFilter: string,
  groupFilter: string
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
  return list;
}

export function entityOptionLabel(e: EntityOption) {
  const place = e.city ? ` · ${e.city}` : "";
  const type = e.type.charAt(0) + e.type.slice(1).toLowerCase();
  return `${e.name} (${type}${place})`;
}

export function buildTourPlanPayload(form: TourFormState, tourKind: TourKind) {
  return {
    title: form.title.trim(),
    tourKind,
    basePriceLkr: form.basePriceLkr,
    summary: form.summary.trim() || undefined,
    description: form.description.trim() || undefined,
    coverUrl: form.coverUrl.trim() || undefined,
    isPublished: form.isPublished,
    dayPlans: form.days.map((day) => ({
      dayNumber: day.dayNumber,
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
