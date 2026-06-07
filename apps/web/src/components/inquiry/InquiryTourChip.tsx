import { Link } from "react-router-dom";

export type InquiryTourRef = {
  id: string;
  title: string;
  slug: string;
  days: number;
  basePriceLkr?: number;
  publicPriceLkr?: number;
};

type Props = {
  tour: InquiryTourRef;
  agencySlug: string;
  compact?: boolean;
};

export function InquiryTourChip({ tour, agencySlug, compact }: Props) {
  const price = tour.publicPriceLkr ?? tour.basePriceLkr;
  const tourHref = `/tours/${agencySlug}/${tour.slug}`;

  return (
    <div className={`inquiry-tour-chip${compact ? " inquiry-tour-chip--compact" : ""}`}>
      <span className="inquiry-tour-chip-label">Ready-made tour</span>
      <div className="inquiry-tour-chip-main">
        <strong>{tour.title}</strong>
        <span className="muted">
          {tour.days} day{tour.days === 1 ? "" : "s"}
          {price != null ? ` · from LKR ${price.toLocaleString()}` : ""}
        </span>
      </div>
      <Link to={tourHref} className="inquiry-tour-chip-link">
        View itinerary
      </Link>
    </div>
  );
}

export function defaultTourInquiryMessage(tour: InquiryTourRef): string {
  return `I'm interested in the "${tour.title}" package (${tour.days} day${tour.days === 1 ? "" : "s"}). Please share availability and next steps.`;
}
