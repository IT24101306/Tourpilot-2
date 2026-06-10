import { CoverImage } from "../CoverImage";
import type { ItineraryGallerySlide } from "./itineraryGallery";

type Props = {
  slides: ItineraryGallerySlide[];
  activeKey?: string | null;
};

export function ItineraryGalleryRail({ slides, activeKey }: Props) {
  if (!slides.length) return null;

  return (
    <aside className="itin-gallery-rail" aria-label="Itinerary photos">
      <p className="itin-gallery-rail__label">Gallery</p>
      <div className="itin-gallery-grid">
        {slides.map((slide) => (
          <figure
            key={slide.key}
            className={`itin-gallery-tile${activeKey === slide.key ? " is-active" : ""}`}
            title={slide.name}
          >
            <CoverImage
              src={slide.imageUrl}
              className="itin-gallery-tile__img"
              alt={slide.name}
            />
          </figure>
        ))}
      </div>
    </aside>
  );
}
