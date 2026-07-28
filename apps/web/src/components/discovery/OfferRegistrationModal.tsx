import { FormEvent, useEffect, useMemo, useState } from "react";
import { resolveImageUrl } from "@tourpilot/shared";
import { api, ApiError } from "../../api/client";
import { useFormatMoney } from "../../context/CurrencyContext";
import { CoverImage } from "../CoverImage";
import { DashboardModal, ModalActions } from "../DashboardModal";
import { FormFieldError } from "../FormFieldError";
import { ImageUrlField } from "../ImageUrlField";
import type { DiscoveryOffer, OfferTourOption } from "./DiscoveryOfferCard";

type Props = {
  open: boolean;
  offer: DiscoveryOffer | null;
  token: string | null;
  /** Published readymade tours the traveler can choose from (e.g. agency storefront tours). */
  availableTours?: OfferTourOption[];
  /** @ handle travelers should tag in their story (agency or influencer). */
  tagHandle?: string | null;
  onClose: () => void;
  onSuccess: () => void;
};

type Step = "tour" | "register";

type AgencyToursResponse = {
  tours: Array<{
    id: string;
    title: string;
    slug: string;
    coverUrl: string | null;
    basePriceLkr: number;
  }>;
};

function mapAgencyTours(tours: AgencyToursResponse["tours"]): OfferTourOption[] {
  return tours.map((t) => ({
    id: t.id,
    title: t.title,
    slug: t.slug,
    coverUrl: t.coverUrl,
    basePriceLkr: t.basePriceLkr,
  }));
}

export function OfferRegistrationModal({
  open,
  offer,
  token,
  availableTours,
  tagHandle,
  onClose,
  onSuccess,
}: Props) {
  const { format } = useFormatMoney();
  const [step, setStep] = useState<Step>("tour");
  const [tours, setTours] = useState<OfferTourOption[]>([]);
  const [toursLoading, setToursLoading] = useState(false);
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function clearFieldError(key: string) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const presetTours = useMemo(() => availableTours ?? [], [availableTours]);

  useEffect(() => {
    if (!open || !offer) return;

    setScreenshotUrl("");
    setTermsAccepted(false);
    setError("");
    setFieldErrors({});
    setSubmitting(false);
    setSelectedTourId(null);
    setStep("tour");

    if (presetTours.length > 0) {
      setTours(presetTours);
      setToursLoading(false);
      return;
    }

    const slug = offer.agencySlug ?? offer.agency?.slug;
    if (!slug) {
      setTours([]);
      setToursLoading(false);
      return;
    }

    let cancelled = false;
    setToursLoading(true);
    api<AgencyToursResponse>(`/agencies/${slug}`)
      .then((agency) => {
        if (cancelled) return;
        setTours(mapAgencyTours(agency.tours));
      })
      .catch(() => {
        if (!cancelled) setTours([]);
      })
      .finally(() => {
        if (!cancelled) setToursLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, offer?.id, presetTours]);

  const selectedTour = tours.find((t) => t.id === selectedTourId) ?? null;
  const storyTagHandle = tagHandle ?? offer?.socialTagHandle ?? null;

  function goToRegister() {
    const errors: Record<string, string> = {};
    if (tours.length > 0 && !selectedTourId) {
      errors.tour = "Choose a readymade tour before continuing.";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setStep("register");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!offer || !token) return;

    const errors: Record<string, string> = {};
    if (tours.length > 0 && !selectedTourId) {
      errors.tour = "Choose a readymade tour before registering.";
    }
    if (!screenshotUrl.trim()) {
      errors.screenshot = "Social media story screenshot is required";
    }
    if (!termsAccepted) {
      errors.terms = "You must agree to the terms and conditions";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (errors.tour) setStep("tour");
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    setError("");
    try {
      await api(`/offers/${offer.id}/register`, {
        method: "POST",
        token,
        body: JSON.stringify({
          screenshotUrl: screenshotUrl.trim(),
          termsAccepted: true,
          tourId: selectedTourId,
        }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  const modalTitle = step === "tour" ? "Choose your tour" : "Register for this offer";

  const modalSubtitle =
    step === "tour"
      ? offer
        ? `${offer.title} — pick any readymade tour, then continue to registration.`
        : undefined
      : offer
        ? `${offer.title} — share this offer on your story, then upload proof below.`
        : undefined;

  return (
    <DashboardModal
      open={open && !!offer}
      title={modalTitle}
      subtitle={modalSubtitle}
      onClose={onClose}
      dialogClassName="offer-register-dialog"
    >
      {step === "tour" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            goToRegister();
          }}
        >
          <div className="offer-register-form">
            {toursLoading ? (
              <p className="muted">Loading readymade tours…</p>
            ) : tours.length === 0 ? (
              <p className="form-error">
                No readymade tours are available to register for right now. Please try again later.
              </p>
            ) : (
              <div className="offer-package-picker">
                {tours.map((tour) => {
                  const selected = selectedTourId === tour.id;
                  return (
                    <button
                      key={tour.id}
                      type="button"
                      className={`offer-package-card${selected ? " is-selected" : ""}`}
                      onClick={() => {
                        setSelectedTourId(tour.id);
                        clearFieldError("tour");
                      }}
                    >
                      <CoverImage
                        src={resolveImageUrl(tour.coverUrl)}
                        alt=""
                        className="offer-package-card__cover"
                      />
                      <div className="offer-package-card__body">
                        <strong>{tour.title}</strong>
                        <span className="offer-package-card__price">
                          {format(tour.basePriceLkr)}
                        </span>
                      </div>
                      <span className="offer-package-card__check" aria-hidden="true">
                        {selected ? "✓" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <FormFieldError message={fieldErrors.tour} />
            {error && <p className="form-error">{error}</p>}
          </div>
          <ModalActions
            onCancel={onClose}
            submitLabel="Continue"
            saving={toursLoading}
          />
        </form>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="offer-register-form">
            {offer && <OfferRegisterProgress offer={offer} />}

            {selectedTour && (
              <div className="offer-register-selected-package">
                <CoverImage
                  src={resolveImageUrl(selectedTour.coverUrl)}
                  alt=""
                  className="offer-register-selected-package__cover"
                />
                <div>
                  <p className="offer-register-selected-package__label">Selected tour</p>
                  <strong>{selectedTour.title}</strong>
                  {tours.length > 1 && (
                    <button
                      type="button"
                      className="offer-register-selected-package__change"
                      onClick={() => setStep("tour")}
                    >
                      Change tour
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="offer-register-requirement" role="note">
              <p className="offer-register-requirement__badge">Required before you can register</p>
              <h4 className="offer-register-requirement__title">Post this offer on your social story</h4>
              <ol className="offer-register-requirement__steps">
                <li>
                  Share <strong>{offer?.title ?? "this offer"}</strong> on Instagram, Facebook, or TikTok as a{" "}
                  <strong>story</strong> (or equivalent short-form post).
                </li>
                <li>
                  Tag me{" "}
                  {storyTagHandle ? (
                    <strong>{storyTagHandle}</strong>
                  ) : (
                    <span className="muted">(@ handle not set on this profile yet)</span>
                  )}{" "}
                  in your story, or include the offer link if shown on the card.
                </li>
                <li>
                  Take a <strong>screenshot of your live story</strong> showing the post.
                </li>
                <li>Upload that screenshot below — registration cannot be completed without it.</li>
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
              hint="Required — upload a clear screenshot of your story featuring this offer (JPEG, PNG, or WebP)."
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

            {error && <p className="form-error">{error}</p>}
          </div>

          <ModalActions
            onCancel={onClose}
            submitLabel={submitting ? "Submitting…" : "Submit registration"}
            saving={submitting}
          />
        </form>
      )}
    </DashboardModal>
  );
}

function OfferRegisterProgress({ offer }: { offer: DiscoveryOffer }) {
  const cap =
    offer.registrationCap ??
    (offer.registeredCount != null ? offer.registeredCount + offer.spotsLeft : offer.spotsLeft);
  const registered = offer.registeredCount ?? 0;
  const progress = cap > 0 ? Math.min(100, Math.round((registered / cap) * 100)) : 0;

  return (
    <div className="offer-register-progress">
      <div className="offer-register-progress__head">
        <span className="offer-register-progress__label">Registration progress</span>
        <strong className="offer-register-progress__value">
          {registered} <span>of {cap}</span> registered
        </strong>
      </div>
      <div
        className="offer-register-progress__bar"
        role="progressbar"
        aria-valuenow={registered}
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-label={`${registered} of ${cap} travelers registered`}
      >
        <span className="offer-register-progress__fill" style={{ width: `${progress}%` }} />
      </div>
      <p className="offer-register-progress__hint">
        {offer.spotsLeft > 0
          ? `${offer.spotsLeft} spot${offer.spotsLeft === 1 ? "" : "s"} left · ${Math.max(
              0,
              cap - registered
            )} more to reach the cap`
          : "Registration cap reached"}
      </p>
    </div>
  );
}
