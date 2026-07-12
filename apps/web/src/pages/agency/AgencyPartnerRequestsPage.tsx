import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { CommissionNegotiationPanel } from "../../components/commission/CommissionNegotiationPanel";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import type { CommissionNegotiation } from "../../lib/commissionNegotiationTypes";

export function AgencyPartnerRequestsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<CommissionNegotiation[]>([]);
  const [filter, setFilter] = useState<"all" | "PENDING" | "NEGOTIATING" | "APPROVED" | "REJECTED">("PENDING");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const q = filter === "all" ? "" : `?status=${filter}`;
      const data = await api<CommissionNegotiation[]>(
        `/agencies/mine/influencer-commission-requests${q}`,
        { token }
      );
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleUpdated(updated: CommissionNegotiation) {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  return (
    <div className="module-shell module-agency">
      <ModuleHeader
        module="partner"
        title="Influencer commission requests"
        subtitle="Negotiate custom commission rates with influencers — agree, reject, or counter-offer."
      />

      <div className="partner-toolbar">
        <label className="partner-filter">
          <span className="muted">Status</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="PENDING">Pending</option>
            <option value="NEGOTIATING">Negotiating</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No commission requests in this view.</p>
      ) : (
        <ul className="commission-tasks-list">
          {rows.map((row) => (
            <li key={row.id}>
              {token && (
                <CommissionNegotiationPanel
                  row={row}
                  viewerRole="AGENCY"
                  token={token}
                  onUpdated={handleUpdated}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
