import {
  offerRewardTierDisplayLine,
  offerRewardTierIcon,
  offerRewardTierMilestoneHeading,
  parseOfferRewardTiers,
  type OfferRewardTier,
} from "@tourpilot/shared";

type Props = {
  tiers: OfferRewardTier[];
  registeredCount: number;
  className?: string;
};

export function OfferRewardLadder({ tiers, registeredCount, className = "" }: Props) {
  const sorted = parseOfferRewardTiers(tiers);
  if (sorted.length === 0) return null;

  const rootClass = ["offer-reward-ladder", className].filter(Boolean).join(" ");

  return (
    <div className={rootClass} aria-label="Offer reward milestones">
      <ul className="offer-reward-ladder__milestones">
        {sorted.map((tier, index) => {
          const unlocked = registeredCount >= tier.registrationsRequired;
          return (
            <li
              key={`${tier.registrationsRequired}-${index}`}
              className={`offer-reward-ladder__milestone${unlocked ? " is-unlocked" : ""}`}
            >
              <p className="offer-reward-ladder__heading">
                {offerRewardTierMilestoneHeading(tier)}
              </p>
              <p className="offer-reward-ladder__reward">
                <span className="offer-reward-ladder__icon" aria-hidden="true">
                  {offerRewardTierIcon(tier)}
                </span>
                <span className="offer-reward-ladder__reward-text">
                  {offerRewardTierDisplayLine(tier)}
                </span>
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
