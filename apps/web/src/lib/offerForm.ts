import type { OfferRewardTier } from "@tourpilot/shared";

export type OfferDraftFields = {
  title: string;
  rewardText: string;
  offerMonth: string | null;
  rewardTiers: OfferRewardTier[];
  registrationCap: number;
  validFrom: string;
  validUntil: string;
  tourPriceLkr: number;
  discountedLkr: number | "";
  isFreeTour: boolean;
};

export function isOfferDraftSavable(draft: OfferDraftFields): boolean {
  if (!draft.title.trim() || !draft.rewardText.trim()) return false;
  if (!draft.offerMonth || !/^\d{4}-\d{2}$/.test(draft.offerMonth)) return false;
  if (!Number.isFinite(draft.registrationCap) || draft.registrationCap < 1) return false;

  const validFrom = new Date(draft.validFrom);
  const validUntil = new Date(draft.validUntil);
  if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validUntil.getTime())) return false;
  if (validUntil <= validFrom) return false;

  if (!Number.isFinite(draft.tourPriceLkr) || draft.tourPriceLkr < 0) return false;
  if (
    !draft.isFreeTour &&
    draft.discountedLkr !== "" &&
    (!Number.isFinite(Number(draft.discountedLkr)) || Number(draft.discountedLkr) < 0)
  ) {
    return false;
  }

  return draft.rewardTiers.every(
    (tier) =>
      tier.registrationsRequired >= 1 &&
      tier.winnersCount >= 1 &&
      tier.rewardLabel.trim().length > 0
  );
}
