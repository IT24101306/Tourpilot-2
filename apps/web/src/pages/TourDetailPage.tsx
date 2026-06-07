import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { TourItineraryPreview } from "../components/itinerary/TourItineraryPreview";
import { SaveTourButton } from "../components/tourist/SaveTourButton";

export function TourDetailPage() {
  const { agencySlug, tourSlug } = useParams<{ agencySlug: string; tourSlug: string }>();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref");
  const [tour, setTour] = useState<Awaited<ReturnType<typeof loadTour>> | null>(null);

  async function loadTour() {
    return api<{
      id: string;
      title: string;
      summary: string | null;
      description: string | null;
      days: number;
      basePriceLkr: number;
      publicPriceLkr?: number;
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
    <section className="section tour-detail-page" style={{ maxWidth: 900, margin: "0 auto" }}>
      <Link to={`/agencies/${tour.agency.slug}`} className="muted">
        ← {tour.agency.name}
      </Link>
      <div className="tour-detail-head">
        <h1 className="tour-detail-title">{tour.title}</h1>
        <SaveTourButton tourId={tour.id} showLabel className="tour-detail-save" />
      </div>
      <p className="price" style={{ fontSize: "1.25rem" }}>
        From LKR {(tour.publicPriceLkr ?? tour.basePriceLkr).toLocaleString()}
      </p>
      {tour.seasonTag && <p className="muted">Best season: {tour.seasonTag}</p>}
      <p style={{ marginTop: 16 }}>{tour.description || tour.summary}</p>

      <TourItineraryPreview days={tour.tourDays} />

      <Link
        to={(() => {
          const params = new URLSearchParams();
          params.set("inquireTour", tour.id);
          if (refCode) params.set("ref", refCode);
          return `/agencies/${tour.agency.slug}?${params.toString()}#request-custom-tour`;
        })()}
        className="btn btn-primary"
      >
        Inquire this tour
      </Link>
    </section>
  );
}
