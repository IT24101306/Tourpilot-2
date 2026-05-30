import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CoverImage } from "../components/CoverImage";
import { DEFAULT_TOUR_COVER_URL } from "@tourpilot/shared";
import { api } from "../api/client";
import "../styles/influencer-display.css";

type StorefrontTour = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  days: number;
  publicPriceLkr: number;
  coverUrl: string;
  agency: { id: string; name: string; slug: string };
  refCode: string | null;
  tourPath: string;
};

type Storefront = {
  slug: string;
  name: string;
  bio: string | null;
  headline: string;
  tagline: string;
  tours: StorefrontTour[];
};

export function InfluencerDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<Storefront | null>(null);
  const [missing, setMissing] = useState(false);
  const [shareMsg, setShareMsg] = useState("");

  useEffect(() => {
    if (!slug) return;
    setMissing(false);
    api<Storefront>(`/influencers/${slug}`)
      .then(setStore)
      .catch(() => setMissing(true));
  }, [slug]);

  if (missing) {
    return (
      <div className="influencer-display-public">
        <div className="influencer-display-public-inner">
          <p>Creator page not found.</p>
          <Link to="/">Back to TourPilot</Link>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="influencer-display-public">
        <div className="influencer-display-public-inner muted">Loading…</div>
      </div>
    );
  }

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  async function sharePage() {
    if (!pageUrl) return;
    setShareMsg("");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: `${store.name} — ${store.headline}`,
          text: store.tagline,
          url: pageUrl,
        });
        setShareMsg("Thanks for sharing!");
      } else {
        await navigator.clipboard.writeText(pageUrl);
        setShareMsg("Link copied.");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(pageUrl);
        setShareMsg("Link copied.");
      } catch {
        setShareMsg("Could not share or copy.");
      }
    }
    setTimeout(() => setShareMsg(""), 2500);
  }

  return (
    <div className="influencer-display-public">
      <header className="topbar topbar--site">
        <Link to="/" className="brand">
          Tour<span>Pilot</span>
        </Link>
        <Link to="/agencies" className="btn btn-ghost">
          Browse agencies
        </Link>
      </header>

      <div className="influencer-display-public-inner">
        <div className="influencer-display-hero">
          <p className="influencer-display-eyebrow">{store.name}</p>
          <h1>{store.headline}</h1>
          <p className="influencer-display-lead">{store.tagline}</p>
          {store.bio && <p className="influencer-display-bio muted">{store.bio}</p>}
          <div className="influencer-display-hero-actions">
            <button type="button" className="btn btn-primary" onClick={() => void sharePage()}>
              Share this page
            </button>
            {shareMsg && <span className="influencer-display-share-msg">{shareMsg}</span>}
          </div>
        </div>

        <section className="influencer-display-packages">
          <h2>Featured tours</h2>
          {store.tours.length === 0 ? (
            <p className="muted">No tours featured yet. Check back soon.</p>
          ) : (
            <div className="influencer-display-grid">
              {store.tours.map((t) => (
                <Link key={t.id} to={t.tourPath} className="influencer-display-card">
                  <CoverImage
                    src={t.coverUrl}
                    fallback={DEFAULT_TOUR_COVER_URL}
                    className="influencer-display-card-cover"
                  />
                  <div className="influencer-display-card-body">
                    <span className="influencer-display-card-agency">{t.agency.name}</span>
                    <h3>{t.title}</h3>
                    <p className="muted">
                      {t.days} days · from LKR {t.publicPriceLkr.toLocaleString()}
                    </p>
                    {t.summary && <p className="influencer-display-card-summary">{t.summary}</p>}
                    <span className="influencer-display-card-cta">View tour →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
