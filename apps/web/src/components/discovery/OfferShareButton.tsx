import { useState, type MouseEvent } from "react";

import { offerShareFeedback, shareOffer } from "../../lib/offerShare";

import type { DiscoveryOffer } from "./DiscoveryOfferCard";

type Props = {
  offer: Pick<DiscoveryOffer, "id" | "title" | "description" | "rewardText">;
  className?: string;
  label?: string;
  variant?: "default" | "hero";
};

export function OfferShareButton({ offer, className, label, variant = "default" }: Props) {
  const [feedback, setFeedback] = useState("");

  async function onShare(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const result = await shareOffer(offer);
    const msg = offerShareFeedback(result);
    if (!msg) return;
    setFeedback(msg);
    window.setTimeout(() => setFeedback(""), 2500);
  }

  const btnClass = [
    "disc-offer-share-btn",
    label && "disc-offer-share-btn--labeled",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (variant === "hero" && label) {
    return (
      <span className={`disc-offer-share-wrap disc-offer-share-wrap--hero${className ? ` ${className}` : ""}`}>
        <span className="disc-offer-share-hero">
          <span className="disc-offer-share-hero__label">{label}</span>
          <button
            type="button"
            className="disc-offer-share-hero__icon-btn"
            onClick={(e) => void onShare(e)}
            aria-label={`Share offer: ${offer.title}`}
            title="Share this offer"
          >
            <PaperPlaneIcon />
          </button>
        </span>
        {feedback ? <span className="disc-offer-share-feedback">{feedback}</span> : null}
      </span>
    );
  }

  return (
    <span className="disc-offer-share-wrap">
      <button
        type="button"
        className={btnClass}
        onClick={(e) => void onShare(e)}
        aria-label={label ?? `Share offer: ${offer.title}`}
        title={label ?? "Share this offer"}
      >
        {label && <span className="disc-offer-share-btn__label">{label}</span>}
        <ShareIcon />
      </button>
      {feedback ? <span className="disc-offer-share-feedback">{feedback}</span> : null}
    </span>
  );
}

function ShareIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PaperPlaneIcon() {
  return (
    <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
