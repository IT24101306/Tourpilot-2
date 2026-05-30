import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CoverImage } from "../components/CoverImage";
import { SaveTourButton } from "../components/tourist/SaveTourButton";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { DEFAULT_TOUR_COVER_URL } from "@tourpilot/shared";

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

export function TouristSavedPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<SavedTourItem[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!token) return;
    setLoading(true);
    api<SavedTourItem[]>("/saved-tours/mine", { token })
      .then(setItems)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [token]);

  if (loading) {
    return <p className="muted">Loading saved tours…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="guided-empty-panel">
        <h3>No saved tours yet</h3>
        <p>Tap the heart on any tour to build your wishlist.</p>
        <Link to="/agencies" className="btn btn-primary">
          Browse agencies
        </Link>
      </div>
    );
  }

  return (
    <ul className="saved-tour-grid">
      {items.map(({ tour }) => (
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
                {tour.days} days · From LKR {tour.publicPriceLkr.toLocaleString()}
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
                    if (!saved) setItems((prev) => prev.filter((i) => i.tour.id !== tour.id));
                  }}
                />
              </div>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
