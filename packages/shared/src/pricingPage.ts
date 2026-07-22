/** CMS-backed pricing / revenue landing page content. */

export type PricingFilterOption = {
  value: string;
  label: string;
};

export type PricingFeatureLine = string;

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
  details: string[];
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
  /** "website" | "system" — comma-joined categories for filter */
  categories: string[];
  featured?: boolean;
  /** Build-yourself interactive picker */
  buildYourself?: boolean;
  /** Opens the included-features modal */
  showIncludedFeatures?: boolean;
  includedFeaturesLabel?: string;
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
      ctaHref: "/register-pro",
      categories: ["website"],
      featured: true,
      features: [
        "Custom, Unique website",
        "Full ERP — free Month 1",
        "Free hosting",
        "Free subdomain",
        "Free admin panel - 1 Month",
        "Unlimited pages",
        "Free SEO optimisation",
        "Free maintenance - 1 month",
      ],
    },
    {
      id: "starter",
      name: "Starter",
      tagline: "Build your own website, with full system access from day one.",
      price: "LKR 5,000",
      priceSub: "per month — all features included",
      ctaLabel: "Get Started",
      ctaHref: "/register-pro",
      categories: ["system"],
      features: [
        "7 day Free trial",
        "Build your website",
        "Free hosting",
        "Free subdomain",
        "Shareable website link",
        "Unlimited usage time",
        "Full ERP",
        "All features included",
      ],
    },
    {
      id: "build-yourself",
      name: "Build Yourself",
      tagline: "Pick only the features you need. You pick your plan, you choose your price.",
      price: "Pay-per-use",
      priceSub: "choose features · billed monthly",
      ctaLabel: "Get Started",
      ctaHref: "/register-pro",
      categories: ["website", "system"],
      buildYourself: true,
      features: ["7 day Free trial", "Free hosting", "Free subdomain", "Unlimited pages"],
    },
    {
      id: "payg-lite",
      name: "Pay-As-You-Go Lite",
      tagline: "Build your own website + Full ERP platform, no cost to start.",
      price: "Free to start",
      priceSub: "no monthly fee, no setup cost",
      ctaLabel: "Get Started",
      ctaHref: "/register-pro",
      categories: ["system"],
      showIncludedFeatures: true,
      includedFeaturesLabel: "View included features",
      features: [
        "7 day Free trial",
        "Build your website",
        "Full ERP",
        "All features free",
        "LKR 250 per login",
        "5% transaction fee",
        "Earnings & income view",
        "Easy wallet top-ups",
        "Free tourist/admin login",
      ],
    },
    {
      id: "payg-plus",
      name: "Pay-As-You-Go Plus",
      tagline: "Build your own website + Full ERP platform, with a lower login cost.",
      price: "Free to start",
      priceSub: "no monthly fee, no setup cost",
      ctaLabel: "Get Started",
      ctaHref: "/register-pro",
      categories: ["system"],
      showIncludedFeatures: true,
      includedFeaturesLabel: "View included features",
      features: [
        "7 day Free trial",
        "Build your website",
        "Full ERP",
        "All features free",
        "LKR 150 per login",
        "10% transaction fee",
        "Earnings & income view",
        "Easy wallet top-ups",
        "Free tourist/admin login",
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
        "Referral codes & share links — promote agency tours, earn commission on referred bookings",
        "Commission on tours — % of tour base price (default agency rate or negotiated rate)",
        "Commission negotiation — request/agree commission % with agencies (partners tab)",
        "Influencer login fee — LKR 25 per login (wallet debit)",
      ],
    },
    {
      title: "Booking (Direct Package Booking)",
      details: [
        "Ready-made tour packages — priced tours published on the storefront (USD shown to travelers)",
        "Traveler purchase flow — inquiry → proposal → accept (no in-app card payment yet)",
        "Offer registrations — travelers join promo campaigns (screenshot/terms flow, not a paid checkout)",
      ],
    },
    {
      title: "Negotiations",
      details: [
        "Custom tour proposals — agency builds itineraries with priced stops and sends quotes to travelers",
        "Negotiated bookings — traveler accepts a proposal → becomes a confirmed booking (payment off-platform today)",
        "Commission negotiation — also a back-and-forth agree-on-a-number flow between agency and influencer",
      ],
    },
    {
      title: "Display Tab (Customise Display Page)",
      details: [
        "Storefront sales funnel — public agency page: hero, packages, transport, gallery, reviews",
        "Influencer storefront — influencer's own page to sell/promote tours (\"share as mine\" style)",
        "Loyalty / promo offers — discounted price or free-tour style campaigns on the storefront",
        "Admin platform offers — site-wide promotional campaigns (acquisition-focused, not direct checkout)",
      ],
    },
    {
      title: "Driver handling",
      details: [
        "Trip assignments — driver assigned to agency bookings",
        "Earnings view — wallet balance + estimated weekly trip income",
        "Driver login fee — LKR 25 per login (wallet debit)",
      ],
    },
    {
      title: "Wallet & logins",
      details: [
        "Wallet top-ups — users add funds to platform wallet",
        "Tourist & Admin login — free, no fee",
      ],
    },
    {
      title: "Marketing strategies",
      details: [
        "Proven marketing strategies specialised for the tourism industry",
        "Individual branding attention",
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

export function parsePricingPageContent(blocks: unknown): PricingPageContent {
  const list = Array.isArray(blocks) ? blocks : [];
  const block = list.find(
    (b): b is PricingPageContent =>
      Boolean(b) && typeof b === "object" && (b as { type?: string }).type === "pricing"
  );
  if (!block) return structuredClone(DEFAULT_PRICING_PAGE);
  return {
    ...structuredClone(DEFAULT_PRICING_PAGE),
    ...block,
    type: "pricing",
    filterOptions: block.filterOptions?.length
      ? block.filterOptions
      : DEFAULT_PRICING_PAGE.filterOptions,
    packages: block.packages?.length ? block.packages : DEFAULT_PRICING_PAGE.packages,
    buildYourselfFeatures: block.buildYourselfFeatures?.length
      ? block.buildYourselfFeatures
      : DEFAULT_PRICING_PAGE.buildYourselfFeatures,
    includedFeaturesSections: block.includedFeaturesSections?.length
      ? block.includedFeaturesSections
      : DEFAULT_PRICING_PAGE.includedFeaturesSections,
  };
}

export function formatPricingLkr(amount: number): string {
  return `LKR ${Math.round(amount).toLocaleString("en-LK")}`;
}
