import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import type { ManagedOffer } from "../../components/offers/OffersDashboard";
import { TourFormModal } from "../../components/tour/TourFormModal";
import {
  buildTourSavePayload,
  getOfferLinkConfirmSummary,
  emptyTourOfferLink,
  tourOfferLinkFromTour,
  validateTourOfferLink,
  type TourOfferLinkState,
} from "../../lib/tourOfferLink";
import {
  defaultTourForm,
  tourToFormState,
  type EntityOption,
  type GroupOption,
  type TourFormState,
  type TourKind,
} from "../../components/tour/tourFormTypes";
import { displayTourPrice } from "../../lib/tourPricing";
import {
  clearTourBuilderDraft,
  loadTourBuilderDraft,
  saveTourBuilderDraft,
  TOUR_BUILDER_RESUME_PARAM,
  tourBuilderAllPath,
} from "../../lib/tourBuilderDraft";
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
  const { requestConfirm } = useConfirmAction();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const resumedTourDraftRef = useRef(false);
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
  const [influencerCommissionPct, setInfluencerCommissionPct] = useState(0);
  const [offers, setOffers] = useState<ManagedOffer[]>([]);
  const [offerLink, setOfferLink] = useState<TourOfferLinkState>(emptyTourOfferLink);
  const [initialLinkedOfferIds, setInitialLinkedOfferIds] = useState<string[]>([]);

  const agencySlug = user?.agency?.slug;

  const refresh = useCallback(async () => {
    if (!token) return;
    const [tourList, entityList, groupList, display, offerList] = await Promise.all([
      api<AgencyTour[]>("/tours/agency/mine", { token }),
      api<EntityRow[]>("/entities", { token }),
      api<GroupRow[]>("/entities/groups", { token }),
      api<{ influencerCommissionPct: number }>("/agencies/mine/display", { token }),
      api<ManagedOffer[]>("/agencies/mine/offers", { token }),
    ]);
    setTours(tourList);
    setEntities(entityList);
    setGroups(groupList);
    setInfluencerCommissionPct(display.influencerCommissionPct ?? 0);
    setOffers(offerList);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    refresh()
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, refresh]);

  useEffect(() => {
    if (resumedTourDraftRef.current) return;
    if (searchParams.get(TOUR_BUILDER_RESUME_PARAM) !== "1") return;

    const draft = loadTourBuilderDraft();
    resumedTourDraftRef.current = true;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete(TOUR_BUILDER_RESUME_PARAM);
    setSearchParams(nextParams, { replace: true });

    if (!draft) return;

    setModalMode(draft.modalMode);
    setModalKind(draft.modalKind);
    setEditingTourId(draft.editingTourId);
    setTourForm(draft.form);
    setOfferLink(draft.offerLink);
    setInitialLinkedOfferIds(draft.initialLinkedOfferIds);
    setTourStatus("");
    setModalOpen(true);

    if (token) {
      refresh().catch(console.error);
    }
  }, [searchParams, setSearchParams, token, refresh]);

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
      catalogValue: published.reduce((s, t) => s + displayTourPrice(t), 0),
    };
  }, [tours]);

  const expandedTour = expandedId ? tours.find((t) => t.id === expandedId) : null;

  function openCreate(kind: TourKind) {
    clearTourBuilderDraft();
    setModalMode("create");
    setModalKind(kind);
    setEditingTourId(null);
    setTourForm({
      ...defaultTourForm(),
      isPublished: kind === "READY_MADE",
    });
    setTourStatus("");
    setOfferLink(emptyTourOfferLink());
    setInitialLinkedOfferIds([]);
    setModalOpen(true);
  }

  function goAddNewEntity() {
    saveTourBuilderDraft({
      form: tourForm,
      modalMode,
      modalKind,
      editingTourId,
      offerLink,
      initialLinkedOfferIds,
    });
    setModalOpen(false);
    navigate(tourBuilderAllPath());
  }

  function openEdit(tour: AgencyTour) {
    setModalMode("edit");
    setModalKind(tour.tourKind);
    setEditingTourId(tour.id);
    setTourForm(tourToFormState(tour));
    const linked = tour.linkedOffers ?? offers.filter((o) => o.tourIds.includes(tour.id));
    const linkedIds = linked.map((o) => (typeof o === "string" ? o : o.id));
    setInitialLinkedOfferIds(linkedIds);
    setOfferLink(
      tourOfferLinkFromTour(
        {
          title: tour.title,
          summary: tour.summary ?? undefined,
          coverUrl: tour.coverUrl ?? undefined,
          basePriceLkr: tour.basePriceLkr,
        },
        linked
      )
    );
    setTourStatus("");
    setModalOpen(true);
  }

  async function executeSaveTour() {
    if (!token) return;
    setTourSaving(true);
    setTourStatus("");
    try {
      const payload = buildTourSavePayload(tourForm, modalKind, offerLink, initialLinkedOfferIds);
      if (modalMode === "create") {
        await api<AgencyTour>("/tours/with-plan", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        setTourStatus(
          offerLink.enabled ? "Tour created and offer links saved." : "Tour created."
        );
      } else if (editingTourId) {
        await api(`/tours/${editingTourId}/with-plan`, {
          method: "PUT",
          token,
          body: JSON.stringify(payload),
        });
        setTourStatus(
          offerLink.enabled || initialLinkedOfferIds.length > 0
            ? "Tour updated and offer links saved."
            : "Tour updated."
        );
      }

      clearTourBuilderDraft();
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

  function saveTour(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    const invalidDay = tourForm.days.find(
      (d) => !d.entries.some((entry) => entry.time && entry.entityId)
    );
    if (invalidDay) {
      setTourStatus(`Day ${invalidDay.dayNumber} needs at least one timed entity.`);
      return;
    }

    const offerErr = validateTourOfferLink(offerLink, { isPublished: tourForm.isPublished });
    if (offerErr) {
      setTourStatus(offerErr);
      return;
    }

    const itineraryDays = tourForm.days.length;
    const activityCount = tourForm.days.reduce(
      (sum, day) => sum + day.entries.filter((entry) => entry.time && entry.entityId).length,
      0
    );

    requestConfirm({
      title: modalMode === "create" ? "Create tour?" : "Save tour changes?",
      description: "Review the itinerary and offer links before saving.",
      confirmLabel: modalMode === "create" ? "Create tour" : "Save changes",
      summary: [
        { label: "Title", value: tourForm.title.trim() || "(untitled)" },
        { label: "Type", value: modalKind === "READY_MADE" ? "Ready-made" : "Custom" },
        { label: "Days", value: String(itineraryDays) },
        { label: "Activities", value: String(activityCount) },
        {
          label: "Base price",
          value: tourForm.basePriceLkr
            ? `LKR ${Number(tourForm.basePriceLkr).toLocaleString()}`
            : "Not set",
        },
        { label: "Visibility", value: tourForm.isPublished ? "Published" : "Draft" },
        ...getOfferLinkConfirmSummary(offerLink, initialLinkedOfferIds, offers, editingTourId),
      ],
      onConfirm: executeSaveTour,
    });
  }

  function togglePublish(tour: AgencyTour) {
    if (!token) return;
    const nextPublished = !tour.isPublished;
    requestConfirm({
      title: nextPublished ? "Publish tour?" : "Unpublish tour?",
      description: nextPublished
        ? "Travelers will be able to discover and inquire about this tour."
        : "The tour will be hidden from your storefront and search.",
      confirmLabel: nextPublished ? "Publish" : "Unpublish",
      summary: [
        { label: "Tour", value: tour.title },
        { label: "Current status", value: tour.isPublished ? "Published" : "Draft" },
        { label: "New status", value: nextPublished ? "Published" : "Draft" },
      ],
      onConfirm: async () => {
        setActionStatus("");
        try {
          await api(`/tours/${tour.id}`, {
            method: "PATCH",
            token,
            body: JSON.stringify({ isPublished: nextPublished }),
          });
          await refresh();
          setActionStatus(nextPublished ? "Tour published." : "Tour unpublished.");
          setTimeout(() => setActionStatus(""), 2500);
        } catch (err) {
          setActionStatus(err instanceof ApiError ? err.message : "Failed to update status");
        }
      },
    });
  }

  function deleteTour(tour: AgencyTour) {
    if (!token) return;
    requestConfirm({
      title: "Delete tour?",
      description: "This cannot be undone. Linked offers may need another tour.",
      variant: "danger",
      confirmLabel: "Delete tour",
      summary: [
        { label: "Tour", value: tour.title },
        { label: "Days", value: String(tour.days) },
        {
          label: "Linked offers",
          value: tour.linkedOffers?.length
            ? tour.linkedOffers.map((o) => o.title).join(", ")
            : "None",
          tone: tour.linkedOffers?.length ? "warning" : "default",
        },
      ],
      onConfirm: async () => {
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
      },
    });
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
                      {(t.linkedOffers?.length ?? 0) > 0 && (
                        <button
                          type="button"
                          className="cat-offer-badge"
                          onClick={() => navigate("/dashboard/agency/offers")}
                          title={t.linkedOffers!.map((o) => o.title).join(", ")}
                        >
                          {t.linkedOffers!.length} offer{t.linkedOffers!.length === 1 ? "" : "s"}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="muted">
                    {t.days} days · LKR {displayTourPrice(t).toLocaleString()} listed
                    {(t.influencerCommissionLkr ?? 0) > 0
                      ? ` · incl. LKR ${t.influencerCommissionLkr!.toLocaleString()} influencer`
                      : ""}{" "}
                    · /{t.slug}
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
        uploadToken={token}
        agencyInfluencerCommissionPct={influencerCommissionPct}
        offers={offers}
        offerLink={offerLink}
        onOfferLinkChange={setOfferLink}
        onAddNewEntity={goAddNewEntity}
      />
    </div>
  );
}
