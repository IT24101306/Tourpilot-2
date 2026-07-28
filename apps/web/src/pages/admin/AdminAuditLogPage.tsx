import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";

type AuditActor = {
  id: string;
  name: string | null;
  phone: string | null;
  role: string | null;
} | null;

type AuditEventRow = {
  id: string;
  createdAt: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  action: string;
  summary: string;
  before: unknown;
  after: unknown;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  relatedInquiryId: string | null;
  actor: AuditActor;
  agency: { id: string; name: string; slug: string } | null;
};

const ENTITY_TYPES = [
  "",
  "TOUR",
  "OFFER",
  "ENTITY",
  "AGENCY_FEATURES",
  "PLATFORM_SETTINGS",
  "CMS_PAGE",
  "VOUCHER",
] as const;

const ACTIONS = ["", "CREATE", "UPDATE", "DELETE", "PUBLISH", "UNPUBLISH"] as const;

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function AdminAuditLogPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<AuditEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams();
    if (entityType) params.set("entityType", entityType);
    if (action) params.set("action", action);
    if (q.trim()) params.set("q", q.trim());
    params.set("take", "300");
    setLoading(true);
    setError("");
    api<AuditEventRow[]>(`/admin/audit-events?${params.toString()}`, { token })
      .then((data) => {
        setRows(data);
        setSelectedId((prev) => (prev && data.some((r) => r.id === prev) ? prev : data[0]?.id ?? null));
      })
      .catch((err) => {
        console.error(err);
        const message =
          err instanceof Error ? err.message : "Failed to load audit events";
        setError(message);
        setRows([]);
        setSelectedId(null);
      })
      .finally(() => setLoading(false));
  }, [token, entityType, action, q]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const changeEntries = useMemo(() => {
    if (!selected?.changes || typeof selected.changes !== "object") return [];
    return Object.entries(selected.changes);
  }, [selected]);

  return (
    <div className="module-shell module-governance">
      <ModuleHeader
        module="governance"
        title="Audit trail"
        subtitle="Pricing, package content, availability, and service changes — retained for dispute evidence."
      />

      <div className="form-grid" style={{ maxWidth: 960, marginBottom: 16, gridTemplateColumns: "1fr 1fr 2fr" }}>
        <label>
          Type
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            {ENTITY_TYPES.map((t) => (
              <option key={t || "all"} value={t}>
                {t || "All types"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Action
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            {ACTIONS.map((a) => (
              <option key={a || "all"} value={a}>
                {a || "All actions"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Search
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Summary, label, actor, id…"
          />
        </label>
      </div>

      {error ? (
        <p className="muted" role="alert" style={{ color: "#b91c1c" }}>
          Could not load audit trail: {error}
          {/does not exist|P2021|Unknown table|AuditEvent/i.test(error)
            ? " — the AuditEvent table is probably missing. Run prisma db push on the API (container entrypoint or manual)."
            : ""}
        </p>
      ) : null}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : error ? null : rows.length === 0 ? (
        <p className="muted">No audit events yet. Changes to tours, offers, entities, and settings will appear here.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 16 }}>
          <div className="gov-table-wrap">
            <table className="agency-table gov-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>What</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    style={{
                      cursor: "pointer",
                      background: selectedId === r.id ? "color-mix(in srgb, var(--brand-accent-teal, #1fa19d) 12%, #fff)" : undefined,
                    }}
                  >
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                    <td>
                      {r.actor?.name || "—"}
                      <br />
                      <span className="muted">
                        {r.actor?.role || "—"}
                        {r.actor?.phone ? ` · ${r.actor.phone}` : ""}
                      </span>
                    </td>
                    <td>
                      <strong>{r.entityLabel || r.entityId}</strong>
                      <br />
                      <span className="muted">
                        {r.entityType}
                        {r.agency ? ` · ${r.agency.name}` : ""}
                      </span>
                    </td>
                    <td>{r.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="gov-panel" style={{ alignSelf: "start" }}>
            {selected ? (
              <>
                <p style={{ marginTop: 0 }}>
                  <strong>{selected.summary}</strong>
                </p>
                <p className="muted" style={{ marginTop: 0 }}>
                  {new Date(selected.createdAt).toLocaleString()} · {selected.entityType} · {selected.action}
                  <br />
                  ID {selected.entityId}
                  {selected.agency ? ` · Agency ${selected.agency.name}` : ""}
                </p>

                {changeEntries.length > 0 ? (
                  <>
                    <h3 style={{ fontSize: "0.95rem", marginBottom: 8 }}>Changed fields</h3>
                    <div className="gov-table-wrap">
                      <table className="agency-table gov-table">
                        <thead>
                          <tr>
                            <th>Field</th>
                            <th>Previous</th>
                            <th>Updated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {changeEntries.map(([field, diff]) => (
                            <tr key={field}>
                              <td>
                                <code>{field}</code>
                              </td>
                              <td>
                                <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>
                                  {formatValue(diff.from)}
                                </pre>
                              </td>
                              <td>
                                <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>
                                  {formatValue(diff.to)}
                                </pre>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="muted">No field-level diff (create/delete or identical snapshot).</p>
                )}

                <details style={{ marginTop: 12 }}>
                  <summary>Full previous value</summary>
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, maxHeight: 240, overflow: "auto" }}>
                    {formatValue(selected.before)}
                  </pre>
                </details>
                <details style={{ marginTop: 8 }}>
                  <summary>Full updated value</summary>
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, maxHeight: 240, overflow: "auto" }}>
                    {formatValue(selected.after)}
                  </pre>
                </details>
              </>
            ) : (
              <p className="muted">Select a row to inspect previous and updated values.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
