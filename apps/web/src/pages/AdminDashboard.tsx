import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ModuleHeader } from "../components/module/ModuleHeader";
import { OpsMetricStrip } from "../components/module/OpsMetricStrip";
import { ApprovalQueue } from "../components/admin/ApprovalQueue";

type AgencyPending = {
  id: string;
  name: string;
  owner: { name: string; phone: string };
};

type AdminOfferLite = {
  id: string;
  isActive: boolean;
  registeredCount: number;
  spotsLeft: number;
};

export function AdminDashboard() {
  const { token } = useAuth();
  const [pending, setPending] = useState<AgencyPending[]>([]);
  const [offers, setOffers] = useState<AdminOfferLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      api<AgencyPending[]>("/admin/agencies/pending", { token }),
      api<AdminOfferLite[]>("/offers", { token }).catch(() => [] as AdminOfferLite[]),
    ])
      .then(([p, o]) => {
        setPending(p);
        setOffers(o);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const offerStats = useMemo(() => {
    const active = offers.filter((o) => o.isActive).length;
    const registrations = offers.reduce((s, o) => s + o.registeredCount, 0);
    return { total: offers.length, active, registrations };
  }, [offers]);

  async function approve(id: string) {
    if (!token) return;
    setApprovingId(id);
    setStatus("");
    try {
      await api(`/admin/agencies/${id}/approve`, { method: "PATCH", token });
      setPending((p) => p.filter((a) => a.id !== id));
      setStatus("Agency approved and is now visible on the public site.");
    } catch {
      setStatus("Approval failed. Try again.");
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div className="module-shell module-governance">
      <ModuleHeader
        module="governance"
        title="Platform oversight"
        subtitle="Review new agencies, manage loyalty offers, and keep the marketplace trustworthy."
      >
        <Link to="/dashboard/admin/offers" className="btn btn-primary">
          Manage offers
        </Link>
      </ModuleHeader>

      <OpsMetricStrip
        metrics={[
          {
            id: "pending",
            label: "Pending agencies",
            value: pending.length,
            hint: "Needs your approval",
          },
          {
            id: "offers",
            label: "Active offers",
            value: offerStats.active,
            hint: `${offerStats.total} total campaigns`,
          },
          {
            id: "regs",
            label: "Offer registrations",
            value: offerStats.registrations,
            hint: "Across all campaigns",
          },
        ]}
      />

      {status && <p className="gov-status-msg">{status}</p>}

      <section className="gov-board">
        <div className="gov-board-head">
          <h3>Approval queue</h3>
          <p className="muted">Agencies cannot appear publicly until approved.</p>
        </div>
        {loading ? (
          <p className="muted">Loading queue…</p>
        ) : (
          <ApprovalQueue items={pending} onApprove={approve} approvingId={approvingId} />
        )}
      </section>

      <section className="gov-links-row">
        <Link to="/dashboard/admin/offers" className="gov-link-card">
          <strong>Loyalty offers</strong>
          <p className="muted">Create caps, discounts, and tour eligibility.</p>
          <span className="gov-link-cta">Open offers →</span>
        </Link>
        <div className="gov-link-card gov-link-card--muted">
          <strong>CMS (home page)</strong>
          <p className="muted">Edit blocks via API: PUT /admin/cms/home</p>
        </div>
      </section>
    </div>
  );
}
