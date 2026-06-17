import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { CommissionNegotiationPanel } from "../../components/commission/CommissionNegotiationPanel";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import {
  isCommissionNegotiationOpen,
  type CommissionNegotiation,
} from "../../lib/commissionNegotiationTypes";

export function InfluencerCommissionRequestsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<CommissionNegotiation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api<CommissionNegotiation[]>("/influencer/commission-requests", { token });
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const openRows = useMemo(
    () => rows.filter((r) => isCommissionNegotiationOpen(r)),
    [rows]
  );
  const closedRows = useMemo(
    () => rows.filter((r) => !isCommissionNegotiationOpen(r)),
    [rows]
  );

  function handleUpdated(updated: CommissionNegotiation) {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  if (!token) return null;

  return (
    <div className="module-shell module-partner">
      <ModuleHeader
        module="partner"
        title="Commission negotiations"
        subtitle="Track requests and counter-offers with agencies. Agree, reject, or negotiate until you reach a rate."
      />

      {loading ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No commission negotiations yet. Request a custom rate when featuring a tour.</p>
      ) : (
        <>
          {openRows.length > 0 && (
            <section className="commission-tasks-section">
              <h2 className="commission-tasks-section__title">Open ({openRows.length})</h2>
              <ul className="commission-tasks-list">
                {openRows.map((row) => (
                  <li key={row.id}>
                    <CommissionNegotiationPanel
                      row={row}
                      viewerRole="INFLUENCER"
                      token={token}
                      onUpdated={handleUpdated}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {closedRows.length > 0 && (
            <section className="commission-tasks-section">
              <h2 className="commission-tasks-section__title">Closed</h2>
              <ul className="commission-tasks-list">
                {closedRows.map((row) => (
                  <li key={row.id}>
                    <CommissionNegotiationPanel
                      row={row}
                      viewerRole="INFLUENCER"
                      token={token}
                      onUpdated={handleUpdated}
                      compact
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
