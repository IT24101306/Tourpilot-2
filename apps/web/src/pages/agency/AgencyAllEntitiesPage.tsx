import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";

const ENTITY_TYPES = [
  { value: "HOTEL", label: "Hotel", icon: "🏨" },
  { value: "VIEWPOINT", label: "Viewpoint", icon: "🏔️" },
  { value: "ACTIVITY", label: "Activity", icon: "🎯" },
  { value: "RESTAURANT", label: "Restaurant", icon: "🍽️" },
  { value: "TRANSPORT", label: "Transport", icon: "🚐" },
  { value: "FREE_TIME", label: "Free time", icon: "☕" },
  { value: "OTHER", label: "Other", icon: "📍" },
] as const;

type EntityMediaItem =
  | { kind: "image"; url: string; label?: string }
  | { kind: "video"; url: string; label?: string }
  | { kind: "link"; url: string; label?: string };

type AgencyEntity = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  district: string | null;
  priceHint: number | null;
  description?: string | null;
};

function formatType(type: string) {
  return type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, " ");
}

function typeMeta(type: string) {
  return ENTITY_TYPES.find((t) => t.value === type) ?? { label: formatType(type), icon: "📍" };
}

export function AgencyAllEntitiesPage() {
  const { token } = useAuth();
  const [entities, setEntities] = useState<AgencyEntity[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const [entityForm, setEntityForm] = useState({
    name: "",
    type: "HOTEL",
    city: "",
    district: "",
    description: "",
    durationMin: "",
    priceHint: "",
    contact: "",
    lat: "",
    lng: "",
  });
  const [media, setMedia] = useState<EntityMediaItem[]>([]);
  const [mediaDraft, setMediaDraft] = useState<{ kind: EntityMediaItem["kind"]; url: string; label: string }>({
    kind: "image",
    url: "",
    label: "",
  });

  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    for (const e of entities) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
    }
    return { total: entities.length, byType };
  }, [entities]);

  async function refresh(authToken: string) {
    const path = typeFilter === "all" ? "/entities" : `/entities?type=${typeFilter}`;
    const list = await api<AgencyEntity[]>(path, { token: authToken });
    setEntities(list);
  }

  useEffect(() => {
    if (!token) return;
    refresh(token).catch(console.error);
  }, [token, typeFilter]);

  async function addEntity(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setToast("");
    const savedName = entityForm.name.trim();
    try {
      await api("/entities", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: savedName,
          type: entityForm.type,
          city: entityForm.city,
          district: entityForm.district || undefined,
          description: entityForm.description || undefined,
          durationMin: entityForm.durationMin ? Number(entityForm.durationMin) : undefined,
          priceHint: entityForm.priceHint ? Number(entityForm.priceHint) : undefined,
          contact: entityForm.contact || undefined,
          lat: entityForm.lat ? Number(entityForm.lat) : undefined,
          lng: entityForm.lng ? Number(entityForm.lng) : undefined,
          media: media.length > 0 ? media : undefined,
        }),
      });
      setEntityForm({
        name: "",
        type: entityForm.type,
        city: "",
        district: "",
        description: "",
        durationMin: "",
        priceHint: "",
        contact: "",
        lat: "",
        lng: "",
      });
      setMedia([]);
      setMediaDraft({ kind: "image", url: "", label: "" });
      setToast(`${savedName || "Entity"} saved to your library.`);
      await refresh(token);
      setTimeout(() => setToast(""), 3200);
    } catch {
      setToast("Could not save entity. Check required fields and try again.");
    } finally {
      setSaving(false);
    }
  }

  function addMediaItem() {
    const url = mediaDraft.url.trim();
    if (!url) return;
    setMedia((m) => [
      ...m,
      { kind: mediaDraft.kind, url, ...(mediaDraft.label.trim() ? { label: mediaDraft.label.trim() } : {}) },
    ]);
    setMediaDraft((d) => ({ ...d, url: "", label: "" }));
  }

  return (
    <div className="module-shell module-catalog entities-studio">
      <ModuleHeader
        module="catalog"
        title="Entity library"
        subtitle="Hotels, viewpoints, activities, and more — the building blocks of your tours."
      />

      <header className="entities-studio-hero cat-studio-hero">
        <div className="entities-studio-stats">
          <div className="entities-stat-pill">
            <span className="entities-stat-value">{stats.total}</span>
            <span className="entities-stat-label">In view</span>
          </div>
          <div className="entities-stat-pill accent">
            <span className="entities-stat-value">{Object.keys(stats.byType).length}</span>
            <span className="entities-stat-label">Types used</span>
          </div>
        </div>
      </header>

      <div className="entities-type-tabs" role="tablist" aria-label="Filter by type">
        <button
          type="button"
          role="tab"
          aria-selected={typeFilter === "all"}
          className={`entities-type-tab ${typeFilter === "all" ? "active" : ""}`}
          onClick={() => setTypeFilter("all")}
        >
          All
          <span className="entities-type-count">{stats.total}</span>
        </button>
        {ENTITY_TYPES.map((t) => {
          const count = stats.byType[t.value] ?? 0;
          if (typeFilter !== "all" && typeFilter !== t.value && count === 0) return null;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={typeFilter === t.value}
              className={`entities-type-tab ${typeFilter === t.value ? "active" : ""}`}
              onClick={() => setTypeFilter(t.value)}
            >
              <span aria-hidden="true">{t.icon}</span>
              {t.label}
              {count > 0 && <span className="entities-type-count">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="entities-studio-layout">
        <form className="entities-form-card" onSubmit={addEntity}>
          <div className="entities-form-card-head">
            <div>
              <h3>Add new entity</h3>
              <p className="muted">Only the name is required — everything else helps on trip planning.</p>
            </div>
          </div>

          <div className="entities-form-section">
            <h4>Basics</h4>
            <div className="entity-form-grid">
              <div className="field full">
                <label htmlFor="ent-name">Name *</label>
                <input
                  id="ent-name"
                  placeholder="e.g. Sigiriya Village Hotel"
                  value={entityForm.name}
                  onChange={(e) => setEntityForm({ ...entityForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="field full">
                <span className="field-label">Type</span>
                <div className="entities-type-picker">
                  {ENTITY_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      className={`entities-type-chip ${entityForm.type === t.value ? "selected" : ""}`}
                      onClick={() => setEntityForm({ ...entityForm, type: t.value })}
                    >
                      <span className="entities-type-chip-icon" aria-hidden="true">
                        {t.icon}
                      </span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label htmlFor="ent-desc">Description</label>
                <textarea
                  id="ent-desc"
                  rows={3}
                  placeholder="What makes this place special?"
                  value={entityForm.description}
                  onChange={(e) => setEntityForm({ ...entityForm, description: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="entities-form-section">
            <h4>Location & contact</h4>
            <div className="entity-form-grid">
              <div className="field">
                <label htmlFor="ent-city">City</label>
                <input
                  id="ent-city"
                  placeholder="Ella"
                  value={entityForm.city}
                  onChange={(e) => setEntityForm({ ...entityForm, city: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="ent-district">District</label>
                <input
                  id="ent-district"
                  placeholder="Badulla"
                  value={entityForm.district}
                  onChange={(e) => setEntityForm({ ...entityForm, district: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="ent-lat">Latitude</label>
                <input
                  id="ent-lat"
                  type="number"
                  step="any"
                  placeholder="6.9271"
                  value={entityForm.lat}
                  onChange={(e) => setEntityForm({ ...entityForm, lat: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="ent-lng">Longitude</label>
                <input
                  id="ent-lng"
                  type="number"
                  step="any"
                  placeholder="79.8612"
                  value={entityForm.lng}
                  onChange={(e) => setEntityForm({ ...entityForm, lng: e.target.value })}
                />
              </div>
              <div className="field full">
                <label htmlFor="ent-contact">Contact</label>
                <input
                  id="ent-contact"
                  placeholder="Phone, email, or WhatsApp"
                  value={entityForm.contact}
                  onChange={(e) => setEntityForm({ ...entityForm, contact: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="entities-form-section">
            <h4>Pricing & duration</h4>
            <div className="entity-form-grid">
              <div className="field">
                <label htmlFor="ent-price">Price hint (LKR)</label>
                <input
                  id="ent-price"
                  type="number"
                  min={0}
                  placeholder="15000"
                  value={entityForm.priceHint}
                  onChange={(e) => setEntityForm({ ...entityForm, priceHint: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="ent-duration">Duration (minutes)</label>
                <input
                  id="ent-duration"
                  type="number"
                  min={0}
                  placeholder="120"
                  value={entityForm.durationMin}
                  onChange={(e) => setEntityForm({ ...entityForm, durationMin: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="entities-form-section">
            <h4>Media gallery</h4>
            <p className="entities-section-hint muted">Images, videos, and links shown on entity cards.</p>
            <div className="entities-media-add">
              <div className="field">
                <label htmlFor="media-kind">Kind</label>
                <select
                  id="media-kind"
                  value={mediaDraft.kind}
                  onChange={(e) =>
                    setMediaDraft((d) => ({ ...d, kind: e.target.value as EntityMediaItem["kind"] }))
                  }
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="link">Link</option>
                </select>
              </div>
              <div className="field grow">
                <label htmlFor="media-url">URL</label>
                <input
                  id="media-url"
                  placeholder="https://…"
                  value={mediaDraft.url}
                  onChange={(e) => setMediaDraft((d) => ({ ...d, url: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="media-label">Label</label>
                <input
                  id="media-label"
                  placeholder="Optional"
                  value={mediaDraft.label}
                  onChange={(e) => setMediaDraft((d) => ({ ...d, label: e.target.value }))}
                />
              </div>
              <button type="button" className="btn btn-ghost entities-media-add-btn" onClick={addMediaItem}>
                Add
              </button>
            </div>

            {media.length > 0 && (
              <ul className="entities-media-list">
                {media.map((m, idx) => (
                  <li key={`${m.kind}-${m.url}-${idx}`} className="entities-media-item">
                    <span className={`entities-media-badge ${m.kind}`}>{m.kind}</span>
                    <div className="entities-media-text">
                      {m.label && <strong>{m.label}</strong>}
                      <span className="muted">{m.url}</span>
                    </div>
                    <button
                      type="button"
                      className="entities-media-remove"
                      onClick={() => setMedia((arr) => arr.filter((_, i) => i !== idx))}
                      aria-label="Remove media"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="entities-form-footer">
            {toast && <p className="entities-toast">{toast}</p>}
            <button type="submit" className="btn btn-primary entities-submit-btn" disabled={saving}>
              {saving ? "Saving…" : "Save entity"}
            </button>
          </div>
        </form>

        <section className="entities-list-card">
          <div className="entities-list-head">
            <h3>Your entities</h3>
            <span className="muted">{entities.length} shown</span>
          </div>

          {entities.length === 0 ? (
            <div className="entities-empty">
              <span className="entities-empty-icon" aria-hidden="true">
                📍
              </span>
              <p>
                <strong>No entities yet</strong>
              </p>
              <p className="muted">Add your first hotel, viewpoint, or activity using the form.</p>
            </div>
          ) : (
            <div className="entities-table-wrap">
              <table className="entities-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Location</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {entities.map((ent) => {
                    const meta = typeMeta(ent.type);
                    return (
                      <tr key={ent.id}>
                        <td>
                          <strong className="entities-row-name">{ent.name}</strong>
                          {ent.description && (
                            <span className="entities-row-desc muted">{ent.description}</span>
                          )}
                        </td>
                        <td>
                          <span className={`entities-type-badge type-${ent.type.toLowerCase()}`}>
                            <span aria-hidden="true">{meta.icon}</span>
                            {meta.label}
                          </span>
                        </td>
                        <td>
                          {[ent.city, ent.district].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="entities-price">
                          {ent.priceHint != null ? `LKR ${ent.priceHint.toLocaleString()}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
