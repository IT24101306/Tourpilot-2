import { useState, type MouseEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { currentPath, loginPath } from "../../utils/authRedirect";
import { CoverImage } from "../CoverImage";
import { isFreeOffer } from "../../lib/offerPricing";
import { OfferCountdown } from "./OfferCountdown";
import { OfferRegistrantsModal } from "./OfferRegistrantsModal";
import { OfferShareButton } from "./OfferShareButton";

export type DiscoveryOffer = {
  id: string;
  title: string;
  description: string | null;
  rewardText: string;
  tourPriceLkr: number;
  discountedLkr: number | null;
  spotsLeft: number;
  registeredCount?: number;
  validUntil: string;
  imageUrl?: string;
  agencyName?: string | null;
  agencySlug?: string | null;
  tourSlug?: string | null;
};

type Props = {
  offer: DiscoveryOffer;
  onRegister?: () => void;
  registerLabel?: string;
  compact?: boolean;
  /** Ultra-dense card for landing hero */
  hero?: boolean;
  /** Spacious editorial card for /offers page */
  page?: boolean;
  /** Show share button (default true on public cards) */
  showShare?: boolean;
  /** DOM id for deep-link scroll (e.g. offer-abc123) */
  cardId?: string;
};

function OfferPrice({ offer }: { offer: DiscoveryOffer }) {
  if (isFreeOffer(offer.discountedLkr)) {
    return (
      <>
        <span className="disc-offer-price-now disc-offer-price-free">FREE</span>
        {offer.tourPriceLkr > 0 && (
          <span className="disc-offer-price-was">LKR {offer.tourPriceLkr.toLocaleString()}</span>
        )}
      </>
    );
  }

  if (offer.discountedLkr != null) {
    return (
      <>
        <span className="disc-offer-price-now">From LKR {offer.discountedLkr.toLocaleString()}</span>
        <span className="disc-offer-price-was">LKR {offer.tourPriceLkr.toLocaleString()}</span>
      </>
    );
  }

  return <span className="disc-offer-price-now">From LKR {offer.tourPriceLkr.toLocaleString()}</span>;
}

export function DiscoveryOfferCard({
  offer,
  onRegister,
  registerLabel = "Register",
  compact,
  hero,
  page,
  showShare = true,
  cardId,
}: Props) {
  const location = useLocation();
  const [registrantsOpen, setRegistrantsOpen] = useState(false);

  function openRegistrants(e: MouseEvent<HTMLElement>) {
    if ((e.target as HTMLElement).closest("a, button")) return;
    setRegistrantsOpen(true);
  }

  const tourHref =
    offer.agencySlug && offer.tourSlug
      ? `/tours/${offer.agencySlug}/${offer.tourSlug}`
      : null;

  if (page) {
    return (
      <article
        id={cardId}
        className="disc-offer-card disc-offer-card--page disc-offer-card--clickable"
        onClick={openRegistrants}
      >
        <div className="disc-offer-media">
          <CoverImage src={offer.imageUrl} className="disc-offer-media-img" alt="" />
          <OfferCountdown validUntil={offer.validUntil} overlay />
          {offer.spotsLeft <= 10 && (
            <span className="disc-offer-scarcity disc-offer-scarcity--overlay">
              {offer.spotsLeft === 0 ? "Full" : `${offer.spotsLeft} spots left`}
            </span>
          )}
        </div>

        <div className="disc-offer-body">
          {offer.agencyName && offer.agencySlug && (
            <Link to={`/agencies/${offer.agencySlug}`} className="disc-offer-agency">
              {offer.agencyName}
            </Link>
          )}

          <h3>{offer.title}</h3>

          {offer.description && <p className="disc-offer-desc">{offer.description}</p>}

          <p className="disc-offer-reward disc-offer-reward--pill">{offer.rewardText}</p>

          <div className="disc-offer-price disc-offer-price--stacked">
            <OfferPrice offer={offer} />
          </div>

          <div className="disc-offer-meta-row">
            {offer.registeredCount != null && (
              <span className="disc-offer-social">
                {offer.registeredCount} traveler{offer.registeredCount === 1 ? "" : "s"} registered
              </span>
            )}
          </div>

          <div className="disc-offer-actions">
            {showShare && <OfferShareButton offer={offer} />}
            {tourHref && (
              <Link to={tourHref} className="btn btn-ghost disc-offer-secondary">
                View tour
              </Link>
            )}
            {onRegister ? (
              <button type="button" className="btn btn-primary disc-offer-cta" onClick={onRegister}>
                {registerLabel}
              </button>
            ) : (
              <Link to={loginPath(currentPath(location))} className="btn btn-primary disc-offer-cta">
                Log in to register
              </Link>
            )}
          </div>
        </div>

        <OfferRegistrantsModal
          open={registrantsOpen}
          offer={offer}
          onClose={() => setRegistrantsOpen(false)}
        />
      </article>
    );
  }

  const cardClass = [
    "disc-offer-card",
    "disc-offer-card--clickable",
    compact && "disc-offer-card--compact",
    hero && "disc-offer-card--hero",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      id={cardId}
      className={cardClass}
      onClick={openRegistrants}
    >
      <div className="disc-offer-top">
        <OfferCountdown validUntil={offer.validUntil} />
        <span className="disc-offer-top-end">
          {!hero && offer.spotsLeft <= 5 && (
            <span className="disc-offer-scarcity">Only {offer.spotsLeft} spots</span>
          )}
          {showShare && <OfferShareButton offer={offer} />}
        </span>
      </div>
      <h3>{offer.title}</h3>
      {!compact && offer.description && <p className="disc-offer-desc">{offer.description}</p>}
      <p className={`disc-offer-reward${hero ? " disc-offer-reward--hero" : ""}`}>{offer.rewardText}</p>
      <p className="disc-offer-price">
        <OfferPrice offer={offer} />
      </p>
      {!hero && offer.registeredCount != null && (
        <p className="disc-offer-social muted">{offer.registeredCount} travelers registered</p>
      )}
      {onRegister && (
        <button type="button" className="btn btn-primary" onClick={onRegister}>
          {registerLabel}
        </button>
      )}

      <OfferRegistrantsModal
        open={registrantsOpen}
        offer={offer}
        onClose={() => setRegistrantsOpen(false)}
      />
    </article>
  );
}
