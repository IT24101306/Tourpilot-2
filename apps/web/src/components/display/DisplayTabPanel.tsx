import { FormEvent, useCallback, useEffect, useState } from "react";
import { displayTourPrice } from "@tourpilot/shared";
import { api, ApiError } from "../../api/client";
import { ImageUrlField } from "../ImageUrlField";
import { DashboardModal, ModalActions, ModalField } from "../DashboardModal";
import {
  defaultDisplayConfig,
  type DisplayConfig,
  type DisplayContent,
  type DisplayOffer,
  type DisplayPackage,
  type DisplayReview,
  type DisplaySectionFlags,
  type GalleryItem,
  type HeroSlide,
} from "./displayTypes";

type PublishedTour = {
  id: string;
  title: string;
  slug: string;
  days: number;
  summary: string | null;
  basePriceLkr: number;
  influencerCommissionLkr?: number;
  publicPriceLkr?: number;
  coverUrl: string | null;
  districtTags: unknown;
};

type DisplayPayload = {
  slug: string;
  logoUrl: string | null;
  coverUrl: string | null;
  influencerCommissionPct: number;
  enabled: DisplaySectionFlags;
  content: DisplayContent;
  gallery: GalleryItem[];
  reviews: DisplayReview[];
  publishedTours: PublishedTour[];
};

type Props = {
  token: string | null;
  agencySlug?: string;
  onGoToTours: () => void;
};

const defaultReviewForm = (): DisplayReview => ({
  authorName: "",
  rating: 5,
  body: "",
});

const defaultPackageForm = (): DisplayPackage => ({
  title: "",
  location: "",
  priceLabel: "",
  imageUrl: "",
});

const defaultOfferForm = (): DisplayOffer => ({
  title: "",
  description: "",
  priceLabel: "",
  badge: "",
  imageUrl: "",
});

export function DisplayTabPanel({ token, agencySlug, onGoToTours }: Props) {
  const [config, setConfig] = useState<DisplayConfig>(defaultDisplayConfig);
  const [publishedTours, setPublishedTours] = useState<PublishedTour[]>([]);
  const [slug, setSlug] = useState(agencySlug || "");
  const [logoUrl, setLogoUrl] = useState("");
  const [influencerCommissionPct, setInfluencerCommissionPct] = useState(8);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [heroModalOpen, setHeroModalOpen] = useState(false);

  const [reviewForm, setReviewForm] = useState<DisplayReview>(defaultReviewForm);
  const [packageForm, setPackageForm] = useState<DisplayPackage>(defaultPackageForm);
  const [galleryForm, setGalleryForm] = useState<GalleryItem>({ url: "", label: "" });
  const [offerForm, setOfferForm] = useState<DisplayOffer>(defaultOfferForm);
  const [heroForm, setHeroForm] = useState<HeroSlide>({ url: "", label: "" });

  const [editReviewIndex, setEditReviewIndex] = useState<number | null>(null);
  const [editPackageIndex, setEditPackageIndex] = useState<number | null>(null);
  const [editOfferIndex, setEditOfferIndex] = useState<number | null>(null);
  const [editHeroIndex, setEditHeroIndex] = useState<number | null>(null);

  const loadDisplay = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api<DisplayPayload>("/agencies/mine/display", { token });
      setSlug(data.slug);
      setLogoUrl(data.logoUrl || "");
      setInfluencerCommissionPct(data.influencerCommissionPct ?? influencerCommissionPct);
      setPublishedTours(data.publishedTours);
      setConfig({
        enabled: data.enabled,
        content: data.content,
        gallery: data.gallery,
        reviews: data.reviews,
      });
    } catch (err) {
      console.error(err);
      setSaveStatus(err instanceof ApiError ? err.message : "Failed to load display settings");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadDisplay();
  }, [loadDisplay]);

  useEffect(() => {
    if (agencySlug) setSlug(agencySlug);
  }, [agencySlug]);

  function toggleSection(key: keyof DisplaySectionFlags, checked: boolean) {
    setConfig((prev) => ({
      ...prev,
      enabled: { ...prev.enabled, [key]: checked },
    }));
  }

  function updateContent(patch: Partial<DisplayContent>) {
    setConfig((prev) => ({ ...prev, content: { ...prev.content, ...patch } }));
  }

  function updateHighlight(index: number, value: string) {
    const highlights = [...config.content.highlights];
    highlights[index] = value;
    updateContent({ highlights });
  }

  function addHighlight() {
    if (config.content.highlights.length >= 6) return;
    updateContent({ highlights: [...config.content.highlights, ""] });
  }

  async function saveSettings() {
    if (!token) return;
    setSaving(true);
    setSaveStatus("");
    try {
      const data = await api<DisplayPayload>("/agencies/mine/display", {
        method: "PUT",
        token,
        body: JSON.stringify({
          influencerCommissionPct,
          logoUrl: logoUrl.trim() || undefined,
          enabled: config.enabled,
          content: {
            ...config.content,
            highlights: config.content.highlights.map((h) => h.trim()).filter(Boolean),
          },
          gallery: config.gallery,
          reviews: config.reviews.map(({ authorName, rating, body }) => ({
            authorName,
            rating,
            body,
          })),
        }),
      });
      setSlug(data.slug);
      setLogoUrl(data.logoUrl || logoUrl);
      setInfluencerCommissionPct(data.influencerCommissionPct ?? influencerCommissionPct);
      setConfig({
        enabled: data.enabled,
        content: data.content,
        gallery: data.gallery,
        reviews: data.reviews,
      });
      setSaveStatus("Display settings saved.");
    } catch (err) {
      setSaveStatus(err instanceof ApiError ? err.message : "Failed to save display settings");
    } finally {
      setSaving(false);
    }
  }

  function importTourAsPackage(tour: PublishedTour) {
    const districts = Array.isArray(tour.districtTags)
      ? (tour.districtTags as string[]).filter(Boolean)
      : [];
    const pkg: DisplayPackage = {
      title: tour.title,
      location: districts[0] || tour.summary || `${tour.days} day tour`,
      priceLabel: `LKR ${displayTourPrice(tour).toLocaleString()} / per person`,
      imageUrl: tour.coverUrl || "https://images.unsplash.com/photo-1682687982501-1e58ab814714?auto=format&fit=crop&w=1200&q=80",
      tourId: tour.id,
    };
    setPackageForm(pkg);
    setEditPackageIndex(null);
    setPackageModalOpen(true);
  }

  function savePackage(e: FormEvent) {
    e.preventDefault();
    const entry = {
      ...packageForm,
      title: packageForm.title.trim(),
      location: packageForm.location.trim(),
      priceLabel: packageForm.priceLabel.trim() || "Contact for price",
      imageUrl: packageForm.imageUrl.trim(),
    };
    if (!entry.title || !entry.imageUrl) return;

    setConfig((prev) => {
      const packages = [...prev.content.packages];
      if (editPackageIndex === null) packages.push(entry);
      else packages[editPackageIndex] = entry;
      return { ...prev, content: { ...prev.content, packages } };
    });
    setPackageModalOpen(false);
  }

  function removePackage(index: number) {
    setConfig((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        packages: prev.content.packages.filter((_, i) => i !== index),
      },
    }));
  }

  function saveReview(e: FormEvent) {
    e.preventDefault();
    const entry: DisplayReview = {
      ...reviewForm,
      authorName: reviewForm.authorName.trim(),
      body: reviewForm.body.trim(),
    };
    if (!entry.authorName) return;

    setConfig((prev) => {
      const reviews = [...prev.reviews];
      if (editReviewIndex === null) reviews.push(entry);
      else reviews[editReviewIndex] = entry;
      return { ...prev, reviews };
    });
    setReviewModalOpen(false);
  }

  function saveGalleryItem(e: FormEvent) {
    e.preventDefault();
    const url = galleryForm.url.trim();
    if (!url) return;
    setConfig((prev) => ({
      ...prev,
      gallery: [...prev.gallery, { url, label: galleryForm.label.trim() || "Gallery" }],
    }));
    setGalleryForm({ url: "", label: "" });
    setGalleryModalOpen(false);
  }

  function saveHeroSlide(e: FormEvent) {
    e.preventDefault();
    const url = heroForm.url.trim();
    if (!url) return;
    const entry: HeroSlide = {
      url,
      label: heroForm.label?.trim() || undefined,
    };

    setConfig((prev) => {
      const heroImages = [...prev.content.heroImages];
      if (editHeroIndex === null) heroImages.push(entry);
      else heroImages[editHeroIndex] = entry;
      return { ...prev, content: { ...prev.content, heroImages } };
    });
    setHeroModalOpen(false);
  }

  function moveHeroSlide(index: number, direction: -1 | 1) {
    setConfig((prev) => {
      const heroImages = [...prev.content.heroImages];
      const next = index + direction;
      if (next < 0 || next >= heroImages.length) return prev;
      [heroImages[index], heroImages[next]] = [heroImages[next], heroImages[index]];
      return { ...prev, content: { ...prev.content, heroImages } };
    });
  }

  function saveOffer(e: FormEvent) {
    e.preventDefault();
    const entry: DisplayOffer = {
      title: offerForm.title.trim(),
      description: offerForm.description.trim(),
      priceLabel: offerForm.priceLabel.trim(),
      badge: offerForm.badge?.trim() || undefined,
      imageUrl: offerForm.imageUrl?.trim() || undefined,
    };
    if (!entry.title) return;

    setConfig((prev) => {
      const offers = [...prev.content.offers];
      if (editOfferIndex === null) offers.push(entry);
      else offers[editOfferIndex] = entry;
      return { ...prev, content: { ...prev.content, offers } };
    });
    setOfferModalOpen(false);
  }

  const displayPageUrl = slug ? `/agencies/${slug}` : "";
  const { content } = config;

  if (loading) {
    return (
      <article className="agent-tab-panel">
        <p className="muted">Loading display settings…</p>
      </article>
    );
  }

  return (
    <article className="agent-tab-panel">
      <div className="panel-head display-panel-head">
        <div>
          <h2>Agency Display Customization</h2>
          <p>Customize what sections appear on your public agency display page.</p>
        </div>
        {displayPageUrl && (
          <a
            href={displayPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost display-view-btn"
          >
            View display page
          </a>
        )}
      </div>

      <section className="display-section-card agency-partner-settings">
        <h3>Influencer referrals</h3>
        <p className="muted">
          One commission rate for all ready-made tours. It is added to your base price on public
          listings; influencers see their earn amount in LKR.
        </p>
        <label htmlFor="influencerCommissionPct">Commission (% of base tour price)</label>
        <input
          id="influencerCommissionPct"
          type="number"
          min={0}
          max={50}
          step={0.5}
          value={influencerCommissionPct}
          onChange={(e) => setInfluencerCommissionPct(Number(e.target.value) || 0)}
        />
      </section>

      <div className="display-sections">
        <section className="display-section-card display-copy-card display-hero-card">
          <h3>Hero banner</h3>
          <p className="muted display-section-desc">
            Full-width banner at the top of your public page. Add multiple images for an automatic
            left-to-right scroll. Headline and subheadline overlay the banner.
          </p>
          <div className="display-field-grid">
            <div className="full">
              <ImageUrlField
                label="Agency logo"
                className="image-url-field--embedded image-url-field--full"
                value={logoUrl}
                onChange={setLogoUrl}
                token={token}
              />
            </div>
            <label>
              Hero headline
              <input
                value={content.heroHeadline}
                onChange={(e) => updateContent({ heroHeadline: e.target.value })}
              />
            </label>
            <label className="full">
              Hero subheadline
              <textarea
                rows={2}
                value={content.heroSubheadline}
                onChange={(e) => updateContent({ heroSubheadline: e.target.value })}
                placeholder="A short line under your headline"
              />
            </label>
          </div>

          {content.heroImages.length > 0 && (
            <ul className="display-item-list display-hero-list">
              {content.heroImages.map((slide, i) => (
                <li key={`${slide.url}-${i}`} className="display-review-item">
                  <div className="display-hero-thumb-wrap">
                    <img src={slide.url} alt="" className="display-hero-thumb" />
                    <div>
                      <strong>Slide {i + 1}</strong>
                      {slide.label && <span className="muted"> · {slide.label}</span>}
                    </div>
                  </div>
                  <div className="display-item-actions">
                    <button
                      type="button"
                      className="btn btn-lite"
                      disabled={i === 0}
                      onClick={() => moveHeroSlide(i, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-lite"
                      disabled={i === content.heroImages.length - 1}
                      onClick={() => moveHeroSlide(i, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn btn-lite"
                      onClick={() => {
                        setEditHeroIndex(i);
                        setHeroForm({ url: slide.url, label: slide.label || "" });
                        setHeroModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-lite"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          content: {
                            ...prev.content,
                            heroImages: prev.content.heroImages.filter((_, j) => j !== i),
                          },
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            className="btn btn-primary display-section-btn"
            disabled={content.heroImages.length >= 12}
            onClick={() => {
              setEditHeroIndex(null);
              setHeroForm({ url: "", label: "" });
              setHeroModalOpen(true);
            }}
          >
            + Add hero image
          </button>
        </section>

        <section className="display-section-card display-copy-card">
          <h3>Page sections</h3>
          <div className="display-field-grid">
            <label>
              Packages title
              <input
                value={content.packagesTitle}
                onChange={(e) => updateContent({ packagesTitle: e.target.value })}
              />
            </label>
            <label className="full">
              Packages subtitle
              <input
                value={content.packagesSubtitle}
                onChange={(e) => updateContent({ packagesSubtitle: e.target.value })}
              />
            </label>
          </div>
        </section>

        <section className="display-section-card">
          <div className="display-section-head">
            <h3>Ready-Made Packages</h3>
            <label className="display-enable">
              <input
                type="checkbox"
                checked={config.enabled.tours}
                onChange={(e) => toggleSection("tours", e.target.checked)}
              />
              <span>Enable</span>
            </label>
          </div>
          <p className="muted display-section-desc">
            Horizontal package cards on your display page. Leave empty to auto-show published tours.
          </p>
          {config.content.packages.length > 0 && (
            <ul className="display-item-list">
              {config.content.packages.map((p, i) => (
                <li key={i} className="display-review-item">
                  <div>
                    <strong>{p.title}</strong>
                    <span className="muted">
                      {" "}
                      · {p.location} · {p.priceLabel}
                    </span>
                  </div>
                  <div className="display-item-actions">
                    <button
                      type="button"
                      className="btn btn-lite"
                      onClick={() => {
                        setEditPackageIndex(i);
                        setPackageForm(p);
                        setPackageModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className="btn btn-lite" onClick={() => removePackage(i)}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {publishedTours.length > 0 && (
            <div className="display-import-row">
              <span className="muted">Import from published tours:</span>
              <div className="display-import-btns">
                {publishedTours.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="btn btn-lite"
                    onClick={() => importTourAsPackage(t)}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            type="button"
            className="btn btn-primary display-section-btn"
            onClick={() => {
              setEditPackageIndex(null);
              setPackageForm(defaultPackageForm());
              setPackageModalOpen(true);
            }}
          >
            + Add Tour Package
          </button>
          <button type="button" className="btn btn-lite display-section-btn" onClick={onGoToTours}>
            Manage tours in Tours tab
          </button>
        </section>

        <section className="display-section-card">
          <div className="display-section-head">
            <h3>Showcase (rating &amp; featured)</h3>
            <label className="display-enable">
              <input
                type="checkbox"
                checked={config.enabled.showcase}
                onChange={(e) => toggleSection("showcase", e.target.checked)}
              />
              <span>Enable</span>
            </label>
          </div>
          <div className="display-field-grid">
            <label>
              Rating score
              <input
                value={content.ratingScore}
                onChange={(e) => updateContent({ ratingScore: e.target.value })}
              />
            </label>
            <label>
              Rating suffix
              <input
                value={content.ratingSuffix}
                onChange={(e) => updateContent({ ratingSuffix: e.target.value })}
              />
            </label>
            <label>
              CTA button label
              <input
                value={content.ctaLabel}
                onChange={(e) => updateContent({ ctaLabel: e.target.value })}
              />
            </label>
            <div className="full">
              <ImageUrlField
                label="Featured image"
                className="image-url-field--embedded image-url-field--full"
                value={content.featuredImageUrl}
                onChange={(featuredImageUrl) => updateContent({ featuredImageUrl })}
                token={token}
              />
            </div>
            <label className="full">
              Featured quote
              <textarea
                rows={3}
                value={content.featuredQuote}
                onChange={(e) => updateContent({ featuredQuote: e.target.value })}
              />
            </label>
          </div>
          <p className="muted display-section-desc">Highlight bullets (left card)</p>
          {content.highlights.map((line, i) => (
            <label key={i} className="display-highlight-row">
              Bullet {i + 1}
              <input value={line} onChange={(e) => updateHighlight(i, e.target.value)} />
            </label>
          ))}
          {content.highlights.length < 6 && (
            <button type="button" className="btn btn-lite" onClick={addHighlight}>
              + Add highlight
            </button>
          )}
        </section>

        <section className="display-section-card">
          <div className="display-section-head">
            <h3>Reviews &amp; Testimonials</h3>
            <label className="display-enable">
              <input
                type="checkbox"
                checked={config.enabled.reviews}
                onChange={(e) => toggleSection("reviews", e.target.checked)}
              />
              <span>Enable</span>
            </label>
          </div>
          <p className="muted display-section-desc">Shown in the right column of the showcase</p>
          {config.reviews.length > 0 && (
            <ul className="display-item-list">
              {config.reviews.map((r, i) => (
                <li key={r.id || i} className="display-review-item">
                  <div>
                    <strong>{r.authorName}</strong>
                    <span className="muted"> · {"★".repeat(r.rating)}</span>
                    {r.body && <p className="muted">{r.body}</p>}
                  </div>
                  <div className="display-item-actions">
                    <button
                      type="button"
                      className="btn btn-lite"
                      onClick={() => {
                        setEditReviewIndex(i);
                        setReviewForm(r);
                        setReviewModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-lite"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          reviews: prev.reviews.filter((_, j) => j !== i),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="btn btn-primary display-section-btn"
            onClick={() => {
              setEditReviewIndex(null);
              setReviewForm(defaultReviewForm());
              setReviewModalOpen(true);
            }}
          >
            + Add Review
          </button>
        </section>

        <section className="display-section-card">
          <div className="display-section-head">
            <h3>Gallery</h3>
            <label className="display-enable">
              <input
                type="checkbox"
                checked={config.enabled.gallery}
                onChange={(e) => toggleSection("gallery", e.target.checked)}
              />
              <span>Enable</span>
            </label>
          </div>
          <p className="muted display-section-desc">Asymmetric gallery wall with image labels</p>
          {config.gallery.length > 0 && (
            <ul className="display-item-list">
              {config.gallery.map((g, i) => (
                <li key={`${g.url}-${i}`}>
                  <strong>{g.label}</strong>
                  <span className="muted"> · {g.url.slice(0, 48)}…</span>
                  <button
                    type="button"
                    className="btn btn-lite"
                    style={{ marginTop: 6 }}
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        gallery: prev.gallery.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="btn btn-primary display-section-btn"
            onClick={() => {
              setGalleryForm({ url: "", label: "" });
              setGalleryModalOpen(true);
            }}
          >
            + Add Gallery Image
          </button>
        </section>

        <section className="display-section-card">
          <div className="display-section-head">
            <h3>Special Offers</h3>
            <label className="display-enable">
              <input
                type="checkbox"
                checked={config.enabled.offers}
                onChange={(e) => toggleSection("offers", e.target.checked)}
              />
              <span>Enable</span>
            </label>
          </div>
          <p className="muted display-section-desc">
            Registration-cap loyalty offers are managed under the{" "}
            <a href="/dashboard/agency/offers">Offers</a> tab and shown here when active. Use the
            cards below for simple promotional banners.
          </p>
          {content.offers.length > 0 && (
            <ul className="display-item-list">
              {content.offers.map((o, i) => (
                <li key={i} className="display-review-item">
                  <div>
                    <strong>{o.title}</strong>
                    {o.badge && <span className="muted"> · {o.badge}</span>}
                    <p className="muted">{o.description}</p>
                  </div>
                  <div className="display-item-actions">
                    <button
                      type="button"
                      className="btn btn-lite"
                      onClick={() => {
                        setEditOfferIndex(i);
                        setOfferForm({
                          ...o,
                          badge: o.badge || "",
                          imageUrl: o.imageUrl || "",
                        });
                        setOfferModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-lite"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          content: {
                            ...prev.content,
                            offers: prev.content.offers.filter((_, j) => j !== i),
                          },
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="btn btn-primary display-section-btn"
            onClick={() => {
              setEditOfferIndex(null);
              setOfferForm(defaultOfferForm());
              setOfferModalOpen(true);
            }}
          >
            + Add Offer
          </button>
        </section>

        <section className="display-section-card">
          <div className="display-section-head">
            <h3>Inquiry Form</h3>
            <label className="display-enable">
              <input
                type="checkbox"
                checked={config.enabled.inquiry}
                onChange={(e) => toggleSection("inquiry", e.target.checked)}
              />
              <span>Enable</span>
            </label>
          </div>
          <p className="display-inquiry-hint">
            {config.enabled.inquiry
              ? "Visitors can plan trips and send inquiries from your public page."
              : "Inquiry form is hidden on your public page."}
          </p>
        </section>

        <button
          type="button"
          className="btn btn-primary display-save-btn"
          disabled={saving}
          onClick={saveSettings}
        >
          {saving ? "Saving…" : "Save Display Settings"}
        </button>
        {saveStatus && <p className="display-save-status">{saveStatus}</p>}
      </div>

      <DashboardModal
        open={packageModalOpen}
        title={editPackageIndex === null ? "Add Tour Package" : "Edit Tour Package"}
        subtitle="Shown on your public display page as a ready-made package card."
        onClose={() => setPackageModalOpen(false)}
      >
        <form onSubmit={savePackage}>
          <div className="entity-form-grid">
            <ModalField label="Title">
              <input
                type="text"
                value={packageForm.title}
                onChange={(e) => setPackageForm({ ...packageForm, title: e.target.value })}
                placeholder="Desert Journey"
                required
                autoFocus
              />
            </ModalField>
            <ModalField label="Location">
              <input
                type="text"
                value={packageForm.location}
                onChange={(e) => setPackageForm({ ...packageForm, location: e.target.value })}
                placeholder="Ella, Sri Lanka"
              />
            </ModalField>
            <ModalField label="Price label">
              <input
                type="text"
                value={packageForm.priceLabel}
                onChange={(e) => setPackageForm({ ...packageForm, priceLabel: e.target.value })}
                placeholder="LKR 49,000 / per person"
              />
            </ModalField>
            <ModalField label="Package image" full>
              <ImageUrlField
                label=""
                className="image-url-field--embedded"
                value={packageForm.imageUrl}
                onChange={(imageUrl) => setPackageForm({ ...packageForm, imageUrl })}
                token={token}
              />
            </ModalField>
          </div>
          <ModalActions
            onCancel={() => setPackageModalOpen(false)}
            submitLabel="Save package"
          />
        </form>
      </DashboardModal>

      <DashboardModal
        open={reviewModalOpen}
        title={editReviewIndex === null ? "Add Review" : "Edit Review"}
        subtitle="Testimonials appear in the showcase column on your display page."
        onClose={() => setReviewModalOpen(false)}
      >
        <form onSubmit={saveReview}>
          <div className="entity-form-grid">
            <ModalField label="Author name">
              <input
                type="text"
                value={reviewForm.authorName}
                onChange={(e) => setReviewForm({ ...reviewForm, authorName: e.target.value })}
                required
                autoFocus
              />
            </ModalField>
            <ModalField label="Rating (1–5)">
              <input
                type="number"
                min={1}
                max={5}
                value={reviewForm.rating}
                onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
                required
              />
            </ModalField>
            <ModalField label="Review text" full>
              <textarea
                rows={4}
                value={reviewForm.body}
                onChange={(e) => setReviewForm({ ...reviewForm, body: e.target.value })}
                placeholder="Guest quote…"
              />
            </ModalField>
          </div>
          <ModalActions onCancel={() => setReviewModalOpen(false)} submitLabel="Save review" />
        </form>
      </DashboardModal>

      <DashboardModal
        open={galleryModalOpen}
        title="Add Gallery Image"
        subtitle="Images appear in the masonry gallery on your display page."
        onClose={() => setGalleryModalOpen(false)}
      >
        <form onSubmit={saveGalleryItem}>
          <div className="entity-form-grid">
            <ModalField label="Gallery image" full>
              <ImageUrlField
                label=""
                className="image-url-field--embedded"
                value={galleryForm.url}
                onChange={(url) => setGalleryForm({ ...galleryForm, url })}
                token={token}
              />
            </ModalField>
            <ModalField label="Label" full>
              <input
                type="text"
                value={galleryForm.label}
                onChange={(e) => setGalleryForm({ ...galleryForm, label: e.target.value })}
                placeholder="Sand Morning"
              />
            </ModalField>
          </div>
          <ModalActions onCancel={() => setGalleryModalOpen(false)} submitLabel="Add image" />
        </form>
      </DashboardModal>

      <DashboardModal
        open={heroModalOpen}
        title={editHeroIndex === null ? "Add hero image" : "Edit hero image"}
        subtitle="Images scroll automatically when you add two or more."
        onClose={() => setHeroModalOpen(false)}
      >
        <form onSubmit={saveHeroSlide}>
          <div className="entity-form-grid">
            <ModalField label="Hero image" full>
              <ImageUrlField
                label=""
                className="image-url-field--embedded"
                value={heroForm.url}
                onChange={(url) => setHeroForm({ ...heroForm, url })}
                token={token}
              />
            </ModalField>
            <ModalField label="Caption (optional)" full>
              <input
                type="text"
                value={heroForm.label || ""}
                onChange={(e) => setHeroForm({ ...heroForm, label: e.target.value })}
                placeholder="Sigiriya sunrise"
              />
            </ModalField>
          </div>
          <ModalActions
            onCancel={() => setHeroModalOpen(false)}
            submitLabel={editHeroIndex === null ? "Add slide" : "Save slide"}
          />
        </form>
      </DashboardModal>

      <DashboardModal
        open={offerModalOpen}
        title={editOfferIndex === null ? "Add Offer" : "Edit Offer"}
        subtitle="Special offers appear in their own section on your display page."
        onClose={() => setOfferModalOpen(false)}
      >
        <form onSubmit={saveOffer}>
          <div className="entity-form-grid">
            <ModalField label="Title">
              <input
                type="text"
                value={offerForm.title}
                onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })}
                required
                autoFocus
              />
            </ModalField>
            <ModalField label="Badge (optional)">
              <input
                type="text"
                value={offerForm.badge || ""}
                onChange={(e) => setOfferForm({ ...offerForm, badge: e.target.value })}
                placeholder="Limited"
              />
            </ModalField>
            <ModalField label="Description" full>
              <textarea
                rows={3}
                value={offerForm.description}
                onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })}
              />
            </ModalField>
            <ModalField label="Price / savings label">
              <input
                type="text"
                value={offerForm.priceLabel}
                onChange={(e) => setOfferForm({ ...offerForm, priceLabel: e.target.value })}
                placeholder="Save up to 15%"
              />
            </ModalField>
            <ModalField label="Offer image (optional)" full>
              <ImageUrlField
                label=""
                className="image-url-field--embedded"
                value={offerForm.imageUrl || ""}
                onChange={(imageUrl) => setOfferForm({ ...offerForm, imageUrl })}
                token={token}
              />
            </ModalField>
          </div>
          <ModalActions onCancel={() => setOfferModalOpen(false)} submitLabel="Save offer" />
        </form>
      </DashboardModal>
    </article>
  );
}
