/** Free trial for pricing-package Get Started signups. */

export const TRIAL_DAYS = 7;
/** Send reminder this many hours before trial ends. */
export const TRIAL_REMINDER_HOURS_BEFORE = 24;

export type PackageBilling = "MONTHLY" | "ONE_TIME" | "PAYG" | "CUSTOM";

export type SelectedPackageInput = {
  packageId: string;
  packageName: string;
  priceLkr: number;
  priceLabel: string;
  billing: PackageBilling;
};

export type TrialStatusView = {
  active: boolean;
  expiredUnpaid: boolean;
  endsAt: string | null;
  daysRemaining: number | null;
  packageId: string | null;
  packageName: string | null;
  priceLkr: number | null;
  priceLabel: string | null;
  billing: PackageBilling | null;
  activatedAt: string | null;
};

export function trialEndsAtFrom(start = new Date(), days = TRIAL_DAYS): Date {
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
}

export function isTrialActive(trialEndsAt: Date | string | null | undefined, now = new Date()): boolean {
  if (!trialEndsAt) return false;
  const end = typeof trialEndsAt === "string" ? new Date(trialEndsAt) : trialEndsAt;
  return end.getTime() > now.getTime();
}

export function isTrialExpiredUnpaid(opts: {
  trialEndsAt?: Date | string | null;
  packageActivatedAt?: Date | string | null;
  now?: Date;
}): boolean {
  const { trialEndsAt, packageActivatedAt, now = new Date() } = opts;
  if (!trialEndsAt || packageActivatedAt) return false;
  const end = typeof trialEndsAt === "string" ? new Date(trialEndsAt) : trialEndsAt;
  return end.getTime() <= now.getTime();
}

export function buildTrialStatus(user: {
  trialEndsAt?: Date | string | null;
  packageActivatedAt?: Date | string | null;
  selectedPackageId?: string | null;
  selectedPackageName?: string | null;
  selectedPackagePriceLkr?: unknown;
  selectedPackagePriceLabel?: string | null;
  selectedPackageBilling?: string | null;
}, now = new Date()): TrialStatusView {
  const endsAt = user.trialEndsAt
    ? typeof user.trialEndsAt === "string"
      ? user.trialEndsAt
      : user.trialEndsAt.toISOString()
    : null;
  const activatedAt = user.packageActivatedAt
    ? typeof user.packageActivatedAt === "string"
      ? user.packageActivatedAt
      : user.packageActivatedAt.toISOString()
    : null;
  const active = isTrialActive(user.trialEndsAt, now) && !user.packageActivatedAt;
  const expiredUnpaid = isTrialExpiredUnpaid({
    trialEndsAt: user.trialEndsAt,
    packageActivatedAt: user.packageActivatedAt,
    now,
  });
  let daysRemaining: number | null = null;
  if (active && endsAt) {
    daysRemaining = Math.max(0, Math.ceil((new Date(endsAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  }
  const priceRaw = user.selectedPackagePriceLkr != null ? Number(user.selectedPackagePriceLkr) : null;
  const billing = (user.selectedPackageBilling as PackageBilling | null) || null;
  return {
    active,
    expiredUnpaid,
    endsAt,
    daysRemaining,
    packageId: user.selectedPackageId ?? null,
    packageName: user.selectedPackageName ?? null,
    priceLkr: priceRaw != null && Number.isFinite(priceRaw) ? Math.round(priceRaw) : null,
    priceLabel: user.selectedPackagePriceLabel ?? null,
    billing,
    activatedAt,
  };
}

export function registerProUrlForPackage(pkg: {
  id: string;
  name: string;
  priceLkr?: number;
  priceLabel?: string;
  price?: string;
  billing?: PackageBilling;
  buildYourself?: boolean;
}): string {
  const params = new URLSearchParams();
  params.set("package", pkg.id);
  params.set("name", pkg.name);
  const billing = pkg.billing || (pkg.buildYourself ? "CUSTOM" : "MONTHLY");
  params.set("billing", billing);
  const priceLkr = pkg.priceLkr ?? 0;
  params.set("priceLkr", String(Math.round(priceLkr)));
  params.set("priceLabel", pkg.priceLabel || pkg.price || `LKR ${priceLkr.toLocaleString("en-LK")}`);
  return `/register-pro?${params.toString()}`;
}
