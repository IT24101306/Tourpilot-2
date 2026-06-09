import { useState, type MouseEvent } from "react";
import { offerShareFeedback, shareOffer } from "../../lib/offerShare";
import type { DiscoveryOffer } from "./DiscoveryOfferCard";

type Props = {
  offer: Pick<DiscoveryOffer, "id" | "title" | "description" | "rewardText">;
  className?: string;
};

export function OfferShareButton({ offer, className }: Props) {
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

  const btnClass = ["disc-offer-share-btn", className].filter(Boolean).join(" ");

  return (
    <span className="disc-offer-share-wrap">
      <button
        type="button"
        className={btnClass}
        onClick={(e) => void onShare(e)}
        aria-label={`Share offer: ${offer.title}`}
        title="Share this offer"
      >
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
