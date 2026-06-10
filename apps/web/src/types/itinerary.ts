export type ItineraryLineItem = {
  label: string;
  kind: string;
  priceLkr: number | null;
  priceOnRequest: boolean;
  notes?: string | null;
  entity?: {
    name: string;
    type: string;
    description?: string | null;
    media?: unknown;
  } | null;
};

export type ItineraryDay = {
  dayNumber: number;
  title: string | null;
  lineItems: ItineraryLineItem[];
};

export type ItineraryView = {
  id?: string;
  title: string | null;
  notes?: string | null;
  baseTotal: number;
  optionalTotal: number;
  grandMax: number;
  shareToken?: string | null;
  days?: ItineraryDay[];
  inquiry?: {
    id: string;
    agency?: { name: string; slug: string; logoUrl?: string | null };
    tourist?: { name: string };
  };
};
