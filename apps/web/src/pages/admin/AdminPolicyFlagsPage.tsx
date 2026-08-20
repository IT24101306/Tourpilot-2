import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import type { AdminPolicyViolation } from "./types";

const FILTERS = [
  { value: "OPEN", label: "Open" },
  { value: "REVIEWED", label: "Reviewed" },
  { value: "DISMISSED", label: "Dismissed" },
  { value: "ALL", label: "All" },
] as const;

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function AdminPolicyFlagsPage() {
  const { token } = useAuth();
  const { requestConfirm } = useConfirmAction();
  const [rows, setRows] = useState<AdminPolicyViolation[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("OPEN");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api<AdminPolicyViolation[]>(
        `/admin/policy-violations?status=${statusFilter}`,
        { token }
      );
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  function review(row: AdminPolicyViolation, status: "REVIEWED" | "DISMISSED") {
    if (!token) return;
    const resume = row.chatPaused;
    requestConfirm({
      title: status === "REVIEWED" ? "Mark as reviewed?" : "Dismiss this flag?",
      description: resume
        ? "This chat is paused. Confirming will reopen messaging for the tourist and agency."
        : "The chat is already open. This only updates the flag status.",
      confirmLabel: resume ? "Review and resume chat" : status === "REVIEWED" ? "Mark reviewed" : "Dismiss",
      variant: status === "DISMISSED" ? "danger" : "default",
      summary: [
        { label: "Person", value: row.offender.name },
        { label: "Role", value: row.offenderRole.toLowerCase() },
        { label: "Detected", value: row.categoryLabels.join(", ") || "—" },
        { label: "Trip", value: `${row.tourist.name} × ${row.agency.name}` },
      ],
      onConfirm: async () => {
        setWorkingId(row.id);
        setMsg("");
        try {
          await api(`/admin/policy-violations/${row.id}`, {
            method: "PATCH",
            token,
            body: JSON.stringify({ status, resumeChat: resume }),
          });
          setMsg(resume ? "Flag reviewed and chat resumed." : "Flag updated.");
          await load();
        } catch {
          setMsg("Update failed.");
        } finally {
          setWorkingId(null);
        }
      },
    });
  }

  return (
    <div className="module-shell module-governance">
      <ModuleHeader
        module="governance"
        title="Policy flags"
        subtitle="Messages blocked for sharing phone numbers, email, social links, or other personal contact details."
      />

      <div className="gov-toolbar">
        <select
          className="agency-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {msg && <p className="gov-status-msg">{msg}</p>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No policy flags in this view.</p>
      ) : (
        <div className="gov-table-wrap">
          <table className="agency-table gov-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Person</th>
                <th>Detected</th>
                <th>Removed message</th>
                <th>Trip</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {formatWhen(row.createdAt)}
                    {row.chatPaused ? (
                      <>
                        <br />
                        <span className="gov-status-badge">Chat paused</span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    <strong>{row.offender.name}</strong>
                    <br />
                    <span className="muted">{row.offenderRole.toLowerCase()}</span>
                    <br />
                    <span className="muted">{row.offender.phone}</span>
                  </td>
                  <td>{row.categoryLabels.join(", ") || "—"}</td>
                  <td>
                    <p className="muted" style={{ margin: 0, maxWidth: 280, whiteSpace: "pre-wrap" }}>
                      {row.originalBody}
                    </p>
                  </td>
                  <td>
                    {row.tourist.name}
                    <br />
                    <span className="muted">{row.agency.name}</span>
                  </td>
                  <td>
                    <span className="gov-status-badge">{row.status.toLowerCase()}</span>
                  </td>
                  <td className="gov-table-actions">
                    <Link
                      to={`/dashboard/admin/inquiries/${row.inquiryId}/trip-room`}
                      className="btn btn-ghost btn-nav"
                    >
                      Trip room
                    </Link>
                    {row.status === "OPEN" ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-nav"
                          disabled={workingId === row.id}
                          onClick={() => review(row, "REVIEWED")}
                        >
                          Review
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-nav"
                          disabled={workingId === row.id}
                          onClick={() => review(row, "DISMISSED")}
                        >
                          Dismiss
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
