import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { loginPath } from "../utils/authRedirect";
import { CoverImage } from "../components/CoverImage";
import { navLinkLightClass } from "../utils/navLinkClass";
import { NotificationBell } from "../components/NotificationBell";
import { DEFAULT_TOUR_COVER_URL, formatTourDaysNights, resolveImageUrl } from "@tourpilot/shared";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AgencyOffersFlipShowcase } from "../components/discovery/AgencyOffersFlipShowcase";
import type { DiscoveryOffer } from "../components/discovery/DiscoveryOfferCard";
import { FormatLkr } from "../components/currency/FormatLkr";
import { OfferRegistrationModal } from "../components/discovery/OfferRegistrationModal";
import { AgencyInquirySection } from "../components/inquiry/AgencyInquirySection";
import { SaveTourButton } from "../components/tourist/SaveTourButton";
import { LineCheckIcon, LineUserIcon } from "../components/icons/LineIcons";
import { TourPilotBrand } from "../components/TourPilotBrand";
import { AgencyHeroBanner } from "../components/display/AgencyHeroBanner";
import { AgencyHeroSectionNav } from "../components/display/AgencyHeroSectionNav";
import { AgencyWhoWeAreSection } from "../components/display/AgencyWhoWeAreSection";
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
      {tour && <span className="agency-package-days">{formatTourDaysNights(tour.days)}</span>}
      <div className="agency-package-card-body">
        <h3>{pkg.title}</h3>
        <p>{pkg.location}</p>
        <strong>
          {tour ? (
            <FormatLkr amount={tour.basePriceLkr} prefix="from" />
          ) : (
            pkg.priceLabel
          )}
        </strong>
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
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref");
  const inquireTourId = searchParams.get("inquireTour");
  const focusInquiryForm =
    Boolean(inquireTourId) || location.hash === "#request-custom-tour";
  const { token, user, logout } = useAuth();
  const agencyReturnPath = slug
    ? `/agencies/${slug}${refCode ? `?ref=${encodeURIComponent(refCode)}` : ""}`
    : "/agencies";
  const [agency, setAgency] = useState<Agency | null>(null);
  const [offerMsg, setOfferMsg] = useState("");
  const [registerOffer, setRegisterOffer] = useState<DiscoveryOffer | null>(null);
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
    api<Agency>(`/agencies/${slug}`).then(setAgency).catch(console.error);
    if (refCode) {
      api("/influencer/track/" + refCode, {
        method: "POST",
        body: JSON.stringify({ sessionId: crypto.randomUUID() }),
      }).catch(() => {});
    }
  }, [slug, refCode]);

  const inquireTour = useMemo(() => {
    if (!inquireTourId || !agency?.tours) return null;
    const match = agency.tours.find((t) => t.id === inquireTourId);
    if (!match) return null;
    return {
      id: match.id,
      title: match.title,
      slug: match.slug,
      days: match.days,
      basePriceLkr: match.basePriceLkr,
    };
  }, [agency?.tours, inquireTourId]);

  const enabled = agency?.display?.enabled ?? defaultDisplayConfig().enabled;
  const content = agency?.display?.content ?? defaultDisplayConfig().content;
  const heroSlides = useMemo(
    () =>
      agency?.display?.content
        ? resolveHeroSlides(agency.display.content, {
            coverUrl: agency.coverUrl,
            featuredImageUrl: agency.display.content.featuredImageUrl,
          })
        : [],
    [agency]
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

  function scrollToOffers() {
    document.getElementById("offers")?.scrollIntoView({ behavior: "smooth" });
  }

  function scrollToInquiry() {
    document.getElementById("request-custom-tour")?.scrollIntoView({ behavior: "smooth" });
  }

  function openOfferRegistration(offer: DiscoveryOffer) {
    if (!token) {
      navigate(loginPath(agencyReturnPath));
      return;
    }
    setOfferMsg("");
    setRegisterOffer(offer);
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

  const hasLoyaltyOffers = showOffers && loyaltyOffers.length > 0;
  const hasCmsOffers = showOffers && cmsOffers.length > 0;
  const hasOffers = hasLoyaltyOffers || hasCmsOffers;
  const hasScenicContent =
    hasCmsOffers || showTours || showShowcase;
  const hasGallery = showGallery && gallery.length > 0;
  const heroSectionLinks: { id: string; label: string }[] = [
    { id: "who-we-are", label: "Who we are" },
  ];
  if (showOffers && hasOffers) heroSectionLinks.push({ id: "offers", label: "Offers" });
  if (showTours) heroSectionLinks.push({ id: "packages", label: "Packages" });
  if (showShowcase && showReviews) heroSectionLinks.push({ id: "reviews", label: "Reviews" });
  if (hasGallery) heroSectionLinks.push({ id: "gallery", label: "Gallery" });
  if (inquiryEnabled) heroSectionLinks.push({ id: "request-custom-tour", label: "Inquire" });

  return (
    <div className="agency-display">
      <header
        className={`topbar topbar--site topbar--hero${navSolid ? " topbar--hero-solid" : ""}`}
      >
        <TourPilotBrand onImage />
        <nav className="nav nav--light" aria-label="Agency storefront">
          <div className="nav-actions nav-actions--light">
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
              <NavLink
                to={loginPath(agencyReturnPath)}
                className={navLinkLightClass}
              >
                Login
              </NavLink>
            )}
          </div>
        </nav>
      </header>

      <section className="agency-hero-banner" aria-label={`${agency.name} hero`}>
        <AgencyHeroBanner slides={heroSlides} />
        <div className="agency-hero-banner__content">
          <div className="agency-display-intro agency-display-intro--hero">
            {agency.logoUrl ? (
              <img src={agency.logoUrl} alt={agency.name} className="agency-display-logo" />
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
            {showOffers && hasOffers && (
              <button type="button" className="agency-hero-banner__cta" onClick={scrollToOffers}>
                View offers
              </button>
            )}
            {inquiryEnabled && (
              <button type="button" className="agency-hero-banner__ghost" onClick={scrollToInquiry}>
                {content.ctaLabel || "Plan your trip"}
              </button>
            )}
          </div>
        </div>
        <AgencyHeroSectionNav links={heroSectionLinks} />
      </section>

      <div className="agency-display-body">
        <div className="agency-display-band agency-display-band--white">
          <div className="agency-display-inner agency-display-inner--who">
            <AgencyWhoWeAreSection
              title={content.whoWeAreTitle}
              description={content.whoWeAreDescription}
              socialLinks={content.whoWeAreSocialLinks}
              images={content.whoWeAreImages}
              fallbackDescription={agency.description}
            />
          </div>
        </div>

        {hasLoyaltyOffers && (
          <div className="agency-display-band agency-display-band--offers-spotlight">
            <div className="agency-display-inner agency-display-inner--offers">
              <AgencyOffersFlipShowcase
                offers={loyaltyOffers.map((offer) => ({
                  ...offer,
                  agencyName: agency.name,
                  agencySlug: agency.slug,
                }))}
                agencyName={agency.name}
                statusMsg={offerMsg || undefined}
                onRegister={(offer) =>
                  openOfferRegistration({
                    ...offer,
                    agencyName: agency.name,
                    agencySlug: agency.slug,
                  })
                }
              />
            </div>
          </div>
        )}

        {hasScenicContent && (
        <div className="agency-display-band agency-display-band--scenic">
          <div className="agency-display-inner">
          {hasCmsOffers && (
            <section className="agency-section agency-offers" id="offers-cms">
              <div className="agency-display-section-head">
                <h2>More promotions</h2>
                <p>Additional deals from {agency.name}.</p>
              </div>
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
                      {offer.priceLabel && (
                        <p className="agency-offer-price">{offer.priceLabel}</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

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
            <section className="agency-showcase" id={showReviews ? "reviews" : undefined}>
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
                      <LineCheckIcon size={14} />
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
          </div>
        </div>
        )}

        {hasGallery && (
          <div className="agency-display-band agency-display-band--white">
            <div className="agency-display-inner">
              <section className="agency-section agency-gallery-section" id="gallery">
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
            </div>
          </div>
        )}

        {inquiryEnabled && (
          <div className="agency-display-band agency-display-band--green">
            <AgencyInquirySection
              agencyId={agency.id}
              agencyName={agency.name}
              agencySlug={agency.slug}
              refCode={refCode}
              tour={inquireTour}
              focusOnMount={focusInquiryForm}
            />
          </div>
        )}
      </div>

      <OfferRegistrationModal
        open={!!registerOffer}
        offer={registerOffer}
        token={token}
        onClose={() => setRegisterOffer(null)}
        onSuccess={() => {
          if (!slug) return;
          setOfferMsg("You are registered — the agency will follow up.");
          void api<Agency>(`/agencies/${slug}`)
            .then(setAgency)
            .catch(console.error);
        }}
      />
    </div>
  );
}
