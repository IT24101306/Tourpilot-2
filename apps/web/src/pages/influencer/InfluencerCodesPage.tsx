import { useMemo, useState } from "react";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { ReferralCodeCard } from "../../components/influencer/ReferralCodeCard";
import { useInfluencerDashboard } from "./types";

export function InfluencerCodesPage() {
  const { data, loading, openCreateForTour, copyText } = useInfluencerDashboard();
  const [agencyFilter, setAgencyFilter] = useState("all");
  const codes = data?.codes ?? [];

  const agencies = useMemo(() => {
    const map = new Map<string, string>();
    codes.forEach((c) => {
      if (c.tour?.agency) map.set(c.tour.agency.id, c.tour.agency.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [codes]);

  const filteredCodes = useMemo(() => {
    if (agencyFilter === "all") return codes;
    return codes.filter((c) => c.tour?.agency.id === agencyFilter);
  }, [codes, agencyFilter]);

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

      <div className="partner-toolbar">
        <label className="partner-filter">
          <span className="muted">Agency</span>
          <select value={agencyFilter} onChange={(e) => setAgencyFilter(e.target.value)}>
            <option value="all">All agencies</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <span className="partner-summary muted">
          {active} active · {filteredCodes.length} shown
        </span>
      </div>

      {loading ? (
        <p className="muted">Loading codes…</p>
      ) : filteredCodes.length === 0 ? (
        <div className="partner-empty">
          <p>{codes.length === 0 ? "No codes yet." : "No codes for this agency."}</p>
          <button type="button" className="btn btn-teal" onClick={() => openCreateForTour()}>
            Create your first code
          </button>
        </div>
      ) : (
        <ul className="partner-code-list">
          {filteredCodes.map((c) => (
            <li key={c.id}>
              <ReferralCodeCard code={c} onCopy={copyText} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
