import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { EntityFormFields } from "../../components/entity/EntityFormFields";
import { EntityMediaFields } from "../../components/entity/EntityMediaFields";
import { EntityFormModal } from "../../components/entity/EntityFormModal";
import {
  buildEntityMediaStore,
  normalizeEntityMedia,
  type EntityMediaItem,
} from "@tourpilot/shared";
import {
  ALLOWED_ENTITY_TYPES,
  buildEntityPayload,
  defaultEntityForm,
  entityDetailsSummary,
  entityLocationLabel,
  entityToFormState,
  entityTypeLabel,
  type EntityFormState,
  type EntityTypeKey,
} from "../../components/entity/entityTypes";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { EntityTypeLineIcon } from "../../components/icons/LineIcons";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { validateRequiredFields } from "../../lib/formValidation";
import { FormValidationMessages } from "../../components/FormFieldError";
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
  { value: "OTHER", label: "Other" },
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
  media?: unknown;
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

  const [editEntity, setEditEntity] = useState<AgencyEntity | null>(null);
  const [editForm, setEditForm] = useState<EntityFormState>(defaultEntityForm());
  const [editMainImageUrl, setEditMainImageUrl] = useState("");
  const [editGallery, setEditGallery] = useState<EntityMediaItem[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [entityFieldErrors, setEntityFieldErrors] = useState<Record<string, string>>({});
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"name" | "type" | "location">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [activePane, setActivePane] = useState<"add" | "list">("add");

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

  const visibleEntities = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = entities;
    if (q) {
      list = list.filter((e) =>
        `${e.name} ${entityTypeLabel(e.type)} ${entityLocationLabel(e)}`
          .toLowerCase()
          .includes(q)
      );
    }
    const sortValue = (e: AgencyEntity) => {
      if (sortKey === "type") return entityTypeLabel(e.type);
      if (sortKey === "location") return entityLocationLabel(e);
      return e.name;
    };
    return [...list].sort((a, b) => {
      const cmp = sortValue(a).localeCompare(sortValue(b), undefined, {
        sensitivity: "base",
        numeric: true,
      });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [entities, search, sortKey, sortDir]);

  function toggleSort(key: "name" | "type" | "location") {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortIndicator = (key: "name" | "type" | "location") =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

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
    const errors = validateRequiredFields({
      name: { label: "Name", value: entityForm.name },
    });
    if (Object.keys(errors).length > 0) {
      setEntityFieldErrors(errors);
      return;
    }
    setEntityFieldErrors({});

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
          setActivePane("list");
          setTimeout(() => setToast(""), 3200);
        } catch {
          setToast("Could not save entity. Check required fields and try again.");
        } finally {
          setSaving(false);
        }
      },
    });
  }

  function openEdit(ent: AgencyEntity) {
    const bundle = normalizeEntityMedia(ent.media);
    setEditEntity(ent);
    setEditForm(entityToFormState(ent));
    setEditMainImageUrl(bundle.mainImageUrl ?? "");
    setEditGallery(bundle.items);
    setEditError("");
    setEditFieldErrors({});
  }

  function closeEdit() {
    setEditEntity(null);
    setEditSaving(false);
    setEditError("");
    setEditFieldErrors({});
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!token || !editEntity) return;
    const errors = validateRequiredFields({
      name: { label: "Name", value: editForm.name },
    });
    if (Object.keys(errors).length > 0) {
      setEditFieldErrors(errors);
      return;
    }
    setEditFieldErrors({});
    setEditSaving(true);
    setEditError("");
    try {
      await api(`/entities/${editEntity.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          ...buildEntityPayload(editForm),
          media: buildEntityMediaStore(editMainImageUrl, editGallery) ?? {
            mainImageUrl: null,
            items: [],
          },
        }),
      });
      await refresh(token);
      setEditEntity(null);
      setToast(`${editForm.name.trim() || "Entity"} updated.`);
      setTimeout(() => setToast(""), 3200);
    } catch {
      setEditError("Could not save changes. Check required fields and try again.");
    } finally {
      setEditSaving(false);
    }
  }

  function deleteEntity(ent: AgencyEntity) {
    if (!token) return;
    requestConfirm({
      title: "Delete this entity?",
      description:
        "It will be removed from your library. Tours or groups that reference it may be affected.",
      confirmLabel: "Delete entity",
      variant: "danger",
      summary: [
        { label: "Name", value: ent.name },
        { label: "Type", value: entityTypeLabel(ent.type) },
        { label: "Location", value: entityLocationLabel(ent) },
      ],
      onConfirm: async () => {
        try {
          await api(`/entities/${ent.id}`, { method: "DELETE", token });
          await refresh(token);
          setToast(`${ent.name} deleted.`);
          setTimeout(() => setToast(""), 3200);
        } catch {
          setToast("Could not delete entity. It may be in use by a tour.");
          setTimeout(() => setToast(""), 4000);
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

      <div
        className={`entities-studio-layout entities-studio-layout--${activePane}`}
      >
        <section
          className={`entities-list-card entities-pane${activePane === "list" ? " is-active" : " is-collapsed"}`}
          onClick={activePane !== "list" ? () => setActivePane("list") : undefined}
          aria-expanded={activePane === "list"}
        >
          <button
            type="button"
            className="entities-pane-head"
            onClick={() => setActivePane("list")}
            aria-pressed={activePane === "list"}
          >
            <div>
              <h3>Your entities</h3>
              <p className="muted">
                {activePane === "list"
                  ? search.trim()
                    ? `${visibleEntities.length} of ${entities.length} shown`
                    : `${entities.length} shown`
                  : "Click to expand and browse your library"}
              </p>
            </div>
            <span className="entities-pane-badge" aria-hidden="true">
              {activePane === "list" ? "Working" : "Open"}
            </span>
          </button>

          <div className="entities-pane-body">
            {entities.length > 0 && (
              <div className="entities-list-tools" role="search">
                <input
                  type="search"
                  className="groups-search"
                  placeholder="Search name, type, or location…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search entities"
                />
              </div>
            )}

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
                      <th aria-sort={sortKey === "name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                        <button type="button" className="entities-sort-btn" onClick={() => toggleSort("name")}>
                          Name{sortIndicator("name")}
                        </button>
                      </th>
                      <th aria-sort={sortKey === "type" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                        <button type="button" className="entities-sort-btn" onClick={() => toggleSort("type")}>
                          Type{sortIndicator("type")}
                        </button>
                      </th>
                      <th aria-sort={sortKey === "location" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                        <button type="button" className="entities-sort-btn" onClick={() => toggleSort("location")}>
                          Location{sortIndicator("location")}
                        </button>
                      </th>
                      <th>Details</th>
                      <th>Price</th>
                      <th aria-label="Actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEntities.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="muted entities-no-match">
                          No entities match “{search.trim()}”.
                        </td>
                      </tr>
                    ) : (
                      visibleEntities.map((ent) => (
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
                        <td className="entities-row-actions">
                          <button
                            type="button"
                            className="mini-btn"
                            onClick={() => openEdit(ent)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="mini-btn mini-btn--danger"
                            onClick={() => deleteEntity(ent)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <form
          className={`entities-form-card entities-pane${activePane === "add" ? " is-active" : " is-collapsed"}`}
          onSubmit={addEntity}
          onClick={activePane !== "add" ? () => setActivePane("add") : undefined}
          aria-expanded={activePane === "add"}
        >
          <button
            type="button"
            className="entities-pane-head"
            onClick={() => setActivePane("add")}
            aria-pressed={activePane === "add"}
          >
            <div>
              <h3>Add new entity</h3>
              <p className="muted">
                {activePane === "add"
                  ? "Choose a type — the form updates with the right fields."
                  : "Click to expand and add an entity"}
              </p>
            </div>
            <span className="entities-pane-badge" aria-hidden="true">
              {activePane === "add" ? "Working" : "Open"}
            </span>
          </button>

          <div className="entities-pane-body">
            <div className="entities-form-section">
              <h4>Details</h4>
              <div className="entity-form-grid">
                <FormValidationMessages errors={entityFieldErrors} />
                <EntityFormFields
                  form={entityForm}
                  onChange={setEntityForm}
                  typePicker="chips"
                  fieldErrors={entityFieldErrors}
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
                disabled={saving}
              >
                {saving ? "Saving…" : "Save entity"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <EntityFormModal
        open={editEntity !== null}
        title="Edit entity"
        subtitle="Update the details and media for this place, then save your changes."
        form={editForm}
        onChange={setEditForm}
        mainImageUrl={editMainImageUrl}
        onMainImageChange={setEditMainImageUrl}
        gallery={editGallery}
        onGalleryChange={setEditGallery}
        saving={editSaving}
        status={editError}
        fieldErrors={editFieldErrors}
        submitLabel="Save changes"
        onSubmit={saveEdit}
        onClose={closeEdit}
        token={token}
      />
    </div>
  );
}
