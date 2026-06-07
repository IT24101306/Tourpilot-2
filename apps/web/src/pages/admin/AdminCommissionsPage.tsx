import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { COMMISSION_STATUSES, type AdminCommission } from "./types";

export function AdminCommissionsPage() {
  const { token } = useAuth();
  const { requestConfirm } = useConfirmAction();
  const [rows, setRows] = useState<AdminCommission[]>([]);
  const [filter, setFilter] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const q = filter ? `?status=${filter}` : "";
    const data = await api<AdminCommission[]>(`/admin/commissions${q}`, { token });
    setRows(data);
    setLoading(false);
  }, [token, filter]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  function setStatus(commission: AdminCommission, status: string) {
    if (!token) return;
    const labels: Record<string, string> = {
      APPROVED: "Approve commission",
      PAID: "Mark commission paid",
      CANCELLED: "Cancel commission",
    };
    requestConfirm({
      title: labels[status] ?? "Update commission?",
      description:
        status === "PAID"
          ? "Credits the influencer wallet and records a payout."
          : "This updates the commission lifecycle for this referral.",
      confirmLabel: labels[status] ?? "Confirm",
      variant: status === "CANCELLED" ? "danger" : "default",
      summary: [
        { label: "Influencer", value: commission.influencer.name },
        { label: "Code", value: commission.code },
        { label: "Amount", value: `LKR ${commission.amountLkr.toLocaleString()}` },
        { label: "Trip", value: `${commission.inquiry.tourist.name} → ${commission.inquiry.agency.name}` },
        { label: "Current status", value: commission.status },
        { label: "New status", value: status },
      ],
      onConfirm: async () => {
        setWorkingId(commission.id);
        try {
          await api(`/admin/commissions/${commission.id}`, {
            method: "PATCH",
            token,
            body: JSON.stringify({ status }),
          });
          await load();
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
        title="Commissions"
        subtitle="Partner payouts tied to referral conversions."
      />

      <div className="gov-toolbar">
        <select className="agency-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All</option>
          {COMMISSION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="gov-table-wrap">
          <table className="agency-table gov-table">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Code</th>
                <th>Amount</th>
                <th>Inquiry</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.influencer.name}
                    <br />
                    <span className="muted">{c.influencer.phone}</span>
                  </td>
                  <td>{c.code}</td>
                  <td>LKR {c.amountLkr.toLocaleString()}</td>
                  <td>
                    {c.inquiry.tourist.name} → {c.inquiry.agency.name}
                    <br />
                    <span className="muted">{c.inquiry.status}</span>
                  </td>
                  <td>{c.status}</td>
                  <td className="gov-table-actions">
                    {c.status === "PENDING" && (
                      <button
                        type="button"
                        className="btn btn-primary btn-nav"
                        disabled={workingId === c.id}
                        onClick={() => setStatus(c, "APPROVED")}
                      >
                        Approve
                      </button>
                    )}
                    {c.status === "APPROVED" && (
                      <button
                        type="button"
                        className="btn btn-teal btn-nav"
                        disabled={workingId === c.id}
                        onClick={() => setStatus(c, "PAID")}
                      >
                        Mark paid
                      </button>
                    )}
                    {c.status !== "CANCELLED" && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-nav"
                        disabled={workingId === c.id}
                        onClick={() => setStatus(c, "CANCELLED")}
                      >
                        Cancel
                      </button>
                    )}
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
