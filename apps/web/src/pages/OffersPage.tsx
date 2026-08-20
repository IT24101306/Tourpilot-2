import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { currentPath, loginPath } from "../utils/authRedirect";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ModuleHeader } from "../components/module/ModuleHeader";
import { EmptyState } from "../components/feedback/EmptyState";
import {
  DiscoveryOfferCard,
  type DiscoveryOffer,
} from "../components/discovery/DiscoveryOfferCard";
import { offerBookPath } from "../lib/offerBookPaths";
import { daysUntilEnd } from "../lib/discoveryUtils";
import { usePublicSmartFeatures } from "../lib/publicSmartFeatures";

export function OffersPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { publicOffersEnabled, loaded: flagsLoaded } = usePublicSmartFeatures();
  const highlightId = searchParams.get("offer");
  const [offers, setOffers] = useState<DiscoveryOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const scrolledRef = useRef(false);
  const returnPath = currentPath(location);

  useEffect(() => {
    if (!publicOffersEnabled) {
      setOffers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api<DiscoveryOffer[]>("/offers/active")
      .then(setOffers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [publicOffersEnabled]);

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

  function openOfferBook(offer: DiscoveryOffer) {
    navigate(offerBookPath(offer.id, returnPath));
  }

  return (
    <section className="section module-shell module-discovery offers-page">
      <ModuleHeader
        module="discovery"
        title="Limited offers"
        subtitle="Transparent tour pricing with rewards and countdown — no hidden surprises."
      >
        {!user && publicOffersEnabled && (
          <Link to={loginPath(returnPath)} className="btn btn-teal">
            Log in to book
          </Link>
        )}
      </ModuleHeader>

      {flagsLoaded && !publicOffersEnabled ? (
        <p className="muted">
          Public offers are currently turned off. Browse agencies and tours, or send an inquiry
          from an agency page.
        </p>
      ) : (
      <>
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


      {loading ? (
        <p className="muted offers-loading">Loading offers…</p>
      ) : offers.length === 0 ? (
        <EmptyState
          title="No active offers right now"
          description="Limited campaigns rotate through the season. Browse agency storefronts meanwhile, or check back soon."
          action={{ label: "Back to home", to: "/" }}
          className="offers-empty"
        />
      ) : (
        <div className="disc-offer-grid disc-offer-grid--page">
          {offers.map((o) => (
            <DiscoveryOfferCard
              key={o.id}
              offer={o}
              page
              cardId={`offer-${o.id}`}
              onRegister={() => openOfferBook(o)}
              registerLabel="Book now"
            />
          ))}
        </div>
      )}
      </>
      )}
    </section>
  );
}
