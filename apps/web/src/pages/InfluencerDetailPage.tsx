import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { CoverImage } from "../components/CoverImage";
import {
  DEFAULT_TOUR_COVER_URL,
  formatTourDaysNights,
  resolveImageUrl,
} from "@tourpilot/shared";
import { FormatLkr } from "../components/currency/FormatLkr";
import {
  type DiscoveryOffer,
} from "../components/discovery/DiscoveryOfferCard";
import { AgencyOffersFlipShowcase } from "../components/discovery/AgencyOffersFlipShowcase";
import { AgencyHeroBanner } from "../components/display/AgencyHeroBanner";
import { AgencyHeroSectionNav } from "../components/display/AgencyHeroSectionNav";
import { AgencyWhoWeAreSection } from "../components/display/AgencyWhoWeAreSection";
import type { DisplaySocialLink, HeroSlide } from "../components/display/displayTypes";
import { LineUserIcon } from "../components/icons/LineIcons";
import { NotificationBell } from "../components/NotificationBell";
import { TourPilotBrand } from "../components/TourPilotBrand";
import { loginPath } from "../utils/authRedirect";
import { navLinkLightClass } from "../utils/navLinkClass";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { resolveInfluencerHeroSlides } from "../lib/influencerDisplay";
import "../styles/agency-display.css";
import "../styles/influencer-display.css";

type StorefrontTour = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  days: number;
  publicPriceLkr: number;
  coverUrl: string;
  agency: { id: string; name: string; slug: string };
  refCode: string | null;
  tourPath: string;
};

type Storefront = {
  slug: string;
  name: string;
  bio: string | null;
  headline: string;
  tagline: string;
  heroImages: HeroSlide[];
  aboutTitle: string;
  aboutDescription: string;
  socialLinks: DisplaySocialLink[];
  tours: StorefrontTour[];
  offers: DiscoveryOffer[];
};

function InfluencerPackageCard({ tour }: { tour: StorefrontTour }) {
  const image = resolveImageUrl(tour.coverUrl, DEFAULT_TOUR_COVER_URL);

  return (
    <Link to={tour.tourPath} className="agency-package-card">
      <CoverImage src={image} className="agency-package-card-bg" />
      <span className="agency-package-days">{formatTourDaysNights(tour.days)}</span>
      <div className="agency-package-card-body">
        <h3>{tour.title}</h3>
        <p>{tour.agency.name}</p>
        <strong>
          <FormatLkr amount={tour.publicPriceLkr} prefix="from" />
        </strong>
        <span className="agency-package-cta">View itinerary →</span>
      </div>
    </Link>
  );
}

export function InfluencerDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const returnPath = slug ? `/influencers/${slug}` : "/";
  const [store, setStore] = useState<Storefront | null>(null);
  const [missing, setMissing] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const [navSolid, setNavSolid] = useState(false);

  useEffect(() => {
    function onScroll() {
      setNavSolid(window.scrollY > 48);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!slug) return;
    setMissing(false);
    api<Storefront>(`/influencers/${slug}`)
      .then((data) => setStore({ ...data, offers: data.offers ?? [] }))
      .catch(() => setMissing(true));
  }, [slug]);

  const heroSlides = useMemo(() => {
    if (!store) return [];
    return resolveInfluencerHeroSlides(
      store.heroImages ?? [],
      store.tours.map((t) => t.coverUrl)
    );
  }, [store]);

  if (missing) {
    return (
      <div className="agency-display influencer-display">
        <div className="agency-display-loading">
          <p>Creator page not found.</p>
          <Link to="/">Back to TourPilot</Link>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="agency-display influencer-display">
        <div className="agency-display-loading">Loading experience…</div>
      </div>
    );
  }

  const storefront = store;
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  const hasOffers = (storefront.offers?.length ?? 0) > 0;
  const hasTours = storefront.tours.length > 0;
  const aboutBody = storefront.aboutDescription?.trim() || storefront.bio?.trim() || "";
  const hasAbout =
    Boolean(aboutBody) || (storefront.socialLinks?.length ?? 0) > 0;

  const heroSectionLinks: { id: string; label: string }[] = [];
  if (hasAbout) heroSectionLinks.push({ id: "who-we-are", label: "About" });
  if (hasOffers) heroSectionLinks.push({ id: "offers", label: "Offers" });
  if (hasTours) heroSectionLinks.push({ id: "packages", label: "Tours" });

  function scrollToPackages() {
    document.getElementById("packages")?.scrollIntoView({ behavior: "smooth" });
  }

  async function sharePage() {
    if (!pageUrl) return;
    setShareMsg("");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: `${storefront.name} — ${storefront.headline}`,
          text: storefront.tagline,
          url: pageUrl,
        });
        setShareMsg("Thanks for sharing!");
      } else {
        await navigator.clipboard.writeText(pageUrl);
        setShareMsg("Link copied.");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(pageUrl);
        setShareMsg("Link copied.");
      } catch {
        setShareMsg("Could not share or copy.");
      }
    }
    setTimeout(() => setShareMsg(""), 2500);
  }

  return (
    <div className="agency-display influencer-display">
      <header
        className={`topbar topbar--site topbar--hero${navSolid ? " topbar--hero-solid" : ""}`}
      >
        <TourPilotBrand onImage />
        <nav className="nav nav--light" aria-label="Creator storefront">
          <div className="nav-actions nav-actions--light">
            <NavLink to="/agencies" className={navLinkLightClass}>
              Browse agencies
            </NavLink>
            <NotificationBell />
            {user ? (
              <>
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

      <section
        className="agency-hero-banner agency-hero-banner--influencer"
        aria-label={`${storefront.name} hero`}
      >
        <AgencyHeroBanner slides={heroSlides} />
        <div className="agency-hero-banner__content agency-hero-banner__content--centered">
          <div className="agency-display-intro agency-display-intro--hero agency-display-intro--centered">
            <div className="agency-display-logo-fallback influencer-display-avatar">
              {storefront.name.charAt(0)}
            </div>
            <div>
              <p className="agency-display-eyebrow">Creator · {storefront.name}</p>
              {storefront.tagline && (
                <p className="agency-display-tagline">{storefront.tagline}</p>
              )}
            </div>
          </div>

          <div className="agency-hero-banner__copy agency-hero-banner__copy--centered">
            <h1>{storefront.headline}</h1>
          </div>

          <div className="agency-hero-banner__actions agency-hero-banner__actions--centered">
            {hasTours && (
              <button type="button" className="agency-hero-banner__cta" onClick={scrollToPackages}>
                View tours
              </button>
            )}
            <button type="button" className="agency-hero-banner__ghost" onClick={() => void sharePage()}>
              Share this page
            </button>
          </div>
          {shareMsg && <p className="influencer-display-share-msg">{shareMsg}</p>}
        </div>
        <AgencyHeroSectionNav links={heroSectionLinks} />
      </section>

      <div className="agency-display-body">
        {hasAbout && (
          <div className="agency-display-band agency-display-band--white">
            <div className="agency-display-inner agency-display-inner--who">
              <AgencyWhoWeAreSection
                title={storefront.aboutTitle || "About the creator"}
                description={aboutBody}
                socialLinks={storefront.socialLinks ?? []}
                images={[]}
              />
            </div>
          </div>
        )}

        {hasOffers && (
          <div className="agency-display-band agency-display-band--offers-spotlight">
            <div className="agency-display-inner agency-display-inner--offers">
              <AgencyOffersFlipShowcase
                offers={storefront.offers}
                agencyName={storefront.name}
                onRegister={(offer) => navigate(`/offers?offer=${offer.id}`)}
              />
            </div>
          </div>
        )}

        <div className="agency-display-band agency-display-band--scenic">
          <div className="agency-display-inner">
            <section className="agency-section" id="packages">
              <div className="agency-display-section-head">
                <h2>Featured tours</h2>
                <p>Hand-picked journeys curated by {storefront.name}.</p>
              </div>
              {!hasTours ? (
                <p className="muted">No tours featured yet. Check back soon.</p>
              ) : (
                <div className="agency-package-grid">
                  {storefront.tours.map((t) => (
                    <InfluencerPackageCard key={t.id} tour={t} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
