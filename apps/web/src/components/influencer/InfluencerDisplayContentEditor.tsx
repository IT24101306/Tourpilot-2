import { FormEvent, useState } from "react";
import { MAX_AGENCY_HERO_SLIDES } from "@tourpilot/shared";
import { ImageUrlField } from "../ImageUrlField";
import { DashboardModal, ModalActions, ModalField } from "../DashboardModal";
import {
  DisplayCompactRow,
  DisplaySectionActions,
} from "../display/DisplayEditorUi";
import { SOCIAL_PLATFORMS, type DisplaySocialLink, type HeroSlide } from "../display/displayTypes";
import { SocialLineIcon } from "../icons/LineIcons";
import { RichTextEditor } from "../richtext/RichTextEditor";

type Props = {
  token: string | null | undefined;
  heroImages: HeroSlide[];
  aboutTitle: string;
  aboutDescription: string;
  socialLinks: DisplaySocialLink[];
  onHeroImagesChange: (slides: HeroSlide[]) => void;
  onAboutTitleChange: (value: string) => void;
  onAboutDescriptionChange: (value: string) => void;
  onSocialLinksChange: (links: DisplaySocialLink[]) => void;
  socialTagHandle: string;
  onSocialTagHandleChange: (value: string) => void;
};

const defaultSocial = (): DisplaySocialLink => ({
  platform: "instagram",
  url: "",
  label: "",
});

export function InfluencerDisplayContentEditor({
  token,
  heroImages,
  aboutTitle,
  aboutDescription,
  socialLinks,
  onHeroImagesChange,
  onAboutTitleChange,
  onAboutDescriptionChange,
  onSocialLinksChange,
  socialTagHandle,
  onSocialTagHandleChange,
}: Props) {
  const [heroModalOpen, setHeroModalOpen] = useState(false);
  const [editHeroIndex, setEditHeroIndex] = useState<number | null>(null);
  const [heroForm, setHeroForm] = useState<HeroSlide>({ url: "", label: "" });

  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [editSocialIndex, setEditSocialIndex] = useState<number | null>(null);
  const [socialForm, setSocialForm] = useState<DisplaySocialLink>(defaultSocial());

  function openAddHero() {
    setEditHeroIndex(null);
    setHeroForm({ url: "", label: "" });
    setHeroModalOpen(true);
  }

  function openEditHero(index: number) {
    const slide = heroImages[index];
    setEditHeroIndex(index);
    setHeroForm({ url: slide.url, label: slide.label || "" });
    setHeroModalOpen(true);
  }

  function saveHeroSlide(e: FormEvent) {
    e.preventDefault();
    const url = heroForm.url.trim();
    if (!url) return;
    const entry: HeroSlide = { url, label: heroForm.label?.trim() || "" };
    if (editHeroIndex === null) {
      onHeroImagesChange([...heroImages, entry]);
    } else {
      onHeroImagesChange(heroImages.map((s, i) => (i === editHeroIndex ? entry : s)));
    }
    setHeroModalOpen(false);
  }

  function removeHeroSlide(index: number) {
    onHeroImagesChange(heroImages.filter((_, i) => i !== index));
    setHeroModalOpen(false);
  }

  function moveHeroSlide(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= heroImages.length) return;
    const copy = [...heroImages];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    onHeroImagesChange(copy);
  }

  function openAddSocial() {
    setEditSocialIndex(null);
    setSocialForm(defaultSocial());
    setSocialModalOpen(true);
  }

  function openEditSocial(index: number) {
    setEditSocialIndex(index);
    setSocialForm({ ...socialLinks[index] });
    setSocialModalOpen(true);
  }

  function saveSocialLink(e: FormEvent) {
    e.preventDefault();
    const entry: DisplaySocialLink = {
      platform: socialForm.platform.trim(),
      url: socialForm.url.trim(),
      label: socialForm.label?.trim() || "",
    };
    if (!entry.platform || !entry.url) return;
    if (editSocialIndex === null) {
      onSocialLinksChange([...socialLinks, entry]);
    } else {
      onSocialLinksChange(socialLinks.map((l, i) => (i === editSocialIndex ? entry : l)));
    }
    setSocialModalOpen(false);
  }

  function removeSocialLink(index: number) {
    onSocialLinksChange(socialLinks.filter((_, i) => i !== index));
    setSocialModalOpen(false);
  }

  return (
    <>
      <div className="display-list-block">
        <h3 className="influencer-display-section-title">Story tag handle</h3>
        <p className="muted display-subsection-desc">
          Travelers who register for offers on your page will tag this @ handle in their social story.
        </p>
        <label className="field">
          <span>@ handle</span>
          <input
            value={socialTagHandle}
            onChange={(e) => onSocialTagHandleChange(e.target.value)}
            placeholder="@yourname"
            maxLength={80}
          />
        </label>
      </div>

      <div className="display-list-block">
        <h3 className="influencer-display-section-title">Hero banner images</h3>
        <p className="muted display-subsection-desc">
          Add up to {MAX_AGENCY_HERO_SLIDES} images for your hero slideshow. Upload from your device
          or paste an image URL.
        </p>
        {heroImages.length === 0 ? (
          <p className="display-empty-hint">No hero images yet — add your first banner slide.</p>
        ) : (
          <div className="display-compact-list">
            {heroImages.map((slide, i) => (
              <DisplayCompactRow
                key={`${slide.url}-${i}`}
                thumb={<img src={slide.url} alt="" className="display-compact-row-thumb" />}
                title={slide.label?.trim() || `Slide ${i + 1}`}
                meta={
                  <span className="muted">
                    {i + 1} of {heroImages.length}
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
                    {i < heroImages.length - 1 && (
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
                onEdit={() => openEditHero(i)}
              />
            ))}
          </div>
        )}
        <DisplaySectionActions>
          <button
            type="button"
            className="btn btn-primary"
            disabled={heroImages.length >= MAX_AGENCY_HERO_SLIDES}
            onClick={openAddHero}
          >
            + Add hero image
          </button>
        </DisplaySectionActions>
      </div>

      <div className="display-list-block">
        <h3 className="influencer-display-section-title">About section</h3>
        <p className="muted display-subsection-desc">
          Introduce yourself to visitors. This appears below your hero on the public page.
        </p>
        <label className="field">
          <span>Section title</span>
          <input
            value={aboutTitle}
            onChange={(e) => onAboutTitleChange(e.target.value)}
            placeholder="About the creator"
            maxLength={80}
          />
        </label>
        <label className="field">
          <span>About you</span>
          <RichTextEditor
            rows={4}
            value={aboutDescription}
            onChange={onAboutDescriptionChange}
            placeholder="Tell followers who you are, what you share, and why you recommend these trips."
            maxLength={1200}
            aria-label="About you"
          />
        </label>
      </div>

      <div className="display-list-block">
        <h3 className="influencer-display-section-title">Social links</h3>
        <p className="muted display-subsection-desc">
          Links appear as icons in your about section on the public page.
        </p>
        {socialLinks.length === 0 ? (
          <p className="display-empty-hint">No social links yet.</p>
        ) : (
          <div className="display-compact-list">
            {socialLinks.map((link, i) => (
              <DisplayCompactRow
                key={`${link.platform}-${i}`}
                thumb={
                  <span className="influencer-display-social-thumb" aria-hidden="true">
                    <SocialLineIcon platform={link.platform} size={18} />
                  </span>
                }
                title={
                  link.label?.trim() ||
                  SOCIAL_PLATFORMS.find((p) => p.id === link.platform)?.label ||
                  link.platform
                }
                meta={<span className="muted">{link.url}</span>}
                onEdit={() => openEditSocial(i)}
              />
            ))}
          </div>
        )}
        <DisplaySectionActions>
          <button
            type="button"
            className="btn btn-primary"
            disabled={socialLinks.length >= 12}
            onClick={openAddSocial}
          >
            + Add social link
          </button>
        </DisplaySectionActions>
      </div>

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
        subtitle="Shown as icon buttons in your about section."
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
                placeholder="Follow on Instagram"
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
    </>
  );
}
