export type TransportOption = {
  id: string;
  name: string;
  variant?: string;
  description: string;
  seating: string;
  luggage: string;
};

export const AGENCY_TRANSPORT_OPTIONS: TransportOption[] = [
  {
    id: "sedan",
    name: "Sedan",
    description: "Comfortable for 2 passengers, especially for a couple",
    seating: "2–3 passengers",
    luggage: "2 medium bags",
  },
  {
    id: "suv",
    name: "SUV",
    description: "Comfortable for 3 passengers, spacious and versatile",
    seating: "3–4 passengers",
    luggage: "3–4 medium bags",
  },
  {
    id: "mini-van-flat",
    name: "Mini-van",
    variant: "Flat Roof",
    description: "Compact van option for small groups.",
    seating: "3–6 passengers",
    luggage: "3–6 medium bags",
  },
  {
    id: "van-high",
    name: "Van",
    variant: "High Roof",
    description: "Extra headroom and space for larger groups.",
    seating: "6–9 passengers",
    luggage: "6–9 medium bags",
  },
  {
    id: "mini-coach",
    name: "Mini Coach",
    description: "Mid-sized group transport with comfort.",
    seating: "9–20 passengers",
    luggage: "9–20 medium bags",
  },
  {
    id: "bus",
    name: "Bus",
    description: "Full-size coach for large groups and long journeys.",
    seating: "20+ passengers",
    luggage: "20+ medium bags",
  },
];

export function transportLabelFor(vehicleId: string): string {
  const option = AGENCY_TRANSPORT_OPTIONS.find((t) => t.id === vehicleId);
  if (!option) return "Vehicle";
  return option.variant ? `${option.name} (${option.variant})` : option.name;
}
