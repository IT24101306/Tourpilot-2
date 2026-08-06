import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { TripPlannerPace, TripPlannerResult } from "@tourpilot/shared";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ModuleHeader } from "../components/module/ModuleHeader";
import { currentPath, loginPath } from "../utils/authRedirect";
import {
  agencyInquiryHandoffPath,
  formatTripPlanHandoffMessage,
  saveChatHandoff,
} from "../lib/chatHandoff";

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

function parsePrefillInterests(raw: string | null): string[] {
  if (!raw?.trim()) return ["Beaches", "Culture & temples"];
  const parts = raw
    .split(/[|,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
  return parts.length ? parts : ["Beaches", "Culture & temples"];
}

export function TripPlannerPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnPath = currentPath(location);

  const [days, setDays] = useState(() => {
    const n = Number(searchParams.get("days"));
    return Number.isFinite(n) && n >= 1 && n <= 30 ? Math.round(n) : 7;
  });
  const [pax, setPax] = useState(() => {
    const n = Number(searchParams.get("pax"));
    return Number.isFinite(n) && n >= 1 && n <= 50 ? Math.round(n) : 2;
  });
  const [interests, setInterests] = useState<string[]>(() =>
    parsePrefillInterests(searchParams.get("interests"))
  );
  const [pace, setPace] = useState<TripPlannerPace>("balanced");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [startDate, setStartDate] = useState("");
  const [notes, setNotes] = useState(() => searchParams.get("notes")?.slice(0, 2000) || "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TripPlannerResult | null>(null);

  useEffect(() => {
    const d = Number(searchParams.get("days"));
    if (Number.isFinite(d) && d >= 1 && d <= 30) setDays(Math.round(d));
    const p = Number(searchParams.get("pax"));
    if (Number.isFinite(p) && p >= 1 && p <= 50) setPax(Math.round(p));
    if (searchParams.has("interests")) {
      setInterests(parsePrefillInterests(searchParams.get("interests")));
    }
    if (searchParams.has("notes")) {
      setNotes(searchParams.get("notes")?.slice(0, 2000) || "");
    }
  }, [searchParams]);

  const interestSet = useMemo(() => new Set(interests), [interests]);

  function toggleInterest(label: string) {
    setInterests((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    );
  }

  function inquireWithPlan(opts: { agencySlug: string; tourId?: string }) {
    if (!result) return;
    const message = formatTripPlanHandoffMessage(result);
    saveChatHandoff({
      agencySlug: opts.agencySlug,
      tourId: opts.tourId,
      pax,
      days,
      interests,
      message,
      createdAt: new Date().toISOString(),
    });
    const target = agencyInquiryHandoffPath(opts.agencySlug, { tourId: opts.tourId });
    if (!user) {
      navigate(loginPath(target));
      return;
    }
    if (user.role !== "TOURIST") return;
    navigate(target);
  }

  function primaryAgencySlug(): string | null {
    if (!result) return null;
    if (result.draftTripPlan?.agencySlug) return result.draftTripPlan.agencySlug;
    const pkg = result.packages?.find((p) => p.agencySlug);
    return pkg?.agencySlug || null;
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
                    <div className="trip-planner-package-actions">
                      {pkg.agencySlug && (
                        <Link to={`/agencies/${pkg.agencySlug}`} className="text-link">
                          View agency
                        </Link>
                      )}
                      {pkg.tourSlug && pkg.agencySlug && (
                        <Link
                          to={`/tours/${pkg.agencySlug}/${pkg.tourSlug}`}
                          className="text-link"
                        >
                          View tour
                        </Link>
                      )}
                      {pkg.agencySlug && (
                        <button
                          type="button"
                          className="btn btn-teal trip-planner-inquire-btn"
                          onClick={() =>
                            inquireWithPlan({
                              agencySlug: pkg.agencySlug!,
                              tourId: pkg.tourId,
                            })
                          }
                        >
                          Inquire
                        </button>
                      )}
                    </div>
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
              primaryAgencySlug() ? (
                <button
                  type="button"
                  className="btn btn-teal"
                  onClick={() => inquireWithPlan({ agencySlug: primaryAgencySlug()! })}
                >
                  Send this plan as an inquiry
                </button>
              ) : (
                <p className="muted">
                  No matching agency yet — ask the Ask chat for packages, or browse agencies to
                  inquire.
                </p>
              )
            ) : (
              <p className="muted">Switch to a tourist account to send this plan as an inquiry.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
