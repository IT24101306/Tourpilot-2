import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ModuleHeader } from "../components/module/ModuleHeader";
import {
  DiscoveryOfferCard,
  type DiscoveryOffer,
} from "../components/discovery/DiscoveryOfferCard";
import { daysUntilEnd } from "../lib/discoveryUtils";

export function OffersPage() {
  const { token, user } = useAuth();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("offer");
  const [offers, setOffers] = useState<DiscoveryOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const scrolledRef = useRef(false);

  useEffect(() => {
    setLoading(true);
    api<DiscoveryOffer[]>("/offers/active")
      .then(setOffers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!highlightId || loading || scrolledRef.current) return;
    const el = document.getElementById(`offer-${highlightId}`);
    if (!el) return;
    scrolledRef.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("disc-offer-card--highlight");
    const t = window.setTimeout(() => el.classList.remove("disc-offer-card--highlight"), 4000);
    return () => window.clearTimeout(t);
  }, [highlightId, loading, offers.length]);

  const stats = useMemo(() => {
    const endingSoon = offers.filter((o) => daysUntilEnd(o.validUntil) <= 7).length;
    const openSpots = offers.reduce((s, o) => s + o.spotsLeft, 0);
    return { total: offers.length, endingSoon, openSpots };
  }, [offers]);

  async function register(offerId: string) {
    if (!token) {
      setMsg("Log in to register for offers.");
      return;
    }
    try {
      await api(`/offers/${offerId}/register`, { method: "POST", token });
      setMsg("You are registered — your agency will follow up.");
      const refreshed = await api<DiscoveryOffer[]>("/offers/active");
      setOffers(refreshed);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Registration failed");
    }
  }

  return (
    <section className="section module-shell module-discovery offers-page">
      <ModuleHeader
        module="discovery"
        title="Limited offers"
        subtitle="Transparent tour pricing with rewards and countdown — no hidden surprises."
      >
        {!user && (
          <Link to="/login" className="btn btn-teal">
            Log in to register
          </Link>
        )}
      </ModuleHeader>

      {!loading && offers.length > 0 && (
        <div className="offers-stat-row">
          <div className="offers-stat">
            <span className="offers-stat-value">{stats.total}</span>
            <span className="offers-stat-label">Active offers</span>
          </div>
          <div className="offers-stat">
            <span className="offers-stat-value">{stats.endingSoon}</span>
            <span className="offers-stat-label">Ending within 7 days</span>
          </div>
          <div className="offers-stat">
            <span className="offers-stat-value">{stats.openSpots}</span>
            <span className="offers-stat-label">Spots available</span>
          </div>
        </div>
      )}

      {msg && <p className="disc-status-msg offers-status-msg">{msg}</p>}

      {loading ? (
        <p className="muted offers-loading">Loading offers…</p>
      ) : offers.length === 0 ? (
        <div className="disc-empty offers-empty">
          <p>No active offers right now. Check back soon or browse agencies.</p>
          <Link to="/agencies" className="btn btn-primary">
            Explore agencies
          </Link>
        </div>
      ) : (
        <div className="disc-offer-grid disc-offer-grid--page">
          {offers.map((o) => (
            <DiscoveryOfferCard
              key={o.id}
              offer={o}
              page
              cardId={`offer-${o.id}`}
              onRegister={token ? () => register(o.id) : undefined}
              registerLabel={token ? "Register for offer" : "Log in to register"}
            />
          ))}
        </div>
      )}
    </section>
  );
}
