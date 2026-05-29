import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { InquiryStatusModal } from "../../components/admin/InquiryStatusModal";
import { INQUIRY_STATUSES, type AdminInquiry } from "./types";

export function AdminInquiriesPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<AdminInquiry[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [edit, setEdit] = useState<AdminInquiry | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const q = statusFilter ? `?status=${statusFilter}` : "";
    const data = await api<AdminInquiry[]>(`/admin/inquiries${q}`, { token });
    setRows(data);
    setLoading(false);
  }, [token, statusFilter]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  async function overrideStatus(status: string, note: string) {
    if (!token || !edit) return;
    setSaving(true);
    try {
      await api(`/admin/inquiries/${edit.id}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status, note: note || undefined }),
      });
      setMsg("Inquiry status updated.");
      setEdit(null);
      await load();
    } catch {
      setMsg("Update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="module-shell module-governance">
      <ModuleHeader
        module="governance"
        title="Inquiries"
        subtitle="Override trip status when agencies or tourists need platform support."
      />

      <div className="gov-toolbar">
        <select
          className="agency-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {INQUIRY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
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
                <th>Trip</th>
                <th>Tourist</th>
                <th>Agency</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td>
                    {i.tour?.title ?? i.type}
                    <br />
                    <span className="muted">{i.pax} pax</span>
                  </td>
                  <td>
                    {i.tourist.name}
                    <br />
                    <span className="muted">{i.tourist.phone}</span>
                  </td>
                  <td>{i.agency.name}</td>
                  <td>
                    <span className="gov-status-badge">{i.status.replace(/_/g, " ")}</span>
                  </td>
                  <td className="gov-table-actions">
                    <Link to={`/trips/${i.id}`} className="btn btn-ghost btn-nav" target="_blank">
                      Trip room
                    </Link>
                    <button
                      type="button"
                      className="btn btn-primary btn-nav"
                      onClick={() => setEdit(i)}
                    >
                      Override
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edit && (
        <InquiryStatusModal
          inquiryId={edit.id}
          currentStatus={edit.status}
          open
          loading={saving}
          onClose={() => setEdit(null)}
          onConfirm={overrideStatus}
        />
      )}
    </div>
  );
}
