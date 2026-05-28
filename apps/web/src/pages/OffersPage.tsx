import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ModuleHeader } from "../components/module/ModuleHeader";
import {
  DiscoveryOfferCard,
  type DiscoveryOffer,
} from "../components/discovery/DiscoveryOfferCard";

export function OffersPage() {
  const { token, user } = useAuth();
  const [offers, setOffers] = useState<DiscoveryOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setLoading(true);
    api<DiscoveryOffer[]>("/offers/active")
      .then(setOffers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
    <section className="section module-shell module-discovery">
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

      {msg && <p className="disc-status-msg">{msg}</p>}

      {loading ? (
        <p className="muted">Loading offers…</p>
      ) : offers.length === 0 ? (
        <div className="disc-empty">
          <p>No active offers right now. Check back soon or browse agencies.</p>
          <Link to="/agencies" className="btn btn-primary">
            Explore agencies
          </Link>
        </div>
      ) : (
        <div className="disc-offer-grid">
          {offers.map((o) => (
            <DiscoveryOfferCard
              key={o.id}
              offer={o}
              onRegister={token ? () => register(o.id) : undefined}
              registerLabel={token ? "Register for offer" : "Log in to register"}
            />
          ))}
        </div>
      )}
    </section>
  );
}
