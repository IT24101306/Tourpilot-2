import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { TaskBoard } from "../../components/tasks/TaskBoard";
import { CommissionNegotiationPanel } from "../../components/commission/CommissionNegotiationPanel";
import { buildAgencyTasks } from "./taskUtils";
import type { AgencyInquiry } from "./types";
import {
  isCommissionNegotiationOpen,
  type CommissionNegotiation,
} from "../../lib/commissionNegotiationTypes";

export function AgencyTasksPage() {
  const { user, token } = useAuth();
  const [inquiries, setInquiries] = useState<AgencyInquiry[]>([]);
  const [commissionRows, setCommissionRows] = useState<CommissionNegotiation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [inq, commissions] = await Promise.all([
        api<AgencyInquiry[]>("/inquiries/mine", { token }),
        api<CommissionNegotiation[]>("/agencies/mine/influencer-commission-requests?status=all", {
          token,
        }),
      ]);
      setInquiries(inq);
      setCommissionRows(commissions);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const tasks = useMemo(
    () => buildAgencyTasks(inquiries, commissionRows),
    [inquiries, commissionRows]
  );

  const openCommissions = useMemo(
    () =>
      commissionRows.filter(
        (r) => isCommissionNegotiationOpen(r) && r.pendingActor === "AGENCY"
      ),
    [commissionRows]
  );

  function handleCommissionUpdated(updated: CommissionNegotiation) {
    setCommissionRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  if (!user || !token) return null;

  return (
    <div className="module-shell module-tasks">
      <ModuleHeader
        module="tasks"
        title="Execution checklist"
        subtitle="Inquiries, commission negotiations, and auto-generated next actions."
      />

      {loading ? (
        <p className="muted">Loading tasks…</p>
      ) : (
        <>
          {openCommissions.length > 0 && (
            <section className="commission-tasks-section">
              <h2 className="commission-tasks-section__title">
                Commission negotiations ({openCommissions.length})
              </h2>
              <p className="muted commission-tasks-section__lead">
                Influencers requested a custom commission rate. Agree, reject, or send a counter-offer.
              </p>
              <ul className="commission-tasks-list">
                {openCommissions.map((row) => (
                  <li key={row.id}>
                    <CommissionNegotiationPanel
                      row={row}
                      viewerRole="AGENCY"
                      token={token}
                      onUpdated={handleCommissionUpdated}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <TaskBoard
            userId={user.id}
            generated={tasks}
            emptyMessage="All caught up. New tasks appear when inquiries or commission requests need action."
          />
        </>
      )}
    </div>
  );
}
