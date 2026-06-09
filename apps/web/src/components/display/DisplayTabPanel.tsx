import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { displayTourPrice } from "@tourpilot/shared";
import { api, ApiError } from "../../api/client";
import { useConfirmAction } from "../confirm/ConfirmActionContext";
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
  SOCIAL_PLATFORMS,
  type DisplayConfig,
  type DisplayContent,
  type DisplayOffer,
  type DisplayPackage,
  type DisplayReview,
  type DisplaySectionFlags,
  type DisplaySocialLink,
  type GalleryItem,
  type HeroSlide,
  type WhoWeAreImage,
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

const defaultSocialForm = (): DisplaySocialLink => ({
  platform: "instagram",
  url: "",
  label: "",
});

const defaultWhoWeAreImageForm = (): WhoWeAreImage => ({
  url: "",
  label: "",
  alt: "",
});

export function DisplayTabPanel({ token, agencySlug, onGoToTours }: Props) {
  const { requestConfirm } = useConfirmAction();
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
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [whoWeAreImageModalOpen, setWhoWeAreImageModalOpen] = useState(false);

  const [reviewForm, setReviewForm] = useState<DisplayReview>(defaultReviewForm);
  const [packageForm, setPackageForm] = useState<DisplayPackage>(defaultPackageForm);
  const [galleryForm, setGalleryForm] = useState<GalleryItem>({ url: "", label: "" });
  const [offerForm, setOfferForm] = useState<DisplayOffer>(defaultOfferForm);
  const [heroForm, setHeroForm] = useState<HeroSlide>({ url: "", label: "" });
  const [socialForm, setSocialForm] = useState<DisplaySocialLink>(defaultSocialForm);
  const [whoWeAreImageForm, setWhoWeAreImageForm] = useState<WhoWeAreImage>(defaultWhoWeAreImageForm);

  const [editReviewIndex, setEditReviewIndex] = useState<number | null>(null);
  const [editPackageIndex, setEditPackageIndex] = useState<number | null>(null);
  const [editOfferIndex, setEditOfferIndex] = useState<number | null>(null);
  const [editHeroIndex, setEditHeroIndex] = useState<number | null>(null);
  const [editGalleryIndex, setEditGalleryIndex] = useState<number | null>(null);
  const [editSocialIndex, setEditSocialIndex] = useState<number | null>(null);
  const [editWhoWeAreImageIndex, setEditWhoWeAreImageIndex] = useState<number | null>(null);
  const displayHydratedRef = useRef(false);
  const skipNextAutoSaveRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const persistDisplaySettings = useCallback(
    async (nextConfig: DisplayConfig, statusMessage = "Display page updated.") => {
      if (!token) return;
      skipNextAutoSaveRef.current = true;
      setSaving(true);
      setSaveStatus("");
      try {
        const data = await api<DisplayPayload>("/agencies/mine/display", {
          method: "PUT",
          token,
          body: JSON.stringify({
            influencerCommissionPct,
            logoUrl: logoUrl.trim() || undefined,
            enabled: { ...nextConfig.enabled, whoWeAre: true },
            content: {
              ...nextConfig.content,
              whoWeAreTitle: nextConfig.content.whoWeAreTitle.trim() || "WHO WE ARE",
              whoWeAreDescription: nextConfig.content.whoWeAreDescription.trim(),
              highlights: nextConfig.content.highlights.map((h) => h.trim()).filter(Boolean),
            },
            gallery: nextConfig.gallery,
            reviews: nextConfig.reviews.map(({ authorName, rating, body }) => ({
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
        setSaveStatus(statusMessage);
      } catch (err) {
        setSaveStatus(err instanceof ApiError ? err.message : "Failed to save display settings");
      } finally {
        setSaving(false);
      }
    },
    [token, logoUrl, influencerCommissionPct]
  );

  useEffect(() => {
    if (loading || saving) return;
    if (!displayHydratedRef.current) {
      displayHydratedRef.current = true;
      return;
    }
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      void persistDisplaySettings(config, "Display page updated.");
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [config, logoUrl, influencerCommissionPct, loading, saving, persistDisplaySettings]);

  async function applyAndPersist(
    updater: (prev: DisplayConfig) => DisplayConfig,
    statusMessage: string
  ) {
    let nextConfig!: DisplayConfig;
    setConfig((prev) => {
      nextConfig = updater(prev);
      return nextConfig;
    });
    await persistDisplaySettings(nextConfig, statusMessage);
  }

  function toggleSection(key: keyof DisplaySectionFlags, checked: boolean) {
    void applyAndPersist(
      (prev) => ({
        ...prev,
        enabled: { ...prev.enabled, [key]: checked },
      }),
      "Display section updated on your public page."
    );
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

  function saveSettings() {
    if (!token) return;
    const enabledSections = Object.entries(config.enabled)
      .filter(([, on]) => on)
      .map(([key]) => key)
      .join(", ");

    requestConfirm({
      title: "Save display settings?",
      description: "Your public agency storefront will reflect these changes.",
      confirmLabel: "Save display",
      summary: [
        { label: "Storefront slug", value: slug || "(pending)" },
        { label: "Influencer commission", value: `${influencerCommissionPct}%` },
        { label: "Enabled sections", value: enabledSections || "None" },
        { label: "Hero slides", value: String(config.content.heroImages.length) },
        { label: "Social links", value: String(config.content.whoWeAreSocialLinks.length) },
        { label: "Who we are images", value: String(config.content.whoWeAreImages.length) },
        { label: "Packages", value: String(config.content.packages.length) },
        { label: "Gallery items", value: String(config.gallery.length) },
        { label: "Reviews", value: String(config.reviews.length) },
        { label: "Offers", value: String(config.content.offers.length) },
      ],
      onConfirm: () => {
        void persistDisplaySettings(config, "Display settings saved.");
      },
    });
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

    const isNew = editPackageIndex === null;
    requestConfirm({
      title: isNew ? "Add package card?" : "Update package card?",
      confirmLabel: isNew ? "Add package" : "Save package",
      summary: [
        { label: "Title", value: entry.title },
        { label: "Location", value: entry.location },
        { label: "Price label", value: entry.priceLabel },
      ],
      onConfirm: () => {
        void applyAndPersist(
          (prev) => {
            const packages = [...prev.content.packages];
            if (editPackageIndex === null) packages.push(entry);
            else packages[editPackageIndex] = entry;
            return { ...prev, content: { ...prev.content, packages } };
          },
          isNew ? "Package added to your display page." : "Package updated on your display page."
        );
        setPackageModalOpen(false);
      },
    });
  }

  function removePackage(index: number) {
    const pkg = config.content.packages[index];
    requestConfirm({
      title: "Remove package?",
      variant: "danger",
      confirmLabel: "Remove package",
      summary: [{ label: "Package", value: pkg?.title ?? `Item ${index + 1}` }],
      onConfirm: () => {
        void applyAndPersist(
          (prev) => ({
            ...prev,
            content: {
              ...prev.content,
              packages: prev.content.packages.filter((_, i) => i !== index),
            },
          }),
          "Package removed from your display page."
        );
        setPackageModalOpen(false);
        setEditPackageIndex(null);
      },
    });
  }

  function saveReview(e: FormEvent) {
    e.preventDefault();
    const entry: DisplayReview = {
      ...reviewForm,
      authorName: reviewForm.authorName.trim(),
      body: reviewForm.body.trim(),
    };
    if (!entry.authorName) return;

    const isNew = editReviewIndex === null;
    requestConfirm({
      title: isNew ? "Add review?" : "Update review?",
      confirmLabel: isNew ? "Add review" : "Save review",
      summary: [
        { label: "Author", value: entry.authorName },
        { label: "Rating", value: `${entry.rating}/5` },
        {
          label: "Review",
          value: entry.body.length > 100 ? `${entry.body.slice(0, 100)}…` : entry.body || "—",
        },
      ],
      onConfirm: () => {
        void applyAndPersist(
          (prev) => {
            const reviews = [...prev.reviews];
            if (editReviewIndex === null) reviews.push(entry);
            else reviews[editReviewIndex] = entry;
            return { ...prev, reviews };
          },
          isNew ? "Review added to your display page." : "Review updated on your display page."
        );
        setReviewModalOpen(false);
      },
    });
  }

  function saveGalleryItem(e: FormEvent) {
    e.preventDefault();
    const url = galleryForm.url.trim();
    if (!url) return;
    const entry = { url, label: galleryForm.label.trim() || "Gallery" };
    const isNew = editGalleryIndex === null;
    requestConfirm({
      title: isNew ? "Add gallery image?" : "Update gallery image?",
      confirmLabel: isNew ? "Add image" : "Save image",
      summary: [
        { label: "Label", value: entry.label },
        { label: "Image URL", value: url.length > 80 ? `${url.slice(0, 80)}…` : url },
      ],
      onConfirm: () => {
        void applyAndPersist(
          (prev) => {
            const gallery = [...prev.gallery];
            if (editGalleryIndex === null) gallery.push(entry);
            else gallery[editGalleryIndex] = entry;
            return { ...prev, gallery };
          },
          isNew ? "Gallery image added to your display page." : "Gallery image updated on your display page."
        );
        setGalleryForm({ url: "", label: "" });
        setEditGalleryIndex(null);
        setGalleryModalOpen(false);
      },
    });
  }

  function saveHeroSlide(e: FormEvent) {
    e.preventDefault();
    const url = heroForm.url.trim();
    if (!url) return;
    const entry: HeroSlide = {
      url,
      label: heroForm.label?.trim() || undefined,
    };
    const isNew = editHeroIndex === null;

    requestConfirm({
      title: isNew ? "Add hero slide?" : "Update hero slide?",
      confirmLabel: isNew ? "Add slide" : "Save slide",
      summary: [
        { label: "Label", value: entry.label || "—" },
        { label: "Image URL", value: url.length > 80 ? `${url.slice(0, 80)}…` : url },
      ],
      onConfirm: () => {
        void applyAndPersist(
          (prev) => {
            const heroImages = [...prev.content.heroImages];
            if (editHeroIndex === null) heroImages.push(entry);
            else heroImages[editHeroIndex] = entry;
            return { ...prev, content: { ...prev.content, heroImages } };
          },
          isNew ? "Hero slide added to your display page." : "Hero slide updated on your display page."
        );
        setHeroModalOpen(false);
      },
    });
  }

  function moveHeroSlide(index: number, direction: -1 | 1) {
    void applyAndPersist((prev) => {
      const heroImages = [...prev.content.heroImages];
      const next = index + direction;
      if (next < 0 || next >= heroImages.length) return prev;
      [heroImages[index], heroImages[next]] = [heroImages[next], heroImages[index]];
      return { ...prev, content: { ...prev.content, heroImages } };
    }, "Hero slide order updated on your display page.");
  }

  function saveSocialLink(e: FormEvent) {
    e.preventDefault();
    const entry: DisplaySocialLink = {
      platform: socialForm.platform.trim(),
      url: socialForm.url.trim(),
      label: socialForm.label?.trim() || undefined,
    };
    if (!entry.platform || !entry.url) return;

    const isNew = editSocialIndex === null;
    requestConfirm({
      title: isNew ? "Add social link?" : "Update social link?",
      confirmLabel: isNew ? "Add link" : "Save link",
      summary: [
        { label: "Platform", value: entry.platform },
        { label: "URL", value: entry.url.length > 80 ? `${entry.url.slice(0, 80)}…` : entry.url },
      ],
      onConfirm: () => {
        void applyAndPersist(
          (prev) => {
            const whoWeAreSocialLinks = [...prev.content.whoWeAreSocialLinks];
            if (editSocialIndex === null) whoWeAreSocialLinks.push(entry);
            else whoWeAreSocialLinks[editSocialIndex] = entry;
            return { ...prev, content: { ...prev.content, whoWeAreSocialLinks } };
          },
          isNew ? "Social link added to your display page." : "Social link updated on your display page."
        );
        setSocialModalOpen(false);
      },
    });
  }

  function removeSocialLink(index: number) {
    const link = config.content.whoWeAreSocialLinks[index];
    requestConfirm({
      title: "Remove social link?",
      variant: "danger",
      confirmLabel: "Remove link",
      summary: [{ label: "Link", value: link?.url ?? `Item ${index + 1}` }],
      onConfirm: () => {
        void applyAndPersist(
          (prev) => ({
            ...prev,
            content: {
              ...prev.content,
              whoWeAreSocialLinks: prev.content.whoWeAreSocialLinks.filter((_, i) => i !== index),
            },
          }),
          "Social link removed from your display page."
        );
        setSocialModalOpen(false);
        setEditSocialIndex(null);
      },
    });
  }

  function saveWhoWeAreImage(e: FormEvent) {
    e.preventDefault();
    const url = whoWeAreImageForm.url.trim();
    if (!url) return;
    const entry: WhoWeAreImage = {
      url,
      label: whoWeAreImageForm.label?.trim() || undefined,
      alt: whoWeAreImageForm.alt?.trim() || undefined,
    };
    const isNew = editWhoWeAreImageIndex === null;

    requestConfirm({
      title: isNew ? "Add badge image?" : "Update badge image?",
      confirmLabel: isNew ? "Add image" : "Save image",
      summary: [
        { label: "Label", value: entry.label || "—" },
        { label: "Image URL", value: url.length > 80 ? `${url.slice(0, 80)}…` : url },
      ],
      onConfirm: () => {
        void applyAndPersist(
          (prev) => {
            const whoWeAreImages = [...prev.content.whoWeAreImages];
            if (editWhoWeAreImageIndex === null) whoWeAreImages.push(entry);
            else whoWeAreImages[editWhoWeAreImageIndex] = entry;
            return { ...prev, content: { ...prev.content, whoWeAreImages } };
          },
          isNew ? "Badge image added to your display page." : "Badge image updated on your display page."
        );
        setWhoWeAreImageModalOpen(false);
      },
    });
  }

  function removeWhoWeAreImage(index: number) {
    const img = config.content.whoWeAreImages[index];
    requestConfirm({
      title: "Remove badge image?",
      variant: "danger",
      confirmLabel: "Remove image",
      summary: [{ label: "Image", value: img?.label || img?.url || `Item ${index + 1}` }],
      onConfirm: () => {
        void applyAndPersist(
          (prev) => ({
            ...prev,
            content: {
              ...prev.content,
              whoWeAreImages: prev.content.whoWeAreImages.filter((_, i) => i !== index),
            },
          }),
          "Badge image removed from your display page."
        );
        setWhoWeAreImageModalOpen(false);
        setEditWhoWeAreImageIndex(null);
      },
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

    const isNew = editOfferIndex === null;
    requestConfirm({
      title: isNew ? "Add storefront offer?" : "Update storefront offer?",
      confirmLabel: isNew ? "Add offer" : "Save offer",
      summary: [
        { label: "Title", value: entry.title },
        { label: "Badge", value: entry.badge || "—" },
        { label: "Price label", value: entry.priceLabel || "—" },
      ],
      onConfirm: () => {
        void applyAndPersist(
          (prev) => {
            const offers = [...prev.content.offers];
            if (editOfferIndex === null) offers.push(entry);
            else offers[editOfferIndex] = entry;
            return { ...prev, content: { ...prev.content, offers } };
          },
          isNew ? "Offer added to your display page." : "Offer updated on your display page."
        );
        setOfferModalOpen(false);
      },
    });
  }

  function removeHeroSlide(index: number) {
    const slide = config.content.heroImages[index];
    requestConfirm({
      title: "Remove hero slide?",
      variant: "danger",
      confirmLabel: "Remove slide",
      summary: [{ label: "Slide", value: slide?.label || `Slide ${index + 1}` }],
      onConfirm: () => {
        void applyAndPersist(
          (prev) => ({
            ...prev,
            content: {
              ...prev.content,
              heroImages: prev.content.heroImages.filter((_, j) => j !== index),
            },
          }),
          "Hero slide removed from your display page."
        );
        setHeroModalOpen(false);
        setEditHeroIndex(null);
      },
    });
  }

  function removeReview(index: number) {
    const review = config.reviews[index];
    requestConfirm({
      title: "Remove review?",
      variant: "danger",
      confirmLabel: "Remove review",
      summary: [{ label: "Author", value: review?.authorName ?? `Review ${index + 1}` }],
      onConfirm: () => {
        void applyAndPersist(
          (prev) => ({
            ...prev,
            reviews: prev.reviews.filter((_, j) => j !== index),
          }),
          "Review removed from your display page."
        );
        setReviewModalOpen(false);
        setEditReviewIndex(null);
      },
    });
  }

  function removeGalleryItem(index: number) {
    const item = config.gallery[index];
    requestConfirm({
      title: "Remove gallery image?",
      variant: "danger",
      confirmLabel: "Remove image",
      summary: [{ label: "Label", value: item?.label ?? `Image ${index + 1}` }],
      onConfirm: () => {
        void applyAndPersist(
          (prev) => ({
            ...prev,
            gallery: prev.gallery.filter((_, j) => j !== index),
          }),
          "Gallery image removed from your display page."
        );
        setGalleryModalOpen(false);
        setEditGalleryIndex(null);
      },
    });
  }

  function removeOffer(index: number) {
    const offer = config.content.offers[index];
    requestConfirm({
      title: "Remove storefront offer?",
      variant: "danger",
      confirmLabel: "Remove offer",
      summary: [{ label: "Offer", value: offer?.title ?? `Offer ${index + 1}` }],
      onConfirm: () => {
        void applyAndPersist(
          (prev) => ({
            ...prev,
            content: {
              ...prev.content,
              offers: prev.content.offers.filter((_, j) => j !== index),
            },
          }),
          "Offer removed from your display page."
        );
        setOfferModalOpen(false);
        setEditOfferIndex(null);
      },
    });
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
      <div className="display-editor-chrome">
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
      </div>

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

        {activeStep === "whoWeAre" && (
          <DisplayStepPanel
            title="Who we are"
            description="Shown directly below your hero — introduce your agency, link social profiles, and add trust badges like TripAdvisor screenshots."
          >
            <DisplayFieldHint>
              This section appears on every agency storefront, directly below the hero banner.
            </DisplayFieldHint>

            <div className="display-field-stack display-field-stack--spaced">
              <label>
                Section title
                <input
                  value={content.whoWeAreTitle}
                  onChange={(e) => updateContent({ whoWeAreTitle: e.target.value })}
                  maxLength={40}
                  placeholder="WHO WE ARE"
                />
              </label>
              <label>
                Description
                <textarea
                  rows={4}
                  value={content.whoWeAreDescription}
                  onChange={(e) => updateContent({ whoWeAreDescription: e.target.value })}
                  placeholder="A short introduction about your agency, team, and what makes your trips special."
                  maxLength={600}
                />
                <DisplayFieldHint>
                  Keep it brief — 2–4 sentences works best. If left empty, your agency profile description may appear instead.
                </DisplayFieldHint>
              </label>
            </div>

            <div className="display-list-block">
              <p className="display-subsection-label">Social links</p>
              <p className="muted display-subsection-desc">
                Instagram, Facebook, TripAdvisor, WhatsApp, or your website.
              </p>
              {content.whoWeAreSocialLinks.length === 0 ? (
                <p className="display-empty-hint">No social links yet.</p>
              ) : (
                <div className="display-compact-list">
                  {content.whoWeAreSocialLinks.map((link, i) => (
                    <DisplayCompactRow
                      key={`${link.platform}-${i}`}
                      title={
                        SOCIAL_PLATFORMS.find((p) => p.id === link.platform)?.label ?? link.platform
                      }
                      meta={
                        <span className="muted">
                          {link.label?.trim() || link.url}
                        </span>
                      }
                      onEdit={() => {
                        setEditSocialIndex(i);
                        setSocialForm({
                          platform: link.platform,
                          url: link.url,
                          label: link.label || "",
                        });
                        setSocialModalOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
              <DisplaySectionActions>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={content.whoWeAreSocialLinks.length >= 12}
                  onClick={() => {
                    setEditSocialIndex(null);
                    setSocialForm(defaultSocialForm());
                    setSocialModalOpen(true);
                  }}
                >
                  + Add social link
                </button>
              </DisplaySectionActions>
            </div>

            <div className="display-list-block">
              <p className="display-subsection-label">Trust badges & review images</p>
              <p className="muted display-subsection-desc">
                Upload screenshots — TripAdvisor reviews, awards, press mentions, etc.
              </p>
              {content.whoWeAreImages.length === 0 ? (
                <p className="display-empty-hint">No images yet.</p>
              ) : (
                <div className="display-compact-list">
                  {content.whoWeAreImages.map((img, i) => (
                    <DisplayCompactRow
                      key={`${img.url}-${i}`}
                      thumb={<img src={img.url} alt="" className="display-compact-row-thumb" />}
                      title={img.label?.trim() || `Image ${i + 1}`}
                      meta={<span className="muted">{img.alt?.trim() || "Badge image"}</span>}
                      onEdit={() => {
                        setEditWhoWeAreImageIndex(i);
                        setWhoWeAreImageForm({
                          url: img.url,
                          label: img.label || "",
                          alt: img.alt || "",
                        });
                        setWhoWeAreImageModalOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
              <DisplaySectionActions>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={content.whoWeAreImages.length >= 8}
                  onClick={() => {
                    setEditWhoWeAreImageIndex(null);
                    setWhoWeAreImageForm(defaultWhoWeAreImageForm());
                    setWhoWeAreImageModalOpen(true);
                  }}
                >
                  + Add image
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
        open={socialModalOpen}
        title={editSocialIndex === null ? "Add social link" : "Edit social link"}
        subtitle="Links appear as pills in the Who we are section on your public page."
        onClose={() => setSocialModalOpen(false)}
      >
        <form onSubmit={saveSocialLink}>
          <div className="entity-form-grid">
            <ModalField label="Platform">
              <select
                value={socialForm.platform}
                onChange={(e) => setSocialForm({ ...socialForm, platform: e.target.value })}
                required
                autoFocus
              >
                {SOCIAL_PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </ModalField>
            <ModalField label="URL" full>
              <input
                type="url"
                value={socialForm.url}
                onChange={(e) => setSocialForm({ ...socialForm, url: e.target.value })}
                placeholder="https://instagram.com/yourpage"
                required
              />
            </ModalField>
            <ModalField label="Custom label (optional)" full>
              <input
                type="text"
                value={socialForm.label || ""}
                onChange={(e) => setSocialForm({ ...socialForm, label: e.target.value })}
                placeholder="Follow us on Instagram"
              />
            </ModalField>
          </div>
          <ModalActions
            onCancel={() => setSocialModalOpen(false)}
            submitLabel={editSocialIndex === null ? "Add link" : "Save link"}
          />
          {editSocialIndex !== null && (
            <button
              type="button"
              className="btn btn-lite display-modal-delete"
              onClick={() => removeSocialLink(editSocialIndex)}
            >
              Remove link
            </button>
          )}
        </form>
      </DashboardModal>

      <DashboardModal
        open={whoWeAreImageModalOpen}
        title={editWhoWeAreImageIndex === null ? "Add badge image" : "Edit badge image"}
        subtitle="TripAdvisor screenshots, awards, or press logos shown beside your intro."
        onClose={() => setWhoWeAreImageModalOpen(false)}
      >
        <form onSubmit={saveWhoWeAreImage}>
          <div className="entity-form-grid">
            <ModalField label="Image" full>
              <ImageUrlField
                label=""
                className="image-url-field--embedded"
                value={whoWeAreImageForm.url}
                onChange={(url) => setWhoWeAreImageForm({ ...whoWeAreImageForm, url })}
                token={token}
              />
            </ModalField>
            <ModalField label="Caption (optional)" full>
              <input
                type="text"
                value={whoWeAreImageForm.label || ""}
                onChange={(e) =>
                  setWhoWeAreImageForm({ ...whoWeAreImageForm, label: e.target.value })
                }
                placeholder="TripAdvisor reviews"
              />
            </ModalField>
            <ModalField label="Alt text (optional)" full>
              <input
                type="text"
                value={whoWeAreImageForm.alt || ""}
                onChange={(e) => setWhoWeAreImageForm({ ...whoWeAreImageForm, alt: e.target.value })}
                placeholder="Screenshot of 5-star TripAdvisor reviews"
              />
            </ModalField>
          </div>
          <ModalActions
            onCancel={() => setWhoWeAreImageModalOpen(false)}
            submitLabel={editWhoWeAreImageIndex === null ? "Add image" : "Save image"}
          />
          {editWhoWeAreImageIndex !== null && (
            <button
              type="button"
              className="btn btn-lite display-modal-delete"
              onClick={() => removeWhoWeAreImage(editWhoWeAreImageIndex)}
            >
              Remove image
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
