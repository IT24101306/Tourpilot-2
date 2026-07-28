import { MAX_AGENCY_HERO_SLIDES, MEDIA, sanitizeRichHtml, isRichTextEmpty } from "@tourpilot/shared";

export type DisplaySectionFlags = {
  branding: boolean;
  whoWeAre: boolean;
  tours: boolean;
  showcase: boolean;
  reviews: boolean;
  gallery: boolean;
  offers: boolean;
  inquiry: boolean;
  transport: boolean;
};

export type DisplaySocialLink = {
  platform: string;
  url: string;
  label?: string;
};

export type WhoWeAreImage = {
  url: string;
  label?: string;
  alt?: string;
};

export type GalleryEntitySnapshot = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  district: string | null;
  description: string | null;
  durationMin: number | null;
  priceHint: number | null;
  media?: unknown;
  metadata?: Record<string, unknown> | null;
};

export type GalleryItem = {
  url: string;
  label: string;
  entityId: string;
};

export type EnrichedGalleryItem = GalleryItem & {
  entity: GalleryEntitySnapshot;
};

export type DisplayPackage = {
  title: string;
  location: string;
  priceLabel: string;
  /** LKR amount for live currency conversion on the public storefront. */
  priceLkr?: number;
  imageUrl: string;
  tourId?: string;
};

export type DisplayOffer = {
  title: string;
  description: string;
  priceLabel: string;
  priceLkr?: number;
  badge?: string;
  imageUrl?: string;
};

/** Free-tour strip banner on the public storefront. */
export type OfferBannerStyle = "strip";

export type DisplayTransportOption = {
  id: string;
  name: string;
  variant?: string;
  description: string;
  seating: string;
  luggage: string;
};

export const DEFAULT_TRANSPORT_OPTIONS: DisplayTransportOption[] = [
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

export type HeroSlide = {
  url: string;
  label?: string;
};

export type DisplayContent = {
  heroHeadline: string;
  heroSubheadline: string;
  heroImages: HeroSlide[];
  whoWeAreTitle: string;
  whoWeAreDescription: string;
  whoWeAreSocialLinks: DisplaySocialLink[];
  whoWeAreImages: WhoWeAreImage[];
  socialTagHandle: string;
  packagesTitle: string;
  packagesSubtitle: string;
  ratingScore: string;
  ratingSuffix: string;
  highlights: string[];
  ctaLabel: string;
  featuredImageUrl: string;
  featuredQuote: string;
  packages: DisplayPackage[];
  offers: DisplayOffer[];
  transportOptions: DisplayTransportOption[];
  offerBannerStyle: OfferBannerStyle;
};

export type DisplaySectionsPayload = {
  enabled: DisplaySectionFlags;
  content: DisplayContent;
};

export const defaultDisplayEnabled = (): DisplaySectionFlags => ({
  branding: true,
  whoWeAre: true,
  tours: true,
  showcase: true,
  reviews: true,
  gallery: true,
  offers: true,
  inquiry: true,
  transport: true,
});

export function defaultDisplayContent(): DisplayContent {
  return {
    heroHeadline: "Find your perfect trip experience.",
    heroSubheadline: "Handcrafted journeys with local experts, transparent pricing, and routes you can trust.",
    heroImages: [],
    whoWeAreTitle: "WHO WE ARE",
    whoWeAreDescription: "",
    whoWeAreSocialLinks: [],
    whoWeAreImages: [],
    socialTagHandle: "",
    packagesTitle: "Ready-Made Packages",
    packagesSubtitle: "Curated routes with local guides, transport, and stays included.",
    ratingScore: "4.9",
    ratingSuffix: "/5",
    highlights: [
      "56+ guided tours delivered",
      "100% safe routes with certified local guides",
      "5+ years of local travel experience",
    ],
    ctaLabel: "Plan your trip",
    featuredImageUrl: MEDIA.hero,
    featuredQuote:
      "We expected sand and silence. We found peace, stars, and people who love what they do.",
    packages: [],
    offers: [],
    transportOptions: DEFAULT_TRANSPORT_OPTIONS.map((option) => ({ ...option })),
    offerBannerStyle: "strip",
  };
}

export function parseDisplaySections(raw: unknown): DisplaySectionFlags {
  const enabled = defaultDisplayEnabled();
  if (!raw || typeof raw !== "object") return enabled;

  const obj = raw as Record<string, unknown>;
  if (obj.enabled && typeof obj.enabled === "object") {
    const e = obj.enabled as Record<string, unknown>;
    return {
      branding: e.branding !== false,
      whoWeAre: e.whoWeAre !== false,
      tours: e.tours !== false,
      showcase: e.showcase !== false,
      reviews: e.reviews !== false,
      gallery: e.gallery !== false,
      offers: e.offers !== false,
      inquiry: e.inquiry !== false,
      transport: e.transport !== false,
    };
  }

  return enabled;
}

export function parseDisplayContent(raw: unknown): DisplayContent {
  const base = defaultDisplayContent();
  if (!raw || typeof raw !== "object") return base;

  const obj = raw as Record<string, unknown>;
  const content =
    obj.content && typeof obj.content === "object"
      ? (obj.content as Record<string, unknown>)
      : obj;

  if (typeof content.heroHeadline === "string") base.heroHeadline = content.heroHeadline;
  if (typeof content.heroSubheadline === "string") base.heroSubheadline = content.heroSubheadline;
  if (typeof content.packagesTitle === "string") base.packagesTitle = content.packagesTitle;
  if (typeof content.packagesSubtitle === "string") base.packagesSubtitle = content.packagesSubtitle;
  if (typeof content.ratingScore === "string") base.ratingScore = content.ratingScore;
  if (typeof content.ratingSuffix === "string") base.ratingSuffix = content.ratingSuffix;
  if (typeof content.ctaLabel === "string") base.ctaLabel = content.ctaLabel;
  if (typeof content.featuredImageUrl === "string") base.featuredImageUrl = content.featuredImageUrl;
  if (typeof content.featuredQuote === "string") base.featuredQuote = content.featuredQuote;

  if (Array.isArray(content.heroImages)) {
    const heroImages: HeroSlide[] = [];
    for (const slide of content.heroImages) {
      if (!slide || typeof slide !== "object") continue;
      const row = slide as Record<string, unknown>;
      const url = String(row.url || "").trim();
      if (!url) continue;
      heroImages.push({
        url,
        label: typeof row.label === "string" ? row.label.trim() : undefined,
      });
    }
    base.heroImages = heroImages.slice(0, MAX_AGENCY_HERO_SLIDES);
  }

  if (typeof content.whoWeAreTitle === "string") base.whoWeAreTitle = content.whoWeAreTitle;
  if (typeof content.whoWeAreDescription === "string") {
    const cleaned = sanitizeRichHtml(content.whoWeAreDescription);
    base.whoWeAreDescription = isRichTextEmpty(cleaned) ? "" : cleaned;
  }

  if (Array.isArray(content.whoWeAreSocialLinks)) {
    const links: DisplaySocialLink[] = [];
    for (const item of content.whoWeAreSocialLinks) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const platform = String(row.platform || "").trim();
      const url = String(row.url || "").trim();
      if (!platform || !url) continue;
      links.push({
        platform,
        url,
        label: typeof row.label === "string" ? row.label.trim() : undefined,
      });
    }
    base.whoWeAreSocialLinks = links.slice(0, 12);
  }

  if (typeof content.socialTagHandle === "string") {
    base.socialTagHandle = content.socialTagHandle.trim().slice(0, 80);
  }

  if (Array.isArray(content.whoWeAreImages)) {
    const images: WhoWeAreImage[] = [];
    for (const item of content.whoWeAreImages) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const url = String(row.url || "").trim();
      if (!url) continue;
      images.push({
        url,
        label: typeof row.label === "string" ? row.label.trim() : undefined,
        alt: typeof row.alt === "string" ? row.alt.trim() : undefined,
      });
    }
    base.whoWeAreImages = images.slice(0, 8);
  }

  if (Array.isArray(content.highlights)) {
    base.highlights = content.highlights
      .map((h) => (typeof h === "string" ? h.trim() : ""))
      .filter(Boolean)
      .slice(0, 6);
  }

  if (Array.isArray(content.packages)) {
    const packages: DisplayPackage[] = [];
    for (const p of content.packages) {
      if (!p || typeof p !== "object") continue;
      const row = p as Record<string, unknown>;
      const title = String(row.title || "").trim();
      const location = String(row.location || "").trim();
      const priceLabel = String(row.priceLabel || "").trim();
      const imageUrl = String(row.imageUrl || "").trim();
      const priceLkrRaw = Number(row.priceLkr);
      const priceLkr = Number.isFinite(priceLkrRaw) && priceLkrRaw >= 0 ? priceLkrRaw : undefined;
      if (!title || !imageUrl) continue;
      packages.push({
        title,
        location,
        priceLabel: priceLabel || "Contact for price",
        priceLkr,
        imageUrl,
        tourId: typeof row.tourId === "string" ? row.tourId : undefined,
      });
    }
    base.packages = packages;
  }

  if (Array.isArray(content.offers)) {
    const offers: DisplayOffer[] = [];
    for (const o of content.offers) {
      if (!o || typeof o !== "object") continue;
      const row = o as Record<string, unknown>;
      const title = String(row.title || "").trim();
      const description = String(row.description || "").trim();
      const priceLabel = String(row.priceLabel || "").trim();
      const priceLkrRaw = Number(row.priceLkr);
      const priceLkr = Number.isFinite(priceLkrRaw) && priceLkrRaw >= 0 ? priceLkrRaw : undefined;
      if (!title) continue;
      offers.push({
        title,
        description,
        priceLabel: priceLabel || "",
        priceLkr,
        badge: typeof row.badge === "string" ? row.badge : undefined,
        imageUrl: typeof row.imageUrl === "string" ? row.imageUrl : undefined,
      });
    }
    base.offers = offers;
  }

  if (Array.isArray(content.transportOptions)) {
    const transportOptions: DisplayTransportOption[] = [];
    for (const item of content.transportOptions) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const id = String(row.id || "").trim();
      const name = String(row.name || "").trim();
      if (!id || !name) continue;
      transportOptions.push({
        id,
        name,
        variant: typeof row.variant === "string" ? row.variant.trim() || undefined : undefined,
        description: (() => {
          const cleaned = sanitizeRichHtml(String(row.description || ""));
          return isRichTextEmpty(cleaned) ? "" : cleaned;
        })(),
        seating: String(row.seating || "").trim(),
        luggage: String(row.luggage || "").trim(),
      });
    }
    base.transportOptions = transportOptions.slice(0, 12);
  } else {
    base.transportOptions = DEFAULT_TRANSPORT_OPTIONS.map((option) => ({ ...option }));
  }

  // Legacy "card" (flip showcase) is retired — always use strip.
  base.offerBannerStyle = "strip";

  return base;
}

export function parseDisplayPayload(sectionsRaw: unknown): DisplaySectionsPayload {
  return {
    enabled: parseDisplaySections(sectionsRaw),
    content: parseDisplayContent(sectionsRaw),
  };
}

export function parseGallery(raw: unknown): GalleryItem[] {
  if (!Array.isArray(raw)) return [];

  const items: GalleryItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const url = String(row.url || "").trim();
    const entityId = String(row.entityId || "").trim();
    if (!url) continue;
    items.push({
      url,
      label: String(row.label || "Gallery").trim() || "Gallery",
      entityId,
    });
  }
  return items;
}

export function enrichGalleryWithEntities(
  items: GalleryItem[],
  entitiesById: Map<string, GalleryEntitySnapshot>
): EnrichedGalleryItem[] {
  const enriched: EnrichedGalleryItem[] = [];
  for (const item of items) {
    const entity = entitiesById.get(item.entityId);
    if (!entity) continue;
    enriched.push({ ...item, entity });
  }
  return enriched;
}

export function buildSectionsPayload(
  enabled: DisplaySectionFlags,
  content: DisplayContent
): Record<string, unknown> {
  return { enabled, content };
}
