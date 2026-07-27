import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { EntityFormModal } from "../components/entity/EntityFormModal";
import {
  buildEntityPayload,
  defaultEntityForm,
  entityDetailsSummary,
  entityLocationLabel,
  type EntityFormState,
  type EntityTypeKey,
} from "../components/entity/entityTypes";
import { buildEntityMediaStore, type EntityMediaItem } from "@tourpilot/shared";
import type { ManagedOffer } from "../components/offers/OffersDashboard";
import { TourFormModal } from "../components/tour/TourFormModal";
import { TourPackagePricingNotice } from "../components/itinerary/TourPackagePricingNotice";
import {
  buildTourSavePayload,
  emptyTourOfferLink,
  validateTourOfferLink,
  type TourOfferLinkState,
} from "../lib/tourOfferLink";
import { DriverFormModal, defaultDriverForm, type DriverFormState } from "../components/driver/DriverFormModal";
import { DriverCalendarModal } from "../components/driver/DriverCalendarModal";
import { GroupFormModal } from "../components/group/GroupFormModal";
import { DisplayTabPanel } from "../components/display/DisplayTabPanel";
import { InquiryReplyModal } from "../components/inquiry/InquiryReplyModal";
import { ChatRoomPopup } from "../components/inquiry/ChatRoomPopup";
import { InquiryThread, type ThreadMessage } from "../components/inquiry/InquiryThread";
import {
  computeMissingRequirements,
  defaultTourForm,
  type EntityOption,
  type GroupOption,
  type TourFormState,
  type TourKind,
} from "../components/tour/tourFormTypes";
import "../styles/dashboard.css";

type TabId =
  | "overview"
  | "inquiries"
  | "bookings"
  | "tours"
  | "drivers"
  | "travelers"
  | "all"
  | "groups"
  | "display";

const DASHBOARD_TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "inquiries", label: "Inquiries" },
  { id: "bookings", label: "Bookings" },
  { id: "tours", label: "Tours" },
  { id: "drivers", label: "Drivers" },
  { id: "travelers", label: "Travelers" },
  { id: "all", label: "Entities" },
  { id: "groups", label: "Groups" },
  { id: "display", label: "Display" },
];

export function AgencyDashboard() {
  const { token, user } = useAuth();
  const [tab, setTab] = useState<TabId>("overview");
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [tours, setTours] = useState<TourRow[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [entityModalOpen, setEntityModalOpen] = useState(false);
  const [entityForm, setEntityForm] = useState<EntityFormState>(defaultEntityForm());
  const [entityMainImageUrl, setEntityMainImageUrl] = useState("");
  const [entityGallery, setEntityGallery] = useState<EntityMediaItem[]>([]);
  const [entityStatus, setEntityStatus] = useState("");
  const [entitySaving, setEntitySaving] = useState(false);
  const [replyInquiryId, setReplyInquiryId] = useState<string | null>(null);
  const [chatInquiry, setChatInquiry] = useState<{ id: string; name: string } | null>(null);
  const [expandedInquiryId, setExpandedInquiryId] = useState<string | null>(null);
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState("all");
  const [tourModalOpen, setTourModalOpen] = useState(false);
  const [tourStatusFilter, setTourStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [tourForm, setTourForm] = useState<TourFormState>(defaultTourForm());
  const [tourStatus, setTourStatus] = useState("");
  const [tourSaving, setTourSaving] = useState(false);
  const [offers, setOffers] = useState<ManagedOffer[]>([]);
  const [offerLink, setOfferLink] = useState<TourOfferLinkState>(emptyTourOfferLink);
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [driverStatusFilter, setDriverStatusFilter] = useState<string>("all");
  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [driverForm, setDriverForm] = useState<DriverFormState>(defaultDriverForm());
  const [driverStatus, setDriverStatus] = useState("");
  const [driverSaving, setDriverSaving] = useState(false);
  const [calendarDriver, setCalendarDriver] = useState<{ id: string; name: string } | null>(null);
  const [groups, setGroups] = useState<EntityGroupRow[]>([]);
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupStatus, setGroupStatus] = useState("");
  const [groupSaving, setGroupSaving] = useState(false);
  const [makeGroupStatus, setMakeGroupStatus] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    refresh(token);
  }, [token]);

  const filteredEntities = useMemo(() => {
    if (typeFilter === "all") return entities;
    return entities.filter((e) => e.type === typeFilter);
  }, [entities, typeFilter]);

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
        entityIds: g.items.map((item) => item.entity.id),
      })),
    [groups]
  );

  const filteredTours = useMemo(() => {
    return tours.filter((t) => {
      if (tourStatusFilter === "published") return t.isPublished;
      if (tourStatusFilter === "draft") return !t.isPublished;
      return true;
    });
  }, [tours, tourStatusFilter]);

  const selectedTour = useMemo(
    () => tours.find((t) => t.id === selectedTourId) ?? null,
    [tours, selectedTourId]
  );

  const filteredDrivers = useMemo(() => {
    if (driverStatusFilter === "all") return drivers;
    return drivers.filter((d) => d.status === driverStatusFilter);
  }, [drivers, driverStatusFilter]);

  const filteredInquiries = useMemo(() => {
    if (inquiryStatusFilter === "all") return inquiries;
    return inquiries.filter((i) => i.status === inquiryStatusFilter);
  }, [inquiries, inquiryStatusFilter]);

  const travelers = useMemo(() => {
    const seen = new Set<string>();
    return inquiries.flatMap((inq) => {
      const name = inq.tourist?.name;
      if (!name || seen.has(name)) return [];
      seen.add(name);
      return [{ name, status: inq.status, message: inq.message }];
    });
  }, [inquiries]);

  const publishedTours = useMemo(() => tours.filter((t) => t.isPublished).length, [tours]);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );

  const allVisibleSelected =
    filteredEntities.length > 0 &&
    filteredEntities.every((ent) => selectedEntityIds.includes(ent.id));

  const selectedCount = selectedEntityIds.length;

  async function refresh(authToken: string) {
    const [inq, ent, tr, dr, gr, offerList] = await Promise.all([
      api<InquiryRow[]>("/inquiries/mine", { token: authToken }),
      api<EntityRow[]>("/entities", { token: authToken }),
      api<TourRow[]>("/tours/agency/mine", { token: authToken }),
      api<DriverRow[]>("/drivers/agency/mine", { token: authToken }),
      api<EntityGroupRow[]>("/entities/groups", { token: authToken }),
      api<ManagedOffer[]>("/agencies/mine/offers", { token: authToken }),
    ]);
    setInquiries(inq);
    setEntities(ent);
    setTours(tr);
    setDrivers(dr);
    setGroups(gr);
    setOffers(offerList);
  }

  function toggleEntitySelection(entityId: string, checked: boolean) {
    setSelectedEntityIds((prev) => {
      if (checked) return prev.includes(entityId) ? prev : [...prev, entityId];
      return prev.filter((id) => id !== entityId);
    });
  }

  function toggleSelectAllVisible(checked: boolean) {
    const visibleIds = filteredEntities.map((ent) => ent.id);
    setSelectedEntityIds((prev) => {
      if (checked) {
        const merged = new Set([...prev, ...visibleIds]);
        return [...merged];
      }
      return prev.filter((id) => !visibleIds.includes(id));
    });
  }

  function openGroupModal() {
    if (selectedEntityIds.length === 0) return;
    setGroupName("");
    setGroupStatus("");
    setGroupModalOpen(true);
  }

  async function createGroup(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const name = groupName.trim();
    const entityIds = [...new Set(selectedEntityIds.filter(Boolean))];
    if (!name) {
      setGroupStatus("Enter a group name.");
      return;
    }
    if (entityIds.length === 0) {
      setGroupStatus("Select at least one entity.");
      return;
    }

    setGroupSaving(true);
    setGroupStatus("");
    try {
      const group = await api<EntityGroupRow>("/entities/groups", {
        method: "POST",
        token,
        body: JSON.stringify({
          name,
          entityIds,
        }),
      });
      await refresh(token);
      setSelectedEntityIds([]);
      setMakeGroupStatus(`${group.name} created with ${group.items.length} entries.`);
      setGroupModalOpen(false);
      setGroupName("");
      setSelectedGroupId(group.id);
      setTab("groups");
    } catch (err) {
      setGroupStatus(err instanceof ApiError ? err.message : "Failed to create group");
    } finally {
      setGroupSaving(false);
    }
  }

  function openAddDriver() {
    setDriverForm(defaultDriverForm());
    setDriverStatus("");
    setDriverModalOpen(true);
  }

  async function saveDriver(e: FormEvent) {
    e.preventDefault();
    if (!token || !driverForm.phone.trim()) return;
    if (!driverForm.profileLocked && !driverForm.name.trim()) return;
    if (driverForm.lookupError) return;

    setDriverSaving(true);
    setDriverStatus("");
    try {
      await api("/drivers", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: driverForm.name.trim(),
          licenseNo: driverForm.licenseNo.trim() || undefined,
          phone: driverForm.phone.trim() || undefined,
          vehicle: driverForm.vehicle.trim() || undefined,
          status: driverForm.status,
        }),
      });
      setDriverStatus("Driver added successfully.");
      await refresh(token);
      setTab("drivers");
      setTimeout(() => {
        setDriverModalOpen(false);
        setDriverForm(defaultDriverForm());
        setDriverStatus("");
      }, 600);
    } catch (err) {
      setDriverStatus(err instanceof ApiError ? err.message : "Failed to save driver");
    } finally {
      setDriverSaving(false);
    }
  }

  async function updateDriverStatus(driverId: string, status: DriverFormState["status"]) {
    if (!token) return;
    try {
      await api(`/drivers/${driverId}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      setDrivers((prev) => prev.map((d) => (d.id === driverId ? { ...d, status } : d)));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to update status");
    }
  }

  function openAddEntity() {
    setEntityForm(defaultEntityForm());
    setEntityStatus("");
    setEntityModalOpen(true);
  }

  function openTourModal() {
    setTourForm({
      ...defaultTourForm(),
      isPublished: true,
    });
    setOfferLink(emptyTourOfferLink());
    setTourStatus("");
    setTourModalOpen(true);
  }

  async function saveTour(e: FormEvent) {
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

    setTourSaving(true);
    setTourStatus("");
    try {
      await api("/tours/with-plan", {
        method: "POST",
        token,
        body: JSON.stringify(
          buildTourSavePayload(tourForm, "READY_MADE", offerLink, [], entityOptions)
        ),
      });
      setTourStatus(
        offerLink.enabled ? "Tour saved with offer links." : "Tour saved successfully."
      );
      await refresh(token);
      setTab("tours");
      setTimeout(() => {
        setTourModalOpen(false);
        setTourStatus("");
      }, 600);
    } catch (err) {
      setTourStatus(err instanceof ApiError ? err.message : "Failed to save tour");
    } finally {
      setTourSaving(false);
    }
  }

  async function addEntity(e: FormEvent) {
    e.preventDefault();
    if (!token || !entityForm.name.trim()) return;
    setEntitySaving(true);
    setEntityStatus("");
    try {
      await api("/entities", {
        method: "POST",
        token,
        body: JSON.stringify({
          ...buildEntityPayload(entityForm),
          media: buildEntityMediaStore(entityMainImageUrl, entityGallery),
        }),
      });
      setEntityStatus("Saved successfully.");
      await refresh(token);
      setTimeout(() => {
        setEntityModalOpen(false);
        setEntityForm(defaultEntityForm());
        setEntityMainImageUrl("");
        setEntityGallery([]);
        setEntityStatus("");
      }, 500);
    } catch (err) {
      setEntityStatus(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setEntitySaving(false);
    }
  }

  return (
    <>
      <nav className="agent-tabs" aria-label="Dashboard tabs">
        {DASHBOARD_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`agent-tab-btn ${tab === item.id ? "active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <section className="agent-content">
        {tab === "overview" && (
          <article className="agent-tab-panel">
            <div className="panel-head">
              <h2>Dashboard Overview</h2>
              <p>Track today&apos;s performance and active operations in one place.</p>
            </div>
            <div className="agent-overview-grid">
              <div className="agent-stat-card">
                <h3>Active Tours</h3>
                <p className="agent-stat-value">{publishedTours}</p>
                <p className="agent-stat-sub">{tours.length} total tours in workspace</p>
              </div>
              <div className="agent-stat-card">
                <h3>Today Bookings</h3>
                <p className="agent-stat-value">{inquiries.length}</p>
                <p className="agent-stat-sub">
                  {inquiries.filter((i) => i.status === "NEW").length} new inquiries
                </p>
              </div>
              <div className="agent-stat-card">
                <h3>Drivers</h3>
                <p className="agent-stat-value">{drivers.length}</p>
                <p className="agent-stat-sub">
                  {drivers.filter((d) => d.status === "Available").length} available now
                </p>
              </div>
            </div>
          </article>
        )}

        {tab === "inquiries" && (
          <article className="agent-tab-panel">
            <div className="panel-head">
              <h2>Inquiries</h2>
              <p>Tour requests from tourists. Open an inquiry to send a reply.</p>
            </div>
            <div className="table-tools">
              <select
                className="table-filter"
                value={inquiryStatusFilter}
                onChange={(e) => setInquiryStatusFilter(e.target.value)}
                aria-label="Filter inquiries"
              >
                <option value="all">All status</option>
                <option value="NEW">New</option>
                <option value="SENT_TO_TOURIST">Sent</option>
                <option value="REVISION_REQUESTED">Revision requested</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="DECLINED">Declined</option>
              </select>
            </div>
            <div className="table-wrap">
              <table className="hotel-table">
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Received</th>
                    <th>Travelers</th>
                    <th>Request</th>
                    <th>Status</th>
                    <th>Replies</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredInquiries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-text">
                        No inquiries yet. They appear when tourists submit the form on your display
                        page.
                      </td>
                    </tr>
                  ) : (
                    filteredInquiries.map((inq) => {
                      const expanded = expandedInquiryId === inq.id;
                      const threadCount = inq.thread?.length ?? 0;
                      const hasRevision = inq.status === "REVISION_REQUESTED";

                      return (
                        <Fragment key={inq.id}>
                          <tr className={hasRevision ? "inquiry-row-revision" : undefined}>
                            <td>
                              <button
                                type="button"
                                className="inquiry-expand-btn"
                                aria-expanded={expanded}
                                aria-label={expanded ? "Hide thread" : "Show thread"}
                                onClick={() =>
                                  setExpandedInquiryId(expanded ? null : inq.id)
                                }
                              >
                                {expanded ? "▼" : "▶"}
                              </button>{" "}
                              <strong>{inq.tourist?.name || "Guest"}</strong>
                              <br />
                              <span className="muted">{inq.tourist?.phone}</span>
                            </td>
                            <td>{formatInquiryDate(inq.createdAt)}</td>
                            <td>{inq.pax}</td>
                            <td className="inquiry-message-cell">
                              {inq.message?.slice(0, 80) || "—"}
                              {inq.message && inq.message.length > 80 ? "…" : ""}
                            </td>
                            <td>
                              <span
                                className={`agent-status-pill ${bookingStatusClass(inq.status)}`}
                              >
                                {formatBookingStatus(inq.status)}
                              </span>
                            </td>
                            <td>
                              {threadCount > 0 ? (
                                <span>
                                  {threadCount} message{threadCount === 1 ? "" : "s"}
                                </span>
                              ) : inq.proposal ? (
                                `${inq.proposal.items.length} option(s)`
                              ) : (
                                (inq.responses?.length ?? 0)
                              )}
                            </td>
                            <td>
                              <div className="inquiry-row-actions">
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  onClick={() =>
                                    setChatInquiry({
                                      id: inq.id,
                                      name: inq.tourist?.name || "Traveler",
                                    })
                                  }
                                >
                                  Chat
                                </button>
                                <button
                                  type="button"
                                  className={`btn ${hasRevision ? "btn-primary" : "btn-primary"}`}
                                  onClick={() => setReplyInquiryId(inq.id)}
                                >
                                  {hasRevision
                                    ? "Edit & resend"
                                    : inq.proposal
                                      ? "Edit proposal"
                                      : "Reply"}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expanded && (
                            <tr className="inquiry-thread-row">
                              <td colSpan={7}>
                                {inq.thread && inq.thread.length > 0 ? (
                                  <InquiryThread messages={inq.thread} compact />
                                ) : (
                                  <p className="muted" style={{ margin: 0 }}>
                                    No messages yet. Use Chat to message the traveler, or Reply to send a proposal.
                                  </p>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </article>
        )}

        {tab === "bookings" && (
          <article className="agent-tab-panel">
            <div className="panel-head">
              <h2>Bookings</h2>
              <p>Confirmed and in-progress reservations.</p>
            </div>
            <p className="muted">
              New tour requests are listed under the <strong>Inquiries</strong> tab.
            </p>
          </article>
        )}

        {tab === "tours" && (
          <article className="agent-tab-panel">
            <div className="panel-head">
              <h2>Tours</h2>
              <p>Manage schedule, guides, and route readiness.</p>
            </div>

            <div className="table-tools">
              <div className="tools-left">
                <div className="sub-tabs" role="tablist" aria-label="Filter tours">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tourStatusFilter === "all"}
                    className={`sub-tab-btn ${tourStatusFilter === "all" ? "active" : ""}`}
                    onClick={() => {
                      setTourStatusFilter("all");
                      setSelectedTourId(null);
                    }}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tourStatusFilter === "published"}
                    className={`sub-tab-btn ${tourStatusFilter === "published" ? "active" : ""}`}
                    onClick={() => {
                      setTourStatusFilter("published");
                      setSelectedTourId(null);
                    }}
                  >
                    Published
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tourStatusFilter === "draft"}
                    className={`sub-tab-btn ${tourStatusFilter === "draft" ? "active" : ""}`}
                    onClick={() => {
                      setTourStatusFilter("draft");
                      setSelectedTourId(null);
                    }}
                  >
                    Drafts
                  </button>
                </div>
              </div>
              <div className="tools-right">
                <button type="button" className="btn btn-primary" onClick={() => openTourModal()}>
                  Create tour
                </button>
              </div>
            </div>

            {filteredTours.length === 0 ? (
              <p className="muted">No tours in this category yet.</p>
            ) : (
              filteredTours.map((t) => (
                <div
                  key={t.id}
                  className="tour-list-item"
                  onClick={() => setSelectedTourId(t.id === selectedTourId ? null : t.id)}
                >
                  <span>
                    {t.title} — {t.durationLabel || `${t.days} days`}
                  </span>
                  <span className="status-badge">{t.isPublished ? "Published" : "Draft"}</span>
                </div>
              ))
            )}

            {selectedTour && (
              <div className="tour-detail-box">
                <h3 style={{ margin: "0 0 12px" }}>{selectedTour.title}</h3>
                {selectedTour.tourDays?.length ? (
                  <>
                    <TourPackagePricingNotice />
                    {selectedTour.tourDays.map((day) => (
                    <div key={day.dayNumber} className="tour-day-block">
                      <h4>Day {day.dayNumber}</h4>
                      <ul>
                        {day.items.map((item, idx) => (
                          <li key={idx}>
                            {item.scheduledTime || "—"} — {item.entityName}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  </>
                ) : (
                  <p className="muted">No day plan saved.</p>
                )}
              </div>
            )}
          </article>
        )}

        {tab === "drivers" && (
          <article className="agent-tab-panel">
            <div className="panel-head">
              <h2>Drivers</h2>
              <p>All registered drivers and current availability.</p>
            </div>

            <div className="table-tools">
              <div className="tools-left">
                <select
                  className="table-filter"
                  aria-label="Filter drivers by status"
                  value={driverStatusFilter}
                  onChange={(e) => setDriverStatusFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="Available">Available</option>
                  <option value="On Tour">On Tour</option>
                  <option value="Off Duty">Off Duty</option>
                </select>
              </div>
              <div className="tools-right">
                <button type="button" className="btn btn-primary" onClick={openAddDriver}>
                  Add Driver
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <table className="hotel-table">
                <thead>
                  <tr>
                    <th>Driver Name</th>
                    <th>License No</th>
                    <th>Phone</th>
                    <th>Vehicle</th>
                    <th>Status</th>
                    <th>Calendar</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDrivers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty-text">
                        No drivers added yet.
                      </td>
                    </tr>
                  ) : (
                    filteredDrivers.map((driver) => (
                      <tr key={driver.id}>
                        <td>
                          <strong>{driver.name}</strong>
                        </td>
                        <td>{driver.licenseNo || "—"}</td>
                        <td>{driver.phone || "—"}</td>
                        <td>{driver.vehicle || "—"}</td>
                        <td>
                          <select
                            className="driver-status-select"
                            aria-label="Driver status"
                            value={driver.status}
                            onChange={(e) =>
                              updateDriverStatus(
                                driver.id,
                                e.target.value as DriverFormState["status"]
                              )
                            }
                          >
                            <option value="Available">Available</option>
                            <option value="On Tour">On Tour</option>
                            <option value="Off Duty">Off Duty</option>
                          </select>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-lite"
                            onClick={() => setCalendarDriver({ id: driver.id, name: driver.name })}
                          >
                            View calendar
                          </button>
                          {!driver.hasLogin && (
                            <p className="muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
                              No app login
                            </p>
                          )}
                          {driver.hasLogin && driver.blockedDates.length > 0 && (
                            <p className="muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
                              {driver.blockedDates.length} blocked day
                              {driver.blockedDates.length === 1 ? "" : "s"}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>
        )}

        {tab === "travelers" && (
          <article className="agent-tab-panel">
            <div className="panel-head">
              <h2>Travelers</h2>
              <p>Recent guests and support priorities.</p>
            </div>
            {travelers.length === 0 ? (
              <p className="muted">No travelers yet.</p>
            ) : (
              <div className="agent-list">
                {travelers.map((traveler) => (
                  <div key={traveler.name} className="agent-list-item">
                    <span>
                      {traveler.name} | {traveler.message?.slice(0, 50) || "No notes"}
                    </span>
                    <span className={`agent-status-pill ${bookingStatusClass(traveler.status)}`}>
                      {formatBookingStatus(traveler.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>
        )}

        {tab === "all" && (
          <article className="agent-tab-panel">
            <div className="panel-head">
              <h2>All Added Entities</h2>
              <p>Every entity created from the ADD popup appears here.</p>
            </div>

            <div className="table-tools">
              <div className="tools-left">
                <button
                  type="button"
                  className="group-btn"
                  disabled={selectedCount === 0}
                  onClick={openGroupModal}
                >
                  Make Group
                </button>
                <p className="group-status" aria-live="polite">
                  {makeGroupStatus}
                  {selectedCount > 0 && !makeGroupStatus
                    ? `${selectedCount} selected`
                    : ""}
                </p>
              </div>
              <div className="tools-right">
                <select
                  className="table-filter"
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                  }}
                  aria-label="Filter by type"
                >
                  <option value="all">All Types</option>
                  <option value="HOTEL">Hotel</option>
                  <option value="ACTIVITY">Activity</option>
                  <option value="VIEWPOINT">Viewpoint</option>
                  <option value="RESTAURANT">Restaurant</option>
                  <option value="OTHER">Other</option>
                </select>
                <button type="button" className="btn btn-primary" onClick={openAddEntity}>
                  ADD
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <table className="hotel-table">
                <thead>
                  <tr>
                    <th className="tick-col">
                      <input
                        className="tick-input"
                        type="checkbox"
                        aria-label="Select all visible entities"
                        checked={allVisibleSelected}
                        onChange={(e) => toggleSelectAllVisible(e.target.checked)}
                      />
                    </th>
                    <th>Entity Name</th>
                    <th>Type</th>
                    <th>Location</th>
                    <th>Price</th>
                    <th>Contact</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntities.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-text">
                        {entities.length === 0
                          ? "No entities added yet. Click ADD to create one."
                          : "No matching results for selected type."}
                      </td>
                    </tr>
                  ) : (
                    filteredEntities.map((ent) => (
                      <tr key={ent.id}>
                        <td className="tick-col">
                          <input
                            className="tick-input"
                            type="checkbox"
                            aria-label={`Select ${ent.name}`}
                            checked={selectedEntityIds.includes(ent.id)}
                            onChange={(e) => toggleEntitySelection(ent.id, e.target.checked)}
                          />
                        </td>
                        <td>
                          <strong>{ent.name}</strong>
                        </td>
                        <td>{formatType(ent.type)}</td>
                        <td>{entityLocationLabel(ent)}</td>
                        <td>{formatPrice(ent)}</td>
                        <td>{ent.contact || "—"}</td>
                        <td className="muted">{formatDetails(ent)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>
        )}

        {tab === "groups" && (
          <article className="agent-tab-panel">
            <div className="panel-head">
              <h2>Groups</h2>
              <p>Open a group card to view all entities linked to that group.</p>
            </div>

            {groups.length === 0 ? (
              <p className="empty-text">
                No groups created yet. Select items in Entities and click Make Group.
              </p>
            ) : (
              <div className="group-cards">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    className={`group-card ${selectedGroupId === group.id ? "active" : ""}`}
                    onClick={() =>
                      setSelectedGroupId((current) => (current === group.id ? null : group.id))
                    }
                  >
                    <h4>{group.name}</h4>
                    <p>{group.items.length} entries</p>
                  </button>
                ))}
              </div>
            )}

            {selectedGroup && (
              <div className="group-detail">
                <h3>{selectedGroup.name}</h3>
                <div className="table-wrap">
                  <table className="hotel-table">
                    <thead>
                      <tr>
                        <th>Entity Name</th>
                        <th>Type</th>
                        <th>Location</th>
                        <th>Price</th>
                        <th>Contact</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedGroup.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.entity.name}</strong>
                          </td>
                          <td>{formatType(item.entity.type)}</td>
                          <td>{entityLocationLabel(item.entity)}</td>
                          <td>{formatPrice(item.entity)}</td>
                          <td>{item.entity.contact || "—"}</td>
                          <td className="muted">{formatDetails(item.entity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </article>
        )}

        {tab === "display" && (
          <DisplayTabPanel
            token={token}
            agencySlug={user?.agency?.slug}
            onGoToTours={() => setTab("tours")}
          />
        )}
      </section>

      <TourFormModal
        open={tourModalOpen}
        mode="create"
        tourKind="READY_MADE"
        form={tourForm}
        entities={entityOptions}
        groups={groupOptions}
        status={tourStatus}
        saving={tourSaving}
        onClose={() => setTourModalOpen(false)}
        onChange={setTourForm}
        onSubmit={saveTour}
        uploadToken={token}
        offers={offers}
        offerLink={offerLink}
        onOfferLinkChange={setOfferLink}
      />

      <EntityFormModal
        open={entityModalOpen}
        form={entityForm}
        mainImageUrl={entityMainImageUrl}
        gallery={entityGallery}
        token={token}
        status={entityStatus}
        saving={entitySaving}
        onClose={() => setEntityModalOpen(false)}
        onChange={setEntityForm}
        onMainImageChange={setEntityMainImageUrl}
        onGalleryChange={setEntityGallery}
        onSubmit={addEntity}
      />

      <DriverFormModal
        open={driverModalOpen}
        form={driverForm}
        status={driverStatus}
        saving={driverSaving}
        token={token}
        onClose={() => setDriverModalOpen(false)}
        onChange={setDriverForm}
        onSubmit={saveDriver}
      />

      <GroupFormModal
        open={groupModalOpen}
        name={groupName}
        status={groupStatus}
        saving={groupSaving}
        onClose={() => setGroupModalOpen(false)}
        onChange={setGroupName}
        onSubmit={createGroup}
      />

      {token && (
        <InquiryReplyModal
          open={Boolean(replyInquiryId)}
          token={token}
          inquiryId={replyInquiryId}
          entities={entityOptions}
          groups={groupOptions}
          onClose={() => setReplyInquiryId(null)}
          onSent={() => token && refresh(token)}
        />
      )}

      <ChatRoomPopup
        open={Boolean(chatInquiry)}
        inquiryId={chatInquiry?.id ?? null}
        partnerName={chatInquiry?.name}
        fullRoomTo={chatInquiry ? `/dashboard/agency/trip-room/${chatInquiry.id}` : undefined}
        onClose={() => {
          setChatInquiry(null);
          if (token) void refresh(token);
        }}
      />

      {token && calendarDriver && (
        <DriverCalendarModal
          open
          token={token}
          driverId={calendarDriver.id}
          driverName={calendarDriver.name}
          onClose={() => setCalendarDriver(null)}
        />
      )}
    </>
  );
}

function formatType(type: string) {
  return type.charAt(0) + type.slice(1).toLowerCase();
}

function formatPrice(ent: EntityRow) {
  if (ent.priceHint == null) return "—";
  const label =
    ent.type === "HOTEL"
      ? "/night"
      : ent.type === "ACTIVITY" || ent.type === "RESTAURANT"
        ? "/person"
        : "";
  return `LKR ${ent.priceHint.toLocaleString()}${label}`;
}

function formatDetails(ent: EntityRow) {
  return entityDetailsSummary(ent);
}

function formatBookingStatus(status: string) {
  if (status === "NEW") return "Pending";
  if (status === "REVISION_REQUESTED") return "Revision requested";
  if (status === "SENT_TO_TOURIST") return "Sent";
  if (status === "ACCEPTED") return "Accepted";
  if (status === "DECLINED" || status === "EXPIRED") return "Closed";
  return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function bookingStatusClass(status: string) {
  if (status === "NEW" || status === "REVISION_REQUESTED") return "warn";
  if (status === "DECLINED" || status === "EXPIRED") return "late";
  return "ok";
}

type InquiryRow = {
  id: string;
  status: string;
  type: string;
  pax: number;
  message: string | null;
  createdAt: string;
  tourist?: { name: string; phone: string };
  responses?: { id: string }[];
  proposal?: { items: { id: string }[] } | null;
  proposalEditable?: boolean;
  thread?: ThreadMessage[];
};

function formatInquiryDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type EntityRow = {
  id: string;
  name: string;
  type: EntityTypeKey | string;
  city: string | null;
  description: string | null;
  priceHint: number | null;
  contact: string | null;
  metadata?: Record<string, unknown> | null;
};

type DriverRow = {
  id: string;
  name: string;
  phone: string | null;
  licenseNo: string | null;
  vehicle: string | null;
  status: DriverFormState["status"];
  blockedDates: string[];
  hasLogin: boolean;
};

type TourRow = {
  id: string;
  title: string;
  days: number;
  tourKind: TourKind;
  basePriceLkr: number;
  isPublished: boolean;
  durationLabel?: string;
  tourDays?: Array<{
    dayNumber: number;
    items: Array<{ scheduledTime: string | null; entityName: string | null }>;
  }>;
};

type EntityGroupRow = {
  id: string;
  name: string;
  description: string | null;
  items: Array<{
    id: string;
    sortOrder: number;
    entity: EntityRow;
  }>;
};
