import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { agencyFeaturesOf, useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { OpsMetricStrip } from "../../components/module/OpsMetricStrip";
import { OperationsQueue } from "../../components/module/OperationsQueue";
import { EmptyState } from "../../components/feedback/EmptyState";
import { AgencyTrustBadgesPanel } from "../../components/smart/AgencyTrustBadgesPanel";
import { groupByQueue, opsMetrics } from "./operationsUtils";
import { AgencyInquiry, AgencyTour } from "./types";

export function AgencyOverviewPage() {
  const { token, user } = useAuth();
  const features = agencyFeaturesOf(user);
  const [tours, setTours] = useState<AgencyTour[]>([]);
  const [inquiries, setInquiries] = useState<AgencyInquiry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      api<AgencyTour[]>("/tours/agency/mine", { token }),
      api<AgencyInquiry[]>("/inquiries/mine", { token }),
    ])
      .then(([t, i]) => {
        setTours(t);
        setInquiries(i);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const metrics = useMemo(() => opsMetrics(inquiries), [inquiries]);
  const queues = useMemo(() => groupByQueue(inquiries), [inquiries]);

  const activeTours = tours.filter((t) => t.isPublished).length;
  const publishedValue = tours
    .filter((t) => t.isPublished)
    .reduce((sum, t) => sum + t.basePriceLkr, 0);

  return (
    <div className="module-shell module-operations">
      <ModuleHeader
        module="operations"
        title="Operations overview"
        subtitle="Today’s bookings, follow-ups, and confirmations in one place."
      >
        <Link to="/dashboard/agency/tasks" className="btn btn-primary">
          Open tasks
        </Link>
        {features.negotiationsBookings && (
          <Link to="/dashboard/agency/negotiations" className="btn btn-ghost">
            Negotiations
          </Link>
        )}
      </ModuleHeader>

      <AgencyTrustBadgesPanel />

      <OpsMetricStrip
        className="ops-metric-strip--overview"
        metrics={[
          {
            id: "action",
            label: "Needs action",
            value: metrics.needsAction,
            hint: "Reply or update proposal",
          },
          {
            id: "today",
            label: "New today",
            value: metrics.today,
            hint: "Inquiries received today",
          },
          {
            id: "waiting",
            label: "Waiting on traveler",
            value: metrics.waitingTourist,
            hint: "Proposal sent",
          },
          {
            id: "confirmed",
            label: "Confirmed",
            value: metrics.confirmed,
            hint: "Ready to execute",
          },
          {
            id: "tours",
            label: "Active tours",
            value: activeTours,
            hint: features.readyMadeTours
              ? `${tours.length} in catalog`
              : "Publishing disabled for this agency",
            href: features.readyMadeTours ? "/dashboard/agency/tours" : undefined,
          },
          {
            id: "catalog",
            label: "Catalog value",
            value: `LKR ${publishedValue.toLocaleString()}`,
            hint: "Published tour pricing",
          },
          {
            id: "open",
            label: "Open inquiries",
            value: metrics.total,
            hint: "Across all stages",
          },
        ]}
      />

      <section className="ops-board">
        <div className="ops-board-head">
          <h3>Live board</h3>
          <p className="muted">Prioritized by what needs your attention first.</p>
        </div>
        {loading ? (
          <p className="muted">Loading operations…</p>
        ) : inquiries.length === 0 ? (
          <EmptyState
            title="No inquiries yet"
            description="When travelers request trips, they will appear here on your live board."
            action={
              features.readyMadeTours
                ? { label: "Manage tours", to: "/dashboard/agency/tours" }
                : undefined
            }
            className="ops-empty-panel"
          />
        ) : (
          <OperationsQueue groups={queues} compact />
        )}
      </section>
    </div>
  );
}
