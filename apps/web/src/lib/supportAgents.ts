export type SupportAgent = {
  id: string;
  name: string;
  role: string;
  service: string;
  description: string;
  priceUsd: number;
  priceLabel: string;
  phone: string;
  phoneDisplay: string;
};

export const SUPPORT_AGENTS: SupportAgent[] = [
  {
    id: "simple-help",
    name: "Nimali Perera",
    role: "Quick help specialist",
    service: "Simple help",
    description: "Screen-share walkthroughs for one task — upload an image, publish a tour, or fix a form error.",
    priceUsd: 29,
    priceLabel: "$29 USD",
    phone: "+94771234567",
    phoneDisplay: "+94 77 123 4567",
  },
  {
    id: "hourly",
    name: "Ravi Fernando",
    role: "Platform consultant",
    service: "Per hour rate",
    description: "Live support billed by the hour — storefront tweaks, offer setup, inquiries, or display page questions.",
    priceUsd: 49,
    priceLabel: "$49 USD / hour",
    phone: "+94772345678",
    phoneDisplay: "+94 77 234 5678",
  },
  {
    id: "full-training",
    name: "Anuki Silva",
    role: "Onboarding trainer",
    service: "Full site training",
    description: "A structured 2-hour session covering your entire dashboard — tours, display, offers, partners, and best practices.",
    priceUsd: 189,
    priceLabel: "$189 USD",
    phone: "+94773456789",
    phoneDisplay: "+94 77 345 6789",
  },
];
