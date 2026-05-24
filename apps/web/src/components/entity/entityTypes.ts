export type EntityTypeKey = "HOTEL" | "ACTIVITY" | "VIEWPOINT" | "RESTAURANT";

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
});

export type FieldKey = keyof EntityFormState;

export type FieldDef = {
  key: FieldKey;
  label: string;
  input?: "text" | "number" | "textarea" | "tel";
  placeholder?: string;
  fullWidth?: boolean;
};

export const ENTITY_TYPE_OPTIONS: { value: EntityTypeKey; label: string }[] = [
  { value: "HOTEL", label: "Hotel" },
  { value: "ACTIVITY", label: "Activity" },
  { value: "VIEWPOINT", label: "Viewpoint" },
  { value: "RESTAURANT", label: "Restaurant" },
];

/** Fields shown per type (name + type selector always shown separately). */
export const FIELDS_BY_TYPE: Record<EntityTypeKey, FieldDef[]> = {
  HOTEL: [
    { key: "city", label: "City", placeholder: "Ella" },
    { key: "rooms", label: "Number of rooms", input: "number", placeholder: "24" },
    { key: "priceHint", label: "Price per night (LKR)", input: "number", placeholder: "8500" },
    { key: "contact", label: "Contact no", input: "tel", placeholder: "0771234567" },
    { key: "location", label: "Location", placeholder: "Address or area", fullWidth: true },
    { key: "otherInfo", label: "Other info", input: "textarea", fullWidth: true },
  ],
  ACTIVITY: [
    { key: "description", label: "Description", input: "textarea", fullWidth: true },
    { key: "priceHint", label: "Price per person (LKR)", input: "number", placeholder: "3500" },
    { key: "duration", label: "Duration", placeholder: "e.g. 3 hours" },
    { key: "location", label: "Location", placeholder: "Meeting point or area" },
    { key: "otherInfo", label: "Other info", input: "textarea", fullWidth: true },
    { key: "contact", label: "Contact no", input: "tel", placeholder: "0771234567" },
  ],
  VIEWPOINT: [
    { key: "description", label: "Description", input: "textarea", fullWidth: true },
    { key: "priceHint", label: "Price (LKR)", input: "number", placeholder: "500" },
    { key: "location", label: "Location", placeholder: "Viewpoint area" },
    { key: "contact", label: "Contact no", input: "tel", placeholder: "0771234567" },
    { key: "otherInfo", label: "Other info", input: "textarea", fullWidth: true },
  ],
  RESTAURANT: [
    { key: "location", label: "Location", placeholder: "City / address", fullWidth: true },
    { key: "priceHint", label: "Average price per person (LKR)", input: "number", placeholder: "2500" },
    { key: "contact", label: "Contact no", input: "tel", placeholder: "0771234567" },
    { key: "openHoursDays", label: "Open hours & days", placeholder: "Mon–Sun 10:00–22:00", fullWidth: true },
    { key: "otherInfo", label: "Other info", input: "textarea", fullWidth: true },
  ],
};

export function buildEntityPayload(form: EntityFormState) {
  const trim = (v: string) => v.trim();
  const num = (v: string) => {
    const n = Number(v);
    return v.trim() && !Number.isNaN(n) ? n : undefined;
  };

  const metadata: Record<string, string | number> = {};
  if (trim(form.location)) metadata.location = trim(form.location);
  if (trim(form.otherInfo)) metadata.otherInfo = trim(form.otherInfo);
  if (trim(form.openHoursDays)) metadata.openHoursDays = trim(form.openHoursDays);

  const payload: Record<string, unknown> = {
    name: trim(form.name),
    type: form.type,
  };

  if (form.type === "HOTEL") {
    if (trim(form.city)) payload.city = trim(form.city);
    if (num(form.rooms) != null) metadata.rooms = num(form.rooms)!;
    if (num(form.priceHint) != null) payload.priceHint = num(form.priceHint);
    if (trim(form.contact)) payload.contact = trim(form.contact);
  }

  if (form.type === "ACTIVITY") {
    if (trim(form.description)) payload.description = trim(form.description);
    if (num(form.priceHint) != null) {
      payload.priceHint = num(form.priceHint);
      metadata.pricePerPerson = num(form.priceHint)!;
    }
    if (trim(form.duration)) metadata.duration = trim(form.duration);
    if (trim(form.contact)) payload.contact = trim(form.contact);
  }

  if (form.type === "VIEWPOINT") {
    if (trim(form.description)) payload.description = trim(form.description);
    if (num(form.priceHint) != null) payload.priceHint = num(form.priceHint);
    if (trim(form.contact)) payload.contact = trim(form.contact);
  }

  if (form.type === "RESTAURANT") {
    if (num(form.priceHint) != null) {
      payload.priceHint = num(form.priceHint);
      metadata.avgPricePerPerson = num(form.priceHint)!;
    }
    if (trim(form.contact)) payload.contact = trim(form.contact);
  }

  if (Object.keys(metadata).length > 0) payload.metadata = metadata;

  return payload;
}

export function entityLocationLabel(entity: {
  city?: string | null;
  metadata?: Record<string, unknown> | null;
}): string {
  const meta = entity.metadata as Record<string, string> | null | undefined;
  return meta?.location || entity.city || "—";
}
