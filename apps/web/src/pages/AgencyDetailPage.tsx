import { FormEvent, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

type Tour = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  days: number;
  basePriceLkr: number;
  coverUrl: string | null;
};

type Agency = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  gallery: string[] | null;
  avgRating: number;
  reviewCount: number;
  tours: Tour[];
  reviews: { authorName: string; rating: number; body: string | null }[];
};

export function AgencyDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref");
  const { token, user } = useAuth();
  const [agency, setAgency] = useState<Agency | null>(null);
  const [showInquiry, setShowInquiry] = useState(false);
  const [message, setMessage] = useState("");
  const [pax, setPax] = useState(2);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!slug) return;
    api<Agency>(`/agencies/${slug}`).then(setAgency).catch(console.error);
    if (refCode) {
      api("/influencer/track/" + refCode, {
        method: "POST",
        body: JSON.stringify({ sessionId: crypto.randomUUID() }),
      }).catch(() => {});
    }
  }, [slug, refCode]);

  async function submitInquiry(e: FormEvent, tourId?: string) {
    e.preventDefault();
    if (!token || !agency) {
      setStatus("Please log in as a tourist to inquire.");
      return;
    }
    try {
      await api("/inquiries", {
        method: "POST",
        token,
        body: JSON.stringify({
          agencyId: agency.id,
          tourId,
          type: tourId ? "READY_MADE" : "CUSTOM",
          pax,
          message,
          refCode: refCode || undefined,
        }),
      });
      setStatus("Inquiry sent! The agency will build your itinerary.");
      setShowInquiry(false);
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Failed to send inquiry");
    }
  }

  if (!agency) return <section className="section">Loading…</section>;

  const gallery = (agency.gallery as string[]) || [];

  return (
    <div style={{ background: "var(--paper)" }}>
      <header className="topbar" style={{ background: "rgba(236,236,233,.9)" }}>
        <Link to="/" className="brand">
          Tour<span style={{ color: "var(--gold)" }}>Pilot</span>
        </Link>
        <Link to="/agencies" className="btn btn-ghost">
          All agencies
        </Link>
      </header>

      <section className="section" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: 8 }}>{agency.name}</h1>
        <p className="muted">
          ★ {agency.avgRating} · {agency.reviewCount} reviews
        </p>
        <p style={{ margin: "16px 0", maxWidth: 720 }}>{agency.description}</p>

        {gallery.length > 0 && (
          <div className="grid-3" style={{ marginBottom: 24 }}>
            {gallery.slice(0, 3).map((url) => (
              <div key={url} className="card-cover" style={{ height: 200, backgroundImage: `url(${url})` }} />
            ))}
          </div>
        )}

        <button type="button" className="btn btn-gold" onClick={() => setShowInquiry(true)}>
          Send inquiry
        </button>

        {showInquiry && (
          <form className="panel" style={{ marginTop: 20 }} onSubmit={(e) => submitInquiry(e)}>
            <h3>Custom tour inquiry</h3>
            <div className="form-grid">
              <label>Travelers</label>
              <input
                type="number"
                min={1}
                value={pax}
                onChange={(e) => setPax(Number(e.target.value))}
              />
              <label>Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Dates, interests, budget…"
              />
              <button type="submit" className="btn btn-primary">
                Submit inquiry
              </button>
            </div>
          </form>
        )}
        {status && <p style={{ marginTop: 12, fontWeight: 700 }}>{status}</p>}

        <h2 className="section-title" style={{ marginTop: 40 }}>
          Ready-made tours
        </h2>
        <div className="grid-3">
          {agency.tours.map((t) => (
            <div key={t.id} className="card">
              <div
                className="card-cover"
                style={{
                  backgroundImage: `url(${t.coverUrl || "https://images.unsplash.com/photo-1580619305218-8423a4bb63b2?w=800"})`,
                }}
              />
              <div className="card-body">
                <h3>{t.title}</h3>
                <p className="muted">
                  {t.days} days · {t.summary}
                </p>
                <p className="price">From LKR {t.basePriceLkr.toLocaleString()}</p>
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <Link to={`/tours/${agency.slug}/${t.slug}`} className="btn btn-ghost">
                    View details
                  </Link>
                  {user?.role === "TOURIST" && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={(e) => submitInquiry(e, t.id)}
                    >
                      Inquire
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <h2 className="section-title" style={{ marginTop: 40 }}>
          Reviews
        </h2>
        {agency.reviews.map((r, i) => (
          <div key={i} className="panel">
            <strong>{r.authorName}</strong> · {"★".repeat(r.rating)}
            <p className="muted">{r.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
