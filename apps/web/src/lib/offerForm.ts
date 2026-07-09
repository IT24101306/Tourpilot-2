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

export function validateOfferDraft(draft: OfferDraftFields): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!draft.title.trim()) errors.title = "Title is required";
  if (!draft.rewardText.trim()) errors.rewardText = "Headline / summary is required";
  if (!draft.offerMonth || !/^\d{4}-\d{2}$/.test(draft.offerMonth)) {
    errors.offerMonth = "Offer month is required";
  }
  if (!Number.isFinite(draft.registrationCap) || draft.registrationCap < 1) {
    errors.registrationCap = "Registration cap is required";
  }

  const validFrom = new Date(draft.validFrom);
  const validUntil = new Date(draft.validUntil);
  if (Number.isNaN(validFrom.getTime())) errors.validFrom = "Valid from date is required";
  if (Number.isNaN(validUntil.getTime())) errors.validUntil = "Valid until date is required";
  if (!Number.isNaN(validFrom.getTime()) && !Number.isNaN(validUntil.getTime()) && validUntil <= validFrom) {
    errors.validUntil = "Valid until must be after valid from";
  }

  if (!Number.isFinite(draft.tourPriceLkr) || draft.tourPriceLkr < 0) {
    errors.tourPriceLkr = "Regular tour price is required";
  }
  if (
    !draft.isFreeTour &&
    draft.discountedLkr !== "" &&
    (!Number.isFinite(Number(draft.discountedLkr)) || Number(draft.discountedLkr) < 0)
  ) {
    errors.discountedLkr = "Discounted price must be zero or greater";
  }

  if (
    !draft.rewardTiers.every(
      (tier) =>
        tier.registrationsRequired >= 1 &&
        tier.winnersCount >= 1 &&
        tier.rewardLabel.trim().length > 0
    )
  ) {
    errors.rewardTiers = "Each reward tier needs registrations, winners, and a reward label";
  }

  return errors;
}

export function isOfferDraftSavable(draft: OfferDraftFields): boolean {
  return Object.keys(validateOfferDraft(draft)).length === 0;
}
