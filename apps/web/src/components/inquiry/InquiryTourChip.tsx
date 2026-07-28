import { Link } from "react-router-dom";
import { formatTourDaysNights } from "@tourpilot/shared";
import { useFormatMoney } from "../../context/CurrencyContext";

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
  /** Hide link to agency tour page (share-as-mine / white-label) */
  hideAgencyLink?: boolean;
};

export function InquiryTourChip({ tour, agencySlug, compact, hideAgencyLink }: Props) {
  const { format } = useFormatMoney();
  const price = tour.publicPriceLkr ?? tour.basePriceLkr;
  const tourHref = `/tours/${agencySlug}/${tour.slug}`;

  return (
    <div className={`inquiry-tour-chip${compact ? " inquiry-tour-chip--compact" : ""}`}>
      <span className="inquiry-tour-chip-label">Ready-made tour</span>
      <div className="inquiry-tour-chip-main">
        <strong>{tour.title}</strong>
        <span className="muted">
          {formatTourDaysNights(tour.days)}
          {price != null ? ` · ${format(price)}` : ""}
        </span>
      </div>
      {!hideAgencyLink && (
        <Link to={tourHref} className="inquiry-tour-chip-link">
          View itinerary
        </Link>
      )}
    </div>
  );
}

export function defaultTourInquiryMessage(tour: InquiryTourRef): string {
  return `I'm interested in the "${tour.title}" package (${formatTourDaysNights(tour.days)}). Please share availability and next steps.`;
}
