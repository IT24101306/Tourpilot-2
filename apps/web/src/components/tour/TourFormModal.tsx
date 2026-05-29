import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { ImageUrlField } from "../ImageUrlField";
import {
  createDayPlan,
  createEntry,
  entityOptionLabel,
  filterEntityOptions,
  renumberDays,
  type DayPlan,
  type EntityOption,
  type GroupOption,
  type TourFormState,
  type TourKind,
} from "./tourFormTypes";

type Props = {
  open: boolean;
  mode: "create" | "edit";
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
};

export function TourFormModal({
  open,
  mode,
  tourKind,
  form,
  entities,
  groups,
  status,
  saving,
  onClose,
  onChange,
  onSubmit,
  uploadToken,
}: Props) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");

  const filteredEntities = useMemo(
    () => filterEntityOptions(entities, groups, typeFilter, groupFilter),
    [entities, groups, typeFilter, groupFilter]
  );

  useEffect(() => {
    if (!open) {
      setTypeFilter("all");
      setGroupFilter("all");
    }
  }, [open]);

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
  }, [typeFilter, groupFilter, filteredEntities, open]);

  if (!open) return null;

  const kindLabel = tourKind === "READY_MADE" ? "Ready-Made" : "Custom";
  const modalTitle =
    mode === "edit" ? `Edit ${kindLabel} Tour` : `Create ${kindLabel} Tour`;

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
    patch: Partial<{ time: string; entityId: string }>
  ) {
    updateDays(
      form.days.map((d) =>
        d.id === dayId
          ? {
              ...d,
              entries: d.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
            }
          : d
      )
    );
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
            <FormField label="Base price (LKR)">
              <input
                type="number"
                min={0}
                step={100}
                value={form.basePriceLkr || ""}
                onChange={(e) =>
                  onChange({ ...form, basePriceLkr: Number(e.target.value) || 0 })
                }
                placeholder="89500"
              />
            </FormField>
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

          <label className="tour-publish-check">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => onChange({ ...form, isPublished: e.target.checked })}
            />
            Publish on agency storefront (travelers can view and inquire)
          </label>

          <div className="entity-filter-row">
            <FormField label="Filter by type">
              <select
                className="table-filter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                aria-label="Filter entities by type"
              >
                <option value="all">All types</option>
                <option value="HOTEL">Hotel</option>
                <option value="ACTIVITY">Activity</option>
                <option value="VIEWPOINT">View point</option>
                <option value="RESTAURANT">Restaurant</option>
              </select>
            </FormField>
            <FormField label="Filter by group">
              <select
                className="table-filter"
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                aria-label="Filter entities by group"
              >
                <option value="all">All groups</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          {filteredEntities.length === 0 && (
            <p className="entity-filter-hint muted">
              No entities match the current filters. Adjust filters or add entities in the ALL tab.
            </p>
          )}

          {form.days.map((day) => (
            <DayBlock
              key={day.id}
              day={day}
              entities={filteredEntities}
              allEntitiesCount={entities.length}
              canRemoveDay={form.days.length > 1}
              onAddEntry={() => addEntry(day.id)}
              onRemoveDay={() => removeDay(day.id)}
              onRemoveEntry={(entryId) => removeEntry(day.id, entryId)}
              onPatchEntry={(entryId, patch) => patchEntry(day.id, entryId, patch)}
            />
          ))}

          <div className="day-tools">
            <button type="button" className="mini-btn" onClick={addDay}>
              + Add Day
            </button>
          </div>

          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.title.trim()}>
              {saving ? "Saving…" : mode === "edit" ? "Update tour" : "Create tour"}
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
  onAddEntry,
  onRemoveDay,
  onRemoveEntry,
  onPatchEntry,
}: {
  day: DayPlan;
  entities: EntityOption[];
  allEntitiesCount: number;
  canRemoveDay: boolean;
  onAddEntry: () => void;
  onRemoveDay: () => void;
  onRemoveEntry: (entryId: string) => void;
  onPatchEntry: (entryId: string, patch: Partial<{ time: string; entityId: string }>) => void;
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
      <div className="day-list">
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
      </div>
    </div>
  );
}

function DayRow({
  entry,
  entities,
  allEntitiesCount,
  onPatch,
  onRemove,
}: {
  entry: { time: string; entityId: string };
  entities: EntityOption[];
  allEntitiesCount: number;
  onPatch: (patch: Partial<{ time: string; entityId: string }>) => void;
  onRemove: () => void;
}) {
  const emptyLabel =
    allEntitiesCount === 0
      ? "No entities available — add some in ALL tab"
      : entities.length === 0
        ? "No entities match filters"
        : "Select entity";

  return (
    <div className="day-row">
      <input
        type="time"
        value={entry.time}
        onChange={(e) => onPatch({ time: e.target.value })}
        required
      />
      <select
        value={entry.entityId}
        onChange={(e) => onPatch({ entityId: e.target.value })}
        required
      >
        <option value="">{emptyLabel}</option>
        {entities.map((ent) => (
          <option key={ent.id} value={ent.id}>
            {entityOptionLabel(ent)}
          </option>
        ))}
      </select>
      <button type="button" className="remove-row-btn" onClick={onRemove} aria-label="Remove entity row">
        ×
      </button>
    </div>
  );
}
