import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

type Props = {
  agencyId: string;
  agencyName: string;
  refCode?: string | null;
};

export function AgencyInquirySection({ agencyId, agencyName, refCode }: Props) {
  const { token, user } = useAuth();
  const [pax, setPax] = useState(2);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budgetBand, setBudgetBand] = useState("");
  const [interests, setInterests] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = Boolean(token && user?.role === "TOURIST");

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

    setSubmitting(true);
    setStatus("");
    try {
      await api("/inquiries", {
        method: "POST",
        token,
        body: JSON.stringify({
          agencyId,
          type: "CUSTOM",
          pax,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
          budgetBand: budgetBand.trim() || undefined,
          interests: interests
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          message: message.trim() || undefined,
          refCode: refCode || undefined,
        }),
      });
      setStatus("Your inquiry was sent! View it under My trips on your profile.");
      setMessage("");
      setInterests("");
      setBudgetBand("");
      setStartDate("");
      setEndDate("");
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Failed to send inquiry");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="agency-inquiry-section" id="request-custom-tour">
      <div className="agency-inquiry-inner">
        <div className="agency-inquiry-layout">
          <header className="agency-inquiry-intro">
            <span className="agency-inquiry-eyebrow">Personalized travel</span>
            <h2>Request a custom tour</h2>
            <p className="agency-inquiry-lead">
              Tell <strong>{agencyName}</strong> what you need — dates, group size, budget, and
              interests — and receive a tailored proposal on your profile.
            </p>
            <ul className="agency-inquiry-trust" aria-hidden="true">
              <li>
                <span className="agency-inquiry-trust-icon">✓</span>
                No payment required to inquire
              </li>
              <li>
                <span className="agency-inquiry-trust-icon">✓</span>
                Direct reply from the agency team
              </li>
              <li>
                <span className="agency-inquiry-trust-icon">✓</span>
                Refine the itinerary together
              </li>
            </ul>
          </header>

          <div className="agency-inquiry-card">
            {!token && (
              <div className="agency-inquiry-login-banner">
                <p>
                  <Link to="/login">Log in</Link> or{" "}
                  <Link to="/register">create a free account</Link> to send your request.
                </p>
              </div>
            )}

            {token && user?.role !== "TOURIST" && (
              <div className="agency-inquiry-login-banner agency-inquiry-login-banner--warn">
                <p>Only tourist accounts can submit custom tour inquiries.</p>
              </div>
            )}

            <form className="agency-inquiry-form" onSubmit={submit}>
              <fieldset className="agency-inquiry-fieldset" disabled={!canSubmit}>
                <legend className="agency-inquiry-legend">Trip details</legend>
                <div className="agency-inquiry-grid agency-inquiry-grid--trip">
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
                  <div className="inquiry-field">
                    <label htmlFor="inquiry-start">Start date</label>
                    <input
                      id="inquiry-start"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="inquiry-field">
                    <label htmlFor="inquiry-end">End date</label>
                    <input
                      id="inquiry-end"
                      type="date"
                      value={endDate}
                      min={startDate || undefined}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
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
                      placeholder="e.g. LKR 150,000 – 200,000"
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
                <legend className="agency-inquiry-legend">Your vision</legend>
                <div className="inquiry-field inquiry-field--full">
                  <label htmlFor="inquiry-message">Trip requirements</label>
                  <textarea
                    id="inquiry-message"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your ideal trip — must-see places, pace, accommodation style, dietary needs, or special occasions…"
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
                  {submitting ? "Sending your request…" : "Send inquiry to agency"}
                </button>
                {canSubmit && (
                  <p className="agency-inquiry-foot">
                    Replies appear on your <Link to="/profile">profile</Link>.
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
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
