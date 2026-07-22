import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { CoverImage } from "../components/CoverImage";
import {
  DEFAULT_TOUR_COVER_URL,
  formatTourDaysNights,
  resolveImageUrl,
} from "@tourpilot/shared";
import { FormatTourPrice } from "../components/currency/FormatLkr";
import { type DiscoveryOffer } from "../components/discovery/DiscoveryOfferCard";
import { AgencyOffersFlipShowcase } from "../components/discovery/AgencyOffersFlipShowcase";
import { AgencyHeroBanner } from "../components/display/AgencyHeroBanner";
import { AgencyHeroSectionNav } from "../components/display/AgencyHeroSectionNav";
import { AgencyWhoWeAreSection } from "../components/display/AgencyWhoWeAreSection";
import type { DisplaySocialLink, HeroSlide } from "../components/display/displayTypes";
import { LineUserIcon } from "../components/icons/LineIcons";
import { NotificationBell } from "../components/NotificationBell";
import { ClientBrand } from "../components/ClientBrand";
import { SaveTourButton } from "../components/tourist/SaveTourButton";
import { AgencyInquirySection } from "../components/inquiry/AgencyInquirySection";
import { ChatRoomPopup } from "../components/inquiry/ChatRoomPopup";
import { DashboardModal } from "../components/DashboardModal";
import { offerBookPath } from "../lib/offerBookPaths";
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
  galleryImages?: HeroSlide[];
  agencyId: string;
  agency: { id: string; name: string; slug: string } | null;
  features?: {
    readyMadeTours?: boolean;
    customInquiries?: boolean;
    negotiationsBookings?: boolean;
    offers?: boolean;
  };
  hideAgencyName?: boolean;
  shareAsMine?: boolean;
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
  socialTagHandle?: string | null;
  tours: StorefrontTour[];
  offers: DiscoveryOffer[];
};

function InfluencerPackageCard({
  tour,
  onOpen,
}: {
  tour: StorefrontTour;
  onOpen?: () => void;
}) {
  const image = resolveImageUrl(tour.coverUrl, DEFAULT_TOUR_COVER_URL);
  const gallery = tour.galleryImages ?? [];
  const body = (
    <>
      <CoverImage src={image} className="agency-package-card-bg" />
      <SaveTourButton tourId={tour.id} className="agency-package-save" />
      <span className="agency-package-days">{formatTourDaysNights(tour.days)}</span>
      {gallery.length > 0 ? (
        <div className="influencer-package-gallery" aria-label="Tour photos">
          {gallery.map((slide, index) => (
            <CoverImage
              key={`${slide.url}-${index}`}
              src={slide.url}
              className="influencer-package-gallery__thumb"
              alt={slide.label || `Tour photo ${index + 1}`}
            />
          ))}
        </div>
      ) : null}
      <div className="agency-package-card-body">
        <h3>{tour.title}</h3>
        {!tour.shareAsMine && !tour.hideAgencyName && tour.agency ? (
          <p>{tour.agency.name}</p>
        ) : null}
        <strong>
          <FormatTourPrice amount={tour.publicPriceLkr} />
        </strong>
        <span className="agency-package-cta">
          {tour.shareAsMine ? "View details →" : "View itinerary →"}
        </span>
      </div>
    </>
  );

  if (tour.shareAsMine && onOpen) {
    return (
      <div className="agency-package-card influencer-package-card influencer-package-card--button">
        <button
          type="button"
          className="influencer-package-card__hit"
          onClick={onOpen}
          aria-label={`View ${tour.title}`}
        />
        {body}
      </div>
    );
  }

  return (
    <Link to={tour.tourPath} className="agency-package-card influencer-package-card">
      {body}
    </Link>
  );
}

export function InfluencerDetailPage({ slugOverride }: { slugOverride?: string } = {}) {
  const params = useParams<{ slug: string }>();
  const slug = slugOverride ?? params.slug;
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const returnPath = slug ? `/i/${slug}` : "/";
  const [store, setStore] = useState<Storefront | null>(null);
  const [missing, setMissing] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const [navSolid, setNavSolid] = useState(false);
  const [selectedTour, setSelectedTour] = useState<StorefrontTour | null>(null);
  const [chatInquiryId, setChatInquiryId] = useState<string | null>(null);

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
  const hasAbout = Boolean(aboutBody) || (storefront.socialLinks?.length ?? 0) > 0;

  const heroSectionLinks: { id: string; label: string }[] = [];
  if (hasAbout) heroSectionLinks.push({ id: "who-we-are", label: "About" });
  if (hasOffers) heroSectionLinks.push({ id: "offers", label: "Offers" });
  if (hasTours) heroSectionLinks.push({ id: "packages", label: "Tours" });

  function scrollToPackages() {
    document.getElementById("packages")?.scrollIntoView({ behavior: "smooth" });
  }

  function openOfferBook(offer: DiscoveryOffer) {
    navigate(offerBookPath(offer.id, returnPath));
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
        <ClientBrand name={storefront.name} to={`/i/${storefront.slug}`} onImage subtitle="Creator" />
        <nav className="nav nav--light" aria-label="Creator storefront">
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
          <AgencyOffersFlipShowcase
            offers={storefront.offers}
            agencyName={storefront.name}
            statusMsg={undefined}
            onRegister={openOfferBook}
          />
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
                    <InfluencerPackageCard
                      key={t.id}
                      tour={t}
                      onOpen={t.shareAsMine ? () => setSelectedTour(t) : undefined}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <DashboardModal
        open={Boolean(selectedTour)}
        title={selectedTour?.title ?? "Tour"}
        onClose={() => setSelectedTour(null)}
        dialogClassName="influencer-tour-popup-dialog"
      >
        {selectedTour && (
          <div className="influencer-tour-popup">
            <CoverImage
              src={resolveImageUrl(selectedTour.coverUrl, DEFAULT_TOUR_COVER_URL)}
              className="influencer-tour-popup__cover"
              alt=""
            />
            <p className="muted">
              {formatTourDaysNights(selectedTour.days)} ·{" "}
              <FormatTourPrice amount={selectedTour.publicPriceLkr} />
            </p>
            {selectedTour.summary ? <p>{selectedTour.summary}</p> : null}
            {(selectedTour.galleryImages?.length ?? 0) > 0 && (
              <div className="influencer-tour-popup__gallery">
                {selectedTour.galleryImages!.map((slide, i) => (
                  <CoverImage
                    key={`${slide.url}-${i}`}
                    src={slide.url}
                    className="influencer-tour-popup__thumb"
                    alt={slide.label || `Photo ${i + 1}`}
                  />
                ))}
              </div>
            )}
            {selectedTour.features?.readyMadeTours === false ? (
              <p className="feature-unavailable-note">
                Online inquiries are not available for this tour&apos;s agency right now.
              </p>
            ) : (
              <AgencyInquirySection
                agencyId={selectedTour.agencyId}
                agencyName={storefront.name}
                agencySlug={selectedTour.agency?.slug ?? "partner"}
                influencerSlug={storefront.slug}
                refCode={selectedTour.refCode}
                tour={{
                  id: selectedTour.id,
                  title: selectedTour.title,
                  slug: selectedTour.slug,
                  days: selectedTour.days,
                  basePriceLkr: selectedTour.publicPriceLkr,
                  publicPriceLkr: selectedTour.publicPriceLkr,
                }}
                embedded
                openChatOnSuccess={false}
                onSuccess={(inquiryId) => {
                  setSelectedTour(null);
                  setChatInquiryId(inquiryId);
                }}
              />
            )}
          </div>
        )}
      </DashboardModal>
      <ChatRoomPopup
        open={Boolean(chatInquiryId)}
        inquiryId={chatInquiryId}
        partnerName={storefront?.name}
        onClose={() => setChatInquiryId(null)}
      />
    </div>
  );
}
