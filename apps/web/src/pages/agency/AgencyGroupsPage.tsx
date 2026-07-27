import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { EntityTypeLineIcon } from "../../components/icons/LineIcons";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { RichTextEditor } from "../../components/richtext/RichTextEditor";
import { RichTextHtml } from "../../components/richtext/RichTextHtml";
import { AgencyEntity, AgencyGroup } from "./types";
import { isRichTextEmpty, stripRichHtml } from "@tourpilot/shared";

function formatType(type: string) {
  return type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, " ");
}

export function AgencyGroupsPage() {
  const { token } = useAuth();
  const { requestConfirm } = useConfirmAction();
  const [groups, setGroups] = useState<AgencyGroup[]>([]);
  const [entities, setEntities] = useState<AgencyEntity[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [entitySearch, setEntitySearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"ok" | "error">("ok");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState({ name: "", description: "", entityIds: [] as string[] });

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api<AgencyGroup[]>("/entities/groups", { token }),
      api<AgencyEntity[]>("/entities", { token }),
    ])
      .then(([g, e]) => {
        setGroups(g);
        setEntities(e);
      })
      .catch((err) => {
        console.error(err);
        setStatusTone("error");
        setStatus(err instanceof ApiError ? err.message : "Failed to load groups");
      });
  }, [token]);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );

  const filteredEntities = useMemo(() => {
    let list = entities;
    if (typeFilter !== "all") list = list.filter((e) => e.type === typeFilter);
    const q = entitySearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.type.toLowerCase().includes(q) ||
          (e.city?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [entities, typeFilter, entitySearch]);

  const entityTypes = useMemo(() => {
    const set = new Set(entities.map((e) => e.type));
    return Array.from(set).sort();
  }, [entities]);

  async function refresh() {
    if (!token) return;
    const g = await api<AgencyGroup[]>("/entities/groups", { token });
    setGroups(g);
    if (selectedGroupId && !g.some((x) => x.id === selectedGroupId)) {
      setSelectedGroupId(null);
    }
  }

  async function persistGroup(payload: {
    name: string;
    description?: string;
    entityIds: string[];
  }) {
    if (!token) throw new Error("Sign in again, then retry.");
    const body = JSON.stringify(payload);
    if (editingGroupId) {
      return api<AgencyGroup>(`/entities/groups/${editingGroupId}`, {
        method: "PATCH",
        token,
        body,
      });
    }
    return api<AgencyGroup>("/entities/groups", {
      method: "POST",
      token,
      body,
    });
  }

  function saveGroup(e: FormEvent) {
    e.preventDefault();
    if (!token) {
      setStatusTone("error");
      setStatus("Sign in again, then retry.");
      return;
    }

    const name = groupForm.name.trim();
    const entityIds = [...new Set(groupForm.entityIds.filter(Boolean))];
    if (!name) {
      setStatusTone("error");
      setStatus("Enter a group name above, then create the group.");
      document.getElementById("group-name")?.focus();
      return;
    }
    if (entityIds.length === 0) {
      setStatusTone("error");
      setStatus("Select at least one entity for this group.");
      return;
    }

    const isEditing = editingGroupId !== null;
    const description = isRichTextEmpty(groupForm.description)
      ? undefined
      : groupForm.description;
    const entityNames = entities
      .filter((ent) => entityIds.includes(ent.id))
      .map((ent) => ent.name)
      .join(", ");

    const payload = { name, description, entityIds };

    requestConfirm({
      title: isEditing ? "Save changes to this group?" : "Create entity group?",
      description: isEditing
        ? "Update the bundle used in itineraries and tour planning."
        : "Reuse this bundle when building itineraries and tours.",
      confirmLabel: isEditing ? "Save changes" : "Create group",
      summary: [
        { label: "Name", value: name },
        {
          label: "Description",
          value: description ? stripRichHtml(description) || "—" : "—",
        },
        { label: "Entities", value: `${entityIds.length} selected` },
        {
          label: "Includes",
          value: entityNames.length > 120 ? `${entityNames.slice(0, 120)}…` : entityNames,
        },
      ],
      onConfirm: async () => {
        setSaving(true);
        setStatus("");
        try {
          const saved = await persistGroup(payload);
          setEditingGroupId(null);
          setGroupForm({ name: "", description: "", entityIds: [] });
          setEntitySearch("");
          await refresh();
          setSelectedGroupId(saved.id);
          setStatusTone("ok");
          setStatus(
            isEditing
              ? `Group updated with ${saved.items.length} entities.`
              : `Group created with ${saved.items.length} entities.`
          );
          setTimeout(() => setStatus(""), 3000);
        } catch (err) {
          const message = err instanceof ApiError ? err.message : "Failed to save group";
          setStatusTone("error");
          setStatus(message);
          throw err;
        } finally {
          setSaving(false);
        }
      },
    });
  }

  function startEdit(group: AgencyGroup) {
    setEditingGroupId(group.id);
    setGroupForm({
      name: group.name,
      description: group.description ?? "",
      entityIds: group.items.map((i) => i.entity.id),
    });
    setEntitySearch("");
    setTypeFilter("all");
    setStatusTone("ok");
    setStatus(`Editing "${group.name}" — add or remove entities, then save.`);
  }

  function startDuplicate(group: AgencyGroup) {
    setEditingGroupId(null);
    setSelectedGroupId(null);
    setGroupForm({
      name: `${group.name} (copy)`,
      description: group.description ?? "",
      entityIds: group.items.map((i) => i.entity.id),
    });
    setEntitySearch("");
    setTypeFilter("all");
    setStatusTone("ok");
    setStatus("Editing a copy — adjust entities and save it as a new group.");
  }

  function cancelEdit() {
    setEditingGroupId(null);
    setGroupForm({ name: "", description: "", entityIds: [] });
    setStatus("");
  }

  function deleteGroup(group: AgencyGroup) {
    if (!token) return;
    requestConfirm({
      title: "Delete this group?",
      description: "The bundle is removed. The entities inside it are not deleted.",
      confirmLabel: "Delete group",
      variant: "danger",
      summary: [
        { label: "Name", value: group.name },
        { label: "Entities", value: `${group.items.length}` },
      ],
      onConfirm: async () => {
        try {
          await api(`/entities/groups/${group.id}`, { method: "DELETE", token });
          if (editingGroupId === group.id) cancelEdit();
          setSelectedGroupId(null);
          await refresh();
          setStatusTone("ok");
          setStatus("Group deleted.");
          setTimeout(() => setStatus(""), 2500);
        } catch (err) {
          setStatusTone("error");
          setStatus(err instanceof ApiError ? err.message : "Failed to delete group");
          throw err;
        }
      },
    });
  }

  function toggleEntity(id: string) {
    setGroupForm((prev) => ({
      ...prev,
      entityIds: prev.entityIds.includes(id)
        ? prev.entityIds.filter((x) => x !== id)
        : [...prev.entityIds, id],
    }));
  }

  function selectAllVisible() {
    const ids = filteredEntities.map((e) => e.id);
    setGroupForm((prev) => ({
      ...prev,
      entityIds: Array.from(new Set([...prev.entityIds, ...ids])),
    }));
  }

  function clearSelection() {
    setGroupForm((prev) => ({ ...prev, entityIds: [] }));
  }

  return (
    <div className="module-shell module-catalog groups-studio">
      <ModuleHeader
        module="catalog"
        title="Entity groups"
        subtitle="Bundle hotels, stops, and experiences into reusable sets for itineraries and tour planning."
      />

      {status && (
        <p className={`groups-toast${statusTone === "error" ? " groups-toast--error" : ""}`}>
          {status}
        </p>
      )}

      <div className="groups-studio-layout">
        <form className="groups-form-card" onSubmit={saveGroup}>
          <div className="groups-form-card-head">
            <h3>{editingGroupId ? "Edit group" : "Create group"}</h3>
            <p className="muted">
              {editingGroupId
                ? "Add or remove entities below, rename it, then save your changes."
                : "Name your set, then pick entities from your catalog."}
            </p>
          </div>

          <div className="entity-form-grid">
            <div className="field full">
              <label htmlFor="group-name">Group name</label>
              <input
                id="group-name"
                type="text"
                placeholder="e.g. Cultural Triangle highlights"
                value={groupForm.name}
                onChange={(e) =>
                  setGroupForm((prev) => ({ ...prev, name: e.target.value }))
                }
                required
              />
            </div>
            <div className="field full">
              <label htmlFor="group-desc">Description</label>
              <RichTextEditor
                id="group-desc"
                rows={2}
                placeholder="Optional — when to use this bundle"
                value={groupForm.description}
                onChange={(description) =>
                  setGroupForm((prev) => ({ ...prev, description }))
                }
                aria-label="Group description"
              />
            </div>
          </div>

          <div className="groups-picker-section">
            <div className="groups-picker-head">
              <div>
                <h4>Entities in this group</h4>
                <p className="muted">
                  {groupForm.entityIds.length} selected
                  {entities.length === 0 && " — add entities in Entities first"}
                </p>
              </div>
              {entities.length > 0 && (
                <div className="groups-picker-tools">
                  <button type="button" className="mini-btn" onClick={selectAllVisible}>
                    Select visible
                  </button>
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={clearSelection}
                    disabled={groupForm.entityIds.length === 0}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {entities.length === 0 ? (
              <div className="groups-picker-empty">
                <p className="muted">No entities in your catalog yet.</p>
                <Link to="/dashboard/agency/all" className="btn btn-ghost">
                  Go to Entities → add entities
                </Link>
              </div>
            ) : (
              <>
                <div className="groups-picker-filters">
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
                    {entityTypes.map((t) => (
                      <option key={t} value={t}>
                        {formatType(t)}
                      </option>
                    ))}
                  </select>
                </div>

                <ul className="groups-entity-list" role="listbox" aria-label="Select entities">
                  {filteredEntities.length === 0 ? (
                    <li className="groups-entity-empty muted">No entities match your filters.</li>
                  ) : (
                    filteredEntities.map((ent) => {
                      const checked = groupForm.entityIds.includes(ent.id);
                      return (
                        <li key={ent.id}>
                          <label
                            className={`groups-entity-row${checked ? " groups-entity-row--selected" : ""}`}
                          >
                            <input
                              type="checkbox"
                              className="groups-entity-checkbox"
                              checked={checked}
                              onChange={() => toggleEntity(ent.id)}
                            />
                            <span className="groups-entity-icon" aria-hidden="true">
                              <EntityTypeLineIcon type={ent.type} size={16} />
                            </span>
                            <span className="groups-entity-info">
                              <span className="groups-entity-name">{ent.name}</span>
                              <span className="groups-entity-meta">
                                {formatType(ent.type)}
                                {ent.city ? ` · ${ent.city}` : ""}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })
                  )}
                </ul>
              </>
            )}
          </div>

          <div className="groups-form-actions">
            {editingGroupId && (
              <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
                Cancel
              </button>
            )}
            <button type="submit" className="btn btn-primary groups-submit" disabled={saving}>
              {saving
                ? editingGroupId
                  ? "Saving…"
                  : "Creating…"
                : editingGroupId
                  ? "Save changes"
                  : "Create group"}
            </button>
          </div>
          {!groupForm.name.trim() || groupForm.entityIds.length === 0 ? (
            <p className="muted" style={{ marginTop: 8, fontSize: "0.85rem" }}>
              {!groupForm.name.trim()
                ? "Enter a group name, then select entities and create."
                : "Select at least one entity, then create."}
            </p>
          ) : null}
        </form>

        <aside className="groups-library">
          <div className="groups-library-head">
            <h3>Your groups</h3>
            <span className="groups-count-badge">{groups.length}</span>
          </div>

          {groups.length === 0 ? (
            <div className="groups-library-empty">
              <p className="muted">No groups yet. Create one to bundle entities for faster tour building.</p>
            </div>
          ) : (
            <ul className="groups-library-list">
              {groups.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    className={`groups-library-card${selectedGroupId === g.id ? " active" : ""}`}
                    onClick={() => setSelectedGroupId(g.id)}
                  >
                    <strong>{g.name}</strong>
                    <span className="muted">{g.items.length} entities</span>
                    {g.description && !isRichTextEmpty(g.description) && (
                      <span className="groups-library-desc">
                        {stripRichHtml(g.description)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selectedGroup && (
            <div className="groups-detail">
              <div className="groups-detail-head">
                <h4>{selectedGroup.name}</h4>
                <button
                  type="button"
                  className="mini-btn"
                  onClick={() => setSelectedGroupId(null)}
                  aria-label="Close detail"
                >
                  Close
                </button>
              </div>
              {selectedGroup.description && !isRichTextEmpty(selectedGroup.description) && (
                <RichTextHtml
                  html={selectedGroup.description}
                  className="muted groups-detail-desc"
                />
              )}
              <div className="groups-detail-actions">
                <button type="button" className="mini-btn" onClick={() => startEdit(selectedGroup)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="mini-btn"
                  onClick={() => startDuplicate(selectedGroup)}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="mini-btn"
                  onClick={() => deleteGroup(selectedGroup)}
                >
                  Delete
                </button>
              </div>
              <ul className="groups-detail-entities">
                {selectedGroup.items.map((item) => (
                  <li key={item.entity.id}>
                    <EntityTypeLineIcon type={item.entity.type} size={14} />
                    <span>
                      {item.entity.name}
                      <span className="muted">
                        {" "}
                        · {formatType(item.entity.type)}
                        {item.entity.city ? ` · ${item.entity.city}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
