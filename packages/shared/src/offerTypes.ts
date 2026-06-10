export type OfferRewardTier = {
  registrationsRequired: number;
  winnersCount: number;
  rewardLabel: string;
};

export function parseOfferRewardTiers(value: unknown): OfferRewardTier[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const registrationsRequired = Number(r.registrationsRequired);
      const winnersCount = Number(r.winnersCount);
      const rewardLabel = typeof r.rewardLabel === "string" ? r.rewardLabel.trim() : "";
      if (
        !Number.isFinite(registrationsRequired) ||
        registrationsRequired < 1 ||
        !Number.isFinite(winnersCount) ||
        winnersCount < 1 ||
        !rewardLabel
      ) {
        return null;
      }
      return { registrationsRequired, winnersCount, rewardLabel };
    })
    .filter((t): t is OfferRewardTier => t !== null)
    .sort((a, b) => a.registrationsRequired - b.registrationsRequired);
}

export const OFFER_MONTH_ABBREVS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function parseOfferMonthParts(
  offerMonth: string | null | undefined
): { year: number; month: number } | null {
  if (!offerMonth || !/^\d{4}-\d{2}$/.test(offerMonth)) return null;
  const [year, month] = offerMonth.split("-").map(Number);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}

export function formatOfferMonthLabel(offerMonth: string | null | undefined): string | null {
  const parts = parseOfferMonthParts(offerMonth);
  if (!parts) return null;
  return new Date(parts.year, parts.month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function offerRewardTierForEveryone(tier: OfferRewardTier): boolean {
  return tier.winnersCount >= tier.registrationsRequired;
}

export function offerRewardTierHeadline(tier: OfferRewardTier): string {
  if (offerRewardTierForEveryone(tier)) {
    return `Everyone gets ${tier.rewardLabel}`;
  }
  if (tier.winnersCount === 1) {
    return `1 person gets ${tier.rewardLabel}`;
  }
  return `${tier.winnersCount} people get ${tier.rewardLabel}`;
}

export function describeOfferRewardTier(tier: OfferRewardTier): string {
  const reward = offerRewardTierHeadline(tier);
  return `At ${tier.registrationsRequired} registrations — ${reward}`;
}

export function offerRewardTierCompactLabel(tier: OfferRewardTier): string {
  const label = tier.rewardLabel.replace(/^(a |an )/i, "");
  if (offerRewardTierForEveryone(tier)) return label;
  if (tier.winnersCount === 1) return label;
  return `${label} (×${tier.winnersCount})`;
}

export function summarizeOfferRewardTiers(tiers: OfferRewardTier[]): string {
  const sorted = parseOfferRewardTiers(tiers);
  if (sorted.length === 0) return "";
  const parts = sorted.map(
    (t) => `hit ${t.registrationsRequired} for ${offerRewardTierCompactLabel(t)}`
  );
  const sentence = parts.join(", then ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
