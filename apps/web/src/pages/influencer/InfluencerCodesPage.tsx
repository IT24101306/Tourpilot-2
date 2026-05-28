import { ModuleHeader } from "../../components/module/ModuleHeader";
import { ReferralCodeCard } from "../../components/influencer/ReferralCodeCard";
import { useInfluencerDashboard } from "./types";

export function InfluencerCodesPage() {
  const { data, loading, openCreateForTour, copyText } = useInfluencerDashboard();
  const codes = data?.codes ?? [];

  const active = codes.filter((c) => c.isActive).length;

  return (
    <div className="module-shell module-partner">
      <ModuleHeader
        module="partner"
        title="Referral codes"
        subtitle="Your shareable links — copy and post to Instagram, TikTok, or your blog."
      >
        <button type="button" className="btn btn-primary" onClick={() => openCreateForTour()}>
          New code
        </button>
      </ModuleHeader>

      <p className="partner-summary muted">
        {active} active · {codes.length} total codes
      </p>

      {loading ? (
        <p className="muted">Loading codes…</p>
      ) : codes.length === 0 ? (
        <div className="partner-empty">
          <p>No codes yet.</p>
          <button type="button" className="btn btn-teal" onClick={() => openCreateForTour()}>
            Create your first code
          </button>
        </div>
      ) : (
        <ul className="partner-code-list">
          {codes.map((c) => (
            <li key={c.id}>
              <ReferralCodeCard code={c} onCopy={copyText} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
