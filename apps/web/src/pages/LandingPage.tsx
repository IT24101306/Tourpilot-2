import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { DiscoveryPathStrip } from "../components/discovery/DiscoveryPathStrip";
import {
  DiscoveryAgencyCard,
  type DiscoveryAgency,
} from "../components/discovery/DiscoveryAgencyCard";
import { DiscoveryOfferCard, type DiscoveryOffer } from "../components/discovery/DiscoveryOfferCard";

export function LandingPage() {
  const [agencies, setAgencies] = useState<DiscoveryAgency[]>([]);
  const [endingSoon, setEndingSoon] = useState<DiscoveryOffer[]>([]);

  useEffect(() => {
    api<DiscoveryAgency[]>("/agencies").then(setAgencies).catch(console.error);
    api<DiscoveryOffer[]>("/offers/ending-soon?limit=3").then(setEndingSoon).catch(console.error);
  }, []);

  const featured = agencies.slice(0, 3);

  return (
    <div className="module-discovery">
      <section className={`hero-image hero-image--landing${endingSoon.length > 0 ? " hero-image--has-offers" : ""}`}>
        <div className="hero-image-top">
          <div className="hero-tags">
            <span className="tag">Sri Lanka</span>
            <span className="tag">Verified agencies</span>
            <span className="tag">Custom itineraries</span>
          </div>
          <span className="disc-hero-badge">Inspired exploration</span>
          <h1>Navigate the island with confidence</h1>
          <p className="hero-image-lead">
            Discover curated tours, compare agencies, and receive transparent itineraries with optional
            add-ons and prices — built for modern travelers.
          </p>
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
            <h2 className="section-title">Start with trusted operators</h2>
            <p className="muted">Highly rated teams ready to craft your Sri Lanka journey.</p>
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
