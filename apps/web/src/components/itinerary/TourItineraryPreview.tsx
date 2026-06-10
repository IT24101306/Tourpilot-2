import { useMemo, useState } from "react";
import { ItineraryExploreView, type ItineraryExploreDay } from "./ItineraryExploreView";
import { ItineraryGalleryRail } from "./ItineraryGalleryRail";
import { collectItineraryGallery } from "./itineraryGallery";

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

export function TourItineraryPreview({ days, title = "Itinerary" }: Props) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const exploreDays = useMemo(() => toExploreDays(days), [days]);
  const gallery = useMemo(() => collectItineraryGallery(exploreDays), [exploreDays]);

  if (!days.length) return null;

  return (
    <div className="tour-itinerary-layout">
      <section className="tour-itinerary-section">
        <header className="tour-itinerary-section__head">
          <h2 className="tour-itinerary-section__title">{title}</h2>
          <p className="tour-itinerary-section__sub">Day by day — expand to see each stop.</p>
        </header>
        <ItineraryExploreView
          days={exploreDays}
          compact
          showPrices
          activeKey={activeKey}
          onActiveKeyChange={setActiveKey}
        />
      </section>

      <ItineraryGalleryRail slides={gallery} activeKey={activeKey} />
    </div>
  );
}
