import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { resolveImageUrl } from "@tourpilot/shared";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useFormatMoney } from "../context/CurrencyContext";
import { CoverImage } from "../components/CoverImage";
import { FormFieldError } from "../components/FormFieldError";
import { ImageUrlField } from "../components/ImageUrlField";
import { TourItineraryPreview } from "../components/itinerary/TourItineraryPreview";
import { OfferBookStepper } from "../components/discovery/OfferBookStepper";
import { OfferShareButton } from "../components/discovery/OfferShareButton";
import type { DiscoveryOffer, OfferTourOption } from "../components/discovery/DiscoveryOfferCard";
import { formatRegistrationOrdinal, offerBookPath } from "../lib/offerBookPaths";
import { usePublicSmartFeatures } from "../lib/publicSmartFeatures";
import { loginPath } from "../utils/authRedirect";

type BookStep = "tour" | "register" | "confirmed";

type BookTour = OfferTourOption & {
  agencySlug: string;
};

type TourDetail = {
  id: string;
  title: string;
  tourDays: Array<{
    dayNumber: number;
    title: string | null;
    items: Array<{
      kind: string;
      label: string | null;
      priceLkr: number | null;
      entity: {
        name: string;
        type?: string;
        description?: string | null;
        media?: unknown;
      } | null;
    }>;
  }>;
};

type AgencyToursResponse = {
  tours: Array<{
    id: string;
    title: string;
    slug: string;
    coverUrl: string | null;
    basePriceLkr: number;
  }>;
};

type RegisterResponse = {
  id: string;
  registrationNumber: number;
};

function mapOfferTours(offer: DiscoveryOffer): BookTour[] {
  const fallbackAgencySlug = offer.agencySlug ?? offer.agency?.slug ?? "";
  if (offer.tours?.length) {
    return offer.tours.map((tour) => {
      const withAgency = tour as OfferTourOption & { agency?: { slug: string } };
      return {
        id: tour.id,
        title: tour.title,
        slug: tour.slug,
        coverUrl: tour.coverUrl,
        basePriceLkr: tour.basePriceLkr,
        agencySlug: withAgency.agency?.slug ?? fallbackAgencySlug,
      };
    });
  }
  return [];
}

export function OfferBookPage() {
  const { offerId } = useParams<{ offerId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token, loading: authLoading } = useAuth();
  const { format } = useFormatMoney();
  const { publicOffersEnabled, loaded: flagsLoaded } = usePublicSmartFeatures();

  const returnTo = searchParams.get("returnTo") ?? "/offers";
  const step = (searchParams.get("step") as BookStep | null) ?? "tour";
  const tourIdFromUrl = searchParams.get("tourId");

  const [offer, setOffer] = useState<DiscoveryOffer | null>(null);
  const [tours, setTours] = useState<BookTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedTourId, setSelectedTourId] = useState<string | null>(tourIdFromUrl);
  const [expandedTourId, setExpandedTourId] = useState<string | null>(null);
  const [itineraryByTourId, setItineraryByTourId] = useState<Record<string, TourDetail["tourDays"]>>({});
  const [itineraryLoadingId, setItineraryLoadingId] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [registrationNumber, setRegistrationNumber] = useState<number | null>(null);

  const bookPath = offerId ? offerBookPath(offerId, returnTo) : "/offers";

  const setStep = useCallback(
    (next: BookStep, tourId?: string | null) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.set("step", next);
        if (tourId) params.set("tourId", tourId);
        else if (next === "tour") params.delete("tourId");
        return params;
      });
    },
    [setSearchParams]
  );

  useEffect(() => {
    if (!offerId) return;
    if (!publicOffersEnabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    api<DiscoveryOffer>(`/offers/${offerId}`)
      .then(async (data) => {
        setOffer(data);
        let nextTours = mapOfferTours(data);
        if (nextTours.length === 0) {
          const slug = data.agencySlug ?? data.agency?.slug;
          if (slug) {
            const agency = await api<AgencyToursResponse>(`/agencies/${slug}`);
            nextTours = agency.tours.map((t) => ({
              ...t,
              agencySlug: slug,
            }));
          }
        }
        setTours(nextTours);
      })
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err.message : "Could not load this offer");
      })
      .finally(() => setLoading(false));
  }, [offerId, publicOffersEnabled]);

  useEffect(() => {
    if (tourIdFromUrl) setSelectedTourId(tourIdFromUrl);
  }, [tourIdFromUrl]);

  const selectedTour = useMemo(
    () => tours.find((t) => t.id === selectedTourId) ?? null,
    [tours, selectedTourId]
  );

  const storyTagHandle = offer?.socialTagHandle ?? null;

  function clearFieldError(key: string) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function loadItinerary(tour: BookTour) {
    if (itineraryByTourId[tour.id]) {
      setExpandedTourId((current) => (current === tour.id ? null : tour.id));
      return;
    }
    setItineraryLoadingId(tour.id);
    setExpandedTourId(tour.id);
    try {
      const detail = await api<TourDetail>(`/tours/public/${tour.agencySlug}/${tour.slug}`);
      setItineraryByTourId((prev) => ({ ...prev, [tour.id]: detail.tourDays ?? [] }));
    } catch {
      setItineraryByTourId((prev) => ({ ...prev, [tour.id]: [] }));
    } finally {
      setItineraryLoadingId(null);
    }
  }

  function selectTour(tourId: string) {
    setSelectedTourId(tourId);
    clearFieldError("tour");
    if (!token) {
      navigate(loginPath(bookPath));
      return;
    }
    setStep("register", tourId);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!offer || !token || !selectedTourId) return;

    const errors: Record<string, string> = {};
    if (!screenshotUrl.trim()) {
      errors.screenshot = "Social media story screenshot is required";
    }
    if (!termsAccepted) {
      errors.terms = "You must agree to the terms and conditions";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await api<RegisterResponse>(`/offers/${offer.id}/register`, {
        method: "POST",
        token,
        body: JSON.stringify({
          screenshotUrl: screenshotUrl.trim(),
          termsAccepted: true,
          tourId: selectedTourId,
          message: message.trim() || undefined,
        }),
      });
      setRegistrationNumber(result.registrationNumber);
      setStep("confirmed", selectedTourId);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!offerId) {
    return <Navigate to="/offers" replace />;
  }

  if (flagsLoaded && !publicOffersEnabled) {
    return (
      <section className="section offer-book-page">
        <p className="muted">
          Public offers are currently turned off. Browse agencies and tours, or send an inquiry
          from an agency page.
        </p>
        <p>
          <Link to="/" className="btn btn-teal">
            Back to home
          </Link>
        </p>
      </section>
    );
  }

  if (loading || authLoading) {
    return (
      <section className="section offer-book-page">
        <p className="muted">Loading offer…</p>
      </section>
    );
  }

  if (!authLoading && !token && step !== "tour") {
    return <Navigate to={loginPath(bookPath)} replace />;
  }

  if (loadError || !offer) {
    return (
      <section className="section offer-book-page">
        <p className="form-error">{loadError || "Offer not found"}</p>
        <Link to={returnTo} className="btn btn-ghost">
          ← Back
        </Link>
      </section>
    );
  }

  if ((step === "register" || step === "confirmed") && !selectedTourId) {
    return <Navigate to={offerBookPath(offerId, returnTo)} replace />;
  }

  if (step === "confirmed" && registrationNumber == null) {
    return <Navigate to={offerBookPath(offerId, returnTo)} replace />;
  }

  return (
    <section className="section offer-book-page module-shell module-discovery">
      <header className="offer-book-page__head">
        <Link to={returnTo} className="offer-book-page__back">
          ← Back
        </Link>
        <div>
          <p className="offer-book-page__eyebrow">Special offer</p>
          <h1 className="offer-book-page__title">{offer.title}</h1>
          <p className="muted offer-book-page__sub">
            {offer.agencyName ?? offer.agency?.name ?? "Travel agency"} ·{" "}
            {offer.spotsLeft > 0 ? `${offer.spotsLeft} spots left` : "Offer full"}
          </p>
        </div>
      </header>

      <OfferBookStepper step={step} />

      {step === "tour" && (
        <div className="offer-book-panel">
          <h2 className="offer-book-panel__title">Choose your tour</h2>
          <p className="muted offer-book-panel__lead">
            Browse readymade tours, open the itinerary to review each day, then select the tour you
            want to book with this offer.
          </p>

          {tours.length === 0 ? (
            <p className="form-error">No readymade tours are available for this offer right now.</p>
          ) : (
            <ul className="offer-book-tour-list">
              {tours.map((tour) => {
                const expanded = expandedTourId === tour.id;
                const itinerary = itineraryByTourId[tour.id];
                const isSelected = selectedTourId === tour.id;
                return (
                  <li key={tour.id} className={`offer-book-tour${isSelected ? " is-selected" : ""}`}>
                    <div className="offer-book-tour__main">
                      <CoverImage
                        src={resolveImageUrl(tour.coverUrl)}
                        alt=""
                        className="offer-book-tour__cover"
                      />
                      <div className="offer-book-tour__copy">
                        <strong>{tour.title}</strong>
                        <span className="muted">{format(tour.basePriceLkr)}</span>
                        <div className="offer-book-tour__actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-nav"
                            onClick={() => void loadItinerary(tour)}
                          >
                            {expanded ? "Hide itinerary" : "View itinerary"}
                          </button>
                          <button
                            type="button"
                            className="brand-btn brand-btn--primary btn-nav"
                            onClick={() => selectTour(tour.id)}
                            disabled={offer.spotsLeft <= 0}
                          >
                            Select tour
                          </button>
                        </div>
                      </div>
                    </div>

                    {expanded && (
                      <div className="offer-book-tour__itinerary">
                        {itineraryLoadingId === tour.id ? (
                          <p className="muted">Loading itinerary…</p>
                        ) : itinerary?.length ? (
                          <TourItineraryPreview days={itinerary} title={`${tour.title} itinerary`} />
                        ) : (
                          <p className="muted">Itinerary details are not available for this tour.</p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <FormFieldError message={fieldErrors.tour} />
        </div>
      )}

      {step === "register" && selectedTour && (
        <form className="offer-book-panel" onSubmit={handleSubmit}>
          <h2 className="offer-book-panel__title">Complete your registration</h2>
          <p className="muted offer-book-panel__lead">
            Share the offer on your story, upload proof, and tell the agency if you need any changes
            before they confirm your booking.
          </p>

          <div className="offer-register-selected-package">
            <CoverImage
              src={resolveImageUrl(selectedTour.coverUrl)}
              alt=""
              className="offer-register-selected-package__cover"
            />
            <div>
              <p className="offer-register-selected-package__label">Selected tour</p>
              <strong>{selectedTour.title}</strong>
              <button
                type="button"
                className="offer-register-selected-package__change"
                onClick={() => setStep("tour", selectedTour.id)}
              >
                Change tour
              </button>
            </div>
          </div>

          <label className="field full">
            <span>Message to agency (optional)</span>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell the agency if you need date changes, group size adjustments, or anything else before they confirm your booking."
              maxLength={2000}
            />
          </label>

          <div className="offer-register-requirement" role="note">
            <p className="offer-register-requirement__badge">Required before booking is confirmed</p>
            <h4 className="offer-register-requirement__title">Post this offer on your social story</h4>
            <ol className="offer-register-requirement__steps">
              <li>
                Share <strong>{offer.title}</strong> on Instagram, Facebook, or TikTok as a story.
              </li>
              <li>
                Tag me{" "}
                {storyTagHandle ? (
                  <strong>{storyTagHandle}</strong>
                ) : (
                  <span className="muted">(@ handle not set on this profile yet)</span>
                )}{" "}
                in your story.
              </li>
              <li>Upload a screenshot of your live story below.</li>
            </ol>
          </div>

          <ImageUrlField
            label="Social media story screenshot"
            value={screenshotUrl}
            onChange={(url) => {
              setScreenshotUrl(url);
              clearFieldError("screenshot");
            }}
            token={token}
            hint="Required — upload a clear screenshot of your story featuring this offer."
            placeholder="Upload story screenshot"
            className="offer-register-upload"
          />
          <FormFieldError message={fieldErrors.screenshot} />

          <label className={`offer-register-terms${fieldErrors.terms ? " offer-register-terms--invalid" : ""}`}>
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => {
                setTermsAccepted(e.target.checked);
                clearFieldError("terms");
              }}
            />
            <span>I agree to the terms and conditions for this offer</span>
          </label>
          <FormFieldError message={fieldErrors.terms} />

          {submitError && <p className="form-error">{submitError}</p>}

          <div className="offer-book-panel__foot">
            <button type="button" className="btn btn-ghost" onClick={() => setStep("tour", selectedTour.id)}>
              Back
            </button>
            <button type="submit" className="brand-btn brand-btn--primary" disabled={submitting}>
              {submitting ? "Submitting…" : "Confirm booking"}
            </button>
          </div>
        </form>
      )}

      {step === "confirmed" && registrationNumber != null && (
        <div className="offer-book-panel offer-book-panel--confirmed">
          <div className="offer-book-confirmed">
            <p className="offer-book-confirmed__badge">Booking registered</p>
            <h2 className="offer-book-confirmed__title">
              You&apos;re the {formatRegistrationOrdinal(registrationNumber)} traveler!
            </h2>
            <p className="offer-book-confirmed__text">
              Your spot is reserved for <strong>{selectedTour?.title ?? "your selected tour"}</strong>.
              Share this offer with friends so more travelers join — everyone wins when registration
              milestones are hit.
            </p>
            <div className="offer-book-confirmed__share">
              <OfferShareButton offer={offer} label="Share with friends" />
            </div>
            <p className="muted offer-book-confirmed__note">
              The agency will review your story screenshot
              {message.trim() ? " and your message" : ""} and confirm your booking soon.
            </p>
            <Link to={returnTo} className="btn btn-teal">
              Return to offers
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
