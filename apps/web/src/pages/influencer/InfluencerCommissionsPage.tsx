import { useMemo } from "react";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { OpsMetricStrip } from "../../components/module/OpsMetricStrip";
import { CommissionCard } from "../../components/influencer/CommissionCard";
import { useInfluencerDashboard } from "./types";

export function InfluencerCommissionsPage() {
  const { data, loading } = useInfluencerDashboard();
  const commissions = data?.commissions ?? [];

  const metrics = useMemo(() => {
    const pending = commissions.filter((c) => c.status === "PENDING").length;
    const approved = commissions.filter((c) => c.status === "APPROVED" || c.status === "PAID").length;
    const total = commissions.reduce((s, c) => s + c.amountLkr, 0);
    return { pending, approved, total, count: commissions.length };
  }, [commissions]);

  return (
    <div className="module-shell module-partner">
      <ModuleHeader
        module="partner"
        title="Commissions"
        subtitle="Earnings when agencies send itineraries to tourists who used your referral link."
      />

      <OpsMetricStrip
        metrics={[
          {
            id: "total",
            label: "Listed total",
            value: metrics.total,
            hint: "LKR on this page",
          },
          {
            id: "pending",
            label: "Pending",
            value: metrics.pending,
            hint: "Awaiting approval",
          },
          {
            id: "approved",
            label: "Approved / paid",
            value: metrics.approved,
            hint: "Settled rows",
          },
          {
            id: "wallet",
            label: "Wallet balance",
            value: Math.round(data?.stats.walletBalance ?? data?.profile.walletBalance ?? 0),
            hint: `${(data?.stats.paidToWallet ?? 0).toLocaleString()} Credits credited`,
          },
        ]}
      />

      {loading ? (
        <p className="muted">Loading commissions…</p>
      ) : commissions.length === 0 ? (
        <div className="partner-empty">
          <p>No commissions yet. Share your referral links to start earning.</p>
        </div>
      ) : (
        <ul className="partner-commission-list">
          {commissions.map((c) => (
            <li key={c.id}>
              <CommissionCard commission={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
