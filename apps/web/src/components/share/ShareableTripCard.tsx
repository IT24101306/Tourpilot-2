import { useMemo, useState } from "react";

type Props = {
  title: string;
  agencyName?: string | null;
  days?: number;
  priceLabel?: string;
  shareUrl: string;
  coverUrl?: string | null;
};

/** Shareable trip / itinerary card with copy + Web Share. */
export function ShareableTripCard({
  title,
  agencyName,
  days,
  priceLabel,
  shareUrl,
  coverUrl,
}: Props) {
  const [copied, setCopied] = useState(false);
  const caption = useMemo(() => {
    const bits = [title];
    if (agencyName) bits.push(`with ${agencyName}`);
    if (days) bits.push(`${days}-day plan`);
    if (priceLabel) bits.push(priceLabel);
    bits.push(shareUrl);
    return bits.join(" · ");
  }, [title, agencyName, days, priceLabel, shareUrl]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function nativeShare() {
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({ title, text: caption, url: shareUrl });
    } catch {
      /* user cancelled */
    }
  }

  return (
    <article className="shareable-trip-card">
      {coverUrl ? (
        <div className="shareable-trip-card__media" style={{ backgroundImage: `url(${coverUrl})` }} />
      ) : (
        <div className="shareable-trip-card__media shareable-trip-card__media--plain" />
      )}
      <div className="shareable-trip-card__body">
        <p className="shareable-trip-card__eyebrow">Shareable trip card</p>
        <h3>{title}</h3>
        <p className="muted">
          {[agencyName, days ? `${days} days` : null, priceLabel].filter(Boolean).join(" · ")}
        </p>
        <div className="shareable-trip-card__actions">
          <button type="button" className="btn btn-primary" onClick={() => void nativeShare()}>
            Share
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void copyLink()}>
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>
    </article>
  );
}
