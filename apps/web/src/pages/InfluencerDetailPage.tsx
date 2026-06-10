import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CoverImage } from "../components/CoverImage";
import { DEFAULT_TOUR_COVER_URL } from "@tourpilot/shared";
import { FormatLkr } from "../components/currency/FormatLkr";
import {
  DiscoveryOfferCard,
  type DiscoveryOffer,
} from "../components/discovery/DiscoveryOfferCard";
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
  offers: DiscoveryOffer[];
};

export function InfluencerDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [store, setStore] = useState<Storefront | null>(null);
  const [missing, setMissing] = useState(false);
  const [shareMsg, setShareMsg] = useState("");

  useEffect(() => {
    if (!slug) return;
    setMissing(false);
    api<Storefront>(`/influencers/${slug}`)
      .then((data) => setStore({ ...data, offers: data.offers ?? [] }))
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

  const storefront = store;
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  async function sharePage() {
    if (!pageUrl) return;
    setShareMsg("");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: `${storefront.name} — ${storefront.headline}`,
          text: storefront.tagline,
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
          <p className="influencer-display-eyebrow">{storefront.name}</p>
          <h1>{storefront.headline}</h1>
          <p className="influencer-display-lead">{storefront.tagline}</p>
          {storefront.bio && <p className="influencer-display-bio muted">{storefront.bio}</p>}
          <div className="influencer-display-hero-actions">
            <button type="button" className="btn btn-primary" onClick={() => void sharePage()}>
              Share this page
            </button>
            {shareMsg && <span className="influencer-display-share-msg">{shareMsg}</span>}
          </div>
        </div>

        {(storefront.offers?.length ?? 0) > 0 && (
          <section className="influencer-display-packages influencer-display-offers">
            <h2>Special offers</h2>
            <div className="disc-offer-grid disc-offer-grid--page influencer-display-offer-grid">
              {storefront.offers.map((o) => (
                <DiscoveryOfferCard
                  key={o.id}
                  offer={o}
                  page
                  cardId={`offer-${o.id}`}
                  onRegister={() => navigate(`/offers?offer=${o.id}`)}
                  registerLabel="Register for offer"
                />
              ))}
            </div>
          </section>
        )}

        <section className="influencer-display-packages">
          <h2>Featured tours</h2>
          {storefront.tours.length === 0 ? (
            <p className="muted">No tours featured yet. Check back soon.</p>
          ) : (
            <div className="influencer-display-grid">
              {storefront.tours.map((t) => (
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
                      {t.days} days · <FormatLkr amount={t.publicPriceLkr} prefix="from" />
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
