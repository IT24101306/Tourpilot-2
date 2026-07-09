import { useEffect, useState } from "react";
import { offerCountdownParts } from "../../lib/offerCountdown";

type Props = {
  validUntil: string;
  className?: string;
  overlay?: boolean;
  variant?: "default" | "hero";
};

function formatHeroCountdown(validUntil: string, nowMs = Date.now()) {
  const parts = offerCountdownParts(validUntil, nowMs);
  if (parts.ended) return "00:00";

  const pad = (n: number) => String(n).padStart(2, "0");
  if (parts.days > 0) {
    return `${parts.days}d ${pad(parts.hours)}:${pad(parts.minutes)}`;
  }
  if (parts.hours > 0) {
    return `${pad(parts.hours)}:${pad(parts.minutes)}`;
  }
  return `${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`;
}

export function OfferCountdown({ validUntil, className = "", overlay, variant = "default" }: Props) {
  const [label, setLabel] = useState(() =>
    variant === "hero" ? formatHeroCountdown(validUntil) : formatDefaultCountdown(validUntil)
  );

  useEffect(() => {
    const tick = () => {
      setLabel(variant === "hero" ? formatHeroCountdown(validUntil) : formatDefaultCountdown(validUntil));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [validUntil, variant]);

  if (variant === "hero") {
    const parts = offerCountdownParts(validUntil);
    const ended = parts.ended;
    const classes = [
      "offer-countdown",
      "offer-countdown--hero",
      ended && "offer-countdown--ended",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={classes} aria-live="polite">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 2h12v4l-4 4 4 4v4H6v-4l4-4-4-4V2z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path d="M6 2h12M6 22h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
        <span className="offer-countdown__hero-time">{ended ? "ENDED" : label}</span>
      </div>
    );
  }

  const classes = [
    "offer-countdown",
    overlay && "offer-countdown--overlay",
    label === "Ended" && "offer-countdown--ended",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} aria-live="polite">
      {label === "Ended" ? "Offer ended" : `Ends in ${label}`}
    </span>
  );
}

function formatDefaultCountdown(validUntil: string, nowMs = Date.now()) {
  const parts = offerCountdownParts(validUntil, nowMs);
  if (parts.ended) return "Ended";

  const pad = (n: number) => String(n).padStart(2, "0");
  if (parts.days > 0) {
    return `${parts.days}d ${pad(parts.hours)}h ${pad(parts.minutes)}m ${pad(parts.seconds)}s`;
  }
  if (parts.hours > 0) {
    return `${pad(parts.hours)}h ${pad(parts.minutes)}m ${pad(parts.seconds)}s`;
  }
  return `${pad(parts.minutes)}m ${pad(parts.seconds)}s`;
}
