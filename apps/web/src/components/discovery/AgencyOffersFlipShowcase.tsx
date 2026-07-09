import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";

import { resolveImageUrl } from "@tourpilot/shared";
import { OfferMonthCalendar } from "./OfferMonthCalendar";
import { OfferCountdown } from "./OfferCountdown";
import { OfferRegistrantsModal } from "./OfferRegistrantsModal";
import { OfferRewardLadder } from "./OfferRewardLadder";
import { OfferShareButton } from "./OfferShareButton";
import type { DiscoveryOffer } from "./DiscoveryOfferCard";
import { OFFER_FLIP_HEADLINE } from "../../lib/offerCopy";

const OFFERS_SECTION_FALLBACK_BG = "/images/offers-section-bg.png";

type Props = {
  offers: DiscoveryOffer[];
  agencyName: string;
  onRegister: (offer: DiscoveryOffer) => void;
  statusMsg?: string;
};

const FLIP_MS = 700;
const CYCLE_MS = 8000;

export function AgencyOffersFlipShowcase({
  offers,
  onRegister,
  statusMsg,
}: Props) {
  const [index, setIndex] = useState(0);
  const [flipPhase, setFlipPhase] = useState<"idle" | "out" | "in">("idle");
  const [paused, setPaused] = useState(false);
  const [registrantsOpen, setRegistrantsOpen] = useState(false);

  const offer = offers[index];
  const hasMultiple = offers.length > 1;
  const flipping = flipPhase !== "idle";

  const backgroundUrl = useMemo(
    () => resolveImageUrl(offer?.imageUrl, OFFERS_SECTION_FALLBACK_BG),
    [offer?.imageUrl]
  );

  const scheduledMonths = useMemo(
    () =>
      [
        ...new Set(
          offers.map((item) => item.offerMonth).filter((value): value is string => Boolean(value))
        ),
      ].sort(),
    [offers]
  );

  const goTo = useCallback(
    (next: number) => {
      if (flipPhase !== "idle" || offers.length === 0) return;
      const normalized = ((next % offers.length) + offers.length) % offers.length;
      if (normalized === index) return;
      setFlipPhase("out");
      window.setTimeout(() => {
        setIndex(normalized);
        setFlipPhase("in");
        window.setTimeout(() => setFlipPhase("idle"), FLIP_MS);
      }, FLIP_MS);
    },
    [flipPhase, index, offers.length]
  );

  useEffect(() => {
    if (!hasMultiple || paused || flipping) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      goTo(index + 1);
    }, CYCLE_MS);

    return () => window.clearInterval(timer);
  }, [hasMultiple, paused, flipping, index, goTo]);

  if (!offer) return null;

  const tiers = offer.rewardTiers ?? [];

  const registrationCap =
    offer.registrationCap ??
    (offer.registeredCount != null ? offer.registeredCount + offer.spotsLeft : offer.spotsLeft);
  const registeredCount = offer.registeredCount ?? 0;
  const registrationProgress =
    registrationCap > 0 ? Math.min(100, Math.round((registeredCount / registrationCap) * 100)) : 0;

  function selectOfferMonth(month: string) {
    const nextIndex = offers.findIndex((item) => item.offerMonth === month);
    if (nextIndex >= 0) goTo(nextIndex);
  }

  function openRegistrants(e: MouseEvent<HTMLElement>) {
    if ((e.target as HTMLElement).closest("button, a")) return;
    setRegistrantsOpen(true);
  }

  return (
    <section id="offers" className="agency-display-band agency-display-band--offers" aria-label="Special offers">
      <div className="agency-display-inner">
        {statusMsg && <p className="agency-offer-status">{statusMsg}</p>}

        <div className="agency-offer-flip-layout">
          <div className="agency-offer-flip-main">
            <div
              className="agency-offer-flip-wrap"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              <div className="agency-offer-flip">
                {hasMultiple && (
                  <button
                    type="button"
                    className="agency-offer-flip__nav agency-offer-flip__nav--prev"
                    onClick={() => goTo(index - 1)}
                    aria-label="Previous offer"
                    disabled={flipping}
                  >
                    ‹
                  </button>
                )}

                <div className="agency-offer-flip__stage">
                  <article
                    className={`agency-offer-flip-card${
                      flipPhase === "out" ? " is-flip-out" : flipPhase === "in" ? " is-flip-in" : ""
                    }`}
                    style={{ backgroundImage: `url(${backgroundUrl})` }}
                    onClick={openRegistrants}
                  >
                    <div className="agency-offer-flip-card__overlay" aria-hidden="true" />

                    <h3 className="agency-offer-flip-card__title">{OFFER_FLIP_HEADLINE}</h3>

                    <div className="agency-offer-flip-card__main">
                      <div className="agency-offer-flip-card__share-col">
                        <OfferShareButton
                          offer={offer}
                          className="agency-offer-flip-card__share"
                          label="Share with friends for a guaranteed win"
                          variant="hero"
                        />
                      </div>

                      {tiers.length > 0 && (
                        <div className="agency-offer-flip-card__rewards-col">
                          <OfferRewardLadder
                            tiers={tiers}
                            registeredCount={offer.registeredCount ?? 0}
                            className="agency-offer-flip-card__ladder"
                          />
                        </div>
                      )}
                    </div>

                    <div className="agency-offer-flip-card__footer">
                      <OfferCountdown
                        validUntil={offer.validUntil}
                        className="agency-offer-flip-card__countdown"
                        variant="hero"
                      />

                      <div className="agency-offer-flip-card__actions">
                        <div className="offer-register-progress agency-offer-flip-card__progress">
                          <div className="offer-register-progress__head">
                            <span className="offer-register-progress__label">Registered so far</span>
                            <strong className="offer-register-progress__value">
                              {registeredCount} <span>of {registrationCap}</span>
                            </strong>
                          </div>
                          <div
                            className="offer-register-progress__bar"
                            role="progressbar"
                            aria-valuenow={registeredCount}
                            aria-valuemin={0}
                            aria-valuemax={registrationCap}
                            aria-label={`${registeredCount} of ${registrationCap} travelers registered`}
                          >
                            <span
                              className="offer-register-progress__fill"
                              style={{ width: `${registrationProgress}%` }}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          className="brand-btn brand-btn--primary agency-offer-flip-card__register"
                          disabled={offer.spotsLeft <= 0}
                          onClick={() => onRegister(offer)}
                        >
                          {offer.spotsLeft > 0 ? "Book now" : "Offer full"}
                        </button>

                        <button
                          type="button"
                          className="agency-offer-flip-card__view"
                          onClick={() => setRegistrantsOpen(true)}
                        >
                          View registrations
                        </button>
                      </div>
                    </div>
                  </article>
                </div>

                {hasMultiple && (
                  <button
                    type="button"
                    className="agency-offer-flip__nav agency-offer-flip__nav--next"
                    onClick={() => goTo(index + 1)}
                    aria-label="Next offer"
                    disabled={flipping}
                  >
                    ›
                  </button>
                )}
              </div>

              {hasMultiple && (
                <div className="agency-offer-flip__dots" role="tablist" aria-label="Offer slides">
                  {offers.map((o, i) => (
                    <button
                      key={o.id}
                      type="button"
                      role="tab"
                      className={`agency-offer-flip__dot${i === index ? " is-active" : ""}`}
                      aria-selected={i === index}
                      aria-label={`Offer ${i + 1}: ${o.title}`}
                      onClick={() => goTo(i)}
                      disabled={flipping}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {scheduledMonths.length > 0 && (
            <aside className="agency-offer-months-panel" aria-label="Offer months calendar">
              <OfferMonthCalendar
                offerMonth={offer.offerMonth}
                offerMonths={scheduledMonths}
                variant="sidebar"
                onMonthSelect={hasMultiple ? selectOfferMonth : undefined}
              />
            </aside>
          )}
        </div>

        <OfferRegistrantsModal
          open={registrantsOpen}
          offer={offer}
          onClose={() => setRegistrantsOpen(false)}
        />
      </div>
    </section>
  );
}
