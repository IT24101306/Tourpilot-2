/** TourPilot support agents modal — admin-editable copy. */

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

export type SupportContent = {
  title: string;
  subtitle: string;
  footer: string;
  agents: SupportAgent[];
};

export const DEFAULT_SUPPORT_CONTENT: SupportContent = {
  title: "TourPilot support",
  subtitle:
    "Choose an agent for simple help, hourly consulting, or full dashboard training. Prices in USD.",
  footer:
    "Available weekdays 9:00–18:00 (SLST). Mention your agency or partner account when you call.",
  agents: [
    {
      id: "simple-help",
      name: "Nimali Perera",
      role: "Quick help specialist",
      service: "Simple help",
      description:
        "Screen-share walkthroughs for one task — upload an image, publish a tour, or fix a form error.",
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
      description:
        "Live support billed by the hour — storefront tweaks, offer setup, inquiries, or display page questions.",
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
      description:
        "A structured 2-hour session covering your entire dashboard — tours, display, offers, partners, and best practices.",
      priceUsd: 189,
      priceLabel: "$189 USD",
      phone: "+94773456789",
      phoneDisplay: "+94 77 345 6789",
    },
  ],
};

export function parseSupportContent(raw: unknown): SupportContent {
  const defaults = structuredClone(DEFAULT_SUPPORT_CONTENT);
  if (!raw || typeof raw !== "object") return defaults;
  const obj = raw as Record<string, unknown>;

  const title = typeof obj.title === "string" && obj.title.trim() ? obj.title : defaults.title;
  const subtitle =
    typeof obj.subtitle === "string" && obj.subtitle.trim() ? obj.subtitle : defaults.subtitle;
  const footer =
    typeof obj.footer === "string" && obj.footer.trim() ? obj.footer : defaults.footer;

  const agentsRaw = Array.isArray(obj.agents) ? obj.agents : defaults.agents;
  const agents: SupportAgent[] = agentsRaw
    .map((item, index): SupportAgent | null => {
      if (!item || typeof item !== "object") return null;
      const a = item as Record<string, unknown>;
      const id =
        typeof a.id === "string" && a.id.trim()
          ? a.id.trim()
          : `agent-${index + 1}`;
      const name = typeof a.name === "string" ? a.name : "";
      const role = typeof a.role === "string" ? a.role : "";
      const service = typeof a.service === "string" ? a.service : "";
      const description = typeof a.description === "string" ? a.description : "";
      const priceUsd = Number(a.priceUsd);
      const priceLabel =
        typeof a.priceLabel === "string" && a.priceLabel.trim()
          ? a.priceLabel
          : Number.isFinite(priceUsd)
            ? `$${Math.round(priceUsd)} USD`
            : "";
      const phone = typeof a.phone === "string" ? a.phone.trim() : "";
      const phoneDisplay =
        typeof a.phoneDisplay === "string" && a.phoneDisplay.trim()
          ? a.phoneDisplay
          : phone;
      if (!name && !service && !phone) return null;
      return {
        id,
        name,
        role,
        service,
        description,
        priceUsd: Number.isFinite(priceUsd) ? priceUsd : 0,
        priceLabel,
        phone,
        phoneDisplay,
      };
    })
    .filter((a): a is SupportAgent => a != null);

  return {
    title,
    subtitle,
    footer,
    agents: agents.length ? agents : defaults.agents,
  };
}
