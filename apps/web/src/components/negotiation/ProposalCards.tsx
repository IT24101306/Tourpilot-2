import { Link } from "react-router-dom";
import { useFormatMoney } from "../../context/CurrencyContext";
import { displayTourPrice } from "../../lib/tourPricing";
import type { ProposalItem } from "../../types/negotiation";

type Props = {
  items: ProposalItem[];
  agencySlug?: string;
  compare?: boolean;
};

export function ProposalCards({ items, agencySlug, compare = true }: Props) {
  const { format, formatFrom } = useFormatMoney();

  if (!items.length) {
    return (
      <div className="neg-proposal-empty">
        <p>No tour options yet.</p>
        <p className="muted">Your agency is preparing a personalized proposal.</p>
      </div>
    );
  }

  return (
    <div className={`neg-proposal-grid${compare && items.length > 1 ? " neg-proposal-grid--compare" : ""}`}>
      {items.map((item, index) => (
        <article key={item.id} className="neg-proposal-card">
          <span className="neg-proposal-option">Option {index + 1}</span>
          {item.kind === "READY_MADE" && item.tour && (
            <>
              <span className="neg-proposal-tag">Ready-made</span>
              <h4>{item.tour.title}</h4>
              <p className="neg-proposal-meta">
                {item.tour.days} days · {formatFrom(displayTourPrice(item.tour)).toLowerCase()}
              </p>
              {agencySlug && (
                <Link
                  to={`/tours/${agencySlug}/${item.tour.slug}`}
                  className="neg-proposal-link"
                >
                  Preview tour →
                </Link>
              )}
            </>
          )}
          {item.kind === "CUSTOM" && item.itinerary && (
            <>
              <span className="neg-proposal-tag">Custom</span>
              <h4>{item.itinerary.title || "Custom itinerary"}</h4>
              <p className="neg-proposal-meta price">
                Up to {format(item.itinerary.grandMax)}
              </p>
              {item.itinerary.shareToken && (
                <Link to={`/itinerary/${item.itinerary.shareToken}`} className="neg-proposal-link">
                  View full itinerary →
                </Link>
              )}
            </>
          )}
        </article>
      ))}
    </div>
  );
}
