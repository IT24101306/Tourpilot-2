import { useEffect, useState } from "react";
import { formatOfferCountdown } from "../../lib/offerCountdown";

type Props = {
  validUntil: string;
  className?: string;
  overlay?: boolean;
};

export function OfferCountdown({ validUntil, className = "", overlay }: Props) {
  const [label, setLabel] = useState(() => formatOfferCountdown(validUntil));

  useEffect(() => {
    setLabel(formatOfferCountdown(validUntil));
    const timer = window.setInterval(() => {
      setLabel(formatOfferCountdown(validUntil));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [validUntil]);

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
