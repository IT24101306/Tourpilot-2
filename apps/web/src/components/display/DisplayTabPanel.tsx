import { FormEvent, useCallback, useEffect, useState } from "react";
import { displayTourPrice } from "@tourpilot/shared";
import { api, ApiError } from "../../api/client";
import { ImageUrlField } from "../ImageUrlField";
import { DashboardModal, ModalActions, ModalField } from "../DashboardModal";
import {
  DisplayCompactRow,
  DisplayFieldHint,
  DisplaySectionActions,
  DisplayStepNav,
  DisplayStepPanel,
  DisplayVisibilityToggle,
  type DisplayStep,
} from "./DisplayEditorUi";
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
  const [activeStep, setActiveStep] = useState<DisplayStep>("hero");
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
  const [editGalleryIndex, setEditGalleryIndex] = useState<number | null>(null);

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
    setPackageModalOpen(false);
    setEditPackageIndex(null);
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
    const entry = { url, label: galleryForm.label.trim() || "Gallery" };
    setConfig((prev) => {
      const gallery = [...prev.gallery];
      if (editGalleryIndex === null) gallery.push(entry);
      else gallery[editGalleryIndex] = entry;
      return { ...prev, gallery };
    });
    setGalleryForm({ url: "", label: "" });
    setEditGalleryIndex(null);
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

  function removeHeroSlide(index: number) {
    setConfig((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        heroImages: prev.content.heroImages.filter((_, j) => j !== index),
      },
    }));
    setHeroModalOpen(false);
    setEditHeroIndex(null);
  }

  function removeReview(index: number) {
    setConfig((prev) => ({
      ...prev,
      reviews: prev.reviews.filter((_, j) => j !== index),
    }));
    setReviewModalOpen(false);
    setEditReviewIndex(null);
  }

  function removeGalleryItem(index: number) {
    setConfig((prev) => ({
      ...prev,
      gallery: prev.gallery.filter((_, j) => j !== index),
    }));
    setGalleryModalOpen(false);
    setEditGalleryIndex(null);
  }

  function removeOffer(index: number) {
    setConfig((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        offers: prev.content.offers.filter((_, j) => j !== index),
      },
    }));
    setOfferModalOpen(false);
    setEditOfferIndex(null);
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
    <article className="agent-tab-panel display-editor">
      <div className="display-editor-toolbar">
        <div>
          <h2>Display page</h2>
          <p className="muted">Edit your public agency page one section at a time.</p>
        </div>
        <div className="display-editor-toolbar-actions">
          {displayPageUrl && (
            <a
              href={displayPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
            >
              Preview page ↗
            </a>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={saveSettings}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <DisplayStepNav active={activeStep} onChange={setActiveStep} />

      <div className="display-step-content">
        {activeStep === "hero" && (
          <DisplayStepPanel
            title="Hero banner"
            description="First thing visitors see — logo, scrolling photos, headline and subheadline."
          >
            <div className="display-field-stack">
              <ImageUrlField
                label="Agency logo"
                className="image-url-field--embedded"
                value={logoUrl}
                onChange={setLogoUrl}
                token={token}
              />
              <label>
                Headline
                <input
                  value={content.heroHeadline}
                  onChange={(e) => updateContent({ heroHeadline: e.target.value })}
                  maxLength={80}
                  placeholder="Find your perfect trip experience"
                />
                <DisplayFieldHint>Keep under ~60 characters for best layout.</DisplayFieldHint>
              </label>
              <label>
                Subheadline
                <textarea
                  rows={2}
                  value={content.heroSubheadline}
                  onChange={(e) => updateContent({ heroSubheadline: e.target.value })}
                  placeholder="A short line under your headline"
                  maxLength={160}
                />
              </label>
            </div>

            <div className="display-list-block">
              <p className="display-subsection-label">Banner slides</p>
              <p className="muted display-subsection-desc">
                Add 2+ images for automatic scrolling. First slide is also used on discovery cards.
              </p>
              {content.heroImages.length === 0 ? (
                <p className="display-empty-hint">No slides yet — add your first banner image.</p>
              ) : (
                <div className="display-compact-list">
                  {content.heroImages.map((slide, i) => (
                    <DisplayCompactRow
                      key={`${slide.url}-${i}`}
                      thumb={<img src={slide.url} alt="" className="display-compact-row-thumb" />}
                      title={slide.label?.trim() || `Slide ${i + 1}`}
                      meta={
                        <span className="muted">
                          {i + 1} of {content.heroImages.length}
                          {i > 0 && (
                            <>
                              {" · "}
                              <button
                                type="button"
                                className="display-inline-link"
                                onClick={() => moveHeroSlide(i, -1)}
                              >
                                Move up
                              </button>
                            </>
                          )}
                          {i < content.heroImages.length - 1 && (
                            <>
                              {" · "}
                              <button
                                type="button"
                                className="display-inline-link"
                                onClick={() => moveHeroSlide(i, 1)}
                              >
                                Move down
                              </button>
                            </>
                          )}
                        </span>
                      }
                      onEdit={() => {
                        setEditHeroIndex(i);
                        setHeroForm({ url: slide.url, label: slide.label || "" });
                        setHeroModalOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
              <DisplaySectionActions>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={content.heroImages.length >= 12}
                  onClick={() => {
                    setEditHeroIndex(null);
                    setHeroForm({ url: "", label: "" });
                    setHeroModalOpen(true);
                  }}
                >
                  + Add slide
                </button>
              </DisplaySectionActions>
            </div>
          </DisplayStepPanel>
        )}

        {activeStep === "packages" && (
          <DisplayStepPanel
            title="Ready-made packages"
            description="Tour cards shown on your public page. Leave empty to auto-list published tours."
          >
            <DisplayVisibilityToggle
              label="Show packages section"
              hint="Turn off to hide tour cards from your public page"
              checked={config.enabled.tours}
              onChange={(checked) => toggleSection("tours", checked)}
            />

            <div className="display-field-stack display-field-stack--spaced">
              <label>
                Section title
                <input
                  value={content.packagesTitle}
                  onChange={(e) => updateContent({ packagesTitle: e.target.value })}
                />
              </label>
              <label>
                Section subtitle
                <input
                  value={content.packagesSubtitle}
                  onChange={(e) => updateContent({ packagesSubtitle: e.target.value })}
                />
              </label>
            </div>

            <div className="display-list-block">
              <p className="display-subsection-label">Package cards</p>
              {config.content.packages.length === 0 ? (
                <p className="display-empty-hint">No custom packages — published tours may still appear.</p>
              ) : (
                <div className="display-compact-list">
                  {config.content.packages.map((p, i) => (
                    <DisplayCompactRow
                      key={`${p.tourId ?? p.title}-${i}`}
                      thumb={
                        p.imageUrl ? (
                          <img src={p.imageUrl} alt="" className="display-compact-row-thumb" />
                        ) : undefined
                      }
                      title={p.title}
                      meta={
                        <span className="muted">
                          {p.location} · {p.priceLabel}
                        </span>
                      }
                      onEdit={() => {
                        setEditPackageIndex(i);
                        setPackageForm(p);
                        setPackageModalOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}

              {publishedTours.length > 0 && (
                <div className="display-import-row">
                  <span className="muted">Quick import from tours:</span>
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

              <DisplaySectionActions>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setEditPackageIndex(null);
                    setPackageForm(defaultPackageForm());
                    setPackageModalOpen(true);
                  }}
                >
                  + Add package
                </button>
                <button type="button" className="btn btn-ghost" onClick={onGoToTours}>
                  Manage tours
                </button>
              </DisplaySectionActions>
            </div>
          </DisplayStepPanel>
        )}

        {activeStep === "showcase" && (
          <DisplayStepPanel
            title="Showcase & social proof"
            description="Rating block, featured photo, trust bullets, and guest reviews."
          >
            <DisplayVisibilityToggle
              label="Show showcase section"
              checked={config.enabled.showcase}
              onChange={(checked) => toggleSection("showcase", checked)}
            />

            <div className="display-rating-row">
              <label>
                Rating
                <input
                  value={content.ratingScore}
                  onChange={(e) => updateContent({ ratingScore: e.target.value })}
                  placeholder="4.9"
                />
              </label>
              <label>
                Suffix
                <input
                  value={content.ratingSuffix}
                  onChange={(e) => updateContent({ ratingSuffix: e.target.value })}
                  placeholder="/5"
                />
              </label>
              <label>
                CTA label
                <input
                  value={content.ctaLabel}
                  onChange={(e) => updateContent({ ctaLabel: e.target.value })}
                  placeholder="Plan your trip"
                />
              </label>
            </div>

            <div className="display-field-stack">
              <ImageUrlField
                label="Featured image"
                className="image-url-field--embedded"
                value={content.featuredImageUrl}
                onChange={(featuredImageUrl) => updateContent({ featuredImageUrl })}
                token={token}
              />
              <label>
                Featured quote
                <textarea
                  rows={3}
                  value={content.featuredQuote}
                  onChange={(e) => updateContent({ featuredQuote: e.target.value })}
                  placeholder="Guest testimonial on the featured photo"
                />
              </label>
            </div>

            <div className="display-list-block">
              <p className="display-subsection-label">Trust highlights</p>
              <div className="display-highlights-grid">
                {content.highlights.map((line, i) => (
                  <label key={i} className="display-highlight-row">
                    Highlight {i + 1}
                    <input
                      value={line}
                      onChange={(e) => updateHighlight(i, e.target.value)}
                      placeholder="e.g. Certified local guides"
                    />
                  </label>
                ))}
              </div>
              {content.highlights.length < 6 && (
                <DisplaySectionActions>
                  <button type="button" className="btn btn-lite" onClick={addHighlight}>
                    + Add highlight
                  </button>
                </DisplaySectionActions>
              )}
            </div>

            <div className="display-list-block">
              <DisplayVisibilityToggle
                label="Show reviews"
                hint="Guest quotes in the showcase column"
                checked={config.enabled.reviews}
                onChange={(checked) => toggleSection("reviews", checked)}
              />
              {config.reviews.length === 0 ? (
                <p className="display-empty-hint">No reviews yet.</p>
              ) : (
                <div className="display-compact-list">
                  {config.reviews.map((r, i) => (
                    <DisplayCompactRow
                      key={r.id || i}
                      title={r.authorName}
                      meta={
                        <>
                          <span className="muted">{"★".repeat(r.rating)}</span>
                          {r.body && <p className="muted">{r.body}</p>}
                        </>
                      }
                      onEdit={() => {
                        setEditReviewIndex(i);
                        setReviewForm(r);
                        setReviewModalOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
              <DisplaySectionActions>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setEditReviewIndex(null);
                    setReviewForm(defaultReviewForm());
                    setReviewModalOpen(true);
                  }}
                >
                  + Add review
                </button>
              </DisplaySectionActions>
            </div>
          </DisplayStepPanel>
        )}

        {activeStep === "gallery" && (
          <>
            <DisplayStepPanel title="Gallery" description="Photo wall on your public page.">
              <DisplayVisibilityToggle
                label="Show gallery"
                checked={config.enabled.gallery}
                onChange={(checked) => toggleSection("gallery", checked)}
              />
              {config.gallery.length === 0 ? (
                <p className="display-empty-hint">No gallery images yet.</p>
              ) : (
                <div className="display-compact-list">
                  {config.gallery.map((g, i) => (
                    <DisplayCompactRow
                      key={`${g.url}-${i}`}
                      thumb={<img src={g.url} alt="" className="display-compact-row-thumb" />}
                      title={g.label}
                      onEdit={() => {
                        setEditGalleryIndex(i);
                        setGalleryForm(g);
                        setGalleryModalOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
              <DisplaySectionActions>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setEditGalleryIndex(null);
                    setGalleryForm({ url: "", label: "" });
                    setGalleryModalOpen(true);
                  }}
                >
                  + Add image
                </button>
              </DisplaySectionActions>
            </DisplayStepPanel>

            <DisplayStepPanel
              title="Promotional offers"
              description="Simple promo banners. Registration offers are managed under the Offers tab."
            >
              <DisplayVisibilityToggle
                label="Show offers section"
                checked={config.enabled.offers}
                onChange={(checked) => toggleSection("offers", checked)}
              />
              {content.offers.length === 0 ? (
                <p className="display-empty-hint">No promo cards yet.</p>
              ) : (
                <div className="display-compact-list">
                  {content.offers.map((o, i) => (
                    <DisplayCompactRow
                      key={i}
                      thumb={
                        o.imageUrl ? (
                          <img src={o.imageUrl} alt="" className="display-compact-row-thumb" />
                        ) : undefined
                      }
                      title={o.title}
                      meta={
                        <span className="muted">
                          {o.badge && `${o.badge} · `}
                          {o.priceLabel || o.description}
                        </span>
                      }
                      onEdit={() => {
                        setEditOfferIndex(i);
                        setOfferForm({
                          ...o,
                          badge: o.badge || "",
                          imageUrl: o.imageUrl || "",
                        });
                        setOfferModalOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
              <DisplaySectionActions>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setEditOfferIndex(null);
                    setOfferForm(defaultOfferForm());
                    setOfferModalOpen(true);
                  }}
                >
                  + Add offer
                </button>
                <a href="/dashboard/agency/offers" className="btn btn-ghost">
                  Manage loyalty offers
                </a>
              </DisplaySectionActions>
            </DisplayStepPanel>
          </>
        )}

        {activeStep === "settings" && (
          <DisplayStepPanel title="Page settings" description="Inquiry form and partner commissions.">
            <DisplayVisibilityToggle
              label="Show inquiry form"
              hint={
                config.enabled.inquiry
                  ? "Visitors can send trip inquiries from your page"
                  : "Inquiry form is hidden on your public page"
              }
              checked={config.enabled.inquiry}
              onChange={(checked) => toggleSection("inquiry", checked)}
            />

            <div className="display-field-stack display-field-stack--spaced">
              <label htmlFor="influencerCommissionPct">
                Influencer commission (% of base tour price)
                <input
                  id="influencerCommissionPct"
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  value={influencerCommissionPct}
                  onChange={(e) => setInfluencerCommissionPct(Number(e.target.value) || 0)}
                />
              </label>
              <DisplayFieldHint>
                Added to your base price on public listings; influencers see their earn amount in LKR.
              </DisplayFieldHint>
            </div>
          </DisplayStepPanel>
        )}
      </div>

      <div className="display-save-bar">
        <div className="display-save-bar-copy">
          <strong>Ready to publish?</strong>
          <p className="muted">Save to update your public agency page.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary display-save-btn"
          disabled={saving}
          onClick={saveSettings}
        >
          {saving ? "Saving…" : "Save display settings"}
        </button>
      </div>
      {saveStatus && <p className="display-save-status">{saveStatus}</p>}

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
          {editPackageIndex !== null && (
            <button
              type="button"
              className="btn btn-lite display-modal-delete"
              onClick={() => removePackage(editPackageIndex)}
            >
              Remove package
            </button>
          )}
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
          {editReviewIndex !== null && (
            <button
              type="button"
              className="btn btn-lite display-modal-delete"
              onClick={() => removeReview(editReviewIndex)}
            >
              Remove review
            </button>
          )}
        </form>
      </DashboardModal>

      <DashboardModal
        open={galleryModalOpen}
        title={editGalleryIndex === null ? "Add gallery image" : "Edit gallery image"}
        subtitle="Images appear in the masonry gallery on your display page."
        onClose={() => {
          setGalleryModalOpen(false);
          setEditGalleryIndex(null);
        }}
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
          <ModalActions
            onCancel={() => {
              setGalleryModalOpen(false);
              setEditGalleryIndex(null);
            }}
            submitLabel={editGalleryIndex === null ? "Add image" : "Save image"}
          />
          {editGalleryIndex !== null && (
            <button
              type="button"
              className="btn btn-lite display-modal-delete"
              onClick={() => removeGalleryItem(editGalleryIndex)}
            >
              Remove image
            </button>
          )}
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
          {editHeroIndex !== null && (
            <button
              type="button"
              className="btn btn-lite display-modal-delete"
              onClick={() => removeHeroSlide(editHeroIndex)}
            >
              Remove slide
            </button>
          )}
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
          {editOfferIndex !== null && (
            <button
              type="button"
              className="btn btn-lite display-modal-delete"
              onClick={() => removeOffer(editOfferIndex)}
            >
              Remove offer
            </button>
          )}
        </form>
      </DashboardModal>
    </article>
  );
}
