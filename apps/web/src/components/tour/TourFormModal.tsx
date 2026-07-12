import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { ImageUrlField } from "../ImageUrlField";
import { AGENCY_TRANSPORT_OPTIONS } from "../display/transportOptions";
import { TransportVehicleIcon } from "../icons/LineIcons";
import type { ManagedOffer } from "../offers/OffersDashboard";
import type { TourOfferLinkState } from "../../lib/tourOfferLink";
import { computeTourFormPricing } from "../../lib/tourFormPricing";
import { TourOfferLinkSection } from "./TourOfferLinkSection";
import { TourPackagePricingNotice } from "../itinerary/TourPackagePricingNotice";
import {
  createDayPlan,
  createEntry,
  entityDestinationOptions,
  entityOptionLabel,
  filterEntityOptions,
  filterGroupOptions,
  isTourFormSavable,
  renumberDays,
  type DayPlan,
  type EntityOption,
  type GroupOption,
  type TourFormState,
  type TourKind,
} from "./tourFormTypes";

type Props = {
  open: boolean;
  mode: "create" | "edit" | "duplicate";
  tourKind: TourKind;
  form: TourFormState;
  entities: EntityOption[];
  groups: GroupOption[];
  status: string;
  saving: boolean;
  onClose: () => void;
  onChange: (next: TourFormState) => void;
  onSubmit: (e: FormEvent) => void;
  uploadToken?: string | null;
  /** Agency-wide % — commission is calculated from base price automatically. */
  agencyInfluencerCommissionPct?: number;
  offers?: ManagedOffer[];
  offerLink?: TourOfferLinkState;
  onOfferLinkChange?: (next: TourOfferLinkState) => void;
  /** Save draft and open Entities tab to add a catalog entity, then return to this package. */
  onAddNewEntity?: () => void;
};

export function TourFormModal({
  open,
  mode,
  form,
  entities,
  groups,
  status,
  saving,
  onClose,
  onChange,
  onSubmit,
  uploadToken,
  agencyInfluencerCommissionPct = 0,
  offers,
  offerLink,
  onOfferLinkChange,
  onAddNewEntity,
}: Props) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [groupSearch, setGroupSearch] = useState("");
  const [entitySearch, setEntitySearch] = useState("");

  const destinationOptions = useMemo(() => entityDestinationOptions(entities), [entities]);

  const filteredGroups = useMemo(
    () => filterGroupOptions(groups, groupSearch),
    [groups, groupSearch]
  );

  const filteredEntities = useMemo(
    () => filterEntityOptions(entities, groups, typeFilter, groupFilter, entitySearch, cityFilter),
    [entities, groups, typeFilter, groupFilter, entitySearch, cityFilter]
  );

  useEffect(() => {
    if (!open) {
      setTypeFilter("all");
      setCityFilter("all");
      setGroupFilter("all");
      setGroupSearch("");
      setEntitySearch("");
    }
  }, [open]);

  useEffect(() => {
    if (cityFilter === "all") return;
    if (!destinationOptions.includes(cityFilter)) {
      setCityFilter("all");
    }
  }, [destinationOptions, cityFilter]);

  useEffect(() => {
    if (groupFilter === "all") return;
    if (!filteredGroups.some((g) => g.id === groupFilter)) {
      setGroupFilter("all");
    }
  }, [filteredGroups, groupFilter]);

  useEffect(() => {
    if (!open) return;
    const allowed = new Set(filteredEntities.map((e) => e.id));
    const needsClear = form.days.some((d) =>
      d.entries.some((e) => e.entityId && !allowed.has(e.entityId))
    );
    if (!needsClear) return;

    onChange({
      ...form,
      days: form.days.map((d) => ({
        ...d,
        entries: d.entries.map((e) =>
          e.entityId && !allowed.has(e.entityId) ? { ...e, entityId: "" } : e
        ),
      })),
    });
  }, [typeFilter, cityFilter, groupFilter, entitySearch, filteredEntities, open]);

  if (!open) return null;

  const effectiveCommissionPct = form.influencerCommissionPct ?? agencyInfluencerCommissionPct;
  const pricing = computeTourFormPricing(form, entities, agencyInfluencerCommissionPct);

  const kindLabel = "Tour";
  const modalTitle =
    mode === "edit"
      ? `Edit ${kindLabel}`
      : mode === "duplicate"
        ? `Duplicate ${kindLabel}`
        : `Create ${kindLabel}`;
  const canSave = isTourFormSavable(form);

  function updateDays(days: DayPlan[]) {
    onChange({ ...form, days: renumberDays(days) });
  }

  function addDay() {
    updateDays([...form.days, createDayPlan(form.days.length + 1)]);
  }

  function removeDay(dayId: string) {
    if (form.days.length <= 1) return;
    updateDays(form.days.filter((d) => d.id !== dayId));
  }

  function addEntry(dayId: string) {
    updateDays(
      form.days.map((d) =>
        d.id === dayId ? { ...d, entries: [...d.entries, createEntry()] } : d
      )
    );
  }

  function removeEntry(dayId: string, entryId: string) {
    updateDays(
      form.days.map((d) => {
        if (d.id !== dayId) return d;
        const entries = d.entries.filter((e) => e.id !== entryId);
        return { ...d, entries: entries.length ? entries : [createEntry()] };
      })
    );
  }

  function patchEntry(
    dayId: string,
    entryId: string,
    patch: Partial<{
      time: string;
      entityId: string;
      costLkr: number;
      sellingPriceLkr: number;
    }>
  ) {
    let mergedPatch = { ...patch };
    if (patch.entityId !== undefined) {
      if (patch.entityId) {
        const ent = entities.find((e) => e.id === patch.entityId);
        mergedPatch = {
          ...mergedPatch,
          costLkr: ent?.priceHint ?? 0,
          sellingPriceLkr: ent?.priceHint ?? 0,
        };
      } else {
        mergedPatch = { ...mergedPatch, costLkr: 0, sellingPriceLkr: 0 };
      }
    }

    updateDays(
      form.days.map((d) =>
        d.id === dayId
          ? {
              ...d,
              entries: d.entries.map((e) => (e.id === entryId ? { ...e, ...mergedPatch } : e)),
            }
          : d
      )
    );
  }

  function patchDay(
    dayId: string,
    patch: Partial<
      Pick<DayPlan, "transportVehicleId" | "transportRateLkr" | "transportSellingPriceLkr">
    >
  ) {
    updateDays(form.days.map((d) => (d.id === dayId ? { ...d, ...patch } : d)));
  }

  return (
    <div className="entity-modal tour-modal open" role="presentation" onClick={onClose}>
      <DialogShell title={modalTitle} onClose={onClose}>
        <p className="dialog-sub muted">
          Set tour details, pricing, and a day-by-day plan with timed entities from your catalog.
        </p>

        <form onSubmit={onSubmit}>
          <FormField label="Tour title" full>
            <input
              type="text"
              value={form.title}
              onChange={(e) => onChange({ ...form, title: e.target.value })}
              placeholder="Ella 2-Day Highlights"
              required
              autoFocus
            />
          </FormField>

          <div className="tour-meta-grid">
            <FormField label="Tour price (LKR)">
              <input
                type="number"
                min={0}
                step={100}
                value={form.priceFromCatalog ? pricing.catalogSubtotal || "" : form.basePriceLkr || ""}
                onChange={(e) =>
                  onChange({
                    ...form,
                    priceFromCatalog: false,
                    basePriceLkr: Number(e.target.value) || 0,
                  })
                }
                placeholder={String(pricing.catalogSubtotal || 0)}
                readOnly={form.priceFromCatalog}
                aria-readonly={form.priceFromCatalog}
              />
            </FormField>
            <FormField label="Influencer commission %">
              <input
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={form.influencerCommissionPct ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  onChange({
                    ...form,
                    influencerCommissionPct: v === "" ? null : Number(v),
                  });
                }}
                placeholder={`Default (${agencyInfluencerCommissionPct}%)`}
                aria-label="Influencer commission percentage"
              />
            </FormField>
            <label className="tour-price-mode full" style={{ gridColumn: "1 / -1" }}>
              <input
                type="checkbox"
                checked={form.priceFromCatalog}
                onChange={(e) =>
                  onChange({
                    ...form,
                    priceFromCatalog: e.target.checked,
                    basePriceLkr: e.target.checked ? pricing.catalogSubtotal : form.basePriceLkr,
                  })
                }
              />
              Auto-calculate tour price from entity rates + vehicle rates in the itinerary
            </label>
            <p className="tour-listed-price muted full" style={{ gridColumn: "1 / -1", margin: 0 }}>
              Final listed price for tourists:{" "}
              <strong>LKR {pricing.listedPriceLkr.toLocaleString()}</strong>
              {pricing.commissionLkr > 0
                ? ` (catalog LKR ${pricing.basePriceLkr.toLocaleString()} + LKR ${pricing.commissionLkr.toLocaleString()} influencer commission at ${effectiveCommissionPct}%)`
                : pricing.basePriceLkr > 0
                  ? ` (catalog LKR ${pricing.basePriceLkr.toLocaleString()}, no influencer commission)`
                  : ""}
              .
            </p>
            <ImageUrlField
              label="Cover image"
              value={form.coverUrl}
              onChange={(coverUrl) => onChange({ ...form, coverUrl })}
              token={uploadToken}
            />
          </div>

          <FormField label="Short summary" full>
            <input
              type="text"
              value={form.summary}
              onChange={(e) => onChange({ ...form, summary: e.target.value })}
              placeholder="Highlights, regions, or who this tour is for"
            />
          </FormField>

          <FormField label="Description" full>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => onChange({ ...form, description: e.target.value })}
              placeholder="Full description shown on the public tour page"
            />
          </FormField>

          <FormField label="Special instructions for influencers" full>
            <textarea
              rows={3}
              value={form.influencerInstructions}
              onChange={(e) => onChange({ ...form, influencerInstructions: e.target.value })}
              placeholder="Promo rules, content guidelines, or dos and don'ts for influencers featuring this tour"
            />
          </FormField>

          <label className="tour-publish-check">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => onChange({ ...form, isPublished: e.target.checked })}
            />
            Publish on agency storefront (travelers can view and inquire)
          </label>

          {offerLink && onOfferLinkChange && offers && (
            <TourOfferLinkSection
              offers={offers}
              link={offerLink}
              onChange={onOfferLinkChange}
              uploadToken={uploadToken}
              tourDefaults={{
                title: form.title,
                summary: form.summary,
                coverUrl: form.coverUrl,
                basePriceLkr: form.basePriceLkr,
                isPublished: form.isPublished,
              }}
            />
          )}

          {onAddNewEntity && (
            <div className="tour-add-entity-row">
              <button type="button" className="btn btn-teal" onClick={onAddNewEntity}>
                + Add new entity
              </button>
              <span className="muted">
                Opens the Entities tab to add a place, then brings you back to this package.
              </span>
            </div>
          )}

          <div className="entity-filter-row tour-entity-filters" role="search">
            <input
              type="search"
              className="groups-search"
              placeholder="Search by name, type, city…"
              value={entitySearch}
              onChange={(e) => setEntitySearch(e.target.value)}
              aria-label="Search entities"
            />
            <select
              className="table-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by type"
            >
              <option value="all">All types</option>
              <option value="HOTEL">Hotel</option>
              <option value="ACTIVITY">Activity</option>
              <option value="VIEWPOINT">View point</option>
              <option value="RESTAURANT">Restaurant</option>
              <option value="OTHER">Other</option>
            </select>
            <select
              className="table-filter"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              aria-label="Filter by destination"
              disabled={destinationOptions.length === 0}
            >
              <option value="all">All destinations</option>
              {destinationOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <div className="tour-group-filter-wrap">
              <input
                type="search"
                className="groups-search groups-search--filter"
                placeholder="Search groups…"
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                aria-label="Search groups"
              />
              <select
                className="table-filter"
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                aria-label="Filter by group"
              >
                <option value="all">All groups</option>
                {filteredGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              {groupSearch.trim() && filteredGroups.length === 0 && (
                <span className="tour-group-filter-empty muted">No groups match</span>
              )}
            </div>
          </div>

          {filteredEntities.length === 0 && (
            <p className="entity-filter-hint muted">
              No entities match your search or filters. Adjust them or add entities in the Entities tab.
            </p>
          )}

          <TourPackagePricingNotice />

          {form.days.map((day) => (
            <DayBlock
              key={day.id}
              day={day}
              entities={filteredEntities}
              allEntitiesCount={entities.length}
              canRemoveDay={form.days.length > 1}
              dayPricing={pricing.dayBreakdown.find((d) => d.dayNumber === day.dayNumber)}
              onAddEntry={() => addEntry(day.id)}
              onRemoveDay={() => removeDay(day.id)}
              onRemoveEntry={(entryId) => removeEntry(day.id, entryId)}
              onPatchEntry={(entryId, patch) => patchEntry(day.id, entryId, patch)}
              onPatchTransport={(patch) => patchDay(day.id, patch)}
            />
          ))}

          <div className="tour-pricing-summary" aria-label="Itinerary pricing breakdown">
            <h4>Pricing breakdown</h4>
            <table className="tour-itinerary-table tour-itinerary-table--summary">
              <thead>
                <tr>
                  <th scope="col"> </th>
                  <th scope="col">Cost</th>
                  <th scope="col">Selling price</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Entities subtotal</td>
                  <td>LKR {pricing.entitiesSubtotal.toLocaleString()}</td>
                  <td>LKR {pricing.entitiesSellingSubtotal.toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Vehicle rates</td>
                  <td>LKR {pricing.transportSubtotal.toLocaleString()}</td>
                  <td>LKR {pricing.transportSellingSubtotal.toLocaleString()}</td>
                </tr>
                <tr className="tour-itinerary-table__total">
                  <td>Grand total</td>
                  <td>
                    <strong>LKR {pricing.catalogSubtotal.toLocaleString()}</strong>
                  </td>
                  <td>
                    <strong>LKR {pricing.sellingTotal.toLocaleString()}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
            {pricing.commissionLkr > 0 && (
              <p className="muted tour-pricing-note">
                Listed tourist price (cost + {effectiveCommissionPct}% influencer commission):{" "}
                <strong>LKR {pricing.listedPriceLkr.toLocaleString()}</strong>
              </p>
            )}
            {pricing.onRequestEntityCount > 0 && (
              <p className="muted tour-pricing-note">
                {pricing.onRequestEntityCount} entit
                {pricing.onRequestEntityCount === 1 ? "y has" : "ies have"} no listed rate — only
                rows with prices are included in the auto totals.
              </p>
            )}
          </div>

          <div className="day-tools">
            <button type="button" className="mini-btn" onClick={addDay}>
              + Add Day
            </button>
          </div>

          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !canSave}>
              {saving
                ? "Saving…"
                : mode === "edit"
                  ? "Update tour"
                  : mode === "duplicate"
                    ? "Save as new tour"
                    : "Create tour"}
            </button>
          </div>
          {status && <p className="tour-status">{status}</p>}
        </form>
      </DialogShell>
    </div>
  );
}

function DialogShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="entity-dialog tour-dialog"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="dialog-head">
        <h3>{title}</h3>
        <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {children}
    </div>
  );
}

function FormField({ label, full, children }: { label: string; full?: boolean; children: ReactNode }) {
  return (
    <div className={`field ${full ? "full" : ""}`} style={{ marginBottom: 12 }}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function DayBlock({
  day,
  entities,
  allEntitiesCount,
  canRemoveDay,
  dayPricing,
  onAddEntry,
  onRemoveDay,
  onRemoveEntry,
  onPatchEntry,
  onPatchTransport,
}: {
  day: DayPlan;
  entities: EntityOption[];
  allEntitiesCount: number;
  canRemoveDay: boolean;
  dayPricing?: {
    costSubtotal: number;
    sellingSubtotal: number;
    transportLabel: string | null;
    transportCostLkr: number;
  };
  onAddEntry: () => void;
  onRemoveDay: () => void;
  onRemoveEntry: (entryId: string) => void;
  onPatchEntry: (
    entryId: string,
    patch: Partial<{
      time: string;
      entityId: string;
      costLkr: number;
      sellingPriceLkr: number;
    }>
  ) => void;
  onPatchTransport: (
    patch: Partial<
      Pick<DayPlan, "transportVehicleId" | "transportRateLkr" | "transportSellingPriceLkr">
    >
  ) => void;
}) {
  return (
    <div className="day-block">
      <div className="day-head">
        <h4>Day {day.dayNumber}</h4>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="mini-btn" onClick={onAddEntry}>
            + Add Entity
          </button>
          {canRemoveDay && (
            <button type="button" className="remove-day-btn" onClick={onRemoveDay}>
              Remove Day
            </button>
          )}
        </div>
      </div>

      <div className="tour-itinerary-table-wrap">
        <table className="tour-itinerary-table">
          <thead>
            <tr>
              <th scope="col">Itinerary</th>
              <th scope="col">Cost (LKR)</th>
              <th scope="col">Selling price (LKR)</th>
              <th scope="col" className="tour-itinerary-table__actions" aria-label="Remove row" />
            </tr>
          </thead>
          <tbody>
            {day.entries.map((entry) => (
              <DayRow
                key={entry.id}
                entry={entry}
                entities={entities}
                allEntitiesCount={allEntitiesCount}
                onPatch={(patch) => onPatchEntry(entry.id, patch)}
                onRemove={() => onRemoveEntry(entry.id)}
              />
            ))}
            <tr className="tour-itinerary-table__transport">
              <td>
                <div className="tour-itinerary-transport">
                  <span className="tour-itinerary-transport__label">Vehicle</span>
                  <select
                    value={day.transportVehicleId}
                    onChange={(e) =>
                      onPatchTransport({
                        transportVehicleId: e.target.value,
                        transportRateLkr: e.target.value ? day.transportRateLkr : 0,
                        transportSellingPriceLkr: e.target.value
                          ? day.transportSellingPriceLkr
                          : 0,
                      })
                    }
                    aria-label={`Day ${day.dayNumber} vehicle`}
                  >
                    <option value="">No vehicle</option>
                    {AGENCY_TRANSPORT_OPTIONS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.variant ? ` (${t.variant})` : ""}
                      </option>
                    ))}
                  </select>
                  {day.transportVehicleId && (
                    <span className="tour-itinerary-transport__icon" aria-hidden="true">
                      <TransportVehicleIcon vehicleId={day.transportVehicleId} size={20} />
                    </span>
                  )}
                </div>
              </td>
              <td>
                <LkrInput
                  value={day.transportRateLkr}
                  onChange={(value) => onPatchTransport({ transportRateLkr: value })}
                  disabled={!day.transportVehicleId}
                  aria-label={`Day ${day.dayNumber} vehicle cost`}
                  placeholder="Cost"
                />
              </td>
              <td>
                <LkrInput
                  value={day.transportSellingPriceLkr}
                  onChange={(value) => onPatchTransport({ transportSellingPriceLkr: value })}
                  disabled={!day.transportVehicleId}
                  aria-label={`Day ${day.dayNumber} vehicle selling price`}
                  placeholder="Selling"
                />
              </td>
              <td />
            </tr>
            {dayPricing && (dayPricing.costSubtotal > 0 || dayPricing.sellingSubtotal > 0) && (
              <tr className="tour-itinerary-table__subtotal">
                <td>
                  Day subtotal
                  {dayPricing.transportCostLkr > 0 && dayPricing.transportLabel
                    ? ` (incl. ${dayPricing.transportLabel})`
                    : ""}
                </td>
                <td>LKR {dayPricing.costSubtotal.toLocaleString()}</td>
                <td>LKR {dayPricing.sellingSubtotal.toLocaleString()}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LkrInput({
  value,
  onChange,
  disabled,
  "aria-label": ariaLabel,
  placeholder,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  "aria-label"?: string;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      min={0}
      step={100}
      className="tour-itinerary-table__amount"
      value={value || ""}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      disabled={disabled}
      aria-label={ariaLabel}
      placeholder={placeholder}
    />
  );
}

function DayRow({
  entry,
  entities,
  allEntitiesCount,
  onPatch,
  onRemove,
}: {
  entry: {
    time: string;
    entityId: string;
    costLkr: number;
    sellingPriceLkr: number;
  };
  entities: EntityOption[];
  allEntitiesCount: number;
  onPatch: (
    patch: Partial<{
      time: string;
      entityId: string;
      costLkr: number;
      sellingPriceLkr: number;
    }>
  ) => void;
  onRemove: () => void;
}) {
  const emptyLabel =
    allEntitiesCount === 0
      ? "No entities available — add some in Entities tab"
      : entities.length === 0
        ? "No entities match filters"
        : "Select entity";

  return (
    <tr className="tour-itinerary-table__entry">
      <td>
        <div className="tour-itinerary-entry">
          <input
            type="time"
            value={entry.time}
            onChange={(e) => onPatch({ time: e.target.value })}
            required
            aria-label="Scheduled time"
          />
          <select
            value={entry.entityId}
            onChange={(e) => onPatch({ entityId: e.target.value })}
            required
            aria-label="Entity"
          >
            <option value="">{emptyLabel}</option>
            {entities.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {entityOptionLabel(ent)}
                {ent.priceHint != null
                  ? ` · LKR ${ent.priceHint.toLocaleString()}`
                  : " · Price on request"}
              </option>
            ))}
          </select>
        </div>
      </td>
      <td>
        <LkrInput
          value={entry.costLkr}
          onChange={(costLkr) => onPatch({ costLkr })}
          aria-label="Cost"
          placeholder="Cost"
        />
      </td>
      <td>
        <LkrInput
          value={entry.sellingPriceLkr}
          onChange={(sellingPriceLkr) => onPatch({ sellingPriceLkr })}
          aria-label="Selling price"
          placeholder="Selling"
        />
      </td>
      <td className="tour-itinerary-table__actions">
        <button
          type="button"
          className="remove-row-btn"
          onClick={onRemove}
          aria-label="Remove entity row"
        >
          ×
        </button>
      </td>
    </tr>
  );
}
