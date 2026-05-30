import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useParams, useSearchParams } from "react-router-dom";
import { CoverImage } from "../components/CoverImage";
import { navLinkClass } from "../utils/navLinkClass";
import { DEFAULT_TOUR_COVER_URL, resolveImageUrl } from "@tourpilot/shared";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  DiscoveryOfferCard,
  type DiscoveryOffer,
} from "../components/discovery/DiscoveryOfferCard";
import { AgencyInquirySection } from "../components/inquiry/AgencyInquirySection";
import { SaveTourButton } from "../components/tourist/SaveTourButton";
import { AgencyHeroBanner } from "../components/display/AgencyHeroBanner";
import {
  defaultDisplayConfig,
  resolveHeroSlides,
  sectionEnabled,
  type DisplayContent,
  type DisplayOffer,
  type DisplayPackage,
  type DisplaySectionFlags,
  type GalleryItem,
} from "../components/display/displayTypes";
import "../styles/agency-display.css";

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
  tagline: string | null;
  description: string | null;
  coverUrl: string | null;
  logoUrl: string | null;
  district: string | null;
  gallery: GalleryItem[];
  avgRating: number;
  reviewCount: number;
  tours: Tour[];
  reviews: { authorName: string; rating: number; body: string | null }[];
  display?: {
    enabled: DisplaySectionFlags;
    content: DisplayContent;
  };
  loyaltyOffers?: DiscoveryOffer[];
};

function splitGalleryColumns(items: GalleryItem[]) {
  const col1: GalleryItem[] = [];
  const col2: GalleryItem[] = [];
  const col3: GalleryItem[] = [];
  items.forEach((item, i) => {
    if (i % 3 === 0) col1.push(item);
    else if (i % 3 === 1) col2.push(item);
    else col3.push(item);
  });
  return [col1, col2, col3];
}

function GalleryColumn({
  items,
  sizeClass,
}: {
  items: GalleryItem[];
  sizeClass: "tall" | "wide" | "short";
}) {
  return (
    <div className="agency-gallery-col">
      {items.map((item, i) => (
        <div key={`${item.url}-${i}`} className={`agency-gallery-item ${sizeClass}`}>
          <div className="agency-gallery-item-bg" style={{ backgroundImage: `url(${item.url})` }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function uniqueReviews(
  reviews: Agency["reviews"],
  max = 6
): Agency["reviews"] {
  const seen = new Set<string>();
  const out: Agency["reviews"] = [];
  for (const r of reviews) {
    const key = `${r.authorName}|${r.body ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    if (out.length >= max) break;
  }
  return out;
}

function PackageCard({
  pkg,
  tour,
  agencySlug,
}: {
  pkg: DisplayPackage;
  tour?: Tour;
  agencySlug: string;
}) {
  const image = resolveImageUrl(pkg.imageUrl?.trim() || tour?.coverUrl, DEFAULT_TOUR_COVER_URL);
  const href = tour ? `/tours/${agencySlug}/${tour.slug}` : null;
  const inner = (
    <>
      <CoverImage src={image} className="agency-package-card-bg" />
      {tour && (
        <SaveTourButton tourId={tour.id} className="agency-package-save" />
      )}
      {tour && <span className="agency-package-days">{tour.days} days</span>}
      <div className="agency-package-card-body">
        <h3>{pkg.title}</h3>
        <p>{pkg.location}</p>
        <strong>{pkg.priceLabel}</strong>
        {href && <span className="agency-package-cta">View itinerary →</span>}
      </div>
    </>
  );

  if (href) {
    return (
      <Link to={href} className="agency-package-card">
        {inner}
      </Link>
    );
  }
  return <div className="agency-package-card">{inner}</div>;
}

export function AgencyDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref");
  const { token } = useAuth();
  const [agency, setAgency] = useState<Agency | null>(null);
  const [offerMsg, setOfferMsg] = useState("");

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

  const enabled = agency?.display?.enabled ?? defaultDisplayConfig().enabled;
  const content = agency?.display?.content ?? defaultDisplayConfig().content;
  const heroSlides = useMemo(
    () =>
      agency
        ? resolveHeroSlides(content, {
            coverUrl: agency.coverUrl,
            featuredImageUrl: content.featuredImageUrl,
          })
        : [],
    [agency, content]
  );
  const packages = content.packages;
  const cmsOffers = content.offers;
  const loyaltyOffers = agency?.loyaltyOffers ?? [];
  const gallery = agency?.gallery || [];

  const tourById = useMemo(() => {
    const map = new Map<string, Tour>();
    agency?.tours.forEach((t) => map.set(t.id, t));
    return map;
  }, [agency?.tours]);

  const visibleReviews = useMemo(
    () => (agency ? uniqueReviews(agency.reviews) : []),
    [agency]
  );

  if (!agency) {
    return (
      <div className="agency-display">
        <div className="agency-display-loading">Loading experience…</div>
      </div>
    );
  }

  function scrollToInquiry() {
    document.getElementById("request-custom-tour")?.scrollIntoView({ behavior: "smooth" });
  }

  async function registerForOffer(offerId: string) {
    if (!token) {
      setOfferMsg("Log in to register for this offer.");
      return;
    }
    if (!slug) return;
    setOfferMsg("");
    try {
      await api(`/offers/${offerId}/register`, { method: "POST", token });
      setOfferMsg("You are registered — the agency will follow up.");
      const refreshed = await api<Agency>(`/agencies/${slug}`);
      setAgency(refreshed);
    } catch (e) {
      setOfferMsg(e instanceof ApiError ? e.message : "Registration failed");
    }
  }

  const [col1, col2, col3] = splitGalleryColumns(gallery);
  const showTours = sectionEnabled(enabled, "tours");
  const showShowcase = sectionEnabled(enabled, "showcase");
  const showReviews = sectionEnabled(enabled, "reviews");
  const showGallery = sectionEnabled(enabled, "gallery");
  const showOffers = sectionEnabled(enabled, "offers");
  const inquiryEnabled = sectionEnabled(enabled, "inquiry");

  const ratingDisplay = content.ratingScore || String(agency.avgRating.toFixed(1));
  const ratingSub =
    agency.reviewCount > 0
      ? `${agency.reviewCount}+ traveler reviews`
      : content.highlights[0] || "Trusted local journeys";

  return (
    <div className="agency-display">
      <header className="topbar topbar--site">
        <Link to="/" className="brand">
          Tour<span>Pilot</span>
        </Link>
        <nav className="nav" aria-label="Agency storefront">
          <div className="nav-actions">
            <NavLink to="/agencies" className={navLinkClass}>
              All agencies
            </NavLink>
            {inquiryEnabled && (
              <button type="button" className="btn btn-teal" onClick={scrollToInquiry}>
                Plan a trip
              </button>
            )}
          </div>
        </nav>
      </header>

      <section className="agency-hero-banner" aria-label={`${agency.name} hero`}>
        <AgencyHeroBanner slides={heroSlides} />
        <div className="agency-hero-banner__content">
          <div className="agency-display-intro agency-display-intro--hero">
            {agency.logoUrl ? (
              <img src={agency.logoUrl} alt="" className="agency-display-logo" />
            ) : (
              <div className="agency-display-logo-fallback">{agency.name.charAt(0)}</div>
            )}
            <div>
              <p className="agency-display-eyebrow">{agency.name}</p>
              {agency.tagline && <p className="agency-display-tagline">{agency.tagline}</p>}
              {agency.district && (
                <p className="agency-display-region">{agency.district}, Sri Lanka</p>
              )}
            </div>
          </div>

          <div className="agency-hero-banner__copy">
            <h1>{content.heroHeadline}</h1>
            {content.heroSubheadline && (
              <p className="agency-hero-banner__lead">{content.heroSubheadline}</p>
            )}
          </div>

          <div className="agency-hero-banner__actions">
            {inquiryEnabled && (
              <button type="button" className="agency-hero-banner__cta" onClick={scrollToInquiry}>
                {content.ctaLabel || "Plan your trip"}
              </button>
            )}
            {showTours && packages.length > 0 && (
              <a href="#packages" className="agency-hero-banner__ghost">
                Browse packages
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="agency-display-inner">
        {showTours && (
          <section className="agency-section" id="packages">
            <div className="agency-display-section-head">
              <h2>{content.packagesTitle}</h2>
              <p>{content.packagesSubtitle}</p>
            </div>
            {packages.length === 0 ? (
              <p className="muted">No packages published yet.</p>
            ) : (
              <div className="agency-package-grid">
                {packages.map((pkg, i) => (
                  <PackageCard
                    key={`${pkg.tourId ?? pkg.title}-${i}`}
                    pkg={pkg}
                    tour={pkg.tourId ? tourById.get(pkg.tourId) : undefined}
                    agencySlug={agency.slug}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {showShowcase && (
          <section className="agency-showcase">
            <div className="agency-showcase-trust">
              <div className="agency-showcase-rating-block">
                <div className="agency-showcase-rating">
                  {ratingDisplay}
                  <span>{content.ratingSuffix}</span>
                </div>
                <p className="agency-showcase-rating-sub">{ratingSub}</p>
              </div>

              <ul className="agency-showcase-highlights">
                {content.highlights.slice(0, 4).map((line, i) => (
                  <li key={i}>
                    <span className="agency-highlight-icon" aria-hidden="true">
                      ✓
                    </span>
                    {line}
                  </li>
                ))}
              </ul>

              {inquiryEnabled && (
                <button type="button" className="agency-showcase-cta" onClick={scrollToInquiry}>
                  {content.ctaLabel}
                </button>
              )}
            </div>

            <div className="agency-showcase-visual">
              <div
                className="agency-showcase-featured"
                style={{ backgroundImage: `url(${content.featuredImageUrl})` }}
              >
                <blockquote className="agency-showcase-featured-quote">
                  &ldquo;{content.featuredQuote}&rdquo;
                </blockquote>
              </div>

              {showReviews && visibleReviews.length > 0 && (
                <div className="agency-showcase-reviews-wrap">
                  <h3 className="agency-reviews-title">What travelers say</h3>
                  <div className="agency-showcase-reviews">
                    {visibleReviews.map((r, i) => (
                      <article key={i} className="agency-review-card">
                        <div className="agency-review-stars" aria-label={`${r.rating} stars`}>
                          {"★".repeat(r.rating)}
                        </div>
                        <p>&ldquo;{r.body}&rdquo;</p>
                        <footer>— {r.authorName}</footer>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {showOffers && (loyaltyOffers.length > 0 || cmsOffers.length > 0) && (
          <section className="agency-section agency-offers">
            <div className="agency-display-section-head">
              <h2>Special offers</h2>
              <p>Limited deals and promotions from {agency.name}.</p>
            </div>
            {offerMsg && <p className="agency-offer-status">{offerMsg}</p>}
            {loyaltyOffers.length > 0 && (
              <div className="agency-loyalty-offers disc-offer-grid">
                {loyaltyOffers.map((offer) => (
                  <DiscoveryOfferCard
                    key={offer.id}
                    offer={{ ...offer, agencyName: agency.name, agencySlug: agency.slug }}
                    compact
                    onRegister={
                      offer.spotsLeft > 0
                        ? () => {
                            if (token) void registerForOffer(offer.id);
                            else setOfferMsg("Log in to register for this offer.");
                          }
                        : undefined
                    }
                    registerLabel={offer.spotsLeft > 0 ? "Register for offer" : "Offer full"}
                  />
                ))}
              </div>
            )}
            {cmsOffers.length > 0 && (
              <div className="agency-offers-grid">
                {cmsOffers.map((offer: DisplayOffer, i) => (
                  <article key={i} className="agency-offer-card">
                    {offer.imageUrl && (
                      <div
                        className="agency-offer-card-cover"
                        style={{ backgroundImage: `url(${offer.imageUrl})` }}
                      />
                    )}
                    <div className="agency-offer-card-body">
                      {offer.badge && <span className="agency-offer-badge">{offer.badge}</span>}
                      <h3>{offer.title}</h3>
                      <p>{offer.description}</p>
                      {offer.priceLabel && <p className="agency-offer-price">{offer.priceLabel}</p>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {showGallery && gallery.length > 0 && (
          <section className="agency-section agency-gallery-section">
            <div className="agency-display-section-head">
              <h2>Gallery</h2>
              <p>Moments from the road with {agency.name}.</p>
            </div>
            <div className="agency-gallery-wall">
              <GalleryColumn items={col1} sizeClass="wide" />
              <GalleryColumn items={col2} sizeClass="tall" />
              <GalleryColumn items={col3} sizeClass="short" />
            </div>
          </section>
        )}

        {agency.description && (
          <p className="agency-display-about">{agency.description}</p>
        )}
      </div>

      {inquiryEnabled && (
        <AgencyInquirySection agencyId={agency.id} agencyName={agency.name} refCode={refCode} />
      )}
    </div>
  );
}
