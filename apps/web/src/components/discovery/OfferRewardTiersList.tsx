import { describeOfferRewardTier, type OfferRewardTier } from "@tourpilot/shared";

type Props = {
  tiers: OfferRewardTier[];
  registeredCount: number;
  className?: string;
};

export function OfferRewardTiersList({ tiers, registeredCount, className = "" }: Props) {
  if (tiers.length === 0) return null;

  return (
    <ul className={`offer-reward-tiers${className ? ` ${className}` : ""}`}>
      {tiers.map((tier, index) => {
        const unlocked = registeredCount >= tier.registrationsRequired;
        return (
          <li
            key={`${tier.registrationsRequired}-${index}`}
            className={`offer-reward-tier${unlocked ? " offer-reward-tier--unlocked" : ""}`}
          >
            <span className="offer-reward-tier__icon" aria-hidden="true">
              {unlocked ? "✓" : "○"}
            </span>
            <span className="offer-reward-tier__text">{describeOfferRewardTier(tier)}</span>
          </li>
        );
      })}
    </ul>
  );
}
