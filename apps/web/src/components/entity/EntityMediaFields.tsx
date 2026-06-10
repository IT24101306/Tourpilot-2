import { useState } from "react";
import type { EntityMediaItem, EntityMediaKind } from "@tourpilot/shared";
import { ImageUrlField } from "../ImageUrlField";

type Props = {
  mainImageUrl: string;
  onMainImageChange: (url: string) => void;
  gallery: EntityMediaItem[];
  onGalleryChange: (items: EntityMediaItem[]) => void;
  token?: string | null;
};

export function EntityMediaFields({
  mainImageUrl,
  onMainImageChange,
  gallery,
  onGalleryChange,
  token,
}: Props) {
  const [kind, setKind] = useState<EntityMediaKind>("image");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");

  function addGalleryItem() {
    const trimmed = url.trim();
    if (!trimmed) return;
    onGalleryChange([
      ...gallery,
      {
        kind,
        url: trimmed,
        ...(label.trim() ? { label: label.trim() } : {}),
      },
    ]);
    setUrl("");
    setLabel("");
  }

  return (
    <div className="entity-media-fields">
      <div className="entities-form-section">
        <h4>Main image</h4>
        <p className="entities-section-hint muted">
          Shown on the itinerary when travelers expand a stop.
        </p>
        <ImageUrlField
          label="Cover photo"
          className="image-url-field--full"
          value={mainImageUrl}
          onChange={onMainImageChange}
          token={token}
          placeholder="Paste a link or upload from your device"
        />
      </div>

      <div className="entities-form-section">
        <h4>Additional media</h4>
        <p className="entities-section-hint muted">Extra images, videos, or links for this place.</p>
        <div className="entities-media-add">
          <div className="field">
            <label htmlFor="entity-gallery-kind">Kind</label>
            <select
              id="entity-gallery-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as EntityMediaKind)}
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="link">Link</option>
            </select>
          </div>
          <div className="field grow">
            {kind === "image" ? (
              <ImageUrlField
                label="Image"
                className="image-url-field--embedded"
                value={url}
                onChange={setUrl}
                token={token}
                placeholder="Paste a link or upload from your device"
              />
            ) : (
              <>
                <label htmlFor="entity-gallery-url">URL</label>
                <input
                  id="entity-gallery-url"
                  placeholder={
                    kind === "video" ? "https://youtube.com/… or video URL" : "https://…"
                  }
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </>
            )}
          </div>
          <div className="field">
            <label htmlFor="entity-gallery-label">Label</label>
            <input
              id="entity-gallery-label"
              placeholder="Optional"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <button type="button" className="btn btn-ghost entities-media-add-btn" onClick={addGalleryItem}>
            Add
          </button>
        </div>

        {gallery.length > 0 && (
          <ul className="entities-media-list">
            {gallery.map((m, idx) => (
              <li key={`${m.kind}-${m.url}-${idx}`} className="entities-media-item">
                <span className={`entities-media-badge ${m.kind}`}>{m.kind}</span>
                <div className="entities-media-text">
                  {m.label && <strong>{m.label}</strong>}
                  <span className="muted">{m.url}</span>
                </div>
                <button
                  type="button"
                  className="entities-media-remove"
                  onClick={() => onGalleryChange(gallery.filter((_, i) => i !== idx))}
                  aria-label="Remove media"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
