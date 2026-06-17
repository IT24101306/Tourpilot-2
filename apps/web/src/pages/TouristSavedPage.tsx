import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CoverImage } from "../components/CoverImage";
import { FormatLkr } from "../components/currency/FormatLkr";
import { SaveTourButton } from "../components/tourist/SaveTourButton";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { DEFAULT_TOUR_COVER_URL } from "@tourpilot/shared";
import type { SerializedTripPlan } from "../lib/buildTripTypes";
import "../styles/build-my-trip.css";

export type SavedTourItem = {
  id: string;
  savedAt: string;
  tour: {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    days: number;
    publicPriceLkr: number;
    coverUrl: string | null;
    agency: { id: string; name: string; slug: string };
    tourPath: string;
  };
};

export type SavedTripPlanItem = {
  id: string;
  title: string;
  plan: SerializedTripPlan;
  estimatedTotalLkr: number | null;
  savedAt: string;
  updatedAt: string;
  agency: { id: string; name: string; slug: string };
  buildPath: string;
};

type SavedTab = "tours" | "plans";

export function TouristSavedPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<SavedTab>("tours");
  const [tourItems, setTourItems] = useState<SavedTourItem[]>([]);
  const [planItems, setPlanItems] = useState<SavedTripPlanItem[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!token) return;
    setLoading(true);
    Promise.all([
      api<SavedTourItem[]>("/saved-tours/mine", { token }),
      api<SavedTripPlanItem[]>("/saved-trip-plans/mine", { token }),
    ])
      .then(([tours, plans]) => {
        setTourItems(tours);
        setPlanItems(plans);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [token]);

  async function removePlan(id: string) {
    if (!token) return;
    await api(`/saved-trip-plans/${id}`, { method: "DELETE", token });
    setPlanItems((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) {
    return <p className="muted">Loading saved items…</p>;
  }

  const empty = tab === "tours" ? tourItems.length === 0 : planItems.length === 0;

  return (
    <div className="build-trip__saved-plans">
      <div className="saved-tabs" role="tablist" aria-label="Saved items">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "tours"}
          className={`saved-tab${tab === "tours" ? " is-active" : ""}`}
          onClick={() => setTab("tours")}
        >
          Saved tours ({tourItems.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "plans"}
          className={`saved-tab${tab === "plans" ? " is-active" : ""}`}
          onClick={() => setTab("plans")}
        >
          My trip plans ({planItems.length})
        </button>
      </div>

      {empty ? (
        <div className="guided-empty-panel">
          <h3>{tab === "tours" ? "No saved tours yet" : "No saved trip plans yet"}</h3>
          <p>
            {tab === "tours"
              ? "Tap the heart on any tour to build your wishlist."
              : "Build a custom itinerary on an agency page and save it to favourites."}
          </p>
          <Link to="/agencies" className="btn btn-primary">
            Browse agencies
          </Link>
        </div>
      ) : tab === "tours" ? (
        <ul className="saved-tour-grid">
          {tourItems.map(({ tour }) => (
            <li key={tour.id}>
              <article className="saved-tour-card">
                <Link to={tour.tourPath} className="saved-tour-card-media">
                  <CoverImage
                    src={tour.coverUrl ?? DEFAULT_TOUR_COVER_URL}
                    className="saved-tour-card-cover"
                  />
                </Link>
                <div className="saved-tour-card-body">
                  <p className="saved-tour-card-agency muted">{tour.agency.name}</p>
                  <h3>
                    <Link to={tour.tourPath}>{tour.title}</Link>
                  </h3>
                  <p className="saved-tour-card-meta muted">
                    {tour.days} days · <FormatLkr amount={tour.publicPriceLkr} prefix="from" />
                  </p>
                  {tour.summary && <p className="saved-tour-card-summary">{tour.summary}</p>}
                  <div className="saved-tour-card-actions">
                    <Link to={tour.tourPath} className="btn btn-teal">
                      View tour
                    </Link>
                    <SaveTourButton
                      tourId={tour.id}
                      showLabel
                      onChange={(saved) => {
                        if (!saved) setTourItems((prev) => prev.filter((i) => i.tour.id !== tour.id));
                      }}
                    />
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="saved-tour-grid">
          {planItems.map((item) => (
            <li key={item.id}>
              <article className="build-trip-plan-card">
                <p className="muted">{item.agency.name}</p>
                <h3>{item.title}</h3>
                <p className="muted">
                  {item.plan.days.length} day{item.plan.days.length === 1 ? "" : "s"}
                  {item.estimatedTotalLkr != null && (
                    <>
                      {" "}
                      · <FormatLkr amount={item.estimatedTotalLkr} />
                    </>
                  )}
                </p>
                <p className="muted" style={{ fontSize: "0.85rem" }}>
                  Saved {new Date(item.savedAt).toLocaleDateString()}
                </p>
                <div className="build-trip-plan-card-actions">
                  <Link to={item.buildPath} className="btn btn-teal">
                    Open builder
                  </Link>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void removePlan(item.id)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
