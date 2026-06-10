import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { currentPath, loginPath, registerPath } from "../../utils/authRedirect";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { LineCheckIcon } from "../icons/LineIcons";
import { useFormatMoney } from "../../context/CurrencyContext";
import {
  defaultTourInquiryMessage,
  InquiryTourChip,
  type InquiryTourRef,
} from "./InquiryTourChip";
import { InquiryTripDates } from "./InquiryTripDates";
import { endDateFromStartAndTourDays } from "@tourpilot/shared";

type Props = {
  agencyId: string;
  agencyName: string;
  agencySlug: string;
  refCode?: string | null;
  tour?: InquiryTourRef | null;
  /** Scroll this section into view once after mount (e.g. from tour inquire link). */
  focusOnMount?: boolean;
};

export function AgencyInquirySection({
  agencyId,
  agencyName,
  agencySlug,
  refCode,
  tour,
  focusOnMount,
}: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const returnTo = currentPath(location);
  const { token, user, refreshUser } = useAuth();
  const { format } = useFormatMoney();
  const [email, setEmail] = useState("");
  const [pax, setPax] = useState(2);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budgetBand, setBudgetBand] = useState("");
  const [interests, setInterests] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [sentInquiryId, setSentInquiryId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = Boolean(token && user?.role === "TOURIST");
  const isTourInquiry = Boolean(tour);

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user?.email]);

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
      setStatus("Please log in as a tourist to send an inquiry.");
      return;
    }
    if (user?.role !== "TOURIST") {
      setStatus("Only tourist accounts can send tour inquiries.");
      return;
    }
    if (!email.trim()) {
      setStatus("Please enter your email so the agency can reach you.");
      return;
    }

    setSubmitting(true);
    setStatus("");
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
          budgetBand: budgetBand.trim() || undefined,
          interests: interests
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          message: message.trim(),
          email: email.trim(),
          refCode: refCode || undefined,
        }),
      });
      await refreshUser().catch(() => {});
      setSentInquiryId(result.id);
      setStatus("Your inquiry was sent! The agency will reply in your trip room.");
      if (!tour) {
        setMessage("");
        setInterests("");
        setBudgetBand("");
        setStartDate("");
        setEndDate("");
      }
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Failed to send inquiry");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      ref={sectionRef}
      className="agency-inquiry-section"
      id="request-custom-tour"
    >
      <div className="agency-inquiry-inner">
        <div className="agency-inquiry-layout">
          <header className="agency-inquiry-intro">
            <span className="agency-inquiry-eyebrow">
              {isTourInquiry ? "Ready-made package" : "Personalized travel"}
            </span>
            <h2>{isTourInquiry ? `Inquire about ${tour!.title}` : "Request a custom tour"}</h2>
            <p className="agency-inquiry-lead">
              {isTourInquiry ? (
                <>
                  You are inquiring about a specific tour from <strong>{agencyName}</strong>. Add
                  dates and any changes — the agency will reply in your trip room.
                </>
              ) : (
                <>
                  Tell <strong>{agencyName}</strong> what you need — dates, group size, budget, and
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
                Direct reply from the agency team
              </li>
              <li>
                <span className="agency-inquiry-trust-icon">
                  <LineCheckIcon size={14} />
                </span>
                Refine the itinerary together
              </li>
            </ul>
          </header>

          <div className="agency-inquiry-card">
            {isTourInquiry && tour && (
              <InquiryTourChip tour={tour} agencySlug={agencySlug} />
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
                  Your agency needs a way to reach you before confirming a booking.
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
                  <div className="inquiry-field">
                    <label htmlFor="inquiry-budget">
                      Budget <span className="inquiry-optional">optional</span>
                    </label>
                    <input
                      id="inquiry-budget"
                      type="text"
                      value={budgetBand}
                      onChange={(e) => setBudgetBand(e.target.value)}
                      placeholder={`e.g. ${format(150_000)} – ${format(200_000)}`}
                    />
                  </div>
                  <div className="inquiry-field">
                    <label htmlFor="inquiry-interests">Interests</label>
                    <input
                      id="inquiry-interests"
                      type="text"
                      value={interests}
                      onChange={(e) => setInterests(e.target.value)}
                      placeholder="Wildlife, beaches, tea country…"
                    />
                    <span className="inquiry-hint">Separate with commas</span>
                  </div>
                </div>
              </fieldset>

              <fieldset className="agency-inquiry-fieldset" disabled={!canSubmit}>
                <legend className="agency-inquiry-legend">
                  {isTourInquiry ? "Your message" : "Your vision"}
                </legend>
                <div className="inquiry-field inquiry-field--full">
                  <label htmlFor="inquiry-message">
                    {isTourInquiry ? "Questions or changes for this tour" : "Trip requirements"}
                  </label>
                  <textarea
                    id="inquiry-message"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      isTourInquiry
                        ? "Preferred dates, group size changes, hotel upgrades, or special requests…"
                        : "Describe your ideal trip — must-see places, pace, accommodation style, dietary needs, or special occasions…"
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
                      : "Send inquiry to agency"}
                </button>
                {canSubmit && (
                  <p className="agency-inquiry-foot">
                    Replies appear in <Link to="/trips">My trips</Link>.
                  </p>
                )}
              </div>
            </form>

            {status && (
              <p
                className={`agency-inquiry-status${
                  status.includes("sent") ? " agency-inquiry-status--success" : ""
                }`}
                role="status"
              >
                {status}
                {sentInquiryId && (
                  <>
                    {" "}
                    <Link to={`/trips/${sentInquiryId}`}>Open trip room →</Link>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
