import { FormEvent, Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import type { ManagedOffer } from "../../components/offers/OffersDashboard";
import { TourFormModal } from "../../components/tour/TourFormModal";
import { TourPackagePricingNotice } from "../../components/itinerary/TourPackagePricingNotice";
import {
  buildTourSavePayload,
  getOfferLinkConfirmSummary,
  emptyTourOfferLink,
  tourOfferLinkFromTour,
  validateTourOfferLink,
  type TourOfferLinkState,
} from "../../lib/tourOfferLink";
import {
  computeMissingRequirements,
  defaultTourForm,
  normalizeTourForm,
  tourToFormState,
  tourToDuplicateFormState,
  type EntityOption,
  type GroupOption,
  type TourFormState,
  type TourKind,
} from "../../components/tour/tourFormTypes";
import { displayTourPrice } from "../../lib/tourPricing";
import { computeTourFormPricing } from "../../lib/tourFormPricing";
import {
  clearTourBuilderDraft,
  loadTourBuilderDraft,
  saveTourBuilderDraft,
  TOUR_BUILDER_RESUME_PARAM,
  tourBuilderAllPath,
} from "../../lib/tourBuilderDraft";
import { entityAutoGuide } from "../../components/entity/entityTypes";
import { AgencyTour } from "./types";

type EntityRow = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  priceHint: number | null;
  metadata?: Record<string, unknown> | null;
};

type GroupRow = {
  id: string;
  name: string;
  items: Array<{ entity: { id: string } }>;
};

type StatusFilter = "all" | "published" | "draft" | "offers";

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "duplicate">("create");
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
    setModalKind("READY_MADE");
    setEditingTourId(draft.editingTourId);
    setTourForm(normalizeTourForm(draft.form));
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
      entities.map((e) => {
        const g = entityAutoGuide(e.metadata);
        return {
          id: e.id,
          name: e.name,
          type: e.type,
          city: e.city,
          priceHint: e.priceHint,
          guide: g ? { name: g.name, cost: g.cost ?? 0 } : null,
        };
      }),
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
      if (statusFilter === "published" && !t.isPublished) return false;
      if (statusFilter === "draft" && t.isPublished) return false;
      if (statusFilter === "offers" && !(t.linkedOffers?.length)) return false;
      return true;
    });
  }, [tours, statusFilter]);

  const stats = useMemo(() => {
    const published = tours.filter((t) => t.isPublished);
    const drafts = tours.filter((t) => !t.isPublished);
    const withOffers = tours.filter((t) => (t.linkedOffers?.length ?? 0) > 0);
    return {
      total: tours.length,
      published: published.length,
      drafts: drafts.length,
      withOffers: withOffers.length,
    };
  }, [tours]);

  const expandedTour = expandedId ? tours.find((t) => t.id === expandedId) : null;

  function openCreate() {
    clearTourBuilderDraft();
    setModalMode("create");
    setModalKind("READY_MADE");
    setEditingTourId(null);
    setTourForm({
      ...defaultTourForm(),
      isPublished: true,
      priceFromCatalog: true,
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

  function openDuplicate(tour: AgencyTour) {
    clearTourBuilderDraft();
    setModalMode("duplicate");
    setModalKind("READY_MADE");
    setEditingTourId(null);
    setTourForm(tourToDuplicateFormState(tour));
    setTourStatus("");
    setOfferLink(emptyTourOfferLink());
    setInitialLinkedOfferIds([]);
    setModalOpen(true);
  }

  function openEdit(tour: AgencyTour) {
    setModalMode("edit");
    setModalKind("READY_MADE");
    setEditingTourId(tour.id);
    const formState = normalizeTourForm(tourToFormState(tour));
    const catalogPricing = computeTourFormPricing(formState, entityOptions, influencerCommissionPct);
    const priceFromCatalog =
      Math.abs(formState.basePriceLkr - catalogPricing.catalogSubtotal) < 1;
    setTourForm({ ...formState, priceFromCatalog });
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
      const payload = buildTourSavePayload(
        tourForm,
        modalKind,
        offerLink,
        initialLinkedOfferIds,
        entityOptions
      );
      if (modalMode === "create" || modalMode === "duplicate") {
        await api<AgencyTour>("/tours/with-plan", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        setTourStatus(
          modalMode === "duplicate"
            ? "New tour saved from duplicate."
            : offerLink.enabled
              ? "Tour created and offer links saved."
              : "Tour created."
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

    const missing = computeMissingRequirements(tourForm);
    if (missing.length) {
      setTourStatus(missing[0]!);
      return;
    }

    const offerErr = validateTourOfferLink(offerLink, { isPublished: tourForm.isPublished });
    if (offerErr) {
      setTourStatus(offerErr);
      document.getElementById("tour-offer-link-section")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    const itineraryDays = tourForm.days.length;
    const activityCount = tourForm.days.reduce(
      (sum, day) => sum + day.entries.filter((entry) => entry.time && entry.entityId).length,
      0
    );
    const pricing = computeTourFormPricing(tourForm, entityOptions, influencerCommissionPct);

    requestConfirm({
      title:
        modalMode === "create"
          ? "Create tour?"
          : modalMode === "duplicate"
            ? "Save as new tour?"
            : "Save tour changes?",
      description:
        modalMode === "duplicate"
          ? "A new tour will be created from this copy. The original tour is unchanged."
          : "Review the itinerary and offer links before saving.",
      confirmLabel:
        modalMode === "create"
          ? "Create tour"
          : modalMode === "duplicate"
            ? "Save new tour"
            : "Save changes",
      summary: [
        { label: "Title", value: tourForm.title.trim() || "(untitled)" },
        { label: "Type", value: "Tour package" },
        { label: "Days", value: String(itineraryDays) },
        { label: "Activities", value: String(activityCount) },
        {
          label: "Tour price",
          value: `LKR ${pricing.basePriceLkr.toLocaleString()}`,
        },
        {
          label: "Catalog breakdown",
          value: `Entities LKR ${pricing.entitiesSubtotal.toLocaleString()} + vehicles LKR ${pricing.transportSubtotal.toLocaleString()}`,
        },
        {
          label: "Final listed price",
          value: `LKR ${pricing.listedPriceLkr.toLocaleString()}`,
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
        subtitle="Create packages, build day-by-day itineraries from your entities, and publish to your storefront."
      >
        <div className="cat-toolbar-actions">
            <button type="button" className="btn btn-primary" onClick={() => openCreate()}>
              + New tour
            </button>
          </div>
      </ModuleHeader>

      {actionStatus && <p className="cat-action-toast">{actionStatus}</p>}

      <div className="agency-sub-tabs cat-tabs" role="tablist" aria-label="Filter tours">
        <button
          type="button"
          role="tab"
          aria-selected={statusFilter === "all"}
          className={`agency-sub-tab${statusFilter === "all" ? " active" : ""}`}
          onClick={() => setStatusFilter("all")}
        >
          All ({stats.total})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={statusFilter === "published"}
          className={`agency-sub-tab${statusFilter === "published" ? " active" : ""}`}
          onClick={() => setStatusFilter("published")}
        >
          Published ({stats.published})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={statusFilter === "draft"}
          className={`agency-sub-tab${statusFilter === "draft" ? " active" : ""}`}
          onClick={() => setStatusFilter("draft")}
        >
          Drafts ({stats.drafts})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={statusFilter === "offers"}
          className={`agency-sub-tab${statusFilter === "offers" ? " active" : ""}`}
          onClick={() => setStatusFilter("offers")}
        >
          With offers ({stats.withOffers})
        </button>
      </div>

      {entities.length === 0 && (
        <p className="cat-hint muted">
          Add entities in the{" "}
          <Link to="/dashboard/agency/all">Entities</Link> tab before building tour itineraries.
        </p>
      )}

      {loading ? (
        <p className="muted">Loading tours…</p>
      ) : filtered.length === 0 ? (
        <div className="cat-empty">
          <p>No tours match these filters.</p>
          <button type="button" className="btn btn-primary" onClick={() => openCreate()}>
            Create your first tour
          </button>
        </div>
      ) : (
        <div className="table-wrap cat-tour-table-wrap">
          <table className="hotel-table cat-tour-table">
            <thead>
              <tr>
                <th>Tour</th>
                <th>Days</th>
                <th>Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <Fragment key={t.id}>
                  <tr className={expandedId === t.id ? "is-expanded" : undefined}>
                    <td>
                      <strong>{t.title}</strong>
                      <div className="muted cat-tour-table__meta">
                        /{t.slug}
                        {(t.linkedOffers?.length ?? 0) > 0
                          ? ` · ${t.linkedOffers!.length} offer${
                              t.linkedOffers!.length === 1 ? "" : "s"
                            }`
                          : ""}
                      </div>
                    </td>
                    <td>{t.days}</td>
                    <td>LKR {displayTourPrice(t).toLocaleString()}</td>
                    <td>
                      <span className={`agency-status ${t.isPublished ? "ok" : "warn"}`}>
                        {t.isPublished ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td>
                      <div className="cat-tour-table__actions">
                        <button
                          type="button"
                          className="mini-btn"
                          onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                        >
                          {expandedId === t.id ? "Hide" : "Plan"}
                        </button>
                        <button type="button" className="mini-btn" onClick={() => openEdit(t)}>
                          Edit
                        </button>
                        <button type="button" className="mini-btn" onClick={() => openDuplicate(t)}>
                          Duplicate
                        </button>
                        <button type="button" className="mini-btn" onClick={() => togglePublish(t)}>
                          {t.isPublished ? "Unpublish" : "Publish"}
                        </button>
                        {t.isPublished && agencySlug && (
                          <Link
                            to={`/tours/${agencySlug}/${t.slug}`}
                            className="mini-btn mini-btn--icon"
                            target="_blank"
                            rel="noreferrer"
                            aria-label="View live tour"
                            title="View live tour"
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
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
                    </td>
                  </tr>
                  {expandedId === t.id && expandedTour?.id === t.id && (
                    <tr className="cat-tour-table__detail-row">
                      <td colSpan={5}>
                        <div className="cat-tour-detail">
                          {expandedTour.tourDays?.length ? (
                            <>
                              <TourPackagePricingNotice />
                              {expandedTour.tourDays.map((day) => (
                                <div key={day.dayNumber} className="cat-tour-day">
                                  <h4>Day {day.dayNumber}</h4>
                                  {day.transportLabel && day.transportRateLkr != null && (
                                    <p className="muted cat-tour-transport">
                                      Vehicle: {day.transportLabel} · LKR{" "}
                                      {Number(day.transportRateLkr).toLocaleString()}
                                    </p>
                                  )}
                                  <ul>
                                    {day.items.map((item, idx) => (
                                      <li key={idx}>
                                        <span className="cat-tour-time">
                                          {item.scheduledTime || "—"}
                                        </span>
                                        {item.entityName}
                                        {item.entityType && (
                                          <span className="muted"> · {item.entityType}</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </>
                          ) : (
                            <p className="muted">
                              No day plan saved. Edit this tour to add entities.
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
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
