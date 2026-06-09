import { DEFAULT_TOUR_COVER_URL, resolveImageUrl } from "@tourpilot/shared";

export type DisplaySectionFlags = {
  whoWeAre: boolean;
  tours: boolean;
  showcase: boolean;
  reviews: boolean;
  gallery: boolean;
  offers: boolean;
  inquiry: boolean;
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

export const SOCIAL_PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "youtube", label: "YouTube" },
  { id: "tiktok", label: "TikTok" },
  { id: "tripadvisor", label: "TripAdvisor" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X (Twitter)" },
  { id: "website", label: "Website" },
] as const;

export type DisplayReview = {
  id?: string;
  authorName: string;
  rating: number;
  body: string;
};

export type GalleryItem = {
  url: string;
  label: string;
};

export type HeroSlide = {
  url: string;
  label?: string;
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
  heroSubheadline: string;
  heroImages: HeroSlide[];
  whoWeAreTitle: string;
  whoWeAreDescription: string;
  whoWeAreSocialLinks: DisplaySocialLink[];
  whoWeAreImages: WhoWeAreImage[];
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

export type DisplayConfig = {
  enabled: DisplaySectionFlags;
  content: DisplayContent;
  gallery: GalleryItem[];
  reviews: DisplayReview[];
};

export const defaultDisplayContent = (): DisplayContent => ({
  heroHeadline: "Find your perfect trip experience.",
  heroSubheadline:
    "Handcrafted journeys with local experts, transparent pricing, and routes you can trust.",
  heroImages: [],
  whoWeAreTitle: "WHO WE ARE",
  whoWeAreDescription: "",
  whoWeAreSocialLinks: [],
  whoWeAreImages: [],
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
    "https://images.unsplash.com/photo-1682687982501-1e58ab814714?auto=format&fit=crop&w=1200&q=80",
  featuredQuote:
    "We expected sand and silence. We found peace, stars, and people who love what they do.",
  packages: [],
  offers: [],
});

export const defaultDisplayConfig = (): DisplayConfig => ({
  enabled: {
    whoWeAre: true,
    tours: true,
    showcase: true,
    reviews: true,
    gallery: true,
    offers: true,
    inquiry: true,
  },
  content: defaultDisplayContent(),
  gallery: [],
  reviews: [],
});

export function sectionEnabled(
  enabled: DisplaySectionFlags | undefined,
  key: keyof DisplaySectionFlags
): boolean {
  return enabled?.[key] ?? defaultDisplayConfig().enabled[key];
}

/** Resolve hero slides for the public page (custom slides → cover → featured → default). */
export function resolveHeroSlides(
  content: DisplayContent,
  fallbacks: { coverUrl?: string | null; featuredImageUrl?: string | null }
): HeroSlide[] {
  const custom = content.heroImages
    .map((s) => ({ url: s.url.trim(), label: s.label?.trim() }))
    .filter((s) => s.url);

  if (custom.length > 0) return custom;

  const slides: HeroSlide[] = [];
  const cover = fallbacks.coverUrl?.trim();
  const featured = fallbacks.featuredImageUrl?.trim();

  if (cover) slides.push({ url: resolveImageUrl(cover), label: "" });
  if (featured && featured !== cover) {
    slides.push({ url: resolveImageUrl(featured), label: "" });
  }

  if (slides.length === 0) {
    slides.push({ url: DEFAULT_TOUR_COVER_URL, label: "" });
  }

  return slides;
}
