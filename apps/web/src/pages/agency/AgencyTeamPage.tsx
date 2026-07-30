import { FormEvent, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { OpsMetricStrip } from "../../components/module/OpsMetricStrip";
import "../../styles/dashboard.css";

type TeamUser = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  isActive: boolean;
};

type StaffRow = {
  id: string;
  title: string | null;
  createdAt: string;
  role: "staff";
  user: TeamUser;
};

type TeamPayload = {
  isOwner: boolean;
  owner: (TeamUser & { role: "owner" }) | null;
  staff: StaffRow[];
};

const emptyForm = () => ({ name: "", phone: "", title: "" });

export function AgencyTeamPage() {
  const { token, user } = useAuth();
  const { requestConfirm } = useConfirmAction();
  const [data, setData] = useState<TeamPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const isOwner = user?.agencyMembership === "owner";

  async function refresh() {
    if (!token) return;
    const payload = await api<TeamPayload>("/agencies/mine/staff", { token });
    setData(payload);
  }

  useEffect(() => {
    if (!token || !isOwner) return;
    setLoading(true);
    refresh()
      .catch((err) => {
        console.error(err);
        setStatus(err instanceof ApiError ? err.message : "Could not load team.");
      })
      .finally(() => setLoading(false));
  }, [token, isOwner]);

  if (user && user.agencyMembership !== "owner") {
    return <Navigate to="/dashboard/agency" replace />;
  }

  function openInvite() {
    setForm(emptyForm());
    setStatus("");
    setModalOpen(true);
  }

  function inviteStaff(e: FormEvent) {
    e.preventDefault();
    if (!token || !form.name.trim() || !form.phone.trim()) return;

    requestConfirm({
      title: "Invite staff member?",
      description: "They can log in with this phone and OTP and manage your agency dashboard.",
      confirmLabel: "Invite staff",
      summary: [
        { label: "Name", value: form.name.trim() },
        { label: "Phone", value: form.phone.trim() },
        { label: "Title", value: form.title.trim() || "—" },
      ],
      onConfirm: async () => {
        setSaving(true);
        setStatus("");
        try {
          await api("/agencies/mine/staff", {
            method: "POST",
            token,
            body: JSON.stringify({
              name: form.name.trim(),
              phone: form.phone.trim(),
              title: form.title.trim() || undefined,
            }),
          });
          setModalOpen(false);
          setForm(emptyForm());
          setStatus("Staff invited. They can log in at /login with that phone and OTP.");
          await refresh();
        } catch (err) {
          setStatus(err instanceof ApiError ? err.message : "Invite failed.");
        } finally {
          setSaving(false);
        }
      },
    });
  }

  function removeStaff(row: StaffRow) {
    if (!token) return;
    requestConfirm({
      title: "Remove from team?",
      description: "They will lose access to this agency dashboard. Their account is kept.",
      confirmLabel: "Remove staff",
      variant: "danger",
      summary: [
        { label: "Name", value: row.user.name },
        { label: "Phone", value: row.user.phone },
        { label: "Title", value: row.title || "—" },
      ],
      onConfirm: async () => {
        setStatus("");
        try {
          await api(`/agencies/mine/staff/${row.id}`, { method: "DELETE", token });
          setStatus(`${row.user.name} removed from the team.`);
          await refresh();
        } catch (err) {
          setStatus(err instanceof ApiError ? err.message : "Remove failed.");
        }
      },
    });
  }

  return (
    <div className="module-shell module-operations">
      <ModuleHeader
        module="operations"
        title="Team"
        subtitle="Invite staff to manage bookings, tours, and trip rooms with your agency."
      >
        <button type="button" className="btn btn-primary" onClick={openInvite}>
          Invite staff
        </button>
      </ModuleHeader>

      {status && <p className="gov-status-msg">{status}</p>}

      <OpsMetricStrip
        metrics={[
          {
            id: "owner",
            label: "Owner",
            value: data?.owner ? 1 : 0,
            hint: "Account owner",
          },
          {
            id: "staff",
            label: "Staff",
            value: data?.staff.length ?? 0,
            hint: "Invited teammates",
          },
          {
            id: "total",
            label: "Total",
            value: (data?.owner ? 1 : 0) + (data?.staff.length ?? 0),
            hint: "People with access",
          },
        ]}
      />

      {loading || !data ? (
        <p className="muted">Loading team…</p>
      ) : (
        <div className="table-wrap">
          <table className="hotel-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Title</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.owner && (
                <tr>
                  <td>
                    <strong>{data.owner.name}</strong>
                  </td>
                  <td>{data.owner.phone}</td>
                  <td>Owner</td>
                  <td className="muted">Account owner</td>
                  <td className="muted">—</td>
                </tr>
              )}
              {data.staff.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.user.name}</strong>
                  </td>
                  <td>{row.user.phone}</td>
                  <td>Staff</td>
                  <td>{row.title || <span className="muted">—</span>}</td>
                  <td>
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() => removeStaff(row)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {!data.staff.length && (
                <tr>
                  <td colSpan={5} className="empty-text">
                    No staff yet. Click &quot;Invite staff&quot; to add a teammate by phone.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="gov-modal-backdrop" role="presentation" onClick={() => setModalOpen(false)}>
          <div
            className="gov-modal"
            role="dialog"
            aria-labelledby="invite-staff-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="invite-staff-title">Invite staff</h3>
            <form onSubmit={inviteStaff}>
              <label>
                Name
                <input
                  required
                  minLength={2}
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Operations lead"
                />
              </label>
              <label>
                Phone (with country code)
                <input
                  required
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+94771234567"
                />
              </label>
              <label>
                Title (optional)
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Operations"
                />
              </label>
              <p className="muted">They use this phone at login with OTP. No separate signup needed.</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Inviting…" : "Invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
