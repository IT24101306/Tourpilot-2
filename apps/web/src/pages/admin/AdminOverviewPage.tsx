import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { AdminCommandHub } from "../../components/admin/AdminCommandHub";
import { ApprovalQueue } from "../../components/admin/ApprovalQueue";
import { RejectAgencyModal } from "../../components/admin/RejectAgencyModal";
import type { AdminStats } from "./types";

type PendingAgency = {
  id: string;
  name: string;
  owner: { name: string; phone: string; email?: string | null };
};

export function AdminOverviewPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pending, setPending] = useState<PendingAgency[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [rejectTarget, setRejectTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      api<AdminStats>("/admin/stats", { token }),
      api<PendingAgency[]>("/admin/agencies/pending", { token }),
    ])
      .then(([s, p]) => {
        setStats(s);
        setPending(p);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const userTotal = useMemo(() => {
    if (!stats) return 0;
    return Object.values(stats.users).reduce((a, b) => a + b, 0);
  }, [stats]);

  async function approve(id: string) {
    if (!token) return;
    setWorkingId(id);
    setStatus("");
    try {
      await api(`/admin/agencies/${id}/approve`, { method: "PATCH", token });
      setPending((p) => p.filter((a) => a.id !== id));
      setStatus("Agency approved.");
      const s = await api<AdminStats>("/admin/stats", { token });
      setStats(s);
    } catch {
      setStatus("Approval failed.");
    } finally {
      setWorkingId(null);
    }
  }

  async function reject(reason: string, sendEmail: boolean) {
    if (!token || !rejectTarget) return;
    setWorkingId(rejectTarget.id);
    setStatus("");
    try {
      const res = await api<{ emailResult?: { delivered: boolean; error?: string } }>(
        `/admin/agencies/${rejectTarget.id}/reject`,
        { method: "PATCH", token, body: JSON.stringify({ reason, sendEmail }) }
      );
      setPending((p) => p.filter((a) => a.id !== rejectTarget.id));
      const emailNote = res.emailResult?.delivered
        ? " Rejection email sent."
        : res.emailResult?.error
          ? ` Email not sent: ${res.emailResult.error}`
          : "";
      setStatus(`Agency rejected.${emailNote}`);
      setRejectTarget(null);
      const s = await api<AdminStats>("/admin/stats", { token });
      setStats(s);
    } catch {
      setStatus("Rejection failed.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="module-shell module-governance gov-command-page">
      <div className="gov-command-intro">
        <ModuleHeader
          module="governance"
          title="Platform command center"
          subtitle="Oversight across agencies, trips, partners, money, and content."
        />
      </div>

      {status && <p className="gov-status-msg">{status}</p>}

      {loading || !stats ? (
        <div className="gov-command-loading">
          <div className="gov-kpi-row gov-kpi-row--skeleton">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="gov-kpi-card gov-skeleton" />
            ))}
          </div>
        </div>
      ) : (
        <AdminCommandHub stats={stats} userTotal={userTotal} />
      )}

      <section className="gov-board gov-board--queue">
        <div className="gov-board-head">
          <div>
            <h3>Approval queue</h3>
            <p className="muted">Reject with reason and email, or approve to publish on the marketplace.</p>
          </div>
          {!loading && (
            <span className="gov-queue-count">
              {pending.length} pending
            </span>
          )}
        </div>
        {loading ? (
          <p className="muted">Loading queue…</p>
        ) : (
          <ApprovalQueue
            items={pending}
            onApprove={approve}
            onReject={(id, name) => setRejectTarget({ id, name })}
            approvingId={workingId}
          />
        )}
      </section>

      <RejectAgencyModal
        agencyName={rejectTarget?.name ?? ""}
        open={!!rejectTarget}
        loading={!!workingId && !!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={reject}
      />
    </div>
  );
}
