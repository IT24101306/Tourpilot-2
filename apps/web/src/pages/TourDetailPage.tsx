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
  const [floatDocked, setFloatDocked] = useState(false);
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

  // Keep the inquire button floating, but dock it above the site footer.
  useEffect(() => {
    if (!tour) return;
    const footer = document.querySelector(".site-footer");
    if (!footer) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setFloatDocked(entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0,
        rootMargin: "0px 0px 96px 0px",
      }
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, [tour]);

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
        <header className="tour-detail-topic">
          <div className="tour-detail-topic__inner">
            <div className="tour-detail-topic__copy">
              <button
                type="button"
                className="tour-detail-back"
                onClick={() => goBack(agencyHref)}
              >
                ← Back
              </button>
              <h1 className="tour-detail-topic__title">{tour.title}</h1>
            </div>
            <div className="tour-detail-topic__aside">
              <p className="tour-detail-topic__price">
                <FormatTourPrice amount={tour.publicPriceLkr ?? tour.basePriceLkr} />
              </p>
              <p className="tour-detail-topic__meta">
                {formatTourDaysNights(tour.days)}
                {tour.seasonTag ? ` · ${tour.seasonTag}` : ""}
              </p>
            </div>
          </div>
        </header>

        <div className="agency-display-band agency-display-band--white">
          <div className="tour-detail-main agency-display-inner">
            <TourItineraryPreview
              days={tour.tourDays}
              coverUrl={tour.coverUrl}
              coverAlt={tour.title}
              headerAction={
                <SaveTourButton tourId={tour.id} showLabel className="tour-detail-save" />
              }
            />
          </div>
        </div>
      </div>

      <section className="tour-detail-cta-band" aria-hidden="true" />

      <div
        className={`tour-detail-float${floatDocked ? " is-docked" : ""}`}
        role="region"
        aria-label="Tour inquiry"
      >
        {canInquire ? (
          <Link to={inquireHref} className="tour-detail-float__btn">
            <span className="tour-detail-float__label">Interested?</span>
            <span className="tour-detail-float__action">Inquire this tour</span>
          </Link>
        ) : (
          <Link to={agencyHref} className="tour-detail-float__btn tour-detail-float__btn--ghost">
            <span className="tour-detail-float__action">View agency page</span>
          </Link>
        )}
      </div>
    </div>
  );
}
