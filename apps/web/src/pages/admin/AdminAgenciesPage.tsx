import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { RejectAgencyModal } from "../../components/admin/RejectAgencyModal";
import type { AdminAgency } from "./types";

const STATUSES = ["", "PENDING", "APPROVED", "SUSPENDED", "REJECTED"] as const;

export function AdminAgenciesPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<AdminAgency[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const q = filter ? `?status=${filter}` : "";
    const data = await api<AdminAgency[]>(`/admin/agencies${q}`, { token });
    setRows(data);
    setLoading(false);
  }, [token, filter]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  async function setStatus(id: string, status: string) {
    if (!token) return;
    setWorkingId(id);
    try {
      await api(`/admin/agencies/${id}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      setMsg(`Status updated to ${status}.`);
      await load();
    } catch {
      setMsg("Update failed.");
    } finally {
      setWorkingId(null);
    }
  }

  async function reject(reason: string, sendEmail: boolean) {
    if (!token || !rejectTarget) return;
    setWorkingId(rejectTarget.id);
    try {
      await api(`/admin/agencies/${rejectTarget.id}/reject`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ reason, sendEmail }),
      });
      setMsg("Agency rejected.");
      setRejectTarget(null);
      await load();
    } catch {
      setMsg("Rejection failed.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="module-shell module-governance">
      <ModuleHeader module="governance" title="Agencies" subtitle="Full marketplace operator control." />

      <div className="gov-toolbar">
        <select
          className="agency-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter by status"
        >
          {STATUSES.map((s) => (
            <option key={s || "all"} value={s}>
              {s || "All statuses"}
            </option>
          ))}
        </select>
      </div>

      {msg && <p className="gov-status-msg">{msg}</p>}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="gov-table-wrap">
          <table className="agency-table gov-table">
            <thead>
              <tr>
                <th>Agency</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Tours</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.name}</strong>
                    <br />
                    <span className="muted">{a.slug}</span>
                    {a.rejectionReason && (
                      <p className="gov-inline-warn">Rejected: {a.rejectionReason}</p>
                    )}
                  </td>
                  <td>
                    {a.owner.name}
                    <br />
                    <span className="muted">{a.owner.phone}</span>
                  </td>
                  <td>
                    <span className={`gov-status-badge gov-status-badge--${a.status.toLowerCase()}`}>
                      {a.status}
                    </span>
                  </td>
                  <td>{a.tourCount}</td>
                  <td className="gov-table-actions">
                    {a.status === "APPROVED" && (
                      <Link to={`/agencies/${a.slug}`} className="btn btn-ghost btn-nav" target="_blank">
                        View
                      </Link>
                    )}
                    {a.status === "PENDING" && (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-nav"
                          disabled={workingId === a.id}
                          onClick={() => setStatus(a.id, "APPROVED")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-nav gov-btn-danger-outline"
                          onClick={() => setRejectTarget({ id: a.id, name: a.name })}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {a.status === "APPROVED" && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-nav"
                        disabled={workingId === a.id}
                        onClick={() => setStatus(a.id, "SUSPENDED")}
                      >
                        Suspend
                      </button>
                    )}
                    {(a.status === "SUSPENDED" || a.status === "REJECTED") && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-nav"
                        disabled={workingId === a.id}
                        onClick={() => setStatus(a.id, "APPROVED")}
                      >
                        Reinstate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RejectAgencyModal
        agencyName={rejectTarget?.name ?? ""}
        open={!!rejectTarget}
        loading={!!workingId}
        onClose={() => setRejectTarget(null)}
        onConfirm={reject}
      />
    </div>
  );
}
