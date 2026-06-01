import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ImageUrlField } from "../../components/ImageUrlField";
import { EntityFormFields } from "../../components/entity/EntityFormFields";
import {
  ALLOWED_ENTITY_TYPES,
  buildEntityPayload,
  defaultEntityForm,
  entityDetailsSummary,
  entityLocationLabel,
  entityTypeLabel,
  type EntityFormState,
  type EntityTypeKey,
} from "../../components/entity/entityTypes";
import { ModuleHeader } from "../../components/module/ModuleHeader";

const TYPE_ICONS: Record<string, string> = {
  HOTEL: "",
  VIEWPOINT: "",
  ACTIVITY: "",
  RESTAURANT: "",
  OTHER: "",
};

const PICKER_TYPES: { value: EntityTypeKey; label: string; icon: string }[] = [
  { value: "HOTEL", label: "Hotel", icon: "" },
  { value: "VIEWPOINT", label: "Viewpoint", icon: "" },
  { value: "ACTIVITY", label: "Activity", icon: "" },
  { value: "RESTAURANT", label: "Restaurant", icon: "" },
];

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
  contact?: string | null;
  metadata?: Record<string, unknown> | null;
};

function typeIcon(type: string) {
  return TYPE_ICONS[type] ?? "📍";
}

export function AgencyAllEntitiesPage() {
  const { token } = useAuth();
  const [entities, setEntities] = useState<AgencyEntity[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const [entityForm, setEntityForm] = useState<EntityFormState>(defaultEntityForm());
  const [media, setMedia] = useState<EntityMediaItem[]>([]);
  const [mediaDraft, setMediaDraft] = useState<{ kind: EntityMediaItem["kind"]; url: string; label: string }>({
    kind: "image",
    url: "",
    label: "",
  });

  const filterTabs = useMemo(() => {
    const tabs: { value: string; label: string; icon: string }[] = [
      { value: "all", label: "All", icon: "📋" },
      ...PICKER_TYPES.map((t) => ({ value: t.value, label: t.label, icon: t.icon })),
    ];
    const legacyTypes = new Set(entities.map((e) => e.type));
    for (const t of legacyTypes) {
      if (!ALLOWED_ENTITY_TYPES.includes(t as EntityTypeKey)) {
        tabs.push({ value: t, label: entityTypeLabel(t), icon: typeIcon(t) });
      }
    }
    return tabs;
  }, [entities]);

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
          ...buildEntityPayload(entityForm),
          media: media.length > 0 ? media : undefined,
        }),
      });
      setEntityForm(defaultEntityForm());
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
        subtitle="Hotels, viewpoints, activities, and restaurants — the building blocks of your tours."
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
        {filterTabs.map((t) => {
          const count = t.value === "all" ? stats.total : stats.byType[t.value] ?? 0;
          if (t.value !== "all" && typeFilter !== t.value && count === 0) return null;
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
              <p className="muted">Choose a type — the form updates with the right fields.</p>
            </div>
          </div>

          <div className="entities-form-section">
            <h4>Details</h4>
            <div className="entity-form-grid">
              <EntityFormFields
                form={entityForm}
                onChange={setEntityForm}
                typePicker="chips"
              />
            </div>
          </div>

          <div className="entities-form-section">
            <h4>Media gallery</h4>
            <p className="entities-section-hint muted">Optional images, videos, and links for this entity.</p>
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
                {mediaDraft.kind === "image" ? (
                  <ImageUrlField
                    label="Image"
                    className="image-url-field--embedded"
                    value={mediaDraft.url}
                    onChange={(url) => setMediaDraft((d) => ({ ...d, url }))}
                    token={token}
                    placeholder="Paste a link or upload from your device"
                  />
                ) : (
                  <>
                    <label htmlFor="media-url">URL</label>
                    <input
                      id="media-url"
                      placeholder={
                        mediaDraft.kind === "video"
                          ? "https://youtube.com/… or video URL"
                          : "https://…"
                      }
                      value={mediaDraft.url}
                      onChange={(e) => setMediaDraft((d) => ({ ...d, url: e.target.value }))}
                    />
                  </>
                )}
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
                    <th>Details</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {entities.map((ent) => (
                    <tr key={ent.id}>
                      <td>
                        <strong className="entities-row-name">{ent.name}</strong>
                        {ent.description && (
                          <span className="entities-row-desc muted">{ent.description}</span>
                        )}
                      </td>
                      <td>
                        <span className={`entities-type-badge type-${ent.type.toLowerCase()}`}>
                          <span aria-hidden="true">{typeIcon(ent.type)}</span>
                          {entityTypeLabel(ent.type)}
                        </span>
                      </td>
                      <td>{entityLocationLabel(ent)}</td>
                      <td className="muted entities-details-cell">{entityDetailsSummary(ent)}</td>
                      <td className="entities-price">
                        {ent.priceHint != null ? `LKR ${ent.priceHint.toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
