import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { OFFER_MONTH_ABBREVS, resolveImageUrl } from "@tourpilot/shared";
import {
  offerRewardTierDisplayLine,
  parseOfferRewardTiers,
  type OfferRewardTier,
} from "@tourpilot/shared";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { formatRegistrationOrdinal } from "../../lib/offerBookPaths";
import { lockBodyScroll, unlockBodyScroll } from "../../lib/scrollLock";
import { loginPath } from "../../utils/authRedirect";
import { CoverImage } from "../CoverImage";
import { DashboardModal } from "../DashboardModal";
import { FormFieldError } from "../FormFieldError";
import { ImageUrlField } from "../ImageUrlField";
import { FormatTourPrice } from "../currency/FormatLkr";
import { AgencyInquirySection } from "../inquiry/AgencyInquirySection";
import { TourItineraryPreview } from "../itinerary/TourItineraryPreview";
import type { DiscoveryOffer } from "./DiscoveryOfferCard";
import { OfferShareButton } from "./OfferShareButton";

export type OfferBannerPackage = {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  basePriceLkr: number;
  location?: string;
  days?: number;
};

type Props = {
  agencyId: string;
  agencyName: string;
  agencySlug: string;
  packages: OfferBannerPackage[];
  offers: DiscoveryOffer[];
  returnTo: string;
  refCode?: string | null;
  socialTagHandle?: string | null;
};

type Panel = "closed" | "month" | "package" | "register" | "congrats";
type SidePanel = null | "tour" | "inquire";

type TourDay = {
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
};

type PublicTourDetail = {
  id: string;
  title: string;
  tourDays: TourDay[];
};

type RegisterResponse = {
  id: string;
  registrationNumber: number;
};

const MONTH_OPTIONS = OFFER_MONTH_ABBREVS.map((label, index) => ({
  value: index + 1,
  label,
}));

const CONFETTI_PIECES = Array.from({ length: 48 }, (_, i) => i);

function buildYearOptions(fromYear: number) {
  return [fromYear, fromYear + 1, fromYear + 2];
}

function pickOfferForMonth(
  offers: DiscoveryOffer[],
  year: number,
  month: number
): DiscoveryOffer | null {
  if (offers.length === 0) return null;
  const key = `${year}-${String(month).padStart(2, "0")}`;
  return offers.find((o) => o.offerMonth === key) ?? offers[0] ?? null;
}

function CongratsMilestoneBar({
  tiers,
  spot,
  registrationCap,
}: {
  tiers: OfferRewardTier[];
  spot: number;
  registrationCap?: number;
}) {
  const sorted = parseOfferRewardTiers(tiers);
  const scaleMax = Math.max(
    registrationCap ?? 0,
    sorted.reduce((max, t) => Math.max(max, t.registrationsRequired), 0),
    spot,
    1
  );

  type Row =
    | { kind: "you" }
    | { kind: "milestone"; tier: OfferRewardTier; unlocked: boolean; isYou: boolean };

  const rows: Row[] = [];
  let youPlaced = false;

  for (const tier of sorted) {
    if (!youPlaced && spot > 0 && spot < tier.registrationsRequired) {
      rows.push({ kind: "you" });
      youPlaced = true;
    }
    const isYou = spot === tier.registrationsRequired;
    rows.push({
      kind: "milestone",
      tier,
      unlocked: spot >= tier.registrationsRequired,
      isYou,
    });
    if (isYou) youPlaced = true;
  }

  if (!youPlaced && spot > 0) {
    rows.push({ kind: "you" });
  }

  return (
    <aside className="agency-offer-congrats-bar" aria-label="Registration milestones">
      <p className="agency-offer-congrats-bar__count">
        <strong>{spot}</strong>
        <span> of {scaleMax} registered</span>
      </p>

      <ul className="agency-offer-congrats-bar__list">
        {rows.map((row, index) => {
          if (row.kind === "you") {
            return (
              <li key={`you-${spot}-${index}`} className="agency-offer-congrats-bar__row is-you">
                <div className="agency-offer-congrats-bar__you-callout">
                  <span className="agency-offer-congrats-bar__you-label">
                    You are the {formatRegistrationOrdinal(spot)} spot
                  </span>
                  <span className="agency-offer-congrats-bar__you-arrow" aria-hidden="true">
                    →
                  </span>
                </div>
                <span className="agency-offer-congrats-bar__dot is-you" aria-hidden="true" />
                <div className="agency-offer-congrats-bar__copy">
                  <strong>{spot}</strong>
                  <span>Your registration</span>
                </div>
              </li>
            );
          }

          return (
            <li
              key={`${row.tier.registrationsRequired}-${index}`}
              className={`agency-offer-congrats-bar__row${
                row.unlocked ? " is-unlocked" : ""
              }${row.isYou ? " is-you" : ""}`}
            >
              {row.isYou ? (
                <div className="agency-offer-congrats-bar__you-callout">
                  <span className="agency-offer-congrats-bar__you-label">
                    You are the {formatRegistrationOrdinal(spot)} spot
                  </span>
                  <span className="agency-offer-congrats-bar__you-arrow" aria-hidden="true">
                    →
                  </span>
                </div>
              ) : (
                <span className="agency-offer-congrats-bar__you-spacer" aria-hidden="true" />
              )}
              <span className="agency-offer-congrats-bar__dot" aria-hidden="true" />
              <div className="agency-offer-congrats-bar__copy">
                <strong>{row.tier.registrationsRequired}</strong>
                <span>{offerRewardTierDisplayLine(row.tier)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export function AgencyOfferFreeBanner({
  agencyId,
  agencyName,
  agencySlug,
  packages,
  offers,
  returnTo,
  refCode,
  socialTagHandle,
}: Props) {
  const navigate = useNavigate();
  const { token } = useAuth();
  const now = useMemo(() => new Date(), []);
  const yearOptions = useMemo(() => buildYearOptions(now.getFullYear()), [now]);

  const [panel, setPanel] = useState<Panel>("closed");
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null);
  const [monthError, setMonthError] = useState("");
  const [packageError, setPackageError] = useState("");
  const [inquirySent, setInquirySent] = useState(false);

  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [registrationNumber, setRegistrationNumber] = useState<number | null>(null);

  const [itineraryByTourId, setItineraryByTourId] = useState<Record<string, TourDay[]>>({});
  const [itineraryTitleById, setItineraryTitleById] = useState<Record<string, string>>({});
  const [itineraryLoadingId, setItineraryLoadingId] = useState<string | null>(null);

  const selectedTour = useMemo(
    () => packages.find((p) => p.id === selectedTourId) ?? null,
    [packages, selectedTourId]
  );

  const activeOffer = useMemo(
    () => pickOfferForMonth(offers, year, month),
    [offers, year, month]
  );

  const storyTagHandle = activeOffer?.socialTagHandle ?? socialTagHandle ?? null;

  useEffect(() => {
    if (panel !== "package" && panel !== "register" && panel !== "congrats") return;
    lockBodyScroll();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (panel === "package" && sidePanel) {
        setSidePanel(null);
        return;
      }
      if (panel === "congrats") {
        closeFlow();
        return;
      }
      if (panel === "register") {
        setPanel("package");
        return;
      }
      closeFlow();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      unlockBodyScroll();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [panel, sidePanel]);

  function openFlow() {
    setMonthError("");
    setPackageError("");
    setSidePanel(null);
    setInquirySent(false);
    setScreenshotUrl("");
    setTermsAccepted(false);
    setFieldErrors({});
    setSubmitError("");
    setRegistrationNumber(null);
    setPanel("month");
  }

  function closeFlow() {
    setPanel("closed");
    setSidePanel(null);
    setPackageError("");
    setInquirySent(false);
    setScreenshotUrl("");
    setTermsAccepted(false);
    setFieldErrors({});
    setSubmitError("");
    setRegistrationNumber(null);
  }

  function goToPackages() {
    if (!year || !month) {
      setMonthError("Please select a year and month.");
      return;
    }
    setMonthError("");
    setSidePanel(null);
    setPanel("package");
  }

  function clearFieldError(key: string) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function loadItinerary(tour: OfferBannerPackage) {
    if (itineraryByTourId[tour.id]) return;
    setItineraryLoadingId(tour.id);
    try {
      const detail = await api<PublicTourDetail>(`/tours/public/${agencySlug}/${tour.slug}`);
      setItineraryByTourId((prev) => ({ ...prev, [tour.id]: detail.tourDays ?? [] }));
      setItineraryTitleById((prev) => ({ ...prev, [tour.id]: detail.title || tour.title }));
    } catch {
      setItineraryByTourId((prev) => ({ ...prev, [tour.id]: [] }));
      setItineraryTitleById((prev) => ({ ...prev, [tour.id]: tour.title }));
    } finally {
      setItineraryLoadingId(null);
    }
  }

  function openTourSide(tour: OfferBannerPackage) {
    setSelectedTourId(tour.id);
    setPackageError("");
    setSidePanel("tour");
    void loadItinerary(tour);
  }

  function openInquireSide(tour: OfferBannerPackage) {
    setSelectedTourId(tour.id);
    setPackageError("");
    setInquirySent(false);
    setSidePanel("inquire");
  }

  function goToScreenshotStep() {
    if (!selectedTourId) {
      setPackageError("Select a package to continue.");
      return;
    }
    if (!activeOffer) {
      setPackageError("No active offer is available for registration right now.");
      return;
    }
    if (!token) {
      navigate(loginPath(returnTo));
      return;
    }
    setSidePanel(null);
    setSubmitError("");
    setFieldErrors({});
    setPanel("register");
  }

  async function handleRegister() {
    if (!activeOffer || !selectedTourId || !token) return;

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
      const result = await api<RegisterResponse>(`/offers/${activeOffer.id}/register`, {
        method: "POST",
        token,
        body: JSON.stringify({
          screenshotUrl: screenshotUrl.trim(),
          termsAccepted: true,
          tourId: selectedTourId,
        }),
      });
      setRegistrationNumber(result.registrationNumber);
      setPanel("congrats");
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  const packageModal =
    panel === "package"
      ? createPortal(
          <div
            className={`entity-modal open agency-offer-package-modal${
              sidePanel ? " is-split" : ""
            }`}
            role="presentation"
            onClick={closeFlow}
          >
            <div
              className="agency-offer-package-stage"
              role="dialog"
              aria-modal="true"
              aria-labelledby="offer-choose-package-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="agency-offer-package-panel agency-offer-package-panel--list">
                <div className="dialog-head">
                  <h3 id="offer-choose-package-title">Choose package</h3>
                  <button
                    type="button"
                    className="close-btn"
                    onClick={closeFlow}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <p className="dialog-sub muted">
                  Select a tour, view details or inquire to change it, then continue.
                </p>

                {packages.length === 0 ? (
                  <p className="muted">No packages are available right now.</p>
                ) : (
                  <ul className="agency-offer-package-picker">
                    {packages.map((tour) => {
                      const selected = selectedTourId === tour.id;
                      return (
                        <li key={tour.id}>
                          <div
                            className={`agency-offer-package-pick${
                              selected ? " is-selected" : ""
                            }`}
                          >
                            <label className="agency-offer-package-pick__select">
                              <input
                                type="radio"
                                name="offer-banner-package"
                                checked={selected}
                                onChange={() => {
                                  setSelectedTourId(tour.id);
                                  setPackageError("");
                                }}
                                className="agency-offer-package-pick__radio"
                              />
                              <span
                                className="agency-offer-package-pick__circle"
                                aria-hidden="true"
                              />
                            </label>
                            <CoverImage
                              src={resolveImageUrl(tour.coverUrl)}
                              alt=""
                              className="agency-offer-package-pick__cover"
                            />
                            <div className="agency-offer-package-pick__body">
                              <strong>{tour.title}</strong>
                              {tour.location ? (
                                <span className="muted">{tour.location}</span>
                              ) : null}
                              <span className="agency-offer-package-pick__price">
                                <FormatTourPrice amount={tour.basePriceLkr} />
                              </span>
                              <div className="agency-offer-package-pick__actions">
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-nav"
                                  onClick={() => openTourSide(tour)}
                                >
                                  View tour
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-lite btn-nav"
                                  onClick={() => openInquireSide(tour)}
                                >
                                  Inquire to change
                                </button>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {packageError ? <p className="form-error">{packageError}</p> : null}
                {inquirySent ? (
                  <p className="agency-offer-package-note">
                    Inquiry sent. You can continue with offer registration.
                  </p>
                ) : null}

                <div className="dialog-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setSidePanel(null);
                      setPanel("month");
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!selectedTourId || !activeOffer}
                    onClick={goToScreenshotStep}
                  >
                    Next
                  </button>
                </div>
              </div>

              {sidePanel && selectedTour ? (
                <div
                  className="agency-offer-package-panel agency-offer-package-panel--side"
                  aria-label={sidePanel === "tour" ? "Tour details" : "Inquiry form"}
                >
                  <div className="dialog-head">
                    <h3>{sidePanel === "tour" ? "Tour details" : "Inquire to change"}</h3>
                    <button
                      type="button"
                      className="close-btn"
                      onClick={() => setSidePanel(null)}
                      aria-label="Close side panel"
                    >
                      ×
                    </button>
                  </div>

                  {sidePanel === "tour" && (
                    <div className="agency-offer-side-tour">
                      <CoverImage
                        src={resolveImageUrl(selectedTour.coverUrl)}
                        alt=""
                        className="agency-offer-side-tour__cover"
                      />
                      <div className="agency-offer-side-tour__meta">
                        <strong>{selectedTour.title}</strong>
                        <span className="agency-offer-package-pick__price">
                          <FormatTourPrice amount={selectedTour.basePriceLkr} />
                        </span>
                      </div>
                      {itineraryLoadingId === selectedTour.id ? (
                        <p className="muted">Loading itinerary…</p>
                      ) : itineraryByTourId[selectedTour.id]?.length ? (
                        <TourItineraryPreview
                          days={itineraryByTourId[selectedTour.id]}
                          title={
                            itineraryTitleById[selectedTour.id] ||
                            `${selectedTour.title} itinerary`
                          }
                        />
                      ) : (
                        <p className="muted">
                          Itinerary details are not available for this tour.
                        </p>
                      )}
                      <div className="dialog-actions">
                        <button
                          type="button"
                          className="btn btn-lite"
                          onClick={() => openInquireSide(selectedTour)}
                        >
                          Inquire to change
                        </button>
                      </div>
                    </div>
                  )}

                  {sidePanel === "inquire" && (
                    <div className="agency-offer-side-inquire">
                      <AgencyInquirySection
                        key={selectedTour.id}
                        agencyId={agencyId}
                        agencyName={agencyName}
                        agencySlug={agencySlug}
                        refCode={refCode}
                        embedded
                        tour={{
                          id: selectedTour.id,
                          title: selectedTour.title,
                          slug: selectedTour.slug,
                          days: selectedTour.days ?? 1,
                          basePriceLkr: selectedTour.basePriceLkr,
                        }}
                        onSuccess={() => setInquirySent(true)}
                      />
                      {inquirySent && (
                        <div className="dialog-actions">
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={!selectedTourId || !activeOffer}
                            onClick={goToScreenshotStep}
                          >
                            Continue to offer registration
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>,
          document.body
        )
      : null;

  const congratsModal =
    panel === "congrats"
      ? createPortal(
          <div
            className="entity-modal open agency-offer-congrats-modal"
            role="presentation"
            onClick={closeFlow}
          >
            <div className="agency-offer-confetti" aria-hidden="true">
              {CONFETTI_PIECES.map((i) => (
                <span
                  key={i}
                  className="agency-offer-confetti__piece"
                  style={
                    {
                      "--i": i,
                      "--x": `${(i * 37) % 100}%`,
                      "--delay": `${(i % 12) * 0.05}s`,
                      "--hue": `${(i * 47) % 360}`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
            <div
              className="entity-dialog agency-offer-congrats-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="offer-congrats-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="agency-offer-congrats__layout">
                <div className="agency-offer-congrats__copy">
                  <p className="agency-offer-congrats__badge">You&apos;re registered</p>
                  <h3 id="offer-congrats-title" className="agency-offer-congrats__title">
                    Congratulations!
                  </h3>
                  <p className="agency-offer-congrats__text">
                    {registrationNumber != null ? (
                      <>
                        You&apos;re the{" "}
                        <strong>{formatRegistrationOrdinal(registrationNumber)}</strong> traveler
                        registered for this offer
                        {selectedTour ? (
                          <>
                            {" "}
                            on <strong>{selectedTour.title}</strong>
                          </>
                        ) : null}
                        .
                      </>
                    ) : (
                      <>Your spot is reserved. The agency will review your story screenshot soon.</>
                    )}
                  </p>
                </div>

                {registrationNumber != null && (
                  <CongratsMilestoneBar
                    tiers={activeOffer?.rewardTiers ?? []}
                    spot={registrationNumber}
                    registrationCap={
                      activeOffer?.registrationCap ??
                      (activeOffer?.registeredCount != null
                        ? activeOffer.registeredCount + (activeOffer.spotsLeft ?? 0)
                        : undefined)
                    }
                  />
                )}
              </div>

              {activeOffer && (
                <div className="agency-offer-congrats__share">
                  <OfferShareButton
                    offer={activeOffer}
                    variant="hero"
                    label="Share with friends to win more"
                    className="agency-offer-congrats__share-btn"
                  />
                </div>
              )}

              <div className="dialog-actions">
                <button type="button" className="btn btn-primary" onClick={closeFlow}>
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <section
      id="offers"
      className="agency-display-band agency-display-band--offers agency-display-band--offer-strip"
      aria-label="Special offers"
    >
      <div className="agency-offer-strip" role="region" aria-label="Free tour offer">
        <p className="agency-offer-strip__text">Your entire tour is free!</p>
        <button type="button" className="agency-offer-strip__cta" onClick={openFlow}>
          Click here
          <span className="agency-offer-strip__arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>

      <DashboardModal
        open={panel === "month"}
        title="Which month are you planning to come?"
        subtitle="Pick the year and month for your trip."
        onClose={closeFlow}
        dialogClassName="agency-offer-flow-dialog"
      >
        <div className="agency-offer-month-form">
          <label className="field">
            <span>Year</span>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Month</span>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {monthError ? <p className="form-error">{monthError}</p> : null}
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={closeFlow}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={goToPackages}>
            Next
          </button>
        </div>
      </DashboardModal>

      <DashboardModal
        open={panel === "register"}
        title="Upload your story screenshot"
        subtitle="Share the offer on your social story, then upload proof to register."
        onClose={closeFlow}
        dialogClassName="agency-offer-flow-dialog agency-offer-register-dialog"
      >
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
              <button
                type="button"
                className="offer-register-selected-package__change"
                onClick={() => setPanel("package")}
              >
                Change tour
              </button>
            </div>
          </div>
        )}

        <div className="offer-register-requirement" role="note">
          <p className="offer-register-requirement__badge">Required before you can register</p>
          <h4 className="offer-register-requirement__title">Post this offer on your social story</h4>
          <ol className="offer-register-requirement__steps">
            <li>
              Share{" "}
              <strong>{activeOffer?.title ?? "this offer"}</strong> on Instagram, Facebook, or
              TikTok as a story.
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

        {!token ? (
          <p className="form-error">
            Please <Link to={loginPath(returnTo)}>log in</Link> to upload a screenshot and
            register.
          </p>
        ) : (
          <>
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

            <label
              className={`offer-register-terms${
                fieldErrors.terms ? " offer-register-terms--invalid" : ""
              }`}
            >
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
          </>
        )}

        {submitError ? <p className="form-error">{submitError}</p> : null}

        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setPanel("package")}>
            Back
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={submitting || !token}
            onClick={() => void handleRegister()}
          >
            {submitting ? "Registering…" : "Register"}
          </button>
        </div>
      </DashboardModal>

      {packageModal}
      {congratsModal}
    </section>
  );
}
