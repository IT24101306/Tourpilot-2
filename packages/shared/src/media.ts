/** Verified Unsplash CDN URLs (images.unsplash.com returns 404 for many legacy IDs). */

const unsplash = (photoId: string, width = 1200) =>
  `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${width}&q=80`;

export const MEDIA = {
  /** Default tour / package cover */
  tourCover: unsplash("1682687982501-1e58ab814714"),
  /** Cultural heritage / temples */
  cultural: unsplash("1500530855697-b586d89ba3ee"),
  /** Coast & beach */
  coast: unsplash("1544735716-392fe2489ffa"),
  /** Wildlife / nature */
  nature: unsplash("1472396961693-142e6e269027"),
  /** Hero / featured landscape */
  hero: unsplash("1682687982501-1e58ab814714", 2200),
  /** Agency card fallback */
  agencyCover: unsplash("1500530855697-b586d89ba3ee", 800),
} as const;

/** Ceylon Trails storefront hero mosaic (served from apps/web/public). */
export const CEYLON_TRAILS_HERO_IMAGES = [
  { url: "/images/ceylon-trails/sigiriya.png", label: "Sigiriya Rock" },
  { url: "/images/ceylon-trails/leopard.png", label: "Sri Lankan Leopard" },
  { url: "/images/ceylon-trails/sunset-fields.png", label: "Golden Hour" },
  { url: "/images/ceylon-trails/colombo-skyline.png", label: "Colombo Skyline" },
  { url: "/images/ceylon-trails/coastal-aerial.png", label: "South Coast" },
  { url: "/images/ceylon-trails/stilt-fishermen.png", label: "Stilt Fishermen" },
  { url: "/images/ceylon-trails/traditional-masks.png", label: "Traditional Masks" },
  { url: "/images/ceylon-trails/train-tea-country.png", label: "Tea Country Train" },
  { url: "/images/ceylon-trails/buddha-rock.png", label: "Ancient Buddha" },
] as const;

export const DEFAULT_TOUR_COVER_URL = MEDIA.tourCover;

/** Legacy seed URLs that 404 on Unsplash — treat as missing so fallbacks apply. */
const BROKEN_UNSPLASH_PHOTO_IDS = ["1580619305218-8423a4bb63b2"] as const;

/** True for absolute http(s) URLs or same-origin upload paths suitable for <img src>. */
export function isUsableImageUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/uploads/") || trimmed.startsWith("/images/")) return true;
  if (BROKEN_UNSPLASH_PHOTO_IDS.some((id) => trimmed.includes(id))) return false;
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Use stored URL when it is a valid absolute URL; otherwise a known-good default. */
export function resolveImageUrl(url: string | null | undefined, fallback = DEFAULT_TOUR_COVER_URL): string {
  return isUsableImageUrl(url) ? url!.trim() : fallback;
}
