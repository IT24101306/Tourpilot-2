import type { Prisma } from "@prisma/client";
import { MAX_AGENCY_HERO_SLIDES } from "@tourpilot/shared";
import { asJson } from "../utils/json.js";

export type InfluencerHeroSlide = {
  url: string;
  label?: string;
};

export type InfluencerSocialLink = {
  platform: string;
  url: string;
  label?: string;
};

export type InfluencerTourDisplaySettings = {
  termsAcceptedAt?: string;
  hideAgencyName?: boolean;
  displayPriceLkr?: number;
};

export type InfluencerDisplayContent = {
  headline: string;
  tagline: string;
  tourIds: string[];
  offerIds: string[];
  heroImages: InfluencerHeroSlide[];
  aboutTitle: string;
  aboutDescription: string;
  socialLinks: InfluencerSocialLink[];
  tourSettings: Record<string, InfluencerTourDisplaySettings>;
};

const SOCIAL_PLATFORMS = new Set([
  "instagram",
  "facebook",
  "youtube",
  "tiktok",
  "tripadvisor",
  "whatsapp",
  "linkedin",
  "x",
  "website",
]);

export function defaultInfluencerDisplay(name: string): InfluencerDisplayContent {
  const first = name.trim().split(/\s+/)[0] || "My";
  return {
    headline: `${first}'s Sri Lanka picks`,
    tagline: "Ready-made tours I recommend — book through the links below.",
    tourIds: [],
    offerIds: [],
    heroImages: [],
    aboutTitle: "About the creator",
    aboutDescription: "",
    socialLinks: [],
    tourSettings: {},
  };
}

function parseHeroSlides(raw: unknown): InfluencerHeroSlide[] {
  if (!Array.isArray(raw)) return [];
  const slides: InfluencerHeroSlide[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const url = typeof row.url === "string" ? row.url.trim() : "";
    if (!url) continue;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    slides.push({ url, ...(label ? { label } : {}) });
    if (slides.length >= MAX_AGENCY_HERO_SLIDES) break;
  }
  return slides;
}

function parseSocialLinks(raw: unknown): InfluencerSocialLink[] {
  if (!Array.isArray(raw)) return [];
  const links: InfluencerSocialLink[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const platform = typeof row.platform === "string" ? row.platform.trim().toLowerCase() : "";
    const url = typeof row.url === "string" ? row.url.trim() : "";
    if (!platform || !url || !SOCIAL_PLATFORMS.has(platform)) continue;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    links.push({ platform, url, ...(label ? { label } : {}) });
    if (links.length >= 12) break;
  }
  return links;
}

function parseTourSettings(raw: unknown): Record<string, InfluencerTourDisplaySettings> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, InfluencerTourDisplaySettings> = {};
  for (const [tourId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!tourId.trim() || !value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const settings: InfluencerTourDisplaySettings = {};
    if (typeof row.termsAcceptedAt === "string" && row.termsAcceptedAt.trim()) {
      settings.termsAcceptedAt = row.termsAcceptedAt.trim();
    }
    if (row.hideAgencyName === true) settings.hideAgencyName = true;
    if (row.displayPriceLkr != null) {
      const price = Number(row.displayPriceLkr);
      if (Number.isFinite(price) && price > 0) settings.displayPriceLkr = Math.round(price);
    }
    if (Object.keys(settings).length > 0) out[tourId.trim()] = settings;
  }
  return out;
}

export function parseInfluencerDisplay(raw: unknown, name: string): InfluencerDisplayContent {
  const base = defaultInfluencerDisplay(name);
  if (!raw || typeof raw !== "object") return base;

  const obj = raw as Record<string, unknown>;
  if (typeof obj.headline === "string" && obj.headline.trim()) {
    base.headline = obj.headline.trim();
  }
  if (typeof obj.tagline === "string" && obj.tagline.trim()) {
    base.tagline = obj.tagline.trim();
  }
  if (Array.isArray(obj.tourIds)) {
    base.tourIds = obj.tourIds
      .map((id) => (typeof id === "string" ? id.trim() : ""))
      .filter(Boolean)
      .slice(0, 48);
  }
  if (Array.isArray(obj.offerIds)) {
    base.offerIds = obj.offerIds
      .map((id) => (typeof id === "string" ? id.trim() : ""))
      .filter(Boolean)
      .slice(0, 24);
  }
  base.heroImages = parseHeroSlides(obj.heroImages);
  if (typeof obj.aboutTitle === "string" && obj.aboutTitle.trim()) {
    base.aboutTitle = obj.aboutTitle.trim().slice(0, 80);
  }
  if (typeof obj.aboutDescription === "string") {
    base.aboutDescription = obj.aboutDescription.trim().slice(0, 1200);
  }
  base.socialLinks = parseSocialLinks(obj.socialLinks);
  base.tourSettings = parseTourSettings(obj.tourSettings);
  return base;
}

export function buildDisplayPayload(content: InfluencerDisplayContent): Prisma.InputJsonValue {
  return asJson({
    headline: content.headline,
    tagline: content.tagline,
    tourIds: content.tourIds,
    offerIds: content.offerIds,
    heroImages: content.heroImages.map((s) => ({
      url: s.url,
      ...(s.label?.trim() ? { label: s.label.trim() } : {}),
    })),
    aboutTitle: content.aboutTitle,
    aboutDescription: content.aboutDescription,
    socialLinks: content.socialLinks.map((l) => ({
      platform: l.platform,
      url: l.url,
      ...(l.label?.trim() ? { label: l.label.trim() } : {}),
    })),
    tourSettings: content.tourSettings,
  });
}

export function pruneTourSettings(
  tourSettings: Record<string, InfluencerTourDisplaySettings>,
  tourIds: string[]
): Record<string, InfluencerTourDisplaySettings> {
  const allowed = new Set(tourIds);
  const out: Record<string, InfluencerTourDisplaySettings> = {};
  for (const [tourId, settings] of Object.entries(tourSettings)) {
    if (allowed.has(tourId)) out[tourId] = settings;
  }
  return out;
}
