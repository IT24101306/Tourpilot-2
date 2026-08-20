import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useParams, useSearchParams } from "react-router-dom";
import { loginPath } from "../utils/authRedirect";
import { CoverImage } from "../components/CoverImage";
import { navLinkLightClass } from "../utils/navLinkClass";
import { NotificationBell } from "../components/NotificationBell";
import {
  DEFAULT_TOUR_COVER_URL,
  formatTourDaysNights,
  normalizeEntityMedia,
  resolveImageUrl,
} from "@tourpilot/shared";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { usePublicSmartFeatures } from "../lib/publicSmartFeatures";
import { newId } from "../lib/newId";
import { AgencyOfferFreeBanner } from "../components/discovery/AgencyOfferFreeBanner";
import type { DiscoveryOffer } from "../components/discovery/DiscoveryOfferCard";
import { FormatLkr } from "../components/currency/FormatLkr";
import { DisplayPriceText } from "../components/currency/DisplayPriceText";
import { displayTourPrice } from "../lib/tourPricing";
import { AgencyInquirySection } from "../components/inquiry/AgencyInquirySection";
import { SaveTourButton } from "../components/tourist/SaveTourButton";
import { EntityTypeLineIcon, LineUserIcon } from "../components/icons/LineIcons";
import { ClientBrand } from "../components/ClientBrand";
import { AgencyHeroBanner } from "../components/display/AgencyHeroBanner";
import { AgencyHeroSectionNav } from "../components/display/AgencyHeroSectionNav";
import { AgencyReviewsFlipShowcase } from "../components/display/AgencyReviewsFlipShowcase";
import { AgencyTransportSection } from "../components/display/AgencyTransportSection";
import { AgencyWhoWeAreSection } from "../components/display/AgencyWhoWeAreSection";
import { RichTextHtml } from "../components/richtext/RichTextHtml";
import { entityDetailsSummary, entityLocationLabel } from "../components/entity/entityTypes";
import {
  defaultDisplayConfig,
  resolveHeroSlides,
  resolveTransportOptions,
  sectionEnabled,
  type DisplayContent,
  type DisplayOffer,
  type DisplayPackage,
  type DisplaySectionFlags,
  type GalleryItem,
  type GalleryEntitySnapshot,
} from "../components/display/displayTypes";
import { DashboardModal } from "../components/DashboardModal";
import { TrustBadgeRow } from "../components/smart/TrustBadgeRow";
import { CurrencyClarityNote } from "../components/smart/CurrencyClarityNote";
import "../styles/agency-display.css";

type Tour = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  days: number;
  basePriceLkr: number;
  publicPriceLkr?: number;
  coverUrl: string | null;
};

type AgencyPublicFeatures = {
  readyMadeTours?: boolean;
  customInquiries?: boolean;
  negotiationsBookings?: boolean;
  offers?: boolean;
  display?: boolean;
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
  contactEmail?: string | null;
  contactPhone?: string | null;
  gallery: GalleryItem[];
  avgRating: number;
  reviewCount: number;
  tours: Tour[];
  reviews: { authorName: string; rating: number; body: string | null; verified?: boolean }[];
  display?: {
    enabled: DisplaySectionFlags;
    content: DisplayContent;
  };
  loyaltyOffers?: DiscoveryOffer[];
  features?: AgencyPublicFeatures;
  trustBadges?: Array<{
    key: string;
    label: string;
    shortLabel: string;
    description: string;
  }>;
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
  onSelect,
}: {
  items: GalleryItem[];
  sizeClass: "tall" | "wide" | "short";
  onSelect: (item: GalleryItem) => void;
}) {
  return (
    <div className="agency-gallery-col">
      {items.map((item, i) => (
        <button
          key={`${item.url}-${i}`}
          type="button"
          className={`agency-gallery-item ${sizeClass}`}
          onClick={() => onSelect(item)}
        >
          <div className="agency-gallery-item-bg" style={{ backgroundImage: `url(${item.url})` }} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function GalleryEntityModalBody({ entity }: { entity: GalleryEntitySnapshot }) {
  const mediaBundle = normalizeEntityMedia(entity.media as any);
  const extraImages =
    mediaBundle.items?.filter((m) => m.kind === "image" && m.url && m.url !== mediaBundle.mainImageUrl) ?? [];

  const kindLabel = entity.type === "RESTAURANT" ? "Other" : entity.type[0] + entity.type.slice(1).toLowerCase();
  const detailsSummary = entityDetailsSummary({
    type: entity.type,
    description: entity.description ?? null,
    metadata: entity.metadata,
  });

  return (
    <div className="agency-gallery-entity-body">
      {mediaBundle.mainImageUrl ? (
        <CoverImage src={mediaBundle.mainImageUrl} className="agency-gallery-entity-main-img" alt={entity.name} />
      ) : null}

      <div className="agency-gallery-entity-text">
        <div className="agency-gallery-entity-kind">
          <EntityTypeLineIcon type={entity.type} size={16} />
          <span>{kindLabel}</span>
        </div>

        {entity.description ? (
          <RichTextHtml html={entity.description} className="agency-gallery-entity-desc" />
        ) : null}

        {detailsSummary && detailsSummary !== "—" ? (
          <p className="muted agency-gallery-entity-details">{detailsSummary}</p>
        ) : null}

        <div className="agency-gallery-entity-price">
          {entity.priceHint != null ? <FormatLkr amount={entity.priceHint} /> : "Price on request"}
        </div>

        {extraImages.length ? (
          <div className="agency-gallery-entity-extra-images">
            {extraImages.slice(0, 5).map((m, idx) => (
              <CoverImage
                key={`${m.url}-${idx}`}
                src={m.url}
                className="agency-gallery-entity-extra-img"
                alt={m.label || entity.name}
              />
            ))}
          </div>
        ) : null}
      </div>
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
  const amountLkr = tour != null ? displayTourPrice(tour) : pkg.priceLkr;
  const inner = (
    <>
      <CoverImage src={image} className="agency-package-card-bg" />
      <div className="agency-package-card__blur" aria-hidden="true" />
      {tour && (
        <SaveTourButton tourId={tour.id} className="agency-package-save" />
      )}
      {tour && <span className="agency-package-days">{formatTourDaysNights(tour.days)}</span>}
      <div className="agency-package-card-body">
        <h3>{pkg.title}</h3>
        <p>{pkg.location}</p>
        <strong className="agency-package-price">
          <DisplayPriceText
            amountLkr={amountLkr}
            priceLabel={pkg.priceLabel}
            suffix=" / per person"
          />
        </strong>
        {href ? (
          <span className="agency-package-cta agency-package-cta--btn">View itinerary</span>
        ) : null}
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

export function AgencyDetailPage({ slugOverride }: { slugOverride?: string } = {}) {
  const params = useParams<{ slug: string }>();
  const slug = slugOverride ?? params.slug;
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref");
  const inquireTourId = searchParams.get("inquireTour");
  const focusInquiryForm =
    Boolean(inquireTourId) || location.hash === "#request-custom-tour";
  const { user, logout } = useAuth();
  const { publicOffersEnabled } = usePublicSmartFeatures();
  const agencyReturnPath = slug
    ? `/agencies/${slug}${refCode ? `?ref=${encodeURIComponent(refCode)}` : ""}`
    : "/";
  const [agency, setAgency] = useState<Agency | null>(null);
  const [navSolid, setNavSolid] = useState(false);

  const [galleryEntityModalOpen, setGalleryEntityModalOpen] = useState(false);
  const [galleryEntity, setGalleryEntity] = useState<GalleryEntitySnapshot | null>(null);

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
        body: JSON.stringify({ sessionId: newId() }),
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
  const transportOptions = resolveTransportOptions(content);
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

  const stripPackages = useMemo(() => {
    const fromPackages = packages
      .map((pkg) => {
        const tour = pkg.tourId ? tourById.get(pkg.tourId) : undefined;
        if (!tour) return null;
        return {
          id: tour.id,
          title: pkg.title || tour.title,
          slug: tour.slug,
          coverUrl: pkg.imageUrl || tour.coverUrl,
          basePriceLkr: tour.basePriceLkr,
          location: pkg.location,
          days: tour.days,
        };
      })
      .filter((p): p is NonNullable<typeof p> => Boolean(p));

    if (fromPackages.length > 0) return fromPackages;

    return (agency?.tours ?? []).map((tour) => ({
      id: tour.id,
      title: tour.title,
      slug: tour.slug,
      coverUrl: tour.coverUrl,
      basePriceLkr: tour.basePriceLkr,
      days: tour.days,
    }));
  }, [packages, tourById, agency?.tours]);

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

  const [col1, col2, col3] = splitGalleryColumns(gallery);
  const agencyFeatures = agency.features ?? {};
  /** Content stays visible; only inquiry/booking actions respect sell features. */
  const readyMadeInquireEnabled = agencyFeatures.readyMadeTours !== false;
  const customInquiriesEnabled = agencyFeatures.customInquiries !== false;
  const showBranding = sectionEnabled(enabled, "branding");
  const showTours = sectionEnabled(enabled, "tours");
  const showShowcase = sectionEnabled(enabled, "showcase");
  const showReviews = sectionEnabled(enabled, "reviews");
  const showGallery = sectionEnabled(enabled, "gallery");
  const showOffers = sectionEnabled(enabled, "offers");
  const displayInquiryOn = sectionEnabled(enabled, "inquiry");
  const canCustomInquire = displayInquiryOn && customInquiriesEnabled;
  const canTourInquire =
    displayInquiryOn && readyMadeInquireEnabled && Boolean(inquireTourId);
  const inquiryEnabled = canCustomInquire || canTourInquire;
  const showTransport = sectionEnabled(enabled, "transport");

  const ratingDisplay = content.ratingScore || String(agency.avgRating.toFixed(1));

  const hasLoyaltyOffers = publicOffersEnabled && showOffers && loyaltyOffers.length > 0;
  const hasCmsOffers = showOffers && cmsOffers.length > 0;
  const hasOffers = hasLoyaltyOffers || hasCmsOffers;
  const showStripBanner = hasLoyaltyOffers;
  const hasScenicContent =
    hasCmsOffers || showTours || showShowcase;
  const hasGallery = showGallery && gallery.length > 0;
  const heroSectionLinks: { id: string; label: string }[] = [];
  if ((showOffers && hasOffers) || showStripBanner) {
    heroSectionLinks.push({ id: "offers", label: "Offers" });
  }
  heroSectionLinks.push({ id: "who-we-are", label: "Who we are" });
  if (showTours) heroSectionLinks.push({ id: "packages", label: "Packages" });
  if (showShowcase && showReviews) heroSectionLinks.push({ id: "reviews", label: "Reviews" });
  if (hasGallery) heroSectionLinks.push({ id: "gallery", label: "Gallery" });
  if (showTransport && transportOptions.length > 0) heroSectionLinks.push({ id: "transport", label: "Transport" });
  if (canCustomInquire) heroSectionLinks.push({ id: "request-custom-tour", label: "Inquire" });

  return (
    <div className="agency-display">
      <header
        className={`topbar topbar--site topbar--hero${navSolid ? " topbar--hero-solid" : ""}`}
      >
        <ClientBrand
          name={agency.name}
          logoUrl={agency.logoUrl}
          to={`/agencies/${agency.slug}`}
          onImage
        />
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

      <section
        className={`agency-hero-banner${showStripBanner ? " agency-hero-banner--with-offer-strip" : ""}`}
        aria-label={`${agency.name} hero`}
      >
        <AgencyHeroBanner slides={heroSlides} />
        <div className="agency-hero-banner__content">
          {showBranding && (
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
          )}

          <div className="agency-hero-banner__copy">
            <h1>{content.heroHeadline}</h1>
            {content.heroSubheadline && (
              <p className="agency-hero-banner__lead">{content.heroSubheadline}</p>
            )}
            {agency.trustBadges && agency.trustBadges.length > 0 ? (
              <TrustBadgeRow
                badges={agency.trustBadges.map((b) => ({ ...b, earned: true }))}
                compact
              />
            ) : null}
            <CurrencyClarityNote className="agency-hero-currency-note" />
          </div>

          <div className="agency-hero-banner__actions">
            {(showOffers && hasOffers) || showStripBanner ? (
              <button type="button" className="agency-hero-banner__cta" onClick={scrollToOffers}>
                View offers
              </button>
            ) : null}
          </div>
        </div>
        <AgencyHeroSectionNav links={heroSectionLinks} />
        {showStripBanner && (
          <div className="agency-hero-offer-slot">
            <AgencyOfferFreeBanner
              agencyId={agency.id}
              agencyName={agency.name}
              agencySlug={agency.slug}
              packages={stripPackages}
              offers={loyaltyOffers}
              returnTo={agencyReturnPath}
              refCode={refCode}
              socialTagHandle={content.socialTagHandle}
            />
          </div>
        )}
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
                      <RichTextHtml html={offer.description} />
                      {offer.priceLabel && (
                        <p className="agency-offer-price">
                          <DisplayPriceText
                            amountLkr={offer.priceLkr}
                            priceLabel={offer.priceLabel}
                          />
                        </p>
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
                <div className="agency-showcase-rating">{ratingDisplay}</div>
                <div className="agency-showcase-rating-stars" aria-hidden="true">
                  {"★★★★★"}
                </div>
              </div>
            </div>

            <div className="agency-showcase-visual">
              {showReviews && visibleReviews.length > 0 ? (
                <AgencyReviewsFlipShowcase reviews={visibleReviews} />
              ) : (
                <blockquote className="agency-showcase-featured-quote agency-showcase-featured-quote--plain">
                  &ldquo;{content.featuredQuote}&rdquo;
                </blockquote>
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
                  <GalleryColumn
                    items={col1}
                    sizeClass="wide"
                    onSelect={(item) => {
                      if (!item.entity) return;
                      setGalleryEntity(item.entity);
                      setGalleryEntityModalOpen(true);
                    }}
                  />
                  <GalleryColumn
                    items={col2}
                    sizeClass="tall"
                    onSelect={(item) => {
                      if (!item.entity) return;
                      setGalleryEntity(item.entity);
                      setGalleryEntityModalOpen(true);
                    }}
                  />
                  <GalleryColumn
                    items={col3}
                    sizeClass="short"
                    onSelect={(item) => {
                      if (!item.entity) return;
                      setGalleryEntity(item.entity);
                      setGalleryEntityModalOpen(true);
                    }}
                  />
                </div>
              </section>
            </div>
          </div>
        )}

        {showTransport && transportOptions.length > 0 && (
          <div className="agency-display-band agency-display-band--transport">
            <div className="agency-display-inner">
              <AgencyTransportSection agencyName={agency.name} options={transportOptions} />
            </div>
          </div>
        )}

        <DashboardModal
          open={galleryEntityModalOpen}
          title={galleryEntity?.name ?? "Gallery"}
          subtitle={
            galleryEntity
              ? `${entityLocationLabel({
                  city: galleryEntity.city,
                  district: galleryEntity.district,
                  metadata: galleryEntity.metadata,
                })}`
              : undefined
          }
          onClose={() => {
            setGalleryEntityModalOpen(false);
            setGalleryEntity(null);
          }}
        >
          {galleryEntity ? (
            <GalleryEntityModalBody entity={galleryEntity} />
          ) : null}
        </DashboardModal>

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

        {displayInquiryOn && !inquiryEnabled && (
          <div className="agency-display-band agency-display-band--green">
            <div className="agency-display-inner">
              <div className="feature-unavailable-note" id="request-custom-tour">
                <strong>Online inquiries unavailable</strong>
                <p>
                  {!customInquiriesEnabled && !readyMadeInquireEnabled
                    ? "This agency is not accepting package or custom trip requests online right now."
                    : !customInquiriesEnabled
                      ? "Custom trip requests are paused. Browse published packages above if available."
                      : "Ready-made tour inquiries are paused. You may still request a custom trip if that option appears elsewhere."}
                </p>
                {(agency.contactEmail || agency.contactPhone) && (
                  <p className="feature-unavailable-note__contact">
                    Contact the agency directly
                    {agency.contactEmail ? (
                      <>
                        :{" "}
                        <a href={`mailto:${agency.contactEmail}`}>{agency.contactEmail}</a>
                      </>
                    ) : null}
                    {agency.contactPhone ? (
                      <>
                        {agency.contactEmail ? " · " : ": "}
                        <a href={`tel:${agency.contactPhone}`}>{agency.contactPhone}</a>
                      </>
                    ) : null}
                    .
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
