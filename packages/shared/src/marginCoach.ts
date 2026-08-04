/** Price & margin coaching for tour / proposal builders. */

export type MarginCoachInput = {
  costLkr: number;
  sellingLkr: number;
  commissionLkr?: number;
  listedPriceLkr?: number;
  /** Agency target margin % on cost (default 25). */
  targetMarginPct?: number;
  /** Warn when margin drops below this % (default 10). */
  warnBelowPct?: number;
  onRequestCount?: number;
};

export type MarginCoachTone = "ok" | "warn" | "danger" | "info";

export type MarginCoachTip = {
  tone: MarginCoachTone;
  title: string;
  detail: string;
};

export function computeMarginPct(costLkr: number, sellingLkr: number): number | null {
  if (!Number.isFinite(costLkr) || !Number.isFinite(sellingLkr) || costLkr <= 0) return null;
  return ((sellingLkr - costLkr) / costLkr) * 100;
}

export function buildMarginCoachTips(input: MarginCoachInput): MarginCoachTip[] {
  const tips: MarginCoachTip[] = [];
  const cost = Number(input.costLkr) || 0;
  const selling = Number(input.sellingLkr) || 0;
  const commission = Number(input.commissionLkr) || 0;
  const listed = Number(input.listedPriceLkr ?? selling + commission) || 0;
  const target = input.targetMarginPct ?? 25;
  const warnBelow = input.warnBelowPct ?? 10;
  const marginPct = computeMarginPct(cost, selling);
  const profit = selling - cost;

  if (cost <= 0 && selling <= 0) {
    tips.push({
      tone: "info",
      title: "Add costs & selling prices",
      detail: "Fill entity and vehicle rates so we can coach your margins.",
    });
    return tips;
  }

  if ((input.onRequestCount ?? 0) > 0) {
    tips.push({
      tone: "info",
      title: "Some prices on request",
      detail: `${input.onRequestCount} line(s) have no selling price — travelers may see incomplete totals.`,
    });
  }

  if (marginPct == null) {
    tips.push({
      tone: "warn",
      title: "Cost missing",
      detail: "Set internal costs so you can see profit before commission.",
    });
  } else if (selling < cost) {
    tips.push({
      tone: "danger",
      title: "Selling below cost",
      detail: `You're ${Math.round(cost - selling).toLocaleString()} LKR under cost before influencer commission.`,
    });
  } else if (marginPct < warnBelow) {
    tips.push({
      tone: "danger",
      title: "Thin margin",
      detail: `Margin is ${marginPct.toFixed(1)}% (under ${warnBelow}% warning). Profit ≈ LKR ${Math.round(profit).toLocaleString()}.`,
    });
  } else if (marginPct < target) {
    tips.push({
      tone: "warn",
      title: "Below target margin",
      detail: `Margin ${marginPct.toFixed(1)}% vs your ${target}% target. Raise selling prices or trim costly days.`,
    });
  } else {
    tips.push({
      tone: "ok",
      title: "Healthy margin",
      detail: `Margin ${marginPct.toFixed(1)}% · profit ≈ LKR ${Math.round(profit).toLocaleString()} before commission.`,
    });
  }

  if (commission > 0) {
    tips.push({
      tone: "info",
      title: "Listed price includes commission",
      detail: `Travelers see ~LKR ${Math.round(listed).toLocaleString()} (includes LKR ${Math.round(commission).toLocaleString()} partner commission).`,
    });
  }

  return tips;
}
