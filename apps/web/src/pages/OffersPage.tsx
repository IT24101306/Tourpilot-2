import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { currentPath, loginPath } from "../utils/authRedirect";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ModuleHeader } from "../components/module/ModuleHeader";
import {
  DiscoveryOfferCard,
  type DiscoveryOffer,
} from "../components/discovery/DiscoveryOfferCard";
import { OfferRegistrationModal } from "../components/discovery/OfferRegistrationModal";
import { daysUntilEnd } from "../lib/discoveryUtils";

export function OffersPage() {
  const { token, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("offer");
  const [offers, setOffers] = useState<DiscoveryOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [registerOffer, setRegisterOffer] = useState<DiscoveryOffer | null>(null);
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

  async function refreshOffers() {
    const refreshed = await api<DiscoveryOffer[]>("/offers/active");
    setOffers(refreshed);
  }

  return (
    <section className="section module-shell module-discovery offers-page">
      <ModuleHeader
        module="discovery"
        title="Limited offers"
        subtitle="Transparent tour pricing with rewards and countdown — no hidden surprises."
      >
        {!user && (
          <Link to={loginPath(currentPath(location))} className="btn btn-teal">
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
              onRegister={() => {
                if (!token) {
                  navigate(loginPath(`/offers?offer=${o.id}`));
                  return;
                }
                setRegisterOffer(o);
              }}
              registerLabel={token ? "Register for offer" : "Log in to register"}
            />
          ))}
        </div>
      )}

      <OfferRegistrationModal
        open={!!registerOffer}
        offer={registerOffer}
        token={token}
        onClose={() => setRegisterOffer(null)}
        onSuccess={() => {
          setMsg("You are registered — your agency will follow up.");
          void refreshOffers().catch(console.error);
        }}
      />
    </section>
  );
}
