import { DEFAULT_TOUR_COVER_URL, resolveImageUrl } from "@tourpilot/shared";
import type { DisplaySocialLink, HeroSlide } from "../components/display/displayTypes";

export type InfluencerTourDisplaySettings = {
  termsAcceptedAt?: string;
  /** @deprecated Prefer shareAsMine */
  hideAgencyName?: boolean;
  /** Hide agency + influencer handles inquire chat */
  shareAsMine?: boolean;
  displayPriceLkr?: number;
  coverUrl?: string;
  galleryImages?: HeroSlide[];
};

export const MAX_INFLUENCER_TOUR_GALLERY = 8;

export type InfluencerDisplayContent = {
  headline: string;
  tagline: string;
  tourIds: string[];
  offerIds: string[];
  heroImages: HeroSlide[];
  aboutTitle: string;
  aboutDescription: string;
  socialLinks: DisplaySocialLink[];
  socialTagHandle: string;
  tourSettings: Record<string, InfluencerTourDisplaySettings>;
};

export function resolveInfluencerHeroSlides(
  heroImages: HeroSlide[],
  tourCoverUrls: string[]
): HeroSlide[] {
  const custom = heroImages
    .map((s) => ({
      url: resolveImageUrl(s.url.trim()),
      label: s.label?.trim() || "",
    }))
    .filter((s) => s.url);

  if (custom.length > 0) return custom;

  const seen = new Set<string>();
  const slides: HeroSlide[] = [];
  for (const cover of tourCoverUrls) {
    const url = resolveImageUrl(cover, DEFAULT_TOUR_COVER_URL);
    if (seen.has(url)) continue;
    seen.add(url);
    slides.push({ url, label: "" });
    if (slides.length >= 8) break;
  }

  if (slides.length === 0) {
    slides.push({ url: DEFAULT_TOUR_COVER_URL, label: "" });
  }
  return slides;
}
