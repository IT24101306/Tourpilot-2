import { FormEvent, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { TripPlannerPace, TripPlannerResult } from "@tourpilot/shared";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ModuleHeader } from "../components/module/ModuleHeader";
import { currentPath, loginPath } from "../utils/authRedirect";

const INTEREST_OPTIONS = [
  "Beaches",
  "Wildlife",
  "Culture & temples",
  "Hill country",
  "Adventure",
  "Food",
  "Wellness",
  "Family-friendly",
] as const;

function formatLkr(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `LKR ${Math.round(n).toLocaleString()}`;
}

export function TripPlannerPage() {
  const { user } = useAuth();
  const location = useLocation();
  const returnPath = currentPath(location);

  const [days, setDays] = useState(7);
  const [pax, setPax] = useState(2);
  const [interests, setInterests] = useState<string[]>(["Beaches", "Culture & temples"]);
  const [pace, setPace] = useState<TripPlannerPace>("balanced");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [startDate, setStartDate] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TripPlannerResult | null>(null);

  const interestSet = useMemo(() => new Set(interests), [interests]);

  function toggleInterest(label: string) {
    setInterests((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const plan = await api<TripPlannerResult>("/smart/trip-planner", {
        method: "POST",
        body: JSON.stringify({
          days,
          pax,
          interests,
          pace,
          budgetMinLkr: budgetMin.trim() ? Number(budgetMin) : null,
          budgetMaxLkr: budgetMax.trim() ? Number(budgetMax) : null,
          startDate: startDate.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      setResult(plan);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Trip planner failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section module-shell trip-planner-page">
      <ModuleHeader
        module="discovery"
        title="AI Trip Planner"
        subtitle="Tell us your dates, pace, and interests — we build a Sri Lanka itinerary from live AI (no canned replies)."
      />

      <form className="trip-planner-form" onSubmit={onSubmit}>
        <div className="trip-planner-form__grid">
          <label className="field">
            <span className="field-label">Days</span>
            <input
              type="number"
              min={1}
              max={30}
              value={days}
              onChange={(e) => setDays(Number(e.target.value) || 1)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Travellers</span>
            <input
              type="number"
              min={1}
              max={50}
              value={pax}
              onChange={(e) => setPax(Number(e.target.value) || 1)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Start date (optional)</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Pace</span>
            <select
              value={pace}
              onChange={(e) => setPace(e.target.value as TripPlannerPace)}
            >
              <option value="relaxed">Relaxed</option>
              <option value="balanced">Balanced</option>
              <option value="packed">Packed</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Budget min (LKR)</span>
            <input
              type="number"
              min={0}
              placeholder="Optional"
              value={budgetMin}
              onChange={(e) => setBudgetMin(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Budget max (LKR)</span>
            <input
              type="number"
              min={0}
              placeholder="Optional"
              value={budgetMax}
              onChange={(e) => setBudgetMax(e.target.value)}
            />
          </label>
        </div>

        <fieldset className="trip-planner-interests">
          <legend className="field-label">Interests</legend>
          <div className="trip-planner-interests__list">
            {INTEREST_OPTIONS.map((label) => (
              <label key={label} className="trip-planner-chip">
                <input
                  type="checkbox"
                  checked={interestSet.has(label)}
                  onChange={() => toggleInterest(label)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span className="field-label">Notes (optional)</span>
          <textarea
            rows={3}
            maxLength={2000}
            placeholder="e.g. first visit, avoid long drives, need kid-friendly hotels…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <div className="trip-planner-form__actions">
          <button type="submit" className="btn btn-teal" disabled={loading}>
            {loading ? "Planning…" : "Generate itinerary"}
          </button>
        </div>
      </form>

      {error && (
        <div className="trip-planner-error" role="alert">
          {error}
        </div>
      )}

      {result && (
        <div className="trip-planner-result">
          <h2 className="trip-planner-result__title">Your plan</h2>
          <p className="trip-planner-result__summary">{result.summary}</p>

          {result.destinations?.length > 0 && (
            <div className="trip-planner-block">
              <h3>Destinations</h3>
              <ul className="trip-planner-dest-list">
                {result.destinations.map((d) => (
                  <li key={`${d.name}-${d.region || ""}`}>
                    <strong>{d.name}</strong>
                    {d.region ? ` · ${d.region}` : ""}
                    <span className="muted"> — {d.why}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.itinerary?.length > 0 && (
            <div className="trip-planner-block">
              <h3>Day by day</h3>
              <ol className="trip-planner-days">
                {result.itinerary.map((day) => (
                  <li key={day.dayNumber}>
                    <strong>
                      Day {day.dayNumber}: {day.title}
                    </strong>
                    {day.highlights?.length > 0 && (
                      <ul>
                        {day.highlights.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {result.packages?.length > 0 && (
            <div className="trip-planner-block">
              <h3>Matching packages</h3>
              <ul className="trip-planner-packages">
                {result.packages.map((pkg) => (
                  <li key={`${pkg.tourId || pkg.title}-${pkg.agencySlug || ""}`}>
                    <div>
                      <strong>{pkg.title}</strong>
                      {pkg.days != null ? ` · ${pkg.days} days` : ""}
                      {pkg.estimatedTotalLkr != null
                        ? ` · from ${formatLkr(pkg.estimatedTotalLkr)}`
                        : ""}
                    </div>
                    <p className="muted">{pkg.matchReason}</p>
                    {pkg.agencySlug && (
                      <Link to={`/agencies/${pkg.agencySlug}`} className="text-link">
                        View agency
                      </Link>
                    )}
                    {pkg.tourSlug && pkg.agencySlug && (
                      <>
                        {" · "}
                        <Link
                          to={`/tours/${pkg.agencySlug}/${pkg.tourSlug}`}
                          className="text-link"
                        >
                          View tour
                        </Link>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="trip-planner-handoff">
            {!user ? (
              <Link to={loginPath(returnPath)} className="btn btn-teal">
                Log in to inquire with an agency
              </Link>
            ) : user.role === "TOURIST" ? (
              <p className="muted">
                Open a matching agency or tour above, then send an inquiry — you can paste this plan
                into a custom request. Full one-click handoff lands with the chatbot pass.
              </p>
            ) : (
              <p className="muted">Switch to a tourist account to send this plan as an inquiry.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
