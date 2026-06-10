import { entityMainImageUrl } from "@tourpilot/shared";
import type { ItineraryExploreDay, ItineraryExploreItem } from "./ItineraryExploreView";

export type ItineraryGallerySlide = {
  key: string;
  name: string;
  imageUrl: string;
};

function itemName(item: ItineraryExploreItem) {
  return item.entity?.name || item.label || "Stop";
}

export function collectItineraryGallery(days: ItineraryExploreDay[]): ItineraryGallerySlide[] {
  const slides: ItineraryGallerySlide[] = [];
  for (const day of days) {
    for (const item of day.items) {
      const imageUrl = item.entity ? entityMainImageUrl(item.entity.media) : null;
      if (!imageUrl) continue;
      slides.push({
        key: item.key,
        name: itemName(item),
        imageUrl,
      });
    }
  }
  return slides;
}

