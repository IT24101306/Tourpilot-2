import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";

export function TourDetailPage() {
  const { agencySlug, tourSlug } = useParams<{ agencySlug: string; tourSlug: string }>();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref");
  const [tour, setTour] = useState<Awaited<ReturnType<typeof loadTour>> | null>(null);

  async function loadTour() {
    return api<{
      title: string;
      summary: string | null;
      description: string | null;
      days: number;
      basePriceLkr: number;
      seasonTag: string | null;
      agency: { name: string; slug: string };
      tourDays: Array<{
        dayNumber: number;
        title: string | null;
        items: Array<{
          kind: string;
          label: string | null;
          priceLkr: number | null;
          entity: { name: string } | null;
        }>;
      }>;
    }>(`/tours/public/${agencySlug}/${tourSlug}`);
  }

  useEffect(() => {
    if (agencySlug && tourSlug) loadTour().then(setTour).catch(console.error);
  }, [agencySlug, tourSlug]);

  useEffect(() => {
    if (!refCode) return;
    api("/influencer/track/" + refCode, {
      method: "POST",
      body: JSON.stringify({ sessionId: "web-" + Date.now() }),
    }).catch(() => {});
  }, [refCode]);

  if (!tour) return <section className="section">Loading…</section>;

  return (
    <section className="section" style={{ maxWidth: 900, margin: "0 auto" }}>
      <Link to={`/agencies/${tour.agency.slug}`} className="muted">
        ← {tour.agency.name}
      </Link>
      <h1 style={{ margin: "12px 0" }}>{tour.title}</h1>
      <p className="price" style={{ fontSize: "1.25rem" }}>
        From LKR {tour.basePriceLkr.toLocaleString()}
      </p>
      {tour.seasonTag && <p className="muted">Best season: {tour.seasonTag}</p>}
      <p style={{ marginTop: 16 }}>{tour.description || tour.summary}</p>

      <h2 className="section-title">Itinerary with optional add-ons</h2>
      {tour.tourDays.map((day) => (
        <div key={day.dayNumber} className="panel">
          <h3>
            Day {day.dayNumber}
            {day.title ? ` — ${day.title}` : ""}
          </h3>
          <ul style={{ paddingLeft: 20 }}>
            {day.items.map((item, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                <strong>{item.entity?.name || item.label}</strong>
                <span className="muted"> · {item.kind.toLowerCase()}</span>
                {item.priceLkr != null && (
                  <span className="price"> — LKR {item.priceLkr.toLocaleString()}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <Link
        to={
          refCode
            ? `/agencies/${tour.agency.slug}?ref=${encodeURIComponent(refCode)}`
            : `/agencies/${tour.agency.slug}`
        }
        className="btn btn-primary"
      >
        Inquire this tour
      </Link>
    </section>
  );
}
