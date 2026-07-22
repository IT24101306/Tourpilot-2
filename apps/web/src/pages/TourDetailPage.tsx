import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { CoverImage } from "../components/CoverImage";
import { TourItineraryPreview } from "../components/itinerary/TourItineraryPreview";
import { formatTourDaysNights } from "@tourpilot/shared";
import { FormatTourPrice } from "../components/currency/FormatLkr";
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
      coverUrl?: string | null;
      agency: { name: string; slug: string };
      features?: {
        readyMadeTours?: boolean;
        customInquiries?: boolean;
      };
      tourDays: Array<{
        dayNumber: number;
        title: string | null;
        items: Array<{
          kind: string;
          label: string | null;
          priceLkr: number | null;
          entity: {
            name: string;
            type?: string;
            description?: string | null;
            media?: unknown;
          } | null;
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

  if (!tour) {
    return (
      <div className="tour-detail">
        <div className="tour-detail-main">Loading…</div>
      </div>
    );
  }

  const canInquire = tour.features?.readyMadeTours !== false;
  const inquireHref = (() => {
    const params = new URLSearchParams();
    params.set("inquireTour", tour.id);
    if (refCode) params.set("ref", refCode);
    return `/agencies/${tour.agency.slug}?${params.toString()}#request-custom-tour`;
  })();

  return (
    <div className="tour-detail">
      <header className="tour-detail-hero-strip">
        <CoverImage src={tour.coverUrl} className="tour-detail-hero-strip__bg" alt="" />
        <div className="tour-detail-hero-strip__shade" aria-hidden="true" />
        <div className="tour-detail-hero-strip__inner">
          <div className="tour-detail-hero-strip__copy">
            <div className="tour-detail-hero-strip__top">
              <Link to={`/agencies/${tour.agency.slug}`} className="tour-detail-eyebrow">
                {tour.agency.name}
              </Link>
              <span className="tour-detail-meta">
                {formatTourDaysNights(tour.days)}
                {tour.seasonTag && ` · ${tour.seasonTag}`}
              </span>
            </div>
            <h1 className="tour-detail-title">{tour.title}</h1>
            {(tour.description || tour.summary) && (
              <p className="tour-detail-desc">{tour.description || tour.summary}</p>
            )}
          </div>
          <div className="tour-detail-hero-strip__aside">
            <p className="tour-detail-price">
              <FormatTourPrice amount={tour.publicPriceLkr ?? tour.basePriceLkr} />
            </p>
            <SaveTourButton tourId={tour.id} showLabel className="tour-detail-save" />
          </div>
        </div>
      </header>

      <div className="tour-detail-main">
        <TourItineraryPreview days={tour.tourDays} />

        <footer className="tour-detail-foot">
          <div className="tour-detail-foot__copy">
            <p className="tour-detail-foot__label">Interested?</p>
            <p className="tour-detail-foot__text">
              {canInquire
                ? `Inquire with ${tour.agency.name} — no payment required.`
                : "Online inquiries are not available for this agency right now. Please contact them directly if you have details."}
            </p>
          </div>
          {canInquire ? (
            <Link to={inquireHref} className="btn btn-primary tour-detail-foot__btn">
              Inquire this tour
            </Link>
          ) : (
            <Link to={`/agencies/${tour.agency.slug}`} className="btn btn-ghost tour-detail-foot__btn">
              View agency page
            </Link>
          )}
        </footer>
      </div>
    </div>
  );
}
