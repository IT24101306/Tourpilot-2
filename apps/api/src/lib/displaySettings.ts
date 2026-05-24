export type DisplaySectionFlags = {
  tours: boolean;
  showcase: boolean;
  reviews: boolean;
  gallery: boolean;
  offers: boolean;
  inquiry: boolean;
};

export type GalleryItem = {
  url: string;
  label: string;
};

export type DisplayPackage = {
  title: string;
  location: string;
  priceLabel: string;
  imageUrl: string;
  tourId?: string;
};

export type DisplayOffer = {
  title: string;
  description: string;
  priceLabel: string;
  badge?: string;
  imageUrl?: string;
};

export type DisplayContent = {
  heroHeadline: string;
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
};

export type DisplaySectionsPayload = {
  enabled: DisplaySectionFlags;
  content: DisplayContent;
};

export const defaultDisplayEnabled = (): DisplaySectionFlags => ({
  tours: true,
  showcase: true,
  reviews: true,
  gallery: true,
  offers: true,
  inquiry: true,
});

export function defaultDisplayContent(): DisplayContent {
  return {
    heroHeadline: "Find your perfect trip experience.",
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
    featuredImageUrl:
      "https://images.unsplash.com/photo-1526778548025-fa2f588cd1f1?auto=format&fit=crop&w=1200&q=80",
    featuredQuote:
      "We expected sand and silence. We found peace, stars, and people who love what they do.",
    packages: [],
    offers: [],
  };
}

export function parseDisplaySections(raw: unknown): DisplaySectionFlags {
  const enabled = defaultDisplayEnabled();
  if (!raw || typeof raw !== "object") return enabled;

  const obj = raw as Record<string, unknown>;
  if (obj.enabled && typeof obj.enabled === "object") {
    const e = obj.enabled as Record<string, unknown>;
    return {
      tours: e.tours !== false,
      showcase: e.showcase !== false,
      reviews: e.reviews !== false,
      gallery: e.gallery !== false,
      offers: e.offers !== false,
      inquiry: e.inquiry !== false,
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
  if (typeof content.packagesTitle === "string") base.packagesTitle = content.packagesTitle;
  if (typeof content.packagesSubtitle === "string") base.packagesSubtitle = content.packagesSubtitle;
  if (typeof content.ratingScore === "string") base.ratingScore = content.ratingScore;
  if (typeof content.ratingSuffix === "string") base.ratingSuffix = content.ratingSuffix;
  if (typeof content.ctaLabel === "string") base.ctaLabel = content.ctaLabel;
  if (typeof content.featuredImageUrl === "string") base.featuredImageUrl = content.featuredImageUrl;
  if (typeof content.featuredQuote === "string") base.featuredQuote = content.featuredQuote;

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
      if (!title || !imageUrl) continue;
      packages.push({
        title,
        location,
        priceLabel: priceLabel || "Contact for price",
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
      if (!title) continue;
      offers.push({
        title,
        description,
        priceLabel: priceLabel || "",
        badge: typeof row.badge === "string" ? row.badge : undefined,
        imageUrl: typeof row.imageUrl === "string" ? row.imageUrl : undefined,
      });
    }
    base.offers = offers;
  }

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
    if (typeof entry === "string" && entry.trim()) {
      items.push({ url: entry.trim(), label: "Gallery" });
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const url = String(row.url || "").trim();
    if (!url) continue;
    items.push({
      url,
      label: String(row.label || "Gallery").trim() || "Gallery",
    });
  }
  return items;
}

export function buildSectionsPayload(
  enabled: DisplaySectionFlags,
  content: DisplayContent
): Record<string, unknown> {
  return { enabled, content };
}
