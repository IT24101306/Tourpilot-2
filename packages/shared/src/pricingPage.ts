/** CMS-backed pricing / revenue landing page content. */

export type PricingFilterOption = {
  value: string;
  label: string;
};

/** One bullet on a package card (or included-features modal). */
export type PricingFeatureLine = {
  text: string;
  bold?: boolean;
  underline?: boolean;
};

export type PricingAddonFeature = {
  id: string;
  name: string;
  priceLkr: number;
  /** Shown on the card (not only in “more features” modal). */
  primary?: boolean;
  defaultChecked?: boolean;
};

export type PricingIncludedSection = {
  title: string;
  details: PricingFeatureLine[];
};

export type PricingPackage = {
  id: string;
  name: string;
  tagline: string;
  price: string;
  priceSub: string;
  ctaLabel: string;
  ctaHref: string;
  features: PricingFeatureLine[];
  /** Optional second feature list on the card. */
  featuresExtraTitle?: string;
  featuresExtra?: PricingFeatureLine[];
  /** "website" | "system" — comma-joined categories for filter */
  categories: string[];
  featured?: boolean;
  /** Build-yourself interactive picker */
  buildYourself?: boolean;
  /** Opens the included-features modal */
  showIncludedFeatures?: boolean;
  includedFeaturesLabel?: string;
  /** Amount charged after the 7-day trial (0 for free-to-start / PAYG). */
  priceLkr?: number;
  /** Display label for post-trial amount (optional override of `price`). */
  priceLabel?: string;
  /** MONTHLY | ONE_TIME | PAYG | CUSTOM */
  billing?: "MONTHLY" | "ONE_TIME" | "PAYG" | "CUSTOM";
  /** For PAYG: per-login fee applied after trial. */
  loginFeeLkr?: number;
};

export type PricingPageContent = {
  type: "pricing";
  headline: string;
  packageTypeLabel: string;
  packageTypeAccent: string;
  filterOptions: PricingFilterOption[];
  packages: PricingPackage[];
  buildYourselfFeatures: PricingAddonFeature[];
  includedFeaturesTitle: string;
  includedFeaturesSections: PricingIncludedSection[];
  moreFeaturesTitle: string;
  moreFeaturesSubtitle: string;
  monthlyTotalLabel: string;
  termsTitle: string;
  termsBody: string;
};

/** Accept legacy plain strings or rich `{ text, bold?, underline? }` lines. */
export function normalizePricingFeatureLine(line: unknown): PricingFeatureLine | null {
  if (typeof line === "string") {
    const text = line.trim();
    return text ? { text } : null;
  }
  if (line && typeof line === "object") {
    const raw = line as { text?: unknown; bold?: unknown; underline?: unknown };
    if (typeof raw.text !== "string") return null;
    const text = raw.text.trim();
    if (!text) return null;
    return {
      text,
      bold: Boolean(raw.bold),
      underline: Boolean(raw.underline),
    };
  }
  return null;
}

export function normalizePricingFeatureLines(lines: unknown): PricingFeatureLine[] {
  if (!Array.isArray(lines)) return [];
  return lines.map(normalizePricingFeatureLine).filter((l): l is PricingFeatureLine => Boolean(l));
}

function fl(text: string, style?: { bold?: boolean; underline?: boolean }): PricingFeatureLine {
  return { text, ...style };
}

export const DEFAULT_PRICING_PAGE: PricingPageContent = {
  type: "pricing",
  headline: "Choose the way you grow online",
  packageTypeLabel: "Package",
  packageTypeAccent: "type",
  filterOptions: [
    { value: "All", label: "All" },
    { value: "Website", label: "Website" },
    { value: "Website + Full System", label: "Website + Full System" },
  ],
  packages: [
    {
      id: "signature-website",
      name: "Signature Website",
      tagline: "A one-of-a-kind website, backed by the full management system.",
      price: "LKR 20,000",
      priceSub: "one-time payment",
      ctaLabel: "Get Started",
      ctaHref: "/register-pro?package=signature-website&name=Signature%20Website&priceLkr=20000&priceLabel=LKR%2020%2C000&billing=ONE_TIME",
      categories: ["website"],
      featured: true,
      priceLkr: 20000,
      billing: "ONE_TIME",
      features: [
        fl("Custom, Unique website", { bold: true }),
        fl("Full ERP — free Month 1"),
        fl("Free hosting"),
        fl("Free subdomain"),
        fl("Free admin panel - 1 Month"),
        fl("Unlimited pages"),
        fl("Free SEO optimisation"),
        fl("Free maintenance - 1 month"),
      ],
    },
    {
      id: "starter",
      name: "Starter",
      tagline: "Build your own website, with full system access from day one.",
      price: "LKR 5,000",
      priceSub: "per month — all features included",
      ctaLabel: "Get Started",
      ctaHref: "/register-pro?package=starter&name=Starter&priceLkr=5000&priceLabel=LKR%205%2C000%20%2F%20month&billing=MONTHLY",
      categories: ["system"],
      priceLkr: 5000,
      billing: "MONTHLY",
      features: [
        fl("7 day Free trial", { bold: true }),
        fl("Build your website"),
        fl("Free hosting"),
        fl("Free subdomain"),
        fl("Shareable website link"),
        fl("Unlimited usage time"),
        fl("Full ERP"),
        fl("All features included"),
      ],
    },
    {
      id: "build-yourself",
      name: "Build Yourself",
      tagline: "Pick only the features you need. You pick your plan, you choose your price.",
      price: "Pay-per-use",
      priceSub: "choose features · billed monthly",
      ctaLabel: "Get Started",
      ctaHref: "/register-pro?package=build-yourself&name=Build%20Yourself&priceLkr=0&priceLabel=Pay-per-use&billing=CUSTOM",
      categories: ["website", "system"],
      buildYourself: true,
      priceLkr: 0,
      billing: "CUSTOM",
      features: [
        fl("7 day Free trial", { bold: true }),
        fl("Free hosting"),
        fl("Free subdomain"),
        fl("Unlimited pages"),
      ],
    },
    {
      id: "payg-lite",
      name: "Pay-As-You-Go Lite",
      tagline: "Build your own website + Full ERP platform, no cost to start.",
      price: "Free to start",
      priceSub: "no monthly fee, no setup cost",
      ctaLabel: "Get Started",
      ctaHref: "/register-pro?package=payg-lite&name=Pay-As-You-Go%20Lite&priceLkr=250&priceLabel=LKR%20250%20per%20login&billing=PAYG",
      categories: ["system"],
      showIncludedFeatures: true,
      includedFeaturesLabel: "View included features",
      priceLkr: 250,
      billing: "PAYG",
      loginFeeLkr: 250,
      features: [
        fl("7 day Free trial", { bold: true }),
        fl("Build your website"),
        fl("Full ERP"),
        fl("All features free"),
        fl("LKR 250 per login", { underline: true }),
        fl("5% transaction fee", { underline: true }),
        fl("Earnings & income view"),
        fl("Easy wallet top-ups"),
        fl("Free tourist/admin login"),
      ],
    },
    {
      id: "payg-plus",
      name: "Pay-As-You-Go Plus",
      tagline: "Build your own website + Full ERP platform, with a lower login cost.",
      price: "Free to start",
      priceSub: "no monthly fee, no setup cost",
      ctaLabel: "Get Started",
      ctaHref: "/register-pro?package=payg-plus&name=Pay-As-You-Go%20Plus&priceLkr=150&priceLabel=LKR%20150%20per%20login&billing=PAYG",
      categories: ["system"],
      showIncludedFeatures: true,
      includedFeaturesLabel: "View included features",
      priceLkr: 150,
      billing: "PAYG",
      loginFeeLkr: 150,
      features: [
        fl("7 day Free trial", { bold: true }),
        fl("Build your website"),
        fl("Full ERP"),
        fl("All features free"),
        fl("LKR 150 per login", { underline: true }),
        fl("10% transaction fee", { underline: true }),
        fl("Earnings & income view"),
        fl("Easy wallet top-ups"),
        fl("Free tourist/admin login"),
      ],
    },
  ],
  buildYourselfFeatures: [
    { id: "website-builder", name: "Website builder", priceLkr: 1000, primary: true, defaultChecked: true },
    { id: "custom-subdomain", name: "Custom subdomain", priceLkr: 800, primary: true, defaultChecked: true },
    { id: "booking", name: "Booking Management", priceLkr: 100, primary: true, defaultChecked: true },
    { id: "negotiations", name: "Negotiations", priceLkr: 500, primary: true, defaultChecked: true },
    { id: "admin-panel", name: "Admin Panel", priceLkr: 500, primary: true, defaultChecked: true },
    { id: "driver-handling", name: "Driver handling", priceLkr: 300, primary: true, defaultChecked: false },
    { id: "influencer", name: "Influencer Connections", priceLkr: 2000, defaultChecked: false },
    { id: "display-tab", name: "Display Tab (Customise Display Page)", priceLkr: 500, defaultChecked: false },
    { id: "wallet", name: "Wallet top-ups & earnings view", priceLkr: 250, defaultChecked: false },
    { id: "analytics", name: "Analytics dashboard", priceLkr: 750, defaultChecked: false },
    { id: "custom-domain", name: "Custom domain support", priceLkr: 400, defaultChecked: false },
    { id: "seo", name: "SEO tools", priceLkr: 350, defaultChecked: false },
    { id: "priority-support", name: "Priority support", priceLkr: 600, defaultChecked: false },
  ],
  includedFeaturesTitle: "All Features Included",
  includedFeaturesSections: [
    {
      title: "Influencer Connections",
      details: [
        fl("Referral codes & share links — promote agency tours, earn commission on referred bookings"),
        fl("Commission on tours — % of tour base price (default agency rate or negotiated rate)"),
        fl("Commission negotiation — request/agree commission % with agencies (partners tab)"),
        fl("Influencer login fee — LKR 25 per login (wallet debit)"),
      ],
    },
    {
      title: "Booking (Direct Package Booking)",
      details: [
        fl("Ready-made tour packages — priced tours published on the storefront (USD shown to travelers)"),
        fl("Traveler purchase flow — inquiry → proposal → accept (no in-app card payment yet)"),
        fl("Offer registrations — travelers join promo campaigns (screenshot/terms flow, not a paid checkout)"),
      ],
    },
    {
      title: "Negotiations",
      details: [
        fl("Custom tour proposals — agency builds itineraries with priced stops and sends quotes to travelers"),
        fl("Negotiated bookings — traveler accepts a proposal → becomes a confirmed booking (payment off-platform today)"),
        fl("Commission negotiation — also a back-and-forth agree-on-a-number flow between agency and influencer"),
      ],
    },
    {
      title: "Display Tab (Customise Display Page)",
      details: [
        fl("Storefront sales funnel — public agency page: hero, packages, transport, gallery, reviews"),
        fl("Influencer storefront — influencer's own page to sell/promote tours (\"share as mine\" style)"),
        fl("Loyalty / promo offers — discounted price or free-tour style campaigns on the storefront"),
        fl("Admin platform offers — site-wide promotional campaigns (acquisition-focused, not direct checkout)"),
      ],
    },
    {
      title: "Driver handling",
      details: [
        fl("Trip assignments — driver assigned to agency bookings"),
        fl("Earnings view — wallet balance + estimated weekly trip income"),
        fl("Driver login fee — LKR 25 per login (wallet debit)"),
      ],
    },
    {
      title: "Wallet & logins",
      details: [
        fl("Wallet top-ups — users add funds to platform wallet"),
        fl("Tourist & Admin login — free, no fee"),
      ],
    },
    {
      title: "Marketing strategies",
      details: [
        fl("Proven marketing strategies specialised for the tourism industry"),
        fl("Individual branding attention"),
      ],
    },
  ],
  moreFeaturesTitle: "More features",
  moreFeaturesSubtitle: "Select extras for your Build Yourself plan",
  monthlyTotalLabel: "Monthly total",
  termsTitle: "Terms & Conditions",
  termsBody:
    "SriLankaTourPilot has the right to change the packages when needed, with 6 months' notice.",
};

function normalizePackage(pkg: PricingPackage): PricingPackage {
  return {
    ...pkg,
    features: normalizePricingFeatureLines(pkg.features),
    featuresExtraTitle: pkg.featuresExtraTitle?.trim() || undefined,
    featuresExtra: normalizePricingFeatureLines(pkg.featuresExtra),
  };
}

export function parsePricingPageContent(blocks: unknown): PricingPageContent {
  const list = Array.isArray(blocks) ? blocks : [];
  const block = list.find(
    (b): b is PricingPageContent =>
      Boolean(b) && typeof b === "object" && (b as { type?: string }).type === "pricing"
  );
  if (!block) return structuredClone(DEFAULT_PRICING_PAGE);
  const base = structuredClone(DEFAULT_PRICING_PAGE);
  const packages = (block.packages?.length ? block.packages : base.packages).map(normalizePackage);
  const includedFeaturesSections = (
    block.includedFeaturesSections?.length
      ? block.includedFeaturesSections
      : base.includedFeaturesSections
  ).map((s) => ({
    title: s.title,
    details: normalizePricingFeatureLines(s.details),
  }));
  return {
    ...base,
    ...block,
    type: "pricing",
    filterOptions: block.filterOptions?.length ? block.filterOptions : base.filterOptions,
    packages,
    buildYourselfFeatures: block.buildYourselfFeatures?.length
      ? block.buildYourselfFeatures
      : base.buildYourselfFeatures,
    includedFeaturesSections,
  };
}

export function formatPricingLkr(amount: number): string {
  return `LKR ${Math.round(amount).toLocaleString("en-LK")}`;
}
