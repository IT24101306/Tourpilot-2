import { useMemo, useState, type ReactNode } from "react";
import { DEFAULT_TOUR_COVER_URL } from "@tourpilot/shared";
import { CoverImage } from "../CoverImage";
import { ItineraryExploreView, type ItineraryExploreDay } from "./ItineraryExploreView";
import { ItineraryGalleryRail } from "./ItineraryGalleryRail";
import { collectItineraryGallery } from "./itineraryGallery";
import { TourPackagePricingNotice } from "./TourPackagePricingNotice";

type TourDay = {
  dayNumber: number;
  title: string | null;
  items: Array<{
    kind: string;
    label: string | null;
    priceLkr: number | null;
    entity: {
      name: string;
      type?: string;
      description?: string | null;
      media?: unknown;
    } | null;
  }>;
};

type Props = {
  days: TourDay[];
  title?: string;
  coverUrl?: string | null;
  coverAlt?: string;
  /** Replaces the section subtitle (e.g. favourites button). */
  headerAction?: ReactNode;
};

function toExploreDays(days: TourDay[]): ItineraryExploreDay[] {
  return days.map((day) => ({
    dayNumber: day.dayNumber,
    title: day.title,
    items: day.items.map((item, i) => ({
      key: `${day.dayNumber}-${i}`,
      kind: item.kind,
      label: item.label,
      priceLkr: item.priceLkr,
      entity: item.entity,
    })),
  }));
}

export function TourItineraryPreview({
  days,
  title = "Itinerary",
  coverUrl,
  coverAlt = "",
  headerAction,
}: Props) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const exploreDays = useMemo(() => toExploreDays(days), [days]);
  const gallery = useMemo(() => collectItineraryGallery(exploreDays), [exploreDays]);

  return (
    <div className="tour-itinerary-layout">
      <div className="tour-itinerary-primary">
        <figure className="tour-detail-cover">
          <CoverImage
            src={coverUrl ?? DEFAULT_TOUR_COVER_URL}
            alt={coverAlt}
            className="tour-detail-cover__img"
          />
        </figure>

        {days.length > 0 ? (
          <section className="tour-itinerary-section">
            <header className="agency-display-section-head tour-itinerary-section__head">
              <h2 className="tour-itinerary-section__title">{title}</h2>
              {headerAction ? (
                <div className="tour-itinerary-section__action">{headerAction}</div>
              ) : null}
            </header>
            <ItineraryExploreView
              days={exploreDays}
              compact
              showPrices
              activeKey={activeKey}
              onActiveKeyChange={setActiveKey}
            />
          </section>
        ) : null}

        <TourPackagePricingNotice className="tour-package-pricing-notice--itinerary" />
      </div>

      {gallery.length > 0 ? (
        <aside className="tour-itinerary-gallery">
          <ItineraryGalleryRail slides={gallery} activeKey={activeKey} />
        </aside>
      ) : null}
    </div>
  );
}
