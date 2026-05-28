import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { OpsMetricStrip } from "../../components/module/OpsMetricStrip";
import { OperationsQueue } from "../../components/module/OperationsQueue";
import { groupByQueue, opsMetrics } from "./operationsUtils";
import { AgencyInquiry, AgencyTour } from "./types";

export function AgencyOverviewPage() {
  const { token } = useAuth();
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
        subtitle="Your mission control for today's bookings, follow-ups, and confirmations."
      >
        <Link to="/dashboard/agency/tasks" className="btn btn-primary">
          Open tasks
        </Link>
        <Link to="/dashboard/agency/negotiations" className="btn btn-ghost">
          Negotiations
        </Link>
      </ModuleHeader>

      <OpsMetricStrip
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
        ]}
      />

      <div className="ops-kpi-row">
        <Link to="/dashboard/agency/tours" className="agency-stat-card clickable">
          <h3>Active tours</h3>
          <p className="agency-stat-value">{activeTours}</p>
          <p className="agency-stat-sub">{tours.length} in catalog</p>
        </Link>
        <div className="agency-stat-card">
          <h3>Catalog value</h3>
          <p className="agency-stat-value">LKR {publishedValue.toLocaleString()}</p>
          <p className="agency-stat-sub">Published tour pricing</p>
        </div>
        <div className="agency-stat-card">
          <h3>Open inquiries</h3>
          <p className="agency-stat-value">{metrics.total}</p>
          <p className="agency-stat-sub">Across all stages</p>
        </div>
      </div>

      <section className="ops-board">
        <div className="ops-board-head">
          <h3>Live operations board</h3>
          <p className="muted">Prioritized by what needs your attention first.</p>
        </div>
        {loading ? (
          <p className="muted">Loading operations…</p>
        ) : inquiries.length === 0 ? (
          <div className="ops-empty-panel">
            <p>No inquiries yet. When travelers request trips, they will appear here.</p>
            <Link to="/dashboard/agency/tours" className="btn btn-ghost">
              Manage tours
            </Link>
          </div>
        ) : (
          <OperationsQueue groups={queues} compact />
        )}
      </section>
    </div>
  );
}
