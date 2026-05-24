export type DisplaySectionFlags = {
  tours: boolean;
  showcase: boolean;
  reviews: boolean;
  gallery: boolean;
  offers: boolean;
  inquiry: boolean;
};

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

export type DisplayConfig = {
  enabled: DisplaySectionFlags;
  content: DisplayContent;
  gallery: GalleryItem[];
  reviews: DisplayReview[];
};

export const defaultDisplayContent = (): DisplayContent => ({
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
});

export const defaultDisplayConfig = (): DisplayConfig => ({
  enabled: {
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
