import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { normalizeEntityMedia } from "@tourpilot/shared";

import { api, ApiError } from "../api/client";
import { CoverImage } from "../components/CoverImage";
import { AGENCY_TRANSPORT_OPTIONS } from "../components/display/transportOptions";
import { EntityTypeLineIcon, TransportVehicleIcon } from "../components/icons/LineIcons";
import { useAuth } from "../context/AuthContext";
import {
  categorySelectionCount,
  computeTripTotal,
  countOnRequestItems,
  createDaySelections,
  DAY_CATEGORIES,
  defaultTripPlan,
  entitiesForCategory,
  entityLocation,
  planHasSelections,
  renumberTripDays,
  serializeTripPlan,
  type BuildTripEntity,
  type DayCategoryId,
  type DaySelections,
  type TripPlanState,
} from "../lib/buildTripTypes";
import { currentPath, loginPath } from "../utils/authRedirect";

import "../styles/build-my-trip.css";

function entityTypeLabel(type: BuildTripEntity["type"]) {
  if (type === "RESTAURANT" || type === "OTHER") return "Other";
  return type[0] + type.slice(1).toLowerCase();
}

export function BuildMyTripPage() {
  const { slug: agencySlug } = useParams<{ slug: string }>();
  const location = useLocation();
  const { user, token, refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [agencyId, setAgencyId] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [entities, setEntities] = useState<BuildTripEntity[]>([]);

  const [plan, setPlan] = useState<TripPlanState>(defaultTripPlan);
  const [activeDayId, setActiveDayId] = useState<string>(plan.days[0].dayId);
  const [openCategory, setOpenCategory] = useState<DayCategoryId>("accommodation");
  const [categorySearch, setCategorySearch] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [showInquire, setShowInquire] = useState(false);
  const [inquireEmail, setInquireEmail] = useState("");
  const [inquirePax, setInquirePax] = useState(2);
  const [inquireStart, setInquireStart] = useState("");
  const [inquireEnd, setInquireEnd] = useState("");
  const [inquireMessage, setInquireMessage] = useState("");
  const [inquireStatus, setInquireStatus] = useState("");
  const [inquireSubmitting, setInquireSubmitting] = useState(false);
  const [sentInquiryId, setSentInquiryId] = useState<string | null>(null);

  useEffect(() => {
    if (!agencySlug) return;
    setLoading(true);
    setError("");

    Promise.all([
      api<{ id: string; name: string }>(`/agencies/${agencySlug}`),
      api<BuildTripEntity[]>(`/entities/public/${agencySlug}`),
    ])
      .then(([agency, ent]) => {
        setAgencyId(agency.id);
        setAgencyName(agency.name);
        setEntities(ent);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load agency catalog");
      })
      .finally(() => setLoading(false));
  }, [agencySlug]);

  useEffect(() => {
    if (user?.email) setInquireEmail(user.email);
  }, [user?.email]);

  const activeDay = plan.days.find((d) => d.dayId === activeDayId) ?? plan.days[0];
  const serializedPlan = useMemo(() => {
    if (!agencySlug) return null;
    return serializeTripPlan(plan, agencySlug, entities);
  }, [plan, agencySlug, entities]);

  const pricedTotal = useMemo(() => computeTripTotal(plan, entities), [plan, entities]);
  const onRequestCount = useMemo(() => countOnRequestItems(plan, entities), [plan, entities]);
  const hasSelections = planHasSelections(plan);
  const canActAsTourist = Boolean(token && user?.role === "TOURIST");

  const categoryEntities = useMemo(() => {
    if (openCategory === "transport") return [];
    const list = entitiesForCategory(entities, openCategory);
    const q = categorySearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((e) => {
      const hay = `${e.name} ${e.type} ${e.city ?? ""} ${e.district ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [entities, openCategory, categorySearch]);

  const transportOptions = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return AGENCY_TRANSPORT_OPTIONS;
    return AGENCY_TRANSPORT_OPTIONS.filter((t) =>
      `${t.name} ${t.variant ?? ""} ${t.description}`.toLowerCase().includes(q)
    );
  }, [categorySearch]);

  function updateActiveDay(updater: (day: DaySelections) => DaySelections) {
    setPlan((prev) => ({
      ...prev,
      days: prev.days.map((d) => (d.dayId === activeDayId ? updater(d) : d)),
    }));
  }

  function toggleEntity(category: "activities" | "viewpoints" | "dining", entityId: string) {
    updateActiveDay((day) => {
      const key = category;
      const list = day[key];
      const next = list.includes(entityId)
        ? list.filter((id) => id !== entityId)
        : [...list, entityId];
      return { ...day, [key]: next };
    });
  }

  function setSingleEntity(entityId: string | null) {
    updateActiveDay((day) => ({
      ...day,
      accommodation: day.accommodation === entityId ? null : entityId,
    }));
  }

  function setTransport(transportId: string | null) {
    updateActiveDay((day) => ({
      ...day,
      transport: day.transport === transportId ? null : transportId,
    }));
  }

  function addDay() {
    setPlan((prev) => {
      const nextDay = createDaySelections(prev.days.length + 1);
      setActiveDayId(nextDay.dayId);
      return { ...prev, days: [...prev.days, nextDay] };
    });
  }

  function removeDay(dayId: string) {
    setPlan((prev) => {
      if (prev.days.length <= 1) return prev;
      const nextDays = renumberTripDays(prev.days.filter((d) => d.dayId !== dayId));
      if (activeDayId === dayId) setActiveDayId(nextDays[0].dayId);
      return { ...prev, days: nextDays };
    });
  }

  async function saveToFavorites() {
    if (!canActAsTourist || !serializedPlan || !agencyId) return;
    setSaving(true);
    setSaveStatus("");
    try {
      await api("/saved-trip-plans", {
        method: "POST",
        token,
        body: JSON.stringify({
          agencyId,
          title: serializedPlan.title,
          plan: serializedPlan,
        }),
      });
      setSaveStatus("Saved to your profile. View it under Saved tours.");
    } catch (e) {
      setSaveStatus(e instanceof ApiError ? e.message : "Could not save trip");
    } finally {
      setSaving(false);
    }
  }

  async function submitInquiry(e: FormEvent) {
    e.preventDefault();
    if (!canActAsTourist || !serializedPlan || !agencyId) return;
    if (!inquireEmail.trim()) {
      setInquireStatus("Please enter your email.");
      return;
    }
    if (!hasSelections) {
      setInquireStatus("Add at least one item to your itinerary before inquiring.");
      return;
    }

    setInquireSubmitting(true);
    setInquireStatus("");
    setSentInquiryId(null);
    try {
      const result = await api<{ id: string }>("/inquiries", {
        method: "POST",
        token,
        body: JSON.stringify({
          agencyId,
          type: "CUSTOM",
          pax: inquirePax,
          startDate: inquireStart ? new Date(inquireStart).toISOString() : undefined,
          endDate: inquireEnd ? new Date(inquireEnd).toISOString() : undefined,
          tripPlan: serializedPlan,
          message: inquireMessage.trim() || undefined,
          email: inquireEmail.trim(),
        }),
      });
      await refreshUser().catch(() => {});
      setSentInquiryId(result.id);
      setInquireStatus("Inquiry sent! The agency will reply in your trip room.");
    } catch (err) {
      setInquireStatus(err instanceof ApiError ? err.message : "Failed to send inquiry");
    } finally {
      setInquireSubmitting(false);
    }
  }

  function renderSelectedChips(day: DaySelections) {
    const chips: Array<{ key: string; label: string; category: string }> = [];
    if (day.accommodation) {
      const ent = entities.find((e) => e.id === day.accommodation);
      if (ent) chips.push({ key: `acc-${ent.id}`, label: ent.name, category: "Accommodation" });
    }
    if (day.transport) {
      const t = AGENCY_TRANSPORT_OPTIONS.find((x) => x.id === day.transport);
      if (t) chips.push({ key: `tr-${t.id}`, label: t.name, category: "Transport" });
    }
    for (const id of day.activities) {
      const ent = entities.find((e) => e.id === id);
      if (ent) chips.push({ key: `act-${id}`, label: ent.name, category: "Activity" });
    }
    for (const id of day.viewpoints) {
      const ent = entities.find((e) => e.id === id);
      if (ent) chips.push({ key: `vp-${id}`, label: ent.name, category: "Viewpoint" });
    }
    for (const id of day.dining) {
      const ent = entities.find((e) => e.id === id);
      if (ent) chips.push({ key: `din-${id}`, label: ent.name, category: "Dining" });
    }
    if (chips.length === 0) return <p className="muted">No selections yet — all categories are optional.</p>;
    return (
      <ul className="build-trip__chip-list">
        {chips.map((c) => (
          <li key={c.key} className="build-trip__chip">
            <span className="build-trip__chip-cat">{c.category}</span>
            {c.label}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="build-trip">
      <header className="build-trip__hero">
        <div className="build-trip__inner">
          <div className="build-trip__kicker">
            <Link to={`/agencies/${agencySlug}`} className="build-trip__back">
              Back to {agencyName || "agency"}
            </Link>
          </div>
          <h1 className="build-trip__title">Build my trip</h1>
          <p className="build-trip__subtitle">
            For each day, pick what you want — accommodation, transport, activities, viewpoints, and dining.
            Every section is optional; choose only what matters to you.
          </p>
        </div>
      </header>

      <div className="build-trip__content">
        {loading ? (
          <p className="muted">Loading agency catalog…</p>
        ) : error ? (
          <p className="form-error">{error}</p>
        ) : (
          <div className="build-trip__layout">
            <section className="build-trip__main">
              <div className="build-trip__planner-head">
                <label className="build-trip__title-field">
                  <span>Trip name</span>
                  <input
                    type="text"
                    value={plan.title}
                    onChange={(e) => setPlan((p) => ({ ...p, title: e.target.value }))}
                    placeholder="My itinerary"
                  />
                </label>

                <div className="build-trip__day-tabs" role="tablist" aria-label="Select itinerary day">
                  {plan.days.map((d) => (
                    <button
                      key={d.dayId}
                      type="button"
                      role="tab"
                      aria-selected={d.dayId === activeDayId}
                      className={`build-trip__day-tab${d.dayId === activeDayId ? " is-active" : ""}${
                        dayHasSelections(d) ? " has-items" : ""
                      }`}
                      onClick={() => {
                        setActiveDayId(d.dayId);
                        setCategorySearch("");
                      }}
                    >
                      Day {d.dayNumber}
                    </button>
                  ))}
                  <button type="button" className="build-trip__day-add" onClick={addDay}>
                    + Add day
                  </button>
                  {plan.days.length > 1 && (
                    <button
                      type="button"
                      className="build-trip__day-remove"
                      onClick={() => removeDay(activeDayId)}
                    >
                      Remove day
                    </button>
                  )}
                </div>
              </div>

              <div className="build-trip__categories">
                {DAY_CATEGORIES.map((cat) => {
                  const count = categorySelectionCount(activeDay, cat.id);
                  const isOpen = openCategory === cat.id;
                  return (
                    <div
                      key={cat.id}
                      className={`build-trip__category${isOpen ? " is-open" : ""}${
                        cat.id === "transport" ? " build-trip__category--transport" : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="build-trip__category-head"
                        aria-expanded={isOpen}
                        onClick={() => {
                          setOpenCategory(cat.id);
                          setCategorySearch("");
                        }}
                      >
                        <span className="build-trip__category-label">{cat.label}</span>
                        <span className="build-trip__category-meta muted">
                          {cat.hint}
                          {count > 0 ? ` · ${count} selected` : ""}
                        </span>
                        <span className="build-trip__category-chevron" aria-hidden="true">
                          {isOpen ? "−" : "+"}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="build-trip__category-body">
                          <input
                            type="search"
                            value={categorySearch}
                            onChange={(e) => setCategorySearch(e.target.value)}
                            placeholder={`Search ${cat.label.toLowerCase()}…`}
                            className="build-trip__search"
                            aria-label={`Search ${cat.label}`}
                          />

                          {cat.id === "transport" ? (
                            <div className="build-trip__transport-grid">
                              {transportOptions.length === 0 ? (
                                <p className="muted">No matching vehicles.</p>
                              ) : (
                                transportOptions.map((t) => {
                                  const selected = activeDay.transport === t.id;
                                  return (
                                    <button
                                      key={t.id}
                                      type="button"
                                      className={`build-trip__transport-card${
                                        selected ? " is-selected" : ""
                                      }`}
                                      onClick={() => setTransport(selected ? null : t.id)}
                                    >
                                      <span className="build-trip__transport-icon">
                                        <TransportVehicleIcon vehicleId={t.id} size={28} />
                                      </span>
                                      <strong>
                                        {t.name}
                                        {t.variant ? ` (${t.variant})` : ""}
                                      </strong>
                                      <span className="muted">{t.seating}</span>
                                      <span className="build-trip__transport-cta">
                                        {selected ? "Selected" : "Select"}
                                      </span>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          ) : (
                            <div className="build-trip__entity-grid">
                              {categoryEntities.length === 0 ? (
                                <p className="muted">
                                  No {cat.label.toLowerCase()} in this agency catalog yet.
                                </p>
                              ) : (
                                categoryEntities.map((e) => {
                                  const media = normalizeEntityMedia(e.media as never);
                                  const selected =
                                    cat.id === "activities"
                                      ? activeDay.activities.includes(e.id)
                                      : cat.id === "viewpoints"
                                        ? activeDay.viewpoints.includes(e.id)
                                        : cat.id === "dining"
                                          ? activeDay.dining.includes(e.id)
                                          : activeDay.accommodation === e.id;

                                  return (
                                    <article
                                      key={e.id}
                                      className={`build-trip__entity-card${
                                        selected ? " is-selected" : ""
                                      }`}
                                    >
                                      <div className="build-trip__entity-media">
                                        {media.mainImageUrl ? (
                                          <CoverImage
                                            src={media.mainImageUrl}
                                            className="build-trip__entity-img"
                                          />
                                        ) : (
                                          <div className="build-trip__entity-img build-trip__entity-img--placeholder" />
                                        )}
                                      </div>
                                      <div className="build-trip__entity-body">
                                        <div className="build-trip__entity-top">
                                          <span className="build-trip__entity-type">
                                            <EntityTypeLineIcon type={e.type} size={14} />
                                            {entityTypeLabel(e.type)}
                                          </span>
                                          <span className="build-trip__entity-price">
                                            {e.priceHint != null
                                              ? `LKR ${e.priceHint.toLocaleString()}`
                                              : "Price on request"}
                                          </span>
                                        </div>
                                        <h3 className="build-trip__entity-name">{e.name}</h3>
                                        <p className="build-trip__entity-meta">{entityLocation(e)}</p>
                                        <div className="build-trip__entity-actions">
                                          <button
                                            type="button"
                                            className={`brand-btn brand-btn--${
                                              selected ? "secondary" : "primary"
                                            }`}
                                            onClick={() => {
                                              if (cat.id === "accommodation") {
                                                setSingleEntity(e.id);
                                              } else if (
                                                cat.id === "activities" ||
                                                cat.id === "viewpoints" ||
                                                cat.id === "dining"
                                              ) {
                                                toggleEntity(cat.id, e.id);
                                              }
                                            }}
                                          >
                                            {selected ? "Remove" : "Add"}
                                          </button>
                                        </div>
                                      </div>
                                    </article>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <aside className="build-trip__aside" aria-label="Trip summary and actions">
              <div className="build-trip__total-card">
                <h2 className="build-trip__aside-title">Total for your trip</h2>
                <p className="build-trip__total-value">LKR {pricedTotal.toLocaleString()}</p>
                <p className="build-trip__total-foot muted">
                  {onRequestCount > 0
                    ? `${onRequestCount} item${onRequestCount === 1 ? "" : "s"} still have “price on request”.`
                    : hasSelections
                      ? "Based on listed prices for your selections."
                      : "Add items to see an estimated total."}
                </p>
              </div>

              <div className="build-trip__day-card">
                <h3 className="build-trip__aside-title">Day {activeDay.dayNumber} selections</h3>
                {renderSelectedChips(activeDay)}
              </div>

              <div className="build-trip__day-card">
                <h3 className="build-trip__aside-title">Full itinerary</h3>
                {plan.days.every((d) => !dayHasSelections(d)) ? (
                  <p className="muted">Your multi-day plan will appear here.</p>
                ) : (
                  <ul className="build-trip__itinerary-list">
                    {plan.days.map((day) => (
                      <li key={day.dayId}>
                        <strong>Day {day.dayNumber}</strong>
                        {!dayHasSelections(day) ? (
                          <span className="muted"> — skipped</span>
                        ) : (
                          <span className="build-trip__itinerary-count muted">
                            {" "}
                            · {categorySelectionCount(day, "accommodation") +
                              categorySelectionCount(day, "transport") +
                              day.activities.length +
                              day.viewpoints.length +
                              day.dining.length}{" "}
                            items
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="build-trip__actions">
                {!user ? (
                  <p className="muted">
                    <Link to={loginPath(currentPath(location))}>Log in</Link> as a tourist to save or
                    inquire.
                  </p>
                ) : user.role !== "TOURIST" ? (
                  <p className="muted">Only tourist accounts can save trips and send inquiries.</p>
                ) : (
                  <>
                    <button
                      type="button"
                      className="brand-btn brand-btn--secondary build-trip__action-btn"
                      disabled={!hasSelections || saving}
                      onClick={() => void saveToFavorites()}
                    >
                      {saving ? "Saving…" : "Save to favourites"}
                    </button>
                    {saveStatus && <p className="build-trip__status">{saveStatus}</p>}

                    <button
                      type="button"
                      className="brand-btn brand-btn--primary build-trip__action-btn"
                      disabled={!hasSelections}
                      onClick={() => setShowInquire((v) => !v)}
                    >
                      Inquire about this trip
                    </button>
                  </>
                )}
              </div>

              {showInquire && canActAsTourist && (
                <form className="build-trip__inquire" onSubmit={submitInquiry}>
                  <h3 className="build-trip__aside-title">Send inquiry to {agencyName}</h3>
                  <label>
                    Email
                    <input
                      type="email"
                      required
                      value={inquireEmail}
                      onChange={(e) => setInquireEmail(e.target.value)}
                    />
                  </label>
                  <label>
                    Travellers
                    <input
                      type="number"
                      min={1}
                      value={inquirePax}
                      onChange={(e) => setInquirePax(Number(e.target.value) || 1)}
                    />
                  </label>
                  <label>
                    Start date
                    <input
                      type="date"
                      value={inquireStart}
                      onChange={(e) => setInquireStart(e.target.value)}
                    />
                  </label>
                  <label>
                    End date
                    <input
                      type="date"
                      value={inquireEnd}
                      onChange={(e) => setInquireEnd(e.target.value)}
                    />
                  </label>
                  <label>
                    Message <span className="muted">(optional)</span>
                    <textarea
                      rows={3}
                      value={inquireMessage}
                      onChange={(e) => setInquireMessage(e.target.value)}
                      placeholder="Any special requests or questions?"
                    />
                  </label>
                  {inquireStatus && (
                    <p className={sentInquiryId ? "build-trip__status build-trip__status--ok" : "form-error"}>
                      {inquireStatus}
                      {sentInquiryId && (
                        <>
                          {" "}
                          <Link to={`/trips/${sentInquiryId}`}>Open trip room →</Link>
                        </>
                      )}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="brand-btn brand-btn--primary build-trip__action-btn"
                    disabled={inquireSubmitting || !hasSelections}
                  >
                    {inquireSubmitting ? "Sending…" : "Send inquiry"}
                  </button>
                </form>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function dayHasSelections(day: DaySelections) {
  return Boolean(
    day.accommodation ||
      day.transport ||
      day.activities.length > 0 ||
      day.viewpoints.length > 0 ||
      day.dining.length > 0
  );
}
