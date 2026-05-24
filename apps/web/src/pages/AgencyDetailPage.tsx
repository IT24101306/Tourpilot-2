import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { AgencyInquirySection } from "../components/inquiry/AgencyInquirySection";
import {
  defaultDisplayConfig,
  sectionEnabled,
  type DisplayContent,
  type DisplayOffer,
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
  description: string | null;
  gallery: GalleryItem[];
  avgRating: number;
  reviewCount: number;
  tours: Tour[];
  reviews: { authorName: string; rating: number; body: string | null }[];
  display?: {
    enabled: DisplaySectionFlags;
    content: DisplayContent;
  };
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

export function AgencyDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref");
  const [agency, setAgency] = useState<Agency | null>(null);

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

  if (!agency) return <section className="section">Loading…</section>;

  function scrollToInquiry() {
    document.getElementById("request-custom-tour")?.scrollIntoView({ behavior: "smooth" });
  }

  const enabled = agency.display?.enabled ?? defaultDisplayConfig().enabled;
  const content = agency.display?.content ?? defaultDisplayConfig().content;
  const packages = content.packages;
  const offers = content.offers;
  const gallery = agency.gallery || [];
  const [col1, col2, col3] = splitGalleryColumns(gallery);

  const showTours = sectionEnabled(enabled, "tours");
  const showShowcase = sectionEnabled(enabled, "showcase");
  const showReviews = sectionEnabled(enabled, "reviews");
  const showGallery = sectionEnabled(enabled, "gallery");
  const showOffers = sectionEnabled(enabled, "offers");
  const inquiryEnabled = sectionEnabled(enabled, "inquiry");

  return (
    <div className="agency-display">
      <header className="topbar" style={{ background: "rgba(236,236,233,.95)" }}>
        <Link to="/" className="brand">
          Tour<span style={{ color: "var(--gold)" }}>Pilot</span>
        </Link>
        <Link to="/agencies" className="btn btn-ghost">
          All agencies
        </Link>
      </header>

      <div className="agency-display-inner">
        <p className="muted" style={{ margin: 0 }}>
          {agency.name}
        </p>

        <div className="agency-display-hero">
          <h1>{content.heroHeadline}</h1>
        </div>

        {showTours && (
          <section>
            <div className="agency-display-section-head">
              <h2>{content.packagesTitle}</h2>
              <p>{content.packagesSubtitle}</p>
            </div>
            {packages.length === 0 ? (
              <p className="muted">No packages published yet.</p>
            ) : (
              <div className="agency-package-row">
                {packages.map((pkg, i) => {
                  const tour = pkg.tourId
                    ? agency.tours.find((t) => t.id === pkg.tourId)
                    : undefined;
                  const href = tour ? `/tours/${agency.slug}/${tour.slug}` : null;
                  const inner = (
                    <>
                      <div
                        className="agency-package-card-bg"
                        style={{ backgroundImage: `url(${pkg.imageUrl})` }}
                      />
                      <div className="agency-package-card-body">
                        <h3>{pkg.title}</h3>
                        <p>{pkg.location}</p>
                        <strong>{pkg.priceLabel}</strong>
                      </div>
                    </>
                  );
                  return href ? (
                    <Link key={i} to={href} className="agency-package-card">
                      {inner}
                    </Link>
                  ) : (
                    <div key={i} className="agency-package-card">
                      {inner}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {showShowcase && (
          <section className="agency-showcase">
            <div className="agency-showcase-stats">
              <div className="agency-showcase-rating">
                {content.ratingScore}
                <span>{content.ratingSuffix}</span>
              </div>
              <ul>
                {content.highlights.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
              {inquiryEnabled && (
                <button type="button" className="agency-showcase-cta" onClick={scrollToInquiry}>
                  {content.ctaLabel}
                </button>
              )}
            </div>

            <div className="agency-showcase-featured">
              <div
                className="agency-showcase-featured-bg"
                style={{ backgroundImage: `url(${content.featuredImageUrl})` }}
              />
              <p className="agency-showcase-featured-quote">&ldquo;{content.featuredQuote}&rdquo;</p>
            </div>

            {showReviews && (
              <div className="agency-showcase-reviews">
                {agency.reviews.length === 0 ? (
                  <div className="agency-review-card">
                    <p className="muted">Testimonials will appear here once added.</p>
                  </div>
                ) : (
                  agency.reviews.map((r, i) => (
                    <div key={i} className="agency-review-card">
                      <div className="agency-review-stars">{"★".repeat(r.rating)}</div>
                      <p>&ldquo;{r.body}&rdquo;</p>
                      <strong>— {r.authorName}</strong>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        )}

        {showOffers && offers.length > 0 && (
          <section className="agency-offers">
            <div className="agency-display-section-head">
              <h2>Special offers</h2>
              <p>Limited deals and seasonal promotions from {agency.name}.</p>
            </div>
            <div className="agency-offers-grid">
              {offers.map((offer: DisplayOffer, i) => (
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
          </section>
        )}

        {showGallery && gallery.length > 0 && (
          <section className="agency-gallery-section">
            <div className="agency-display-section-head">
              <h2>Gallery</h2>
              <p>A living, asymmetric wall of moments from our tours.</p>
            </div>
            <div className="agency-gallery-wall">
              <GalleryColumn items={col1} sizeClass="wide" />
              <GalleryColumn items={col2} sizeClass="tall" />
              <GalleryColumn items={col3} sizeClass="short" />
            </div>
          </section>
        )}

        {agency.description && (
          <p style={{ marginTop: 40, maxWidth: 720, color: "#444", lineHeight: 1.6 }}>
            {agency.description}
          </p>
        )}
      </div>

      {inquiryEnabled && (
        <AgencyInquirySection
          agencyId={agency.id}
          agencyName={agency.name}
          refCode={refCode}
        />
      )}
    </div>
  );
}
