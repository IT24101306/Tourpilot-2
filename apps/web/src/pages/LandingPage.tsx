import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { DiscoveryPathStrip } from "../components/discovery/DiscoveryPathStrip";
import {
  DiscoveryAgencyCard,
  type DiscoveryAgency,
} from "../components/discovery/DiscoveryAgencyCard";
import { DiscoveryOfferCard, type DiscoveryOffer } from "../components/discovery/DiscoveryOfferCard";

type CmsBlock = {
  type?: string;
  headline?: string;
  lead?: string;
  tags?: string[];
  badge?: string;
  title?: string;
  subtitle?: string;
};

type CmsPage = {
  slug: string;
  title: string;
  blocks: CmsBlock[] | unknown;
};

const DEFAULT_HERO = {
  tags: ["Sri Lanka", "Verified agencies", "Custom itineraries"],
  badge: "Inspired exploration",
  headline: "Navigate the island with confidence",
  lead:
    "Discover curated tours, compare agencies, and receive transparent itineraries with optional add-ons and prices — built for modern travelers.",
};

const DEFAULT_FEATURED = {
  title: "Start with trusted operators",
  subtitle: "Highly rated teams ready to craft your Sri Lanka journey.",
};

function asBlocks(raw: unknown): CmsBlock[] {
  return Array.isArray(raw) ? (raw as CmsBlock[]) : [];
}

export function LandingPage() {
  const [agencies, setAgencies] = useState<DiscoveryAgency[]>([]);
  const [endingSoon, setEndingSoon] = useState<DiscoveryOffer[]>([]);
  const [cms, setCms] = useState<CmsPage | null>(null);

  useEffect(() => {
    api<DiscoveryAgency[]>("/agencies").then(setAgencies).catch(console.error);
    api<DiscoveryOffer[]>("/offers/ending-soon?limit=3").then(setEndingSoon).catch(console.error);
    api<CmsPage>("/cms/home")
      .then(setCms)
      .catch(() => setCms(null));
  }, []);

  const blocks = asBlocks(cms?.blocks);
  const heroBlock = blocks.find((b) => b.type === "hero");
  const featuredBlock = blocks.find((b) => b.type === "featured_agencies");

  const hero = {
    tags: heroBlock?.tags?.length ? heroBlock.tags : DEFAULT_HERO.tags,
    badge: heroBlock?.badge?.trim() || DEFAULT_HERO.badge,
    headline: heroBlock?.headline?.trim() || DEFAULT_HERO.headline,
    lead: heroBlock?.lead?.trim() || DEFAULT_HERO.lead,
  };
  const featuredCopy = {
    title: featuredBlock?.title?.trim() || DEFAULT_FEATURED.title,
    subtitle: featuredBlock?.subtitle?.trim() || DEFAULT_FEATURED.subtitle,
  };

  const featured = agencies.slice(0, 3);

  return (
    <div className="module-discovery">
      <section
        className={`hero-image hero-image--landing${endingSoon.length > 0 ? " hero-image--has-offers" : ""}`}
      >
        <div className="hero-image-top">
          <div className="hero-tags">
            {hero.tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
          <span className="disc-hero-badge">{hero.badge}</span>
          <h1>{hero.headline}</h1>
          <p className="hero-image-lead">{hero.lead}</p>
        </div>

        {endingSoon.length > 0 && (
          <div className="hero-offers disc-hero-offers">
            <div className="hero-offers-head">
              <span className="hero-offers-label">Ending soon</span>
              <Link to="/offers" className="hero-offers-link">
                View all offers
              </Link>
            </div>
            <div className="disc-offer-grid disc-offer-grid--hero">
              {endingSoon.map((o) => (
                <Link key={o.id} to="/offers" className="disc-offer-card-link">
                  <DiscoveryOfferCard offer={o} compact hero />
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="hero-actions">
          <Link to="/offers" className="btn btn-teal">
            View offers
          </Link>
          <Link to="/register" className="btn btn-ghost">
            Sign up free
          </Link>
        </div>
      </section>

      <section className="section disc-path-section">
        <DiscoveryPathStrip />
      </section>

      <section className="section module-shell">
        <div className="disc-section-head">
          <div>
            <span className="module-badge module-badge--discovery">Featured agencies</span>
            <h2 className="section-title">{featuredCopy.title}</h2>
            <p className="muted">{featuredCopy.subtitle}</p>
          </div>
        </div>

        {featured.length === 0 ? (
          <p className="muted">Loading featured agencies…</p>
        ) : (
          <div className="disc-agency-grid">
            {featured.map((a, i) => (
              <DiscoveryAgencyCard key={a.id} agency={a} featured={i === 0} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
