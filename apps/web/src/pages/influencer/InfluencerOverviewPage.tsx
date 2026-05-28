import { Link } from "react-router-dom";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { OpsMetricStrip } from "../../components/module/OpsMetricStrip";
import { GrowthJourney } from "../../components/influencer/GrowthJourney";
import { useInfluencerDashboard } from "./types";

export function InfluencerOverviewPage() {
  const { data, loading, openCreateForTour } = useInfluencerDashboard();

  if (loading || !data) {
    return <p className="muted">Loading partner dashboard…</p>;
  }

  const { profile, stats } = data;

  return (
    <div className="module-shell module-partner">
      <ModuleHeader
        module="partner"
        title={`Welcome, ${profile.name}`}
        subtitle="Grow your audience — share tour links, track clicks, and earn when agencies send itineraries."
      >
        <button type="button" className="btn btn-primary" onClick={() => openCreateForTour()}>
          Create referral code
        </button>
        <Link to="/dashboard/influencer/tours" className="btn btn-teal">
          Browse tours
        </Link>
      </ModuleHeader>

      <OpsMetricStrip
        metrics={[
          {
            id: "earned",
            label: "Total earned",
            value: Math.round(stats.totalEarned),
            hint: `LKR ${stats.totalEarned.toLocaleString()} approved`,
          },
          {
            id: "pending",
            label: "Pending",
            value: Math.round(stats.pendingCommission),
            hint: `LKR ${stats.pendingCommission.toLocaleString()} awaiting`,
          },
          {
            id: "clicks",
            label: "Link clicks",
            value: stats.totalClicks,
            hint: "All referral codes",
          },
          {
            id: "inquiries",
            label: "Referred inquiries",
            value: stats.totalInquiries,
            hint: `${stats.activeCodes} active codes`,
          },
        ]}
      />

      <section className="partner-board">
        <div className="partner-board-head">
          <h3>How you earn</h3>
          <Link to="/dashboard/influencer/guide" className="partner-board-link">
            Full guide →
          </Link>
        </div>
        <GrowthJourney />
      </section>
    </div>
  );
}
