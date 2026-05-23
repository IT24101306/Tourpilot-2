import { FormEvent, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { AgencyEntity, AgencyGroup } from "./types";

export function AgencyGroupsPage() {
  const { token } = useAuth();
  const [groups, setGroups] = useState<AgencyGroup[]>([]);
  const [entities, setEntities] = useState<AgencyEntity[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<AgencyGroup | null>(null);
  const [groupForm, setGroupForm] = useState({ name: "", description: "", entityIds: [] as string[] });

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api<AgencyGroup[]>("/entities/groups", { token }),
      api<AgencyEntity[]>("/entities", { token }),
    ]).then(([g, e]) => {
      setGroups(g);
      setEntities(e);
    });
  }, [token]);

  async function refresh() {
    if (!token) return;
    const g = await api<AgencyGroup[]>("/entities/groups", { token });
    setGroups(g);
  }

  async function createGroup(e: FormEvent) {
    e.preventDefault();
    if (!token || !groupForm.name.trim()) return;
    await api("/entities/groups", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: groupForm.name,
        description: groupForm.description || undefined,
        entityIds: groupForm.entityIds,
      }),
    });
    setGroupForm({ name: "", description: "", entityIds: [] });
    await refresh();
  }

  function toggleEntity(id: string) {
    setGroupForm((prev) => ({
      ...prev,
      entityIds: prev.entityIds.includes(id)
        ? prev.entityIds.filter((x) => x !== id)
        : [...prev.entityIds, id],
    }));
  }

  return (
    <>
      <div className="agency-panel-head">
        <h2>Groups</h2>
        <p>Open a group to view all entities linked to that group.</p>
      </div>

      <form className="form-grid agency-panel" onSubmit={createGroup}>
        <h3>Create group</h3>
        <input
          placeholder="Group name"
          value={groupForm.name}
          onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
          required
        />
        <input
          placeholder="Description (optional)"
          value={groupForm.description}
          onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
        />
        {entities.length > 0 && (
          <div className="agency-entity-picks">
            <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>
              Select entities to include:
            </p>
            {entities.map((ent) => (
              <label key={ent.id} className="agency-entity-pick">
                <input
                  type="checkbox"
                  checked={groupForm.entityIds.includes(ent.id)}
                  onChange={() => toggleEntity(ent.id)}
                />
                {ent.name} ({ent.type})
              </label>
            ))}
          </div>
        )}
        <button type="submit" className="btn btn-primary">
          Create group
        </button>
      </form>

      {groups.length === 0 ? (
        <p className="muted empty-text">No groups created yet.</p>
      ) : (
        <div className="agency-group-cards">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className="agency-group-card"
              onClick={() => setSelectedGroup(g)}
            >
              <strong>{g.name}</strong>
              <span className="muted">{g.items.length} entities</span>
            </button>
          ))}
        </div>
      )}

      {selectedGroup && (
        <div className="agency-panel" style={{ marginTop: 16 }}>
          <h3>{selectedGroup.name}</h3>
          {selectedGroup.description && <p className="muted">{selectedGroup.description}</p>}
          <div className="agency-table-wrap">
            <table className="agency-table">
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Type</th>
                  <th>City</th>
                </tr>
              </thead>
              <tbody>
                {selectedGroup.items.map((item) => (
                  <tr key={item.entity.id}>
                    <td>{item.entity.name}</td>
                    <td>{item.entity.type}</td>
                    <td>{item.entity.city || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setSelectedGroup(null)}>
            Close
          </button>
        </div>
      )}
    </>
  );
}
