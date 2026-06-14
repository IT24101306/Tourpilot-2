import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { EntityFormFields } from "../../components/entity/EntityFormFields";
import { EntityMediaFields } from "../../components/entity/EntityMediaFields";
import { buildEntityMediaStore, type EntityMediaItem } from "@tourpilot/shared";
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
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { EntityTypeLineIcon } from "../../components/icons/LineIcons";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import {
  TOUR_BUILDER_RETURN_PARAM,
  TOUR_BUILDER_RETURN_VALUE,
  tourBuilderResumePath,
} from "../../lib/tourBuilderDraft";

const PICKER_TYPES: { value: EntityTypeKey; label: string }[] = [
  { value: "HOTEL", label: "Hotel" },
  { value: "VIEWPOINT", label: "Viewpoint" },
  { value: "ACTIVITY", label: "Activity" },
  { value: "RESTAURANT", label: "Restaurant" },
];

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

export function AgencyAllEntitiesPage() {
  const { token } = useAuth();
  const { requestConfirm } = useConfirmAction();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnToTourBuilder =
    searchParams.get(TOUR_BUILDER_RETURN_PARAM) === TOUR_BUILDER_RETURN_VALUE;
  const [entities, setEntities] = useState<AgencyEntity[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const [entityForm, setEntityForm] = useState<EntityFormState>(defaultEntityForm());
  const [mainImageUrl, setMainImageUrl] = useState("");
  const [gallery, setGallery] = useState<EntityMediaItem[]>([]);

  const filterTabs = useMemo(() => {
    const tabs: { value: string; label: string }[] = [
      { value: "all", label: "All" },
      ...PICKER_TYPES.map((t) => ({ value: t.value, label: t.label })),
    ];
    const legacyTypes = new Set(entities.map((e) => e.type));
    for (const t of legacyTypes) {
      if (!ALLOWED_ENTITY_TYPES.includes(t as EntityTypeKey)) {
        tabs.push({ value: t, label: entityTypeLabel(t) });
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

  function addEntity(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const savedName = entityForm.name.trim();
    const payload = buildEntityPayload(entityForm);
    requestConfirm({
      title: "Add entity to library?",
      description: "This place becomes available for itineraries and tour planning.",
      confirmLabel: "Save entity",
      summary: [
        { label: "Name", value: savedName || "(untitled)" },
        { label: "Type", value: entityTypeLabel(entityForm.type) },
        { label: "Location", value: entityLocationLabel(entityForm) },
        { label: "Main image", value: mainImageUrl.trim() ? "Yes" : "No" },
        { label: "Extra media", value: String(gallery.length) },
        { label: "Details", value: entityDetailsSummary(entityForm) },
      ],
      onConfirm: async () => {
        setSaving(true);
        setToast("");
        try {
          await api("/entities", {
            method: "POST",
            token,
            body: JSON.stringify({
              ...payload,
              media: buildEntityMediaStore(mainImageUrl, gallery),
            }),
          });
          setEntityForm(defaultEntityForm());
          setMainImageUrl("");
          setGallery([]);
          await refresh(token);
          if (returnToTourBuilder) {
            navigate(tourBuilderResumePath());
            return;
          }
          setToast(`${savedName || "Entity"} saved to your library.`);
          setTimeout(() => setToast(""), 3200);
        } catch {
          setToast("Could not save entity. Check required fields and try again.");
        } finally {
          setSaving(false);
        }
      },
    });
  }

  return (
    <div className="module-shell module-catalog entities-studio">
      <ModuleHeader
        module="catalog"
        title="Entity library"
        subtitle={
          returnToTourBuilder
            ? "Add an entity for your package in progress — you'll return to Tours when you save."
            : "Hotels, viewpoints, activities, and restaurants — the building blocks of your tours."
        }
      />

      {returnToTourBuilder && (
        <div className="tour-builder-return-banner" role="status">
          <span>
            You're adding an entity for a <strong>package you're building</strong>. Save the
            entity below to return to your tour, or{" "}
            <Link to={tourBuilderResumePath()}>go back without adding</Link>.
          </span>
        </div>
      )}

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
              <span aria-hidden="true">
                <EntityTypeLineIcon type={t.value} size={16} />
              </span>
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

          <EntityMediaFields
            mainImageUrl={mainImageUrl}
            onMainImageChange={setMainImageUrl}
            gallery={gallery}
            onGalleryChange={setGallery}
            token={token}
          />

          <div className="entities-form-footer">
            {toast && <p className="entities-toast">{toast}</p>}
            <button
              type="submit"
              className="btn btn-primary entities-submit-btn"
              disabled={saving || !entityForm.name.trim()}
            >
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
                <EntityTypeLineIcon type="OTHER" size={28} />
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
                          <span aria-hidden="true">
                            <EntityTypeLineIcon type={ent.type} size={14} />
                          </span>
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
