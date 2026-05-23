import { FormEvent, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { AgencyEntity } from "./types";

const ENTITY_TYPES = ["HOTEL", "VIEWPOINT", "ACTIVITY", "RESTAURANT", "TRANSPORT", "FREE_TIME", "OTHER"];

export function AgencyAllEntitiesPage() {
  const { token } = useAuth();
  const [entities, setEntities] = useState<AgencyEntity[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [entityForm, setEntityForm] = useState({
    name: "",
    type: "HOTEL",
    city: "",
    priceHint: "",
  });

  useEffect(() => {
    if (!token) return;
    refresh(token);
  }, [token]);

  async function refresh(authToken: string) {
    const path = typeFilter === "all" ? "/entities" : `/entities?type=${typeFilter}`;
    const list = await api<AgencyEntity[]>(path, { token: authToken });
    setEntities(list);
  }

  useEffect(() => {
    if (token) refresh(token);
  }, [typeFilter, token]);

  async function addEntity(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    await api("/entities", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: entityForm.name,
        type: entityForm.type,
        city: entityForm.city,
        priceHint: entityForm.priceHint ? Number(entityForm.priceHint) : undefined,
      }),
    });
    setEntityForm({ name: "", type: "HOTEL", city: "", priceHint: "" });
    refresh(token);
  }

  return (
    <>
      <div className="agency-panel-head">
        <h2>All Added Entities</h2>
        <p>Every entity you create appears here.</p>
      </div>

      <div className="agency-tools">
        <select
          className="agency-filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by type"
        >
          <option value="all">All Types</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      <form className="form-grid agency-panel" onSubmit={addEntity}>
        <h3>Add entity</h3>
        <input
          placeholder="Name"
          value={entityForm.name}
          onChange={(e) => setEntityForm({ ...entityForm, name: e.target.value })}
          required
        />
        <select
          value={entityForm.type}
          onChange={(e) => setEntityForm({ ...entityForm, type: e.target.value })}
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          placeholder="City"
          value={entityForm.city}
          onChange={(e) => setEntityForm({ ...entityForm, city: e.target.value })}
        />
        <input
          placeholder="Price hint LKR"
          value={entityForm.priceHint}
          onChange={(e) => setEntityForm({ ...entityForm, priceHint: e.target.value })}
        />
        <button type="submit" className="btn btn-primary">
          Add entity
        </button>
      </form>

      <div className="agency-table-wrap" style={{ marginTop: 16 }}>
        <table className="agency-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>City</th>
              <th>Price hint</th>
            </tr>
          </thead>
          <tbody>
            {entities.map((ent) => (
              <tr key={ent.id}>
                <td>{ent.name}</td>
                <td>{ent.type}</td>
                <td>{ent.city || "—"}</td>
                <td>{ent.priceHint != null ? `LKR ${ent.priceHint.toLocaleString()}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {entities.length === 0 && <p className="muted" style={{ padding: 12 }}>No entities yet.</p>}
      </div>
    </>
  );
}
