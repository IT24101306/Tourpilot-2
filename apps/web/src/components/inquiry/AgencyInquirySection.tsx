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
      setStatus("Your inquiry was sent! The agency will reply on your profile.");
      setMessage("");
      setInterests("");
      setBudgetBand("");
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Failed to send inquiry");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="agency-inquiry-section" id="request-custom-tour">
      <div className="agency-inquiry-inner">
        <h2>Request a custom tour</h2>
        <p className="agency-inquiry-lead">
          Tell {agencyName} what you need — dates, group size, budget, and interests — and they will
          send a tailored proposal to your profile.
        </p>

        {!token && (
          <p className="agency-inquiry-login-hint">
            <Link to="/login">Log in</Link> as a tourist to submit an inquiry.
          </p>
        )}

        <form className="agency-inquiry-form" onSubmit={submit}>
          <div className="agency-inquiry-grid">
            <label>
              Travelers
              <input
                type="number"
                min={1}
                value={pax}
                onChange={(e) => setPax(Number(e.target.value))}
                required
                disabled={!token}
              />
            </label>
            <label>
              Start date
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={!token}
              />
            </label>
            <label>
              End date
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={!token}
              />
            </label>
            <label>
              Budget (optional)
              <input
                type="text"
                value={budgetBand}
                onChange={(e) => setBudgetBand(e.target.value)}
                placeholder="e.g. LKR 150,000 – 200,000"
                disabled={!token}
              />
            </label>
            <label className="full">
              Interests (comma-separated)
              <input
                type="text"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="Wildlife, beaches, tea country…"
                disabled={!token}
              />
            </label>
            <label className="full">
              Your requirements
              <textarea
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your ideal trip, must-see places, pace, accommodation preferences…"
                required
                disabled={!token}
              />
            </label>
          </div>
          <button type="submit" className="btn btn-gold agency-inquiry-submit" disabled={submitting || !token}>
            {submitting ? "Sending…" : "Send inquiry to agency"}
          </button>
          {status && <p className="agency-inquiry-status">{status}</p>}
          {token && user?.role === "TOURIST" && (
            <p className="muted agency-inquiry-foot">
              Replies appear on your <Link to="/profile">profile</Link>.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
