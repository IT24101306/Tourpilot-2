import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { currentPath, loginPath, registerPath } from "../../utils/authRedirect";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useCurrency } from "../../context/CurrencyContext";
import { LineCheckIcon } from "../icons/LineIcons";
import {
  defaultTourInquiryMessage,
  InquiryTourChip,
  type InquiryTourRef,
} from "./InquiryTourChip";
import { InquiryTripDates } from "./InquiryTripDates";
import { InquiryInterestTags } from "./InquiryInterestTags";
import { ChatRoomPopup } from "./ChatRoomPopup";
import { endDateFromStartAndTourDays, DISPLAY_CURRENCIES, type DisplayCurrency } from "@tourpilot/shared";

const BUDGET_CURRENCIES = DISPLAY_CURRENCIES;

type BudgetCurrency = DisplayCurrency;

type Props = {
  agencyId: string;
  agencyName: string;
  agencySlug: string;
  refCode?: string | null;
  /** When set with share-as-mine tours, inquire chat is handled by this influencer */
  influencerSlug?: string | null;
  tour?: InquiryTourRef | null;
  /** Scroll this section into view once after mount (e.g. from tour inquire link). */
  focusOnMount?: boolean;
  /** Compact layout for use inside offer-flow side panels. */
  embedded?: boolean;
  /** When false, parent should open chat (e.g. if this section will unmount). Default true. */
  openChatOnSuccess?: boolean;
  onSuccess?: (inquiryId: string) => void;
};

function formatBudgetBand(
  currency: BudgetCurrency,
  min: string,
  max: string
): string | undefined {
  const start = min.trim();
  const end = max.trim();
  if (!start && !end) return undefined;
  if (start && end) return `${currency} ${start} – ${end}`;
  if (start) return `${currency} from ${start}`;
  return `${currency} up to ${end}`;
}

export function AgencyInquirySection({
  agencyId,
  agencyName,
  agencySlug,
  refCode,
  influencerSlug,
  tour,
  focusOnMount,
  embedded,
  openChatOnSuccess = true,
  onSuccess,
}: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const returnTo = currentPath(location);
  const { token, user, refreshUser } = useAuth();
  const { currency: displayCurrency } = useCurrency();
  const [email, setEmail] = useState("");
  const [pax, setPax] = useState(2);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState<BudgetCurrency>(() =>
    BUDGET_CURRENCIES.includes(displayCurrency as BudgetCurrency)
      ? (displayCurrency as BudgetCurrency)
      : "USD"
  );
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [statusOk, setStatusOk] = useState(false);
  const [sentInquiryId, setSentInquiryId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = Boolean(token && user?.role === "TOURIST");
  const isTourInquiry = Boolean(tour);
  const partnerLabel = agencyName.trim() || (influencerSlug ? "the creator" : "the agency");

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user?.email]);

  useEffect(() => {
    if (BUDGET_CURRENCIES.includes(displayCurrency as BudgetCurrency)) {
      setBudgetCurrency(displayCurrency as BudgetCurrency);
    }
  }, [displayCurrency]);

  useEffect(() => {
    const preferred = user?.touristProfile?.displayCurrency as DisplayCurrency | undefined;
    if (preferred && BUDGET_CURRENCIES.includes(preferred as BudgetCurrency)) {
      setBudgetCurrency(preferred as BudgetCurrency);
    }
  }, [user?.touristProfile?.displayCurrency]);

  useEffect(() => {
    if (tour) {
      setMessage(defaultTourInquiryMessage(tour));
    }
  }, [tour?.id]);

  useEffect(() => {
    if (!tour?.days || !startDate) return;
    const autoEnd = endDateFromStartAndTourDays(startDate, tour.days);
    if (autoEnd && autoEnd !== endDate) setEndDate(autoEnd);
  }, [tour?.days, startDate]);

  useEffect(() => {
    if (!focusOnMount) return;

    let cancelled = false;
    let attempt = 0;

    const scrollToSection = () => {
      if (cancelled) return;
      const el = sectionRef.current;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (attempt < 24) {
        attempt += 1;
        window.setTimeout(scrollToSection, 50);
      }
    };

    const timer = window.setTimeout(scrollToSection, 50);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [focusOnMount]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token) {
      setStatusOk(false);
      setStatus("Please log in as a tourist to send an inquiry.");
      return;
    }
    if (user?.role !== "TOURIST") {
      setStatusOk(false);
      setStatus("Only tourist accounts can send tour inquiries.");
      return;
    }
    if (!email.trim()) {
      setStatusOk(false);
      setStatus(`Please enter your email so ${partnerLabel} can reach you.`);
      return;
    }

    const minNum = budgetMin.trim() ? Number(budgetMin) : NaN;
    const maxNum = budgetMax.trim() ? Number(budgetMax) : NaN;
    if (budgetMin.trim() && (!Number.isFinite(minNum) || minNum < 0)) {
      setStatusOk(false);
      setStatus("Enter a valid starting budget.");
      return;
    }
    if (budgetMax.trim() && (!Number.isFinite(maxNum) || maxNum < 0)) {
      setStatusOk(false);
      setStatus("Enter a valid ending budget.");
      return;
    }
    if (Number.isFinite(minNum) && Number.isFinite(maxNum) && maxNum < minNum) {
      setStatusOk(false);
      setStatus("Ending budget should be greater than or equal to the starting budget.");
      return;
    }

    setSubmitting(true);
    setStatus("");
    setStatusOk(false);
    setSentInquiryId(null);
    try {
      const result = await api<{ id: string }>("/inquiries", {
        method: "POST",
        token,
        body: JSON.stringify({
          agencyId,
          tourId: tour?.id,
          type: isTourInquiry ? "READY_MADE" : "CUSTOM",
          pax,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
          budgetBand: formatBudgetBand(budgetCurrency, budgetMin, budgetMax),
          interests,
          message: message.trim(),
          email: email.trim(),
          refCode: refCode || undefined,
          influencerSlug: influencerSlug || undefined,
        }),
      });
      await refreshUser().catch(() => {});
      setSentInquiryId(result.id);
      setStatusOk(true);
      setStatus(
        `${partnerLabel} received your request. You can keep chatting here without leaving this page.`
      );
      if (openChatOnSuccess) setChatOpen(true);
      onSuccess?.(result.id);
      if (!tour) {
        setMessage("");
        setInterests([]);
        setBudgetMin("");
        setBudgetMax("");
        setStartDate("");
        setEndDate("");
      }
    } catch (err) {
      setStatusOk(false);
      setStatus(err instanceof ApiError ? err.message : "Failed to send inquiry");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      ref={sectionRef}
      className={`agency-inquiry-section${embedded ? " agency-inquiry-section--embedded" : ""}`}
      id={embedded ? undefined : "request-custom-tour"}
    >
      <div className="agency-inquiry-inner">
        <div className="agency-inquiry-layout">
          {!embedded && (
            <header className="agency-inquiry-intro">
              <span className="agency-inquiry-eyebrow">
                {isTourInquiry ? "Ready-made package" : "Personalized travel"}
              </span>
              <h2>{isTourInquiry ? `Inquire about ${tour!.title}` : "Request a custom tour"}</h2>
              <p className="agency-inquiry-lead">
                {isTourInquiry ? (
                  <>
                    You are inquiring about a specific tour from <strong>{partnerLabel}</strong>. Add
                    dates and any changes — they will reply in your chat room.
                  </>
                ) : (
                  <>
                    Tell <strong>{partnerLabel}</strong> what you need — dates, group size, budget, and
                    interests — and receive a tailored proposal on your profile.
                  </>
                )}
              </p>
              <ul className="agency-inquiry-trust" aria-hidden="true">
                <li>
                  <span className="agency-inquiry-trust-icon">
                    <LineCheckIcon size={14} />
                  </span>
                  No payment required to inquire
                </li>
                <li>
                  <span className="agency-inquiry-trust-icon">
                    <LineCheckIcon size={14} />
                  </span>
                  Direct reply from {partnerLabel}
                </li>
                <li>
                  <span className="agency-inquiry-trust-icon">
                    <LineCheckIcon size={14} />
                  </span>
                  Refine the itinerary together
                </li>
              </ul>
            </header>
          )}

          <div className="agency-inquiry-card">
            {embedded && (
              <header className="agency-inquiry-embedded-head">
                <h3>{isTourInquiry ? `Inquire about ${tour!.title}` : "Request a custom tour"}</h3>
                <p className="muted">
                  {influencerSlug
                    ? "Add your dates and details — you’ll chat with the creator in your chat room."
                    : `Tell ${partnerLabel} what to change, then continue with offer registration.`}
                </p>
              </header>
            )}
            {isTourInquiry && tour && (
              <InquiryTourChip
                tour={tour}
                agencySlug={agencySlug}
                compact={embedded}
                hideAgencyLink={Boolean(influencerSlug)}
              />
            )}

            {!token && (
              <div className="agency-inquiry-login-banner">
                <p>
                  <Link to={loginPath(returnTo)}>Log in</Link> or{" "}
                  <Link to={registerPath(returnTo)}>create a free account</Link> to send your
                  request.
                </p>
              </div>
            )}

            {token && user?.role !== "TOURIST" && (
              <div className="agency-inquiry-login-banner agency-inquiry-login-banner--warn">
                <p>Only tourist accounts can submit tour inquiries.</p>
              </div>
            )}

            <form className="agency-inquiry-form" onSubmit={submit}>
              <fieldset className="agency-inquiry-fieldset" disabled={!canSubmit}>
                <legend className="agency-inquiry-legend">Contact details</legend>
                <p className="inquiry-field-hint">
                  <strong>{partnerLabel}</strong> needs a way to reach you before confirming a booking.
                </p>
                <div className="agency-inquiry-grid agency-inquiry-grid--contact">
                  <div className="inquiry-field">
                    <label htmlFor="inquiry-email">Email</label>
                    <input
                      id="inquiry-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                  <div className="inquiry-field">
                    <label htmlFor="inquiry-phone">Phone</label>
                    <input
                      id="inquiry-phone"
                      type="tel"
                      value={user?.phone ?? ""}
                      readOnly
                      className="inquiry-input-readonly"
                      aria-describedby="inquiry-phone-hint"
                    />
                    <span id="inquiry-phone-hint" className="inquiry-hint">
                      From your account — used for OTP login
                    </span>
                  </div>
                </div>
              </fieldset>

              <fieldset className="agency-inquiry-fieldset" disabled={!canSubmit}>
                <legend className="agency-inquiry-legend">Trip details</legend>
                <div className="agency-inquiry-trip-block">
                  <div className="inquiry-field inquiry-field--compact">
                    <label htmlFor="inquiry-pax">Travelers</label>
                    <input
                      id="inquiry-pax"
                      type="number"
                      min={1}
                      max={99}
                      value={pax}
                      onChange={(e) => setPax(Number(e.target.value))}
                      required
                    />
                  </div>
                  <InquiryTripDates
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    tourDays={tour?.days}
                  />
                </div>
              </fieldset>

              <fieldset className="agency-inquiry-fieldset" disabled={!canSubmit}>
                <legend className="agency-inquiry-legend">Preferences</legend>
                <div className="agency-inquiry-grid agency-inquiry-grid--prefs">
                  <div className="inquiry-field inquiry-field--full">
                    <label id="inquiry-budget-label">
                      Budget <span className="inquiry-optional">optional</span>
                    </label>
                    <div
                      className="inquiry-budget-row"
                      role="group"
                      aria-labelledby="inquiry-budget-label"
                    >
                      <label className="inquiry-budget-currency">
                        <span className="sr-only">Currency</span>
                        <select
                          value={budgetCurrency}
                          onChange={(e) => setBudgetCurrency(e.target.value as BudgetCurrency)}
                        >
                          {BUDGET_CURRENCIES.map((code) => (
                            <option key={code} value={code}>
                              {code}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="inquiry-budget-amount">
                        <span className="inquiry-budget-amount__label">From</span>
                        <input
                          id="inquiry-budget-min"
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          value={budgetMin}
                          onChange={(e) => setBudgetMin(e.target.value)}
                          placeholder="Starting"
                        />
                      </label>
                      <span className="inquiry-budget-sep" aria-hidden="true">
                        –
                      </span>
                      <label className="inquiry-budget-amount">
                        <span className="inquiry-budget-amount__label">To</span>
                        <input
                          id="inquiry-budget-max"
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          value={budgetMax}
                          onChange={(e) => setBudgetMax(e.target.value)}
                          placeholder="Ending"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="inquiry-field inquiry-field--full">
                    <label htmlFor="inquiry-interests">Interests</label>
                    <InquiryInterestTags
                      id="inquiry-interests"
                      value={interests}
                      onChange={setInterests}
                      disabled={!canSubmit}
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset className="agency-inquiry-fieldset" disabled={!canSubmit}>
                <legend className="agency-inquiry-legend">
                  {isTourInquiry ? "Your message" : "Your vision"}
                </legend>
                <div className="inquiry-field inquiry-field--full">
                  <label htmlFor="inquiry-message">
                    {isTourInquiry ? "Questions or changes for this tour" : "Describe your dream journey"}
                  </label>
                  <textarea
                    id="inquiry-message"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      isTourInquiry
                        ? "Preferred dates, group size changes, hotel upgrades, or special requests…"
                        : "Describe your dream journey — must-see places, pace, stays, food, or special occasions…"
                    }
                    required
                  />
                </div>
              </fieldset>

              <div className="agency-inquiry-footer">
                <button
                  type="submit"
                  className="agency-inquiry-submit"
                  disabled={submitting || !canSubmit}
                >
                  {submitting
                    ? "Sending your request…"
                    : isTourInquiry
                      ? "Send inquiry about this tour"
                      : `Send inquiry to ${partnerLabel}`}
                </button>
                {canSubmit && (
                  <p className="agency-inquiry-foot">
                    After you send, the chat room opens here so you can keep talking without leaving
                    this page. You can also find it anytime in{" "}
                    <Link to="/trips" className="agency-inquiry-foot__highlight">
                      My trips
                    </Link>
                    .
                  </p>
                )}
              </div>
            </form>

            {status && (
              <div
                className={`agency-inquiry-status${statusOk ? " agency-inquiry-status--success" : ""}`}
                role="status"
              >
                {statusOk ? (
                  <>
                    <strong>We received your request</strong>
                    <p>
                      {status}{" "}
                      {sentInquiryId ? (
                        <button
                          type="button"
                          className="agency-inquiry-status__cta"
                          onClick={() => setChatOpen(true)}
                        >
                          Visit the chat room →
                        </button>
                      ) : null}
                    </p>
                  </>
                ) : (
                  <p>{status}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ChatRoomPopup
        open={chatOpen}
        inquiryId={sentInquiryId}
        partnerName={partnerLabel}
        onClose={() => setChatOpen(false)}
      />
    </section>
  );
}
