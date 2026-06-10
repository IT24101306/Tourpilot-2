import { useCallback, useEffect, useState, type MouseEvent } from "react";

import { OfferMonthCalendar } from "./OfferMonthCalendar";

import { CoverImage } from "../CoverImage";

import { useFormatMoney } from "../../context/CurrencyContext";

import { isFreeOffer } from "../../lib/offerPricing";

import { OfferCountdown } from "./OfferCountdown";

import { OfferRegistrantsModal } from "./OfferRegistrantsModal";

import { OfferRewardRoadmap } from "./OfferRewardRoadmap";

import { OfferShareButton } from "./OfferShareButton";

import type { DiscoveryOffer } from "./DiscoveryOfferCard";



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

  agencyName,

  onRegister,

  statusMsg,

}: Props) {

  const [index, setIndex] = useState(0);

  const [flipPhase, setFlipPhase] = useState<"idle" | "out" | "in">("idle");

  const [paused, setPaused] = useState(false);

  const [registrantsOpen, setRegistrantsOpen] = useState(false);

  const { format, formatFrom } = useFormatMoney();



  const offer = offers[index];

  const hasMultiple = offers.length > 1;

  const flipping = flipPhase !== "idle";

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



  const cap =

    offer.registrationCap ??

    (offer.registeredCount != null ? offer.registeredCount + offer.spotsLeft : offer.spotsLeft);

  const registered = offer.registeredCount ?? 0;

  const progress = cap > 0 ? Math.min(100, Math.round((registered / cap) * 100)) : 0;

  const tiers = offer.rewardTiers ?? [];



  function openRegistrants(e: MouseEvent<HTMLElement>) {

    if ((e.target as HTMLElement).closest("button, a")) return;

    setRegistrantsOpen(true);

  }



  return (

    <section className="agency-offer-showcase" id="offers" aria-label="Special offers">

      <div className="agency-offer-showcase__glow" aria-hidden="true" />



      <header className="agency-offer-showcase__head">

        <span className="agency-offer-showcase__eyebrow">Limited time</span>

        <h2>Special offers</h2>

        <p>

          Register with <strong>{agencyName}</strong> — each offer runs for one dedicated month.

          More registrations unlock bigger group rewards.

        </p>

      </header>



      {statusMsg && <p className="agency-offer-status agency-offer-showcase__status">{statusMsg}</p>}

      <OfferMonthCalendar
        key={offer.id}
        offerMonth={offer.offerMonth}
        className="agency-offer-showcase__month-cal"
      />

      <div

        className="agency-offer-flip"

        onMouseEnter={() => setPaused(true)}

        onMouseLeave={() => setPaused(false)}

      >

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

            className={`agency-offer-flip__card${

              flipPhase === "out" ? " is-flip-out" : flipPhase === "in" ? " is-flip-in" : ""

            }`}

            onClick={openRegistrants}

          >

            <div className="agency-offer-flip__media">

              <CoverImage src={offer.imageUrl} className="agency-offer-flip__img" alt="" />

              <div className="agency-offer-flip__media-shade" aria-hidden="true" />

              <div className="agency-offer-flip__countdown-wrap">

                <OfferCountdown validUntil={offer.validUntil} className="agency-offer-flip__countdown" />

              </div>

            </div>



            <div className="agency-offer-flip__body">

              <div className="agency-offer-flip__body-top">

                <h3>{offer.title}</h3>

                <OfferShareButton

                  offer={offer}

                  className="agency-offer-flip__share"

                  label="Bring friends for the guaranteed win"

                />

              </div>



              {offer.description && (

                <p className="agency-offer-flip__desc">{offer.description}</p>

              )}



              {offer.rewardText && <p className="agency-offer-flip__reward">{offer.rewardText}</p>}



              {tiers.length > 0 && (

                <div className="agency-offer-flip__tiers-wrap">

                  <p className="agency-offer-flip__tiers-title">Rewards</p>

                  <OfferRewardRoadmap

                    tiers={tiers}

                    registeredCount={registered}

                    registrationCap={cap}

                    className="agency-offer-flip__roadmap"

                    interactive

                  />

                </div>

              )}



              <div className="agency-offer-flip__goal">

                <div className="agency-offer-flip__goal-head">

                  <span className="agency-offer-flip__goal-label">Registration progress</span>

                  <strong className="agency-offer-flip__goal-value">

                    {registered} <span>of {cap}</span> registered

                  </strong>

                </div>

                <div

                  className="agency-offer-flip__progress"

                  role="progressbar"

                  aria-valuenow={registered}

                  aria-valuemin={0}

                  aria-valuemax={cap}

                  aria-label={`${registered} of ${cap} travelers registered`}

                >

                  <span className="agency-offer-flip__progress-fill" style={{ width: `${progress}%` }} />

                </div>

                <p className="agency-offer-flip__goal-hint">

                  {offer.spotsLeft > 0

                    ? `${offer.spotsLeft} spot${offer.spotsLeft === 1 ? "" : "s"} left · ${Math.max(0, cap - registered)} more to reach cap`

                    : "Registration cap reached"}

                </p>

              </div>



              <div className="agency-offer-flip__price-row">

                {isFreeOffer(offer.discountedLkr) ? (

                  <span className="agency-offer-flip__price agency-offer-flip__price--free">FREE tour</span>

                ) : offer.discountedLkr != null ? (

                  <>

                    <span className="agency-offer-flip__price">{formatFrom(offer.discountedLkr)}</span>

                    <span className="agency-offer-flip__price-was">{format(offer.tourPriceLkr)}</span>

                  </>

                ) : (

                  <span className="agency-offer-flip__price">{formatFrom(offer.tourPriceLkr)}</span>

                )}

              </div>



              <div className="agency-offer-flip__actions">

                <button

                  type="button"

                  className="agency-offer-flip__cta"

                  disabled={offer.spotsLeft <= 0}

                  onClick={() => onRegister(offer)}

                >

                  {offer.spotsLeft > 0 ? "Register for this offer" : "Offer full"}

                </button>

                <button

                  type="button"

                  className="agency-offer-flip__registrants-link"

                  onClick={() => setRegistrantsOpen(true)}

                >

                  View {registered} registration{registered === 1 ? "" : "s"}

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



      <OfferRegistrantsModal

        open={registrantsOpen}

        offer={offer}

        onClose={() => setRegistrantsOpen(false)}

      />

    </section>

  );

}

