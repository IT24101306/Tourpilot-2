import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  displayTourPrice,
  isRichTextEmpty,
  isUsableImageUrl,
  MAX_AGENCY_HERO_SLIDES,
  MEDIA,
  stripRichHtml,
} from "@tourpilot/shared";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../confirm/ConfirmActionContext";
import { ImageUrlField } from "../ImageUrlField";
import { DashboardModal, ModalActions, ModalField } from "../DashboardModal";
import { DisplayPriceText } from "../currency/DisplayPriceText";
import { ModuleHeader } from "../module/ModuleHeader";
import { RichTextEditor } from "../richtext/RichTextEditor";
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
  type DisplayTransportOption,
  type GalleryItem,
  type HeroSlide,
  type WhoWeAreImage,
} from "./displayTypes";
import { AGENCY_TRANSPORT_OPTIONS } from "./transportOptions";

import type { EntityOption } from "../tour/tourFormTypes";
import { entityOptionLabel } from "../tour/tourFormTypes";
import { validateRequiredFields } from "../../lib/formValidation";
import { FormValidationMessages } from "../FormFieldError";

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

const defaultTransportForm = (): DisplayTransportOption => ({
  id: "sedan",
  name: "",
  variant: "",
  description: "",
  seating: "",
  luggage: "",
});

export function DisplayTabPanel({ token, agencySlug, onGoToTours }: Props) {
  const { refreshUser } = useAuth();
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

  const [entities, setEntities] = useState<EntityOption[]>([]);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [heroModalOpen, setHeroModalOpen] = useState(false);
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [whoWeAreImageModalOpen, setWhoWeAreImageModalOpen] = useState(false);
  const [transportModalOpen, setTransportModalOpen] = useState(false);

  const [reviewForm, setReviewForm] = useState<DisplayReview>(defaultReviewForm);
  const [packageForm, setPackageForm] = useState<DisplayPackage>(defaultPackageForm);
  const [galleryForm, setGalleryForm] = useState<GalleryItem>({
    url: "",
    label: "",
    entityId: "",
  });
  const [offerForm, setOfferForm] = useState<DisplayOffer>(defaultOfferForm);
  const [heroForm, setHeroForm] = useState<HeroSlide>({ url: "", label: "" });
  const [socialForm, setSocialForm] = useState<DisplaySocialLink>(defaultSocialForm);
  const [whoWeAreImageForm, setWhoWeAreImageForm] = useState<WhoWeAreImage>(defaultWhoWeAreImageForm);
  const [transportForm, setTransportForm] = useState<DisplayTransportOption>(defaultTransportForm);

  const [editReviewIndex, setEditReviewIndex] = useState<number | null>(null);
  const [editPackageIndex, setEditPackageIndex] = useState<number | null>(null);
  const [editOfferIndex, setEditOfferIndex] = useState<number | null>(null);
  const [editHeroIndex, setEditHeroIndex] = useState<number | null>(null);
  const [editGalleryIndex, setEditGalleryIndex] = useState<number | null>(null);
  const [editSocialIndex, setEditSocialIndex] = useState<number | null>(null);
  const [editWhoWeAreImageIndex, setEditWhoWeAreImageIndex] = useState<number | null>(null);
  const [editTransportIndex, setEditTransportIndex] = useState<number | null>(null);
  const [modalFieldErrors, setModalFieldErrors] = useState<Record<string, string>>({});
  const [saveBarDocked, setSaveBarDocked] = useState(false);
  const displayHydratedRef = useRef(false);
  const skipNextAutoSaveRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistSeqRef = useRef(0);

  function cancelPendingAutoSave() {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }

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
        enabled: { ...defaultDisplayConfig().enabled, ...data.enabled },
        content: {
          ...data.content,
          transportOptions: Array.isArray(data.content.transportOptions)
            ? data.content.transportOptions
            : defaultDisplayConfig().content.transportOptions,
          offerBannerStyle: "strip",
        },
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

  // Keep the save bar floating, but dock it above the site footer when that enters view.
  useEffect(() => {
    if (loading) return;
    const footer = document.querySelector(".site-footer");
    if (!footer) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setSaveBarDocked(entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0,
        rootMargin: "0px 0px 96px 0px",
      }
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, [loading]);

  useEffect(() => {
    if (agencySlug) setSlug(agencySlug);
  }, [agencySlug]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const rows = await api<
          Array<{
            id: string;
            name: string;
            type: string;
            city: string | null;
            priceHint: number | null;
          }>
        >("/entities", { token });
        setEntities(
          rows.map((e) => ({
            id: e.id,
            name: e.name,
            type: e.type,
            city: e.city,
            priceHint: e.priceHint,
          }))
        );
      } catch (err) {
        console.error(err);
      }
    })();
  }, [token]);

  const persistDisplaySettings = useCallback(
    async (nextConfig: DisplayConfig, statusMessage = "Display page updated.") => {
      if (!token) return;
      const seq = ++persistSeqRef.current;
      cancelPendingAutoSave();
      skipNextAutoSaveRef.current = true;
      setSaving(true);
      setSaveStatus("");
      try {
        const heroImages = nextConfig.content.heroImages
          .map((slide) => ({
            url: slide.url.trim(),
            ...(slide.label?.trim() ? { label: slide.label.trim() } : {}),
          }))
          .filter((slide) => isUsableImageUrl(slide.url));

        const featuredImageUrl = isUsableImageUrl(nextConfig.content.featuredImageUrl)
          ? nextConfig.content.featuredImageUrl.trim()
          : MEDIA.hero;

        const gallery = nextConfig.gallery
          .map((g) => ({
            url: g.url.trim(),
            label: g.label.trim() || "Gallery",
            entityId: g.entityId.trim(),
          }))
          .filter((g) => g.url && g.entityId);

        const data = await api<DisplayPayload>("/agencies/mine/display", {
          method: "PUT",
          token,
          body: JSON.stringify({
            influencerCommissionPct,
            logoUrl: logoUrl.trim() || undefined,
            enabled: { ...nextConfig.enabled, whoWeAre: true },
            content: {
              ...nextConfig.content,
              heroImages,
              featuredImageUrl,
              whoWeAreTitle: nextConfig.content.whoWeAreTitle.trim() || "WHO WE ARE",
              whoWeAreDescription: isRichTextEmpty(nextConfig.content.whoWeAreDescription)
                ? ""
                : nextConfig.content.whoWeAreDescription,
              highlights: nextConfig.content.highlights.map((h) => h.trim()).filter(Boolean),
            },
            gallery,
            reviews: nextConfig.reviews.map(({ authorName, rating, body }) => ({
              authorName,
              rating,
              body,
            })),
          }),
        });
        if (seq !== persistSeqRef.current) return;
        setSlug(data.slug);
        setLogoUrl(data.logoUrl || logoUrl);
        setInfluencerCommissionPct(data.influencerCommissionPct ?? influencerCommissionPct);
        setConfig({
          enabled: { ...defaultDisplayConfig().enabled, ...data.enabled },
          content: data.content,
          gallery: data.gallery,
          reviews: data.reviews,
        });
        await refreshUser().catch(() => {});
        setSaveStatus(statusMessage);
      } catch (err) {
        if (seq !== persistSeqRef.current) return;
        setSaveStatus(err instanceof ApiError ? err.message : "Failed to save display settings");
      } finally {
        if (seq === persistSeqRef.current) setSaving(false);
      }
    },
    [token, logoUrl, influencerCommissionPct, refreshUser]
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
    cancelPendingAutoSave();
    skipNextAutoSaveRef.current = true;
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

  function clearModalFieldError(key: string) {
    setModalFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
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
        { label: "Transport vehicles", value: String(config.content.transportOptions.length) },
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
      location: districts[0] || stripRichHtml(tour.summary) || `${tour.days} day tour`,
      priceLabel: "",
      priceLkr: displayTourPrice(tour),
      imageUrl: tour.coverUrl || "https://images.unsplash.com/photo-1682687982501-1e58ab814714?auto=format&fit=crop&w=1200&q=80",
      tourId: tour.id,
    };
    setPackageForm(pkg);
    setEditPackageIndex(null);
    setPackageModalOpen(true);
  }

  function savePackage(e: FormEvent) {
    e.preventDefault();
    const errors = validateRequiredFields({
      title: { label: "Title", value: packageForm.title },
      imageUrl: { label: "Package image", value: packageForm.imageUrl },
    });
    if (Object.keys(errors).length > 0) {
      setModalFieldErrors(errors);
      return;
    }
    setModalFieldErrors({});

    const entry = {
      ...packageForm,
      title: packageForm.title.trim(),
      location: packageForm.location.trim(),
      priceLabel: packageForm.priceLabel.trim() || "Contact for price",
      imageUrl: packageForm.imageUrl.trim(),
      priceLkr:
        typeof packageForm.priceLkr === "number" && Number.isFinite(packageForm.priceLkr)
          ? packageForm.priceLkr
          : undefined,
    };

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
    const errors = validateRequiredFields({
      authorName: { label: "Author name", value: reviewForm.authorName },
    });
    if (Object.keys(errors).length > 0) {
      setModalFieldErrors(errors);
      return;
    }
    setModalFieldErrors({});

    const entry: DisplayReview = {
      ...reviewForm,
      authorName: reviewForm.authorName.trim(),
      body: reviewForm.body.trim(),
    };

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
    const errors = validateRequiredFields({
      url: { label: "Gallery image", value: galleryForm.url },
      entityId: { label: "Linked entity", value: galleryForm.entityId },
    });
    if (Object.keys(errors).length > 0) {
      setModalFieldErrors(errors);
      return;
    }
    setModalFieldErrors({});

    const url = galleryForm.url.trim();
    const entityId = galleryForm.entityId.trim();

    const entry: GalleryItem = {
      url,
      label: galleryForm.label.trim() || "Gallery",
      entityId,
    };

    const linkedEntity = entities.find((ent) => ent.id === entityId);
    const isNew = editGalleryIndex === null;
    requestConfirm({
      title: isNew ? "Add gallery image?" : "Update gallery image?",
      confirmLabel: isNew ? "Add image" : "Save image",
      summary: [
        { label: "Label", value: entry.label },
        { label: "Linked entity", value: linkedEntity ? entityOptionLabel(linkedEntity) : "—" },
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
        setGalleryForm({ url: "", label: "", entityId: "" });
        setEditGalleryIndex(null);
        setGalleryModalOpen(false);
      },
    });
  }

  function saveHeroSlide(e: FormEvent) {
    e.preventDefault();
    const errors = validateRequiredFields({
      url: { label: "Hero image", value: heroForm.url },
    });
    if (Object.keys(errors).length > 0) {
      setModalFieldErrors(errors);
      return;
    }
    setModalFieldErrors({});

    const url = heroForm.url.trim();
    const isNew = editHeroIndex === null;
    if (isNew && config.content.heroImages.length >= MAX_AGENCY_HERO_SLIDES) {
      setSaveStatus(`You can add up to ${MAX_AGENCY_HERO_SLIDES} hero slides.`);
      return;
    }
    const entry: HeroSlide = {
      url,
      label: heroForm.label?.trim() || undefined,
    };

    requestConfirm({
      title: isNew ? "Add hero slide?" : "Update hero slide?",
      confirmLabel: isNew ? "Add slide" : "Save slide",
      summary: [
        { label: "Label", value: entry.label || "—" },
        { label: "Image URL", value: url.length > 80 ? `${url.slice(0, 80)}…` : url },
      ],
      onConfirm: async () => {
        await applyAndPersist(
          (prev) => {
            const heroImages = [...prev.content.heroImages];
            if (editHeroIndex === null) heroImages.push(entry);
            else heroImages[editHeroIndex] = entry;
            return { ...prev, content: { ...prev.content, heroImages } };
          },
          isNew ? "Hero slide added to your display page." : "Hero slide updated on your display page."
        );
        setHeroModalOpen(false);
        setEditHeroIndex(null);
        setHeroForm({ url: "", label: "" });
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
    const errors = validateRequiredFields({
      url: { label: "URL", value: socialForm.url },
    });
    if (Object.keys(errors).length > 0) {
      setModalFieldErrors(errors);
      return;
    }
    setModalFieldErrors({});

    const entry: DisplaySocialLink = {
      platform: socialForm.platform.trim(),
      url: socialForm.url.trim(),
      label: socialForm.label?.trim() || undefined,
    };

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
    const errors = validateRequiredFields({
      url: { label: "Image", value: whoWeAreImageForm.url },
    });
    if (Object.keys(errors).length > 0) {
      setModalFieldErrors(errors);
      return;
    }
    setModalFieldErrors({});

    const url = whoWeAreImageForm.url.trim();
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
    const errors = validateRequiredFields({
      title: { label: "Title", value: offerForm.title },
    });
    if (Object.keys(errors).length > 0) {
      setModalFieldErrors(errors);
      return;
    }
    setModalFieldErrors({});

    const entry: DisplayOffer = {
      title: offerForm.title.trim(),
      description: isRichTextEmpty(offerForm.description) ? "" : offerForm.description,
      priceLabel: offerForm.priceLabel.trim(),
      badge: offerForm.badge?.trim() || undefined,
      imageUrl: offerForm.imageUrl?.trim() || undefined,
    };

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

  function applyTransportTemplate(vehicleId: string) {
    const template = AGENCY_TRANSPORT_OPTIONS.find((option) => option.id === vehicleId);
    if (!template) {
      setTransportForm((prev) => ({ ...prev, id: vehicleId }));
      return;
    }
    setTransportForm({
      id: template.id,
      name: template.name,
      variant: template.variant || "",
      description: template.description,
      seating: template.seating,
      luggage: template.luggage,
    });
  }

  function saveTransport(e: FormEvent) {
    e.preventDefault();
    const errors = validateRequiredFields({
      name: { label: "Display name", value: transportForm.name },
    });
    if (Object.keys(errors).length > 0) {
      setModalFieldErrors(errors);
      return;
    }
    setModalFieldErrors({});

    const entry: DisplayTransportOption = {
      id: transportForm.id.trim(),
      name: transportForm.name.trim(),
      variant: transportForm.variant?.trim() || undefined,
      description: isRichTextEmpty(transportForm.description) ? "" : transportForm.description,
      seating: transportForm.seating.trim(),
      luggage: transportForm.luggage.trim(),
    };

    const isNew = editTransportIndex === null;
    requestConfirm({
      title: isNew ? "Add transport option?" : "Update transport option?",
      confirmLabel: isNew ? "Add vehicle" : "Save vehicle",
      summary: [
        { label: "Vehicle", value: entry.name },
        { label: "Seats", value: entry.seating || "—" },
        { label: "Luggage", value: entry.luggage || "—" },
      ],
      onConfirm: () => {
        void applyAndPersist(
          (prev) => {
            const transportOptions = [...prev.content.transportOptions];
            if (editTransportIndex === null) transportOptions.push(entry);
            else transportOptions[editTransportIndex] = entry;
            return { ...prev, content: { ...prev.content, transportOptions } };
          },
          isNew ? "Transport option added to your display page." : "Transport option updated."
        );
        setTransportModalOpen(false);
        setEditTransportIndex(null);
      },
    });
  }

  function removeTransport(index: number) {
    const option = config.content.transportOptions[index];
    requestConfirm({
      title: "Remove transport option?",
      variant: "danger",
      confirmLabel: "Remove vehicle",
      summary: [{ label: "Vehicle", value: option?.name ?? `Vehicle ${index + 1}` }],
      onConfirm: () => {
        void applyAndPersist(
          (prev) => ({
            ...prev,
            content: {
              ...prev.content,
              transportOptions: prev.content.transportOptions.filter((_, j) => j !== index),
            },
          }),
          "Transport option removed from your display page."
        );
        setTransportModalOpen(false);
        setEditTransportIndex(null);
      },
    });
  }

  function resetTransportDefaults() {
    requestConfirm({
      title: "Reset transport list?",
      description: "This replaces your custom vehicles with the standard line-up.",
      confirmLabel: "Reset list",
      summary: [{ label: "Vehicles", value: `${AGENCY_TRANSPORT_OPTIONS.length} default options` }],
      onConfirm: () => {
        void applyAndPersist(
          (prev) => ({
            ...prev,
            content: {
              ...prev.content,
              transportOptions: AGENCY_TRANSPORT_OPTIONS.map((option) => ({ ...option })),
            },
          }),
          "Transport list reset to defaults."
        );
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
      <ModuleHeader module="discovery" title="Display page">
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
      </ModuleHeader>

      <div className="display-editor-body">
        <DisplayStepNav active={activeStep} onChange={setActiveStep} />

        <div className="display-step-content">
        {activeStep === "hero" && (
          <DisplayStepPanel
            title="Hero banner"
            description="First thing visitors see — logo, scrolling photos, headline and subheadline."
          >
            <DisplayVisibilityToggle
              label="Show company logo & name"
              hint="Logo, agency name, tagline, and location on the hero banner"
              checked={config.enabled.branding}
              onChange={(checked) => toggleSection("branding", checked)}
            />

            <div className="display-field-stack display-field-stack--spaced">
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
                Add up to {MAX_AGENCY_HERO_SLIDES} images for automatic scrolling (2+ recommended).
                First slide is also used on discovery cards.
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
                  disabled={content.heroImages.length >= MAX_AGENCY_HERO_SLIDES}
                  onClick={() => {
                    setEditHeroIndex(null);
                    setHeroForm({ url: "", label: "" });
                    setHeroModalOpen(true);
                  }}
                >
                  + Add slide
                </button>
                {content.heroImages.length >= MAX_AGENCY_HERO_SLIDES && (
                  <p className="muted display-limit-hint">
                    Maximum of {MAX_AGENCY_HERO_SLIDES} slides reached.
                  </p>
                )}
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
                <RichTextEditor
                  rows={4}
                  value={content.whoWeAreDescription}
                  onChange={(whoWeAreDescription) => updateContent({ whoWeAreDescription })}
                  placeholder="A short introduction about your agency, team, and what makes your trips special."
                  maxLength={600}
                  aria-label="Who we are description"
                />
                <DisplayFieldHint>
                  Keep it brief — 2–4 sentences works best. If left empty, your agency profile description may appear instead.
                </DisplayFieldHint>
              </label>
            </div>

            <label className="field">
              <span>Story tag handle</span>
              <input
                value={content.socialTagHandle}
                onChange={(e) => updateContent({ socialTagHandle: e.target.value })}
                placeholder="@youragency"
                maxLength={80}
              />
              <DisplayFieldHint>
                Travelers registering for your offers will be asked to tag this @ handle in their story.
              </DisplayFieldHint>
            </label>

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
                          {p.location} ·{" "}
                          <DisplayPriceText
                            amountLkr={p.priceLkr}
                            priceLabel={p.priceLabel}
                            suffix=" / per person"
                          />
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
                      meta={
                        <span className="muted">
                          {g.entityId
                            ? entities.find((ent) => ent.id === g.entityId)
                              ? entityOptionLabel(entities.find((ent) => ent.id === g.entityId)!)
                              : "Not linked"
                            : "Not linked"}
                        </span>
                      }
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
                    setGalleryForm({ url: "", label: "", entityId: "" });
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
                          <DisplayPriceText
                            amountLkr={o.priceLkr}
                            priceLabel={o.priceLabel || o.description}
                            fallback={o.description || "—"}
                          />
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

            <DisplayStepPanel
              title="Transport"
              description="Vehicle cards shown on your public page for every group size."
            >
              <DisplayVisibilityToggle
                label="Show transport section"
                hint={
                  config.enabled.transport
                    ? "Travelers see your vehicle options on your public page."
                    : "The transport section is hidden on your public page."
                }
                checked={config.enabled.transport}
                onChange={(checked) => toggleSection("transport", checked)}
              />

              <div className="display-list-block">
                <p className="display-subsection-label">Vehicle line-up</p>
                <p className="muted display-subsection-desc">
                  Add, edit, or remove the transport cards travelers see on your storefront.
                </p>
                {content.transportOptions.length === 0 ? (
                  <p className="display-empty-hint">No transport options yet.</p>
                ) : (
                  <div className="display-compact-list">
                    {content.transportOptions.map((option, i) => (
                      <DisplayCompactRow
                        key={`${option.id}-${i}`}
                        title={
                          option.variant ? `${option.name} (${option.variant})` : option.name
                        }
                        meta={
                          <span className="muted">
                            {option.seating || "Seats TBD"}
                            {option.luggage ? ` · ${option.luggage}` : ""}
                          </span>
                        }
                        onEdit={() => {
                          setEditTransportIndex(i);
                          setTransportForm({
                            id: option.id,
                            name: option.name,
                            variant: option.variant || "",
                            description: option.description,
                            seating: option.seating,
                            luggage: option.luggage,
                          });
                          setTransportModalOpen(true);
                        }}
                      />
                    ))}
                  </div>
                )}
                <DisplaySectionActions>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={content.transportOptions.length >= 12}
                    onClick={() => {
                      setEditTransportIndex(null);
                      applyTransportTemplate("sedan");
                      setTransportModalOpen(true);
                    }}
                  >
                    + Add vehicle
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={resetTransportDefaults}
                  >
                    Reset to defaults
                  </button>
                </DisplaySectionActions>
              </div>
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
      </div>

      <div
        className={`display-save-bar${saveBarDocked ? " is-docked" : ""}`}
      >
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
            <FormValidationMessages errors={modalFieldErrors} />
            <ModalField label="Title" error={modalFieldErrors.title}>
              <input
                type="text"
                value={packageForm.title}
                onChange={(e) => {
                  setPackageForm({ ...packageForm, title: e.target.value });
                  clearModalFieldError("title");
                }}
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
                placeholder="e.g. Contact for price (live amount uses tour LKR)"
              />
            </ModalField>
            <ModalField label="Package image" full error={modalFieldErrors.imageUrl}>
              <ImageUrlField
                label=""
                className="image-url-field--embedded"
                value={packageForm.imageUrl}
                onChange={(imageUrl) => {
                  setPackageForm({ ...packageForm, imageUrl });
                  clearModalFieldError("imageUrl");
                }}
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
            <FormValidationMessages errors={modalFieldErrors} />
            <ModalField label="Author name" error={modalFieldErrors.authorName}>
              <input
                type="text"
                value={reviewForm.authorName}
                onChange={(e) => {
                  setReviewForm({ ...reviewForm, authorName: e.target.value });
                  clearModalFieldError("authorName");
                }}
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
          <ModalActions
            onCancel={() => setReviewModalOpen(false)}
            submitLabel="Save review"

          />
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
            <FormValidationMessages errors={modalFieldErrors} />
            <ModalField label="Gallery image" full error={modalFieldErrors.url}>
              <ImageUrlField
                label=""
                className="image-url-field--embedded"
                value={galleryForm.url}
                onChange={(url) => {
                  setGalleryForm({ ...galleryForm, url });
                  clearModalFieldError("url");
                }}
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
            <ModalField label="Link to entity" full error={modalFieldErrors.entityId}>
              <select
                value={galleryForm.entityId}
                onChange={(e) => {
                  setGalleryForm({ ...galleryForm, entityId: e.target.value });
                  clearModalFieldError("entityId");
                }}
              >
                <option value="">Select…</option>
                {entities.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {entityOptionLabel(ent)}
                  </option>
                ))}
              </select>
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
            <FormValidationMessages errors={modalFieldErrors} />
            <ModalField label="Hero image" full error={modalFieldErrors.url}>
              <ImageUrlField
                label=""
                className="image-url-field--embedded"
                value={heroForm.url}
                onChange={(url) => {
                  setHeroForm({ ...heroForm, url });
                  clearModalFieldError("url");
                }}
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
            <FormValidationMessages errors={modalFieldErrors} />
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
            <ModalField label="URL" full error={modalFieldErrors.url}>
              <input
                type="url"
                value={socialForm.url}
                onChange={(e) => {
                  setSocialForm({ ...socialForm, url: e.target.value });
                  clearModalFieldError("url");
                }}
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
            <FormValidationMessages errors={modalFieldErrors} />
            <ModalField label="Image" full error={modalFieldErrors.url}>
              <ImageUrlField
                label=""
                className="image-url-field--embedded"
                value={whoWeAreImageForm.url}
                onChange={(url) => {
                  setWhoWeAreImageForm({ ...whoWeAreImageForm, url });
                  clearModalFieldError("url");
                }}
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
            <FormValidationMessages errors={modalFieldErrors} />
            <ModalField label="Title" error={modalFieldErrors.title}>
              <input
                type="text"
                value={offerForm.title}
                onChange={(e) => {
                  setOfferForm({ ...offerForm, title: e.target.value });
                  clearModalFieldError("title");
                }}
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
              <RichTextEditor
                rows={3}
                value={offerForm.description}
                onChange={(description) => setOfferForm({ ...offerForm, description })}
                aria-label="Offer description"
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
          <ModalActions
            onCancel={() => setOfferModalOpen(false)}
            submitLabel="Save offer"

          />
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

      <DashboardModal
        open={transportModalOpen}
        title={editTransportIndex === null ? "Add vehicle" : "Edit vehicle"}
        subtitle="Shown as a card in the transport section on your public page."
        onClose={() => {
          setTransportModalOpen(false);
          setEditTransportIndex(null);
        }}
      >
        <form onSubmit={saveTransport}>
          <div className="entity-form-grid">
            <FormValidationMessages errors={modalFieldErrors} />
            <ModalField label="Vehicle type (icon)">
              <select
                value={transportForm.id}
                onChange={(e) => {
                  if (editTransportIndex === null) applyTransportTemplate(e.target.value);
                  else setTransportForm((prev) => ({ ...prev, id: e.target.value }));
                }}
                required
              >
                {AGENCY_TRANSPORT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.variant ? `${option.name} (${option.variant})` : option.name}
                  </option>
                ))}
              </select>
            </ModalField>
            <ModalField label="Display name" error={modalFieldErrors.name}>
              <input
                type="text"
                value={transportForm.name}
                onChange={(e) => {
                  setTransportForm({ ...transportForm, name: e.target.value });
                  clearModalFieldError("name");
                }}
                placeholder="Sedan"
                required
                autoFocus
              />
            </ModalField>
            <ModalField label="Variant label (optional)">
              <input
                type="text"
                value={transportForm.variant || ""}
                onChange={(e) => setTransportForm({ ...transportForm, variant: e.target.value })}
                placeholder="High Roof"
              />
            </ModalField>
            <ModalField label="Description" full>
              <RichTextEditor
                rows={3}
                value={transportForm.description}
                onChange={(description) =>
                  setTransportForm({ ...transportForm, description })
                }
                placeholder="Comfortable for small groups with room for luggage."
                aria-label="Vehicle description"
              />
            </ModalField>
            <ModalField label="Seating">
              <input
                type="text"
                value={transportForm.seating}
                onChange={(e) => setTransportForm({ ...transportForm, seating: e.target.value })}
                placeholder="2–3 passengers"
              />
            </ModalField>
            <ModalField label="Luggage">
              <input
                type="text"
                value={transportForm.luggage}
                onChange={(e) => setTransportForm({ ...transportForm, luggage: e.target.value })}
                placeholder="2 medium bags"
              />
            </ModalField>
          </div>
          <ModalActions
            onCancel={() => {
              setTransportModalOpen(false);
              setEditTransportIndex(null);
            }}
            submitLabel={editTransportIndex === null ? "Add vehicle" : "Save vehicle"}

          />
          {editTransportIndex !== null && (
            <button
              type="button"
              className="btn btn-lite display-modal-delete"
              onClick={() => removeTransport(editTransportIndex)}
            >
              Remove vehicle
            </button>
          )}
        </form>
      </DashboardModal>
    </article>
  );
}
