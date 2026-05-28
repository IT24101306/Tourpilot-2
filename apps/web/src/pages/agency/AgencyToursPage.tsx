import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { TourFormModal } from "../../components/tour/TourFormModal";
import {
  buildTourPlanPayload,
  defaultTourForm,
  tourToFormState,
  type EntityOption,
  type GroupOption,
  type TourFormState,
  type TourKind,
} from "../../components/tour/tourFormTypes";
import { AgencyTour } from "./types";

type EntityRow = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  priceHint: number | null;
};

type GroupRow = {
  id: string;
  name: string;
  items: Array<{ entity: { id: string } }>;
};

type KindTab = "all" | TourKind;
type StatusFilter = "all" | "published" | "draft";

export function AgencyToursPage() {
  const { token, user } = useAuth();
  const [tours, setTours] = useState<AgencyTour[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindTab, setKindTab] = useState<KindTab>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [modalKind, setModalKind] = useState<TourKind>("READY_MADE");
  const [editingTourId, setEditingTourId] = useState<string | null>(null);
  const [tourForm, setTourForm] = useState<TourFormState>(defaultTourForm());
  const [tourStatus, setTourStatus] = useState("");
  const [tourSaving, setTourSaving] = useState(false);

  const agencySlug = user?.agency?.slug;

  const refresh = useCallback(async () => {
    if (!token) return;
    const [tourList, entityList, groupList] = await Promise.all([
      api<AgencyTour[]>("/tours/agency/mine", { token }),
      api<EntityRow[]>("/entities", { token }),
      api<GroupRow[]>("/entities/groups", { token }),
    ]);
    setTours(tourList);
    setEntities(entityList);
    setGroups(groupList);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    refresh()
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, refresh]);

  const entityOptions: EntityOption[] = useMemo(
    () =>
      entities.map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        city: e.city,
        priceHint: e.priceHint,
      })),
    [entities]
  );

  const groupOptions: GroupOption[] = useMemo(
    () =>
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        entityIds: g.items.map((i) => i.entity.id),
      })),
    [groups]
  );

  const filtered = useMemo(() => {
    return tours.filter((t) => {
      if (kindTab !== "all" && t.tourKind !== kindTab) return false;
      if (statusFilter === "published" && !t.isPublished) return false;
      if (statusFilter === "draft" && t.isPublished) return false;
      return true;
    });
  }, [tours, kindTab, statusFilter]);

  const stats = useMemo(() => {
    const published = tours.filter((t) => t.isPublished);
    const drafts = tours.filter((t) => !t.isPublished);
    return {
      total: tours.length,
      published: published.length,
      drafts: drafts.length,
      readyMade: tours.filter((t) => t.tourKind === "READY_MADE").length,
      custom: tours.filter((t) => t.tourKind === "CUSTOM").length,
      catalogValue: published.reduce((s, t) => s + t.basePriceLkr, 0),
    };
  }, [tours]);

  const expandedTour = expandedId ? tours.find((t) => t.id === expandedId) : null;

  function openCreate(kind: TourKind) {
    setModalMode("create");
    setModalKind(kind);
    setEditingTourId(null);
    setTourForm({
      ...defaultTourForm(),
      isPublished: kind === "READY_MADE",
    });
    setTourStatus("");
    setModalOpen(true);
  }

  function openEdit(tour: AgencyTour) {
    setModalMode("edit");
    setModalKind(tour.tourKind);
    setEditingTourId(tour.id);
    setTourForm(tourToFormState(tour));
    setTourStatus("");
    setModalOpen(true);
  }

  async function saveTour(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    const invalidDay = tourForm.days.find(
      (d) => !d.entries.some((entry) => entry.time && entry.entityId)
    );
    if (invalidDay) {
      setTourStatus(`Day ${invalidDay.dayNumber} needs at least one timed entity.`);
      return;
    }

    setTourSaving(true);
    setTourStatus("");
    try {
      const payload = buildTourPlanPayload(tourForm, modalKind);
      if (modalMode === "create") {
        await api("/tours/with-plan", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        setTourStatus("Tour created.");
      } else if (editingTourId) {
        await api(`/tours/${editingTourId}/with-plan`, {
          method: "PUT",
          token,
          body: JSON.stringify(payload),
        });
        setTourStatus("Tour updated.");
      }
      await refresh();
      setTimeout(() => {
        setModalOpen(false);
        setTourStatus("");
      }, 500);
    } catch (err) {
      setTourStatus(err instanceof ApiError ? err.message : "Failed to save tour");
    } finally {
      setTourSaving(false);
    }
  }

  async function togglePublish(tour: AgencyTour) {
    if (!token) return;
    setActionStatus("");
    try {
      await api(`/tours/${tour.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ isPublished: !tour.isPublished }),
      });
      await refresh();
      setActionStatus(tour.isPublished ? "Tour unpublished." : "Tour published.");
      setTimeout(() => setActionStatus(""), 2500);
    } catch (err) {
      setActionStatus(err instanceof ApiError ? err.message : "Failed to update status");
    }
  }

  async function deleteTour(tour: AgencyTour) {
    if (!token) return;
    if (!window.confirm(`Delete "${tour.title}"? This cannot be undone.`)) return;
    setActionStatus("");
    try {
      await api(`/tours/${tour.id}`, { method: "DELETE", token });
      if (expandedId === tour.id) setExpandedId(null);
      await refresh();
      setActionStatus("Tour deleted.");
      setTimeout(() => setActionStatus(""), 2500);
    } catch (err) {
      setActionStatus(err instanceof ApiError ? err.message : "Failed to delete tour");
    }
  }

  return (
    <div className="module-shell module-catalog">
      <ModuleHeader
        module="catalog"
        title="Tour catalog"
        subtitle="Create ready-made packages, build day-by-day itineraries from your entities, and publish to your storefront."
      >
        <div className="cat-toolbar-actions">
            <button type="button" className="btn btn-primary" onClick={() => openCreate("READY_MADE")}>
              + Ready-made tour
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => openCreate("CUSTOM")}>
              + Custom tour
            </button>
          </div>
      </ModuleHeader>

      {actionStatus && <p className="cat-action-toast">{actionStatus}</p>}

      <div className="cat-stat-row">
        <div className="cat-stat">
          <span className="cat-stat-value">{stats.total}</span>
          <span className="cat-stat-label">Total tours</span>
        </div>
        <div className="cat-stat">
          <span className="cat-stat-value">{stats.published}</span>
          <span className="cat-stat-label">Published</span>
        </div>
        <div className="cat-stat">
          <span className="cat-stat-value">{stats.drafts}</span>
          <span className="cat-stat-label">Drafts</span>
        </div>
        <div className="cat-stat">
          <span className="cat-stat-value">LKR {stats.catalogValue.toLocaleString()}</span>
          <span className="cat-stat-label">Published value</span>
        </div>
      </div>

      <div className="cat-filters">
        <div className="agency-sub-tabs cat-tabs">
          <button
            type="button"
            className={`agency-sub-tab${kindTab === "all" ? " active" : ""}`}
            onClick={() => setKindTab("all")}
          >
            All ({stats.total})
          </button>
          <button
            type="button"
            className={`agency-sub-tab${kindTab === "READY_MADE" ? " active" : ""}`}
            onClick={() => setKindTab("READY_MADE")}
          >
            Ready-made ({stats.readyMade})
          </button>
          <button
            type="button"
            className={`agency-sub-tab${kindTab === "CUSTOM" ? " active" : ""}`}
            onClick={() => setKindTab("CUSTOM")}
          >
            Custom ({stats.custom})
          </button>
        </div>
        <select
          className="table-filter cat-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by publish status"
        >
          <option value="all">All statuses</option>
          <option value="published">Published only</option>
          <option value="draft">Drafts only</option>
        </select>
      </div>

      {entities.length === 0 && (
        <p className="cat-hint muted">
          Add entities in the{" "}
          <Link to="/dashboard/agency/all">ALL</Link> tab before building tour itineraries.
        </p>
      )}

      {loading ? (
        <p className="muted">Loading tours…</p>
      ) : filtered.length === 0 ? (
        <div className="cat-empty">
          <p>No tours match these filters.</p>
          <button type="button" className="btn btn-primary" onClick={() => openCreate("READY_MADE")}>
            Create your first tour
          </button>
        </div>
      ) : (
        <ul className="cat-tour-list">
          {filtered.map((t) => (
            <li key={t.id}>
              <article
                className={`cat-tour-card${expandedId === t.id ? " cat-tour-card--expanded" : ""}`}
              >
                <div className="cat-tour-main">
                  <div className="cat-tour-head">
                    <h3>{t.title}</h3>
                    <div className="cat-tour-badges">
                      <span className={`cat-kind-badge cat-kind-badge--${t.tourKind.toLowerCase()}`}>
                        {t.tourKind === "READY_MADE" ? "Ready-made" : "Custom"}
                      </span>
                      <span className={`agency-status ${t.isPublished ? "ok" : "warn"}`}>
                        {t.isPublished ? "Published" : "Draft"}
                      </span>
                    </div>
                  </div>
                  <p className="muted">
                    {t.days} days · LKR {t.basePriceLkr.toLocaleString()} · /{t.slug}
                  </p>
                  {t.summary && <p className="cat-tour-summary">{t.summary}</p>}
                </div>

                <div className="cat-tour-actions">
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                  >
                    {expandedId === t.id ? "Hide plan" : "View plan"}
                  </button>
                  <button type="button" className="mini-btn" onClick={() => openEdit(t)}>
                    Edit
                  </button>
                  <button type="button" className="mini-btn" onClick={() => togglePublish(t)}>
                    {t.isPublished ? "Unpublish" : "Publish"}
                  </button>
                  {t.isPublished && agencySlug && (
                    <Link
                      to={`/tours/${agencySlug}/${t.slug}`}
                      className="mini-btn"
                      target="_blank"
                      rel="noreferrer"
                    >
                      View live
                    </Link>
                  )}
                  <button
                    type="button"
                    className="mini-btn mini-btn--danger"
                    onClick={() => deleteTour(t)}
                  >
                    Delete
                  </button>
                </div>
              </article>

              {expandedId === t.id && expandedTour?.id === t.id && (
                <div className="cat-tour-detail">
                  {expandedTour.tourDays?.length ? (
                    expandedTour.tourDays.map((day) => (
                      <div key={day.dayNumber} className="cat-tour-day">
                        <h4>Day {day.dayNumber}</h4>
                        <ul>
                          {day.items.map((item, idx) => (
                            <li key={idx}>
                              <span className="cat-tour-time">{item.scheduledTime || "—"}</span>
                              {item.entityName}
                              {item.entityType && (
                                <span className="muted"> · {item.entityType}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No day plan saved. Edit this tour to add entities.</p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <TourFormModal
        open={modalOpen}
        mode={modalMode}
        tourKind={modalKind}
        form={tourForm}
        entities={entityOptions}
        groups={groupOptions}
        status={tourStatus}
        saving={tourSaving}
        onClose={() => setModalOpen(false)}
        onChange={setTourForm}
        onSubmit={saveTour}
      />
    </div>
  );
}
