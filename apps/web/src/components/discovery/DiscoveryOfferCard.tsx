import { daysUntilEnd } from "../../lib/discoveryUtils";

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
};

type Props = {
  offer: DiscoveryOffer;
  onRegister?: () => void;
  registerLabel?: string;
  compact?: boolean;
  /** Ultra-dense card for landing hero */
  hero?: boolean;
};

export function DiscoveryOfferCard({
  offer,
  onRegister,
  registerLabel = "Register",
  compact,
  hero,
}: Props) {
  const daysLeft = daysUntilEnd(offer.validUntil);
  const urgency =
    daysLeft === 0 ? "Ends today" : daysLeft === 1 ? "1 day left" : `${daysLeft} days left`;

  const cardClass = [
    "disc-offer-card",
    compact && "disc-offer-card--compact",
    hero && "disc-offer-card--hero",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={cardClass}>
      <div className="disc-offer-top">
        <span className="disc-offer-urgency">{urgency}</span>
        {!hero && offer.spotsLeft <= 5 && (
          <span className="disc-offer-scarcity">Only {offer.spotsLeft} spots</span>
        )}
      </div>
      <h3>{offer.title}</h3>
      {!compact && offer.description && <p className="disc-offer-desc">{offer.description}</p>}
      <p className={`disc-offer-reward${hero ? " disc-offer-reward--hero" : ""}`}>{offer.rewardText}</p>
      <p className="disc-offer-price">
        {offer.discountedLkr != null ? (
          <>
            <span className="disc-offer-price-now">
              From LKR {offer.discountedLkr.toLocaleString()}
            </span>
            <span className="disc-offer-price-was">LKR {offer.tourPriceLkr.toLocaleString()}</span>
          </>
        ) : (
          <span className="disc-offer-price-now">From LKR {offer.tourPriceLkr.toLocaleString()}</span>
        )}
      </p>
      {!hero && offer.registeredCount != null && (
        <p className="disc-offer-social muted">{offer.registeredCount} travelers registered</p>
      )}
      {onRegister && (
        <button type="button" className="btn btn-primary" onClick={onRegister}>
          {registerLabel}
        </button>
      )}
    </article>
  );
}
