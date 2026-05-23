import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

type Offer = {
  id: string;
  title: string;
  description: string | null;
  rewardText: string;
  tourPriceLkr: number;
  discountedLkr: number | null;
  spotsLeft: number;
  registeredCount: number;
  validUntil: string;
};

export function OffersPage() {
  const { token } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api<Offer[]>("/offers/active").then(setOffers).catch(console.error);
  }, []);

  async function register(offerId: string) {
    if (!token) {
      setMsg("Log in to register for offers.");
      return;
    }
    try {
      await api(`/offers/${offerId}/register`, { method: "POST", token });
      setMsg("Registered successfully!");
      const refreshed = await api<Offer[]>("/offers/active");
      setOffers(refreshed);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Registration failed");
    }
  }

  return (
    <section className="section">
      <h1 className="section-title">Loyalty & offers</h1>
      <p className="muted">Tour prices are always shown. Limited spots with countdown.</p>
      {msg && <p style={{ fontWeight: 700 }}>{msg}</p>}
      <div className="grid-3">
        {offers.map((o) => {
          const ends = new Date(o.validUntil).getTime() - Date.now();
          const daysLeft = Math.max(0, Math.ceil(ends / (1000 * 60 * 60 * 24)));
          return (
            <div key={o.id} className="card">
              <div className="card-body">
                <h3>{o.title}</h3>
                <p className="muted">{o.description}</p>
                <p>
                  <strong>{o.rewardText}</strong>
                </p>
                <p className="price">
                  LKR {o.tourPriceLkr.toLocaleString()}
                  {o.discountedLkr != null && (
                    <span className="muted"> → LKR {o.discountedLkr.toLocaleString()}</span>
                  )}
                </p>
                <p className="countdown" style={{ color: "var(--green)" }}>
                  {daysLeft}d left · {o.spotsLeft} spots left
                </p>
                <p className="muted">{o.registeredCount} registered</p>
                <button type="button" className="btn btn-primary" onClick={() => register(o.id)}>
                  Register
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
