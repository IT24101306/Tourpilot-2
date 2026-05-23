import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api/client";

type AgencyCard = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  coverUrl: string | null;
  avgRating: number;
  reviewCount: number;
  tourCount: number;
};

type Offer = {
  id: string;
  title: string;
  rewardText: string;
  tourPriceLkr: number;
  discountedLkr: number | null;
  spotsLeft: number;
  validUntil: string;
};

export function LandingPage() {
  const [agencies, setAgencies] = useState<AgencyCard[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    api<AgencyCard[]>("/agencies").then(setAgencies).catch(console.error);
    api<Offer[]>("/offers/active").then(setOffers).catch(console.error);
  }, []);

  return (
    <>
      <section className="hero-image">
        <div className="hero-tags">
          <span className="tag">Sri Lanka</span>
          <span className="tag">Verified agencies</span>
          <span className="tag">Custom itineraries</span>
        </div>
        <h1>Navigate the island with confidence</h1>
        <p>
          Discover curated tours, compare agencies, and receive transparent itineraries with optional
          add-ons and prices — built for modern travelers.
        </p>
        <Link to="/agencies" className="btn btn-teal">
          Explore agencies
        </Link>
      </section>

      {offers[0] && (
        <section className="section">
          <div className="offer-banner">
            <h2 style={{ margin: "0 0 8px" }}>{offers[0].title}</h2>
            <p style={{ margin: "0 0 8px", opacity: 0.95 }}>{offers[0].rewardText}</p>
            <p style={{ margin: 0 }}>
              Tour price: <strong>LKR {offers[0].tourPriceLkr.toLocaleString()}</strong>
              {offers[0].discountedLkr != null && (
                <> → <strong>LKR {offers[0].discountedLkr.toLocaleString()}</strong></>
              )}
            </p>
            <p className="countdown" style={{ marginTop: 12 }}>
              {offers[0].spotsLeft} spots left
            </p>
            <Link to="/offers" className="btn btn-ghost" style={{ marginTop: 12, background: "#fff" }}>
              View offers
            </Link>
          </div>
        </section>
      )}

      <section className="section">
        <h2 className="section-title">Featured agencies</h2>
        <div className="grid-3">
          {agencies.map((a) => (
            <Link key={a.id} to={`/agencies/${a.slug}`} className="card" style={{ textDecoration: "none" }}>
              <div
                className="card-cover"
                style={{
                  backgroundImage: `url(${a.coverUrl || "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800"})`,
                }}
              />
              <div className="card-body">
                <h3>{a.name}</h3>
                <p className="muted">{a.tagline || "Curated Sri Lanka experiences"}</p>
                <p className="muted">
                  ★ {a.avgRating} · {a.reviewCount} reviews · {a.tourCount} tours
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
