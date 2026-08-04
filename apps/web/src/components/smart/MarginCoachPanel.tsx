import type { MarginCoachTip } from "@tourpilot/shared";
import { buildMarginCoachTips } from "@tourpilot/shared";

type Props = {
  costLkr: number;
  sellingLkr: number;
  commissionLkr?: number;
  listedPriceLkr?: number;
  onRequestCount?: number;
  targetMarginPct?: number;
  warnBelowPct?: number;
};

const toneClass: Record<MarginCoachTip["tone"], string> = {
  ok: "margin-coach__tip--ok",
  warn: "margin-coach__tip--warn",
  danger: "margin-coach__tip--danger",
  info: "margin-coach__tip--info",
};

/** Inline price & margin coach for tour / proposal builders. */
export function MarginCoachPanel(props: Props) {
  const tips = buildMarginCoachTips(props);
  if (!tips.length) return null;

  return (
    <aside className="margin-coach" aria-label="Price and margin coach">
      <h4 className="margin-coach__title">Price &amp; margin coach</h4>
      <ul className="margin-coach__list">
        {tips.map((tip) => (
          <li key={tip.title} className={`margin-coach__tip ${toneClass[tip.tone]}`}>
            <strong>{tip.title}</strong>
            <span>{tip.detail}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
