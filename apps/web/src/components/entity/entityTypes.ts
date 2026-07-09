export type EntityTypeKey = "HOTEL" | "ACTIVITY" | "VIEWPOINT" | "RESTAURANT";

export const ALLOWED_ENTITY_TYPES: EntityTypeKey[] = [
  "HOTEL",
  "VIEWPOINT",
  "ACTIVITY",
  "RESTAURANT",
];

export type EntityFormState = {
  name: string;
  type: EntityTypeKey;
  city: string;
  description: string;
  priceHint: string;
  contact: string;
  duration: string;
  location: string;
  otherInfo: string;
  rooms: string;
  openHoursDays: string;
  starRating: string;
  amenities: string;
  minGroupSize: string;
  maxGroupSize: string;
  bestTimeToVisit: string;
  cuisineType: string;
  reservationRequired: string;
  dressCode: string;
};

export const defaultEntityForm = (): EntityFormState => ({
  name: "",
  type: "HOTEL",
  city: "",
  description: "",
  priceHint: "",
  contact: "",
  duration: "",
  location: "",
  otherInfo: "",
  rooms: "",
  openHoursDays: "",
  starRating: "",
  amenities: "",
  minGroupSize: "",
  maxGroupSize: "",
  bestTimeToVisit: "",
  cuisineType: "",
  reservationRequired: "false",
  dressCode: "",
});

/** Build editable form state from an existing entity (reverse of buildEntityPayload). */
export function entityToFormState(entity: {
  name: string;
  type: string;
  city?: string | null;
  description?: string | null;
  priceHint?: number | null;
  contact?: string | null;
  metadata?: Record<string, unknown> | null;
}): EntityFormState {
  const m = (entity.metadata || {}) as Record<string, unknown>;
  const str = (v: unknown) => (v == null ? "" : String(v));
  const type = (ALLOWED_ENTITY_TYPES.includes(entity.type as EntityTypeKey)
    ? (entity.type as EntityTypeKey)
    : "HOTEL") as EntityTypeKey;

  return {
    ...defaultEntityForm(),
    name: entity.name ?? "",
    type,
    city: str(entity.city),
    description: str(entity.description),
    priceHint: entity.priceHint != null ? String(entity.priceHint) : "",
    contact: str(entity.contact),
    duration: str(m.duration),
    location: str(m.location),
    otherInfo: str(m.otherInfo),
    rooms: str(m.rooms),
    openHoursDays: str(m.openHoursDays),
    starRating: str(m.starRating),
    amenities: str(m.amenities),
    minGroupSize: str(m.minGroupSize),
    maxGroupSize: str(m.maxGroupSize),
    bestTimeToVisit: str(m.bestTimeToVisit),
    cuisineType: str(m.cuisineType),
    reservationRequired: m.reservationRequired ? "true" : "false",
    dressCode: str(m.dressCode),
  };
}

export type FieldKey = keyof EntityFormState;

export type FieldDef = {
  key: FieldKey;
  label: string;
  input?: "text" | "number" | "textarea" | "tel" | "checkbox";
  placeholder?: string;
  fullWidth?: boolean;
  min?: number;
  max?: number;
};

export const ENTITY_TYPE_OPTIONS: { value: EntityTypeKey; label: string }[] = [
  { value: "HOTEL", label: "Hotel" },
  { value: "ACTIVITY", label: "Activity" },
  { value: "VIEWPOINT", label: "Viewpoint" },
  { value: "RESTAURANT", label: "Restaurant" },
];

/** Fields shown per type (name + type selector always shown separately). */
const DESCRIPTION_FIELD: FieldDef = {
  key: "description",
  label: "Description",
  input: "textarea",
  placeholder: "What makes this place special for travelers?",
  fullWidth: true,
};

export const FIELDS_BY_TYPE: Record<EntityTypeKey, FieldDef[]> = {
  HOTEL: [
    DESCRIPTION_FIELD,
    { key: "rooms", label: "Number of rooms", input: "number", placeholder: "24" },
    { key: "starRating", label: "Star rating", input: "number", placeholder: "4", min: 1, max: 5 },
    { key: "priceHint", label: "Price per night (LKR)", input: "number", placeholder: "8500" },
    { key: "contact", label: "Contact no", input: "tel", placeholder: "0771234567" },
    { key: "location", label: "Location", placeholder: "Address or area", fullWidth: true },
    {
      key: "amenities",
      label: "Amenities",
      input: "textarea",
      placeholder: "Pool, Wi-Fi, parking, breakfast included…",
      fullWidth: true,
    },
    { key: "otherInfo", label: "Other info", input: "textarea", fullWidth: true },
  ],
  ACTIVITY: [
    DESCRIPTION_FIELD,
    { key: "priceHint", label: "Price per person (LKR)", input: "number", placeholder: "3500" },
    { key: "minGroupSize", label: "Min group size", input: "number", placeholder: "2" },
    { key: "maxGroupSize", label: "Max group size", input: "number", placeholder: "12" },
    {
      key: "duration",
      label: "Average time to participate",
      placeholder: "e.g. 3 hours",
    },
    { key: "location", label: "Location", placeholder: "Meeting point or area" },
    { key: "otherInfo", label: "Other info", input: "textarea", fullWidth: true },
    { key: "contact", label: "Contact no", input: "tel", placeholder: "0771234567" },
  ],
  VIEWPOINT: [
    DESCRIPTION_FIELD,
    { key: "priceHint", label: "Price (LKR)", input: "number", placeholder: "500" },
    {
      key: "duration",
      label: "Average time to visit",
      placeholder: "e.g. 45 minutes",
    },
    {
      key: "bestTimeToVisit",
      label: "Best time to visit",
      placeholder: "e.g. Sunrise, 6–8 AM",
      fullWidth: true,
    },
    { key: "location", label: "Location", placeholder: "Viewpoint area" },
    { key: "contact", label: "Contact no", input: "tel", placeholder: "0771234567" },
    { key: "otherInfo", label: "Other info", input: "textarea", fullWidth: true },
  ],
  RESTAURANT: [
    DESCRIPTION_FIELD,
    { key: "location", label: "Location", placeholder: "City / address", fullWidth: true },
    { key: "cuisineType", label: "Cuisine type", placeholder: "Sri Lankan, seafood, vegan…" },
    { key: "priceHint", label: "Average price per person (LKR)", input: "number", placeholder: "2500" },
    { key: "contact", label: "Contact no", input: "tel", placeholder: "0771234567" },
    { key: "openHoursDays", label: "Open hours & days", placeholder: "Mon–Sun 10:00–22:00", fullWidth: true },
    {
      key: "reservationRequired",
      label: "Reservation required",
      input: "checkbox",
      fullWidth: true,
    },
    { key: "dressCode", label: "Dress code", placeholder: "Smart casual, no shorts…", fullWidth: true },
    { key: "otherInfo", label: "Other info", input: "textarea", fullWidth: true },
  ],
};

function trim(v: string) {
  return v.trim();
}

function num(v: string) {
  const n = Number(v);
  return v.trim() && !Number.isNaN(n) ? n : undefined;
}

function boolFromForm(v: string) {
  return v === "true";
}

export function buildEntityPayload(form: EntityFormState) {
  const metadata: Record<string, string | number | boolean> = {};
  if (trim(form.location)) metadata.location = trim(form.location);
  if (trim(form.otherInfo)) metadata.otherInfo = trim(form.otherInfo);
  if (trim(form.openHoursDays)) metadata.openHoursDays = trim(form.openHoursDays);

  const payload: Record<string, unknown> = {
    name: trim(form.name),
    type: form.type,
  };

  if (trim(form.description)) payload.description = trim(form.description);

  if (form.type === "HOTEL") {
    if (num(form.rooms) != null) metadata.rooms = num(form.rooms)!;
    if (num(form.starRating) != null) metadata.starRating = num(form.starRating)!;
    if (trim(form.amenities)) metadata.amenities = trim(form.amenities);
    if (num(form.priceHint) != null) payload.priceHint = num(form.priceHint);
    if (trim(form.contact)) payload.contact = trim(form.contact);
  }

  if (form.type === "ACTIVITY") {
    if (num(form.priceHint) != null) {
      payload.priceHint = num(form.priceHint);
      metadata.pricePerPerson = num(form.priceHint)!;
    }
    if (num(form.minGroupSize) != null) metadata.minGroupSize = num(form.minGroupSize)!;
    if (num(form.maxGroupSize) != null) metadata.maxGroupSize = num(form.maxGroupSize)!;
    if (trim(form.duration)) metadata.duration = trim(form.duration);
    if (trim(form.contact)) payload.contact = trim(form.contact);
  }

  if (form.type === "VIEWPOINT") {
    if (num(form.priceHint) != null) payload.priceHint = num(form.priceHint);
    if (trim(form.duration)) metadata.duration = trim(form.duration);
    if (trim(form.bestTimeToVisit)) metadata.bestTimeToVisit = trim(form.bestTimeToVisit);
    if (trim(form.contact)) payload.contact = trim(form.contact);
  }

  if (form.type === "RESTAURANT") {
    if (trim(form.cuisineType)) metadata.cuisineType = trim(form.cuisineType);
    if (num(form.priceHint) != null) {
      payload.priceHint = num(form.priceHint);
      metadata.avgPricePerPerson = num(form.priceHint)!;
    }
    if (trim(form.contact)) payload.contact = trim(form.contact);
    metadata.reservationRequired = boolFromForm(form.reservationRequired);
    if (trim(form.dressCode)) metadata.dressCode = trim(form.dressCode);
  }

  if (Object.keys(metadata).length > 0) payload.metadata = metadata;

  return payload;
}

export function entityLocationLabel(entity: {
  city?: string | null;
  district?: string | null;
  metadata?: Record<string, unknown> | null;
}): string {
  const meta = entity.metadata as Record<string, string> | null | undefined;
  if (meta?.location) return meta.location;
  const parts = [entity.city, entity.district].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

export function entityTypeLabel(type: string) {
  return ENTITY_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type.replace(/_/g, " ");
}

export function entityDetailsSummary(entity: {
  type: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}): string {
  const m = (entity.metadata || {}) as Record<string, string | number | boolean>;
  const parts: string[] = [];

  if (entity.type === "HOTEL") {
    if (m.rooms != null) parts.push(`${m.rooms} rooms`);
    if (m.starRating != null) parts.push(`${m.starRating}★`);
    if (m.amenities) parts.push(String(m.amenities).slice(0, 36) + (String(m.amenities).length > 36 ? "…" : ""));
  }
  if (entity.type === "ACTIVITY") {
    if (m.duration) parts.push(`~${m.duration}`);
    if (m.minGroupSize != null || m.maxGroupSize != null) {
      parts.push(`Group ${m.minGroupSize ?? "?"}–${m.maxGroupSize ?? "?"}`);
    }
  }
  if (entity.type === "VIEWPOINT") {
    if (m.duration) parts.push(`~${m.duration}`);
    if (m.bestTimeToVisit) parts.push(String(m.bestTimeToVisit));
  }
  if (entity.type === "RESTAURANT") {
    if (m.cuisineType) parts.push(String(m.cuisineType));
    if (m.reservationRequired) parts.push("Reservation required");
    if (m.dressCode) parts.push(String(m.dressCode));
    if (m.openHoursDays) parts.push(String(m.openHoursDays));
  }
  if (m.otherInfo && parts.length < 2) {
    parts.push(String(m.otherInfo).slice(0, 40) + (String(m.otherInfo).length > 40 ? "…" : ""));
  }

  return parts.length ? parts.join(" · ") : entity.description?.slice(0, 50) || "—";
}
