import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { TourItineraryPreview } from "../components/itinerary/TourItineraryPreview";
import { formatTourDaysNights } from "@tourpilot/shared";
import { FormatTourPrice } from "../components/currency/FormatLkr";
import { SaveTourButton } from "../components/tourist/SaveTourButton";
import { ClientBrand } from "../components/ClientBrand";
import { NotificationBell } from "../components/NotificationBell";
import { LineUserIcon } from "../components/icons/LineIcons";
import { RichTextHtml } from "../components/richtext/RichTextHtml";
import { useAuth } from "../context/AuthContext";
import { currentPath, loginPath } from "../utils/authRedirect";
import { navLinkLightClass } from "../utils/navLinkClass";
import "../styles/agency-display.css";

export function TourDetailPage() {
  const { agencySlug, tourSlug } = useParams<{ agencySlug: string; tourSlug: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const refCode = searchParams.get("ref");
  const [tour, setTour] = useState<Awaited<ReturnType<typeof loadTour>> | null>(null);
  const returnPath = currentPath(location);

  function goBack(fallbackHref: string) {
    if (location.key !== "default") {
      navigate(-1);
      return;
    }
    navigate(fallbackHref);
  }

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
      agency: { name: string; slug: string; logoUrl?: string | null };
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
    const loadingBackHref = agencySlug ? `/agencies/${agencySlug}` : "/";
    return (
      <div className="agency-display tour-detail">
        <header className="topbar topbar--site tour-detail-topbar">
          <ClientBrand
            name={agencySlug || "Tour"}
            to={loadingBackHref}
            onDark
          />
        </header>
        <div className="tour-detail-main agency-display-inner">
          <button
            type="button"
            className="tour-detail-back"
            onClick={() => goBack(loadingBackHref)}
          >
            ← Back
          </button>
          <p className="muted">Loading…</p>
        </div>
      </div>
    );
  }

  const canInquire = tour.features?.readyMadeTours !== false;
  const agencyHref = (() => {
    const params = new URLSearchParams();
    if (refCode) params.set("ref", refCode);
    const q = params.toString();
    return `/agencies/${tour.agency.slug}${q ? `?${q}` : ""}`;
  })();
  const inquireHref = (() => {
    const params = new URLSearchParams();
    params.set("inquireTour", tour.id);
    if (refCode) params.set("ref", refCode);
    return `/agencies/${tour.agency.slug}?${params.toString()}#request-custom-tour`;
  })();

  return (
    <div className="agency-display tour-detail">
      <header className="topbar topbar--site tour-detail-topbar">
        <ClientBrand
          name={tour.agency.name}
          logoUrl={tour.agency.logoUrl}
          to={agencyHref}
          onDark
        />
        <nav className="nav nav--light" aria-label="Tour">
          <div className="nav-actions nav-actions--light">
            {user ? (
              <>
                <NotificationBell />
                <NavLink to="/profile" className="agency-icon-btn" aria-label="Profile">
                  <LineUserIcon />
                </NavLink>
                <button type="button" className="nav-link-light" onClick={logout}>
                  Log out
                </button>
              </>
            ) : (
              <NavLink to={loginPath(returnPath)} className={navLinkLightClass}>
                Login
              </NavLink>
            )}
          </div>
        </nav>
      </header>

      <div className="agency-display-body">
        <div className="agency-display-band agency-display-band--white">
          <div className="tour-detail-main agency-display-inner">
            <button
              type="button"
              className="tour-detail-back"
              onClick={() => goBack(agencyHref)}
            >
              ← Back
            </button>

            <header className="tour-detail-intro">
              <div className="tour-detail-intro__copy">
                <div className="tour-detail-intro__top">
                  <Link to={agencyHref} className="tour-detail-eyebrow">
                    {tour.agency.name}
                  </Link>
                  <span className="tour-detail-meta">
                    {formatTourDaysNights(tour.days)}
                    {tour.seasonTag && ` · ${tour.seasonTag}`}
                  </span>
                </div>
                <h1 className="tour-detail-title">{tour.title}</h1>
                {(tour.description || tour.summary) && (
                  <RichTextHtml
                    html={tour.description || tour.summary}
                    className="tour-detail-desc"
                  />
                )}
              </div>
              <div className="tour-detail-intro__aside">
                <p className="tour-detail-price">
                  <FormatTourPrice amount={tour.publicPriceLkr ?? tour.basePriceLkr} />
                </p>
                <SaveTourButton tourId={tour.id} showLabel className="tour-detail-save" />
              </div>
            </header>

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
                <Link to={agencyHref} className="btn btn-ghost tour-detail-foot__btn">
                  View agency page
                </Link>
              )}
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
