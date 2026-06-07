import { useMemo, useState } from "react";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { InfluencerTourCard } from "../../components/influencer/InfluencerTourCard";
import { InfluencerTourDetailModal } from "../../components/influencer/InfluencerTourDetailModal";
import { useInfluencerDashboard } from "./types";
import type { InfluencerTour, ReferralCode } from "./types";

export function InfluencerToursPage() {
  const { tours, data, loading, openCreateForTour, copyText } = useInfluencerDashboard();
  const [agencyFilter, setAgencyFilter] = useState("all");
  const [detailTour, setDetailTour] = useState<InfluencerTour | null>(null);

  const agencies = useMemo(() => {
    const map = new Map<string, string>();
    tours.forEach((t) => map.set(t.agency.id, t.agency.name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tours]);

  const filteredTours = useMemo(() => {
    if (agencyFilter === "all") return tours;
    return tours.filter((t) => t.agency.id === agencyFilter);
  }, [tours, agencyFilter]);

  const codesByTourId = useMemo(() => {
    const map = new Map<string, ReferralCode>();
    data?.codes.forEach((c) => {
      if (c.tour?.id && c.isActive) map.set(c.tour.id, c);
    });
    return map;
  }, [data?.codes]);

  return (
    <div className="module-shell module-partner">
      <ModuleHeader
        module="partner"
        title="Agency tours"
        subtitle="Pick ready-made packages to promote — each tour can have one active referral code."
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
        <span className="muted">{filteredTours.length} tours</span>
      </div>

      {loading ? (
        <p className="muted">Loading tours…</p>
      ) : filteredTours.length === 0 ? (
        <div className="partner-empty">
          <p>No published ready-made tours yet. Check back soon.</p>
        </div>
      ) : (
        <div className="partner-tour-grid">
          {filteredTours.map((tour) => (
            <InfluencerTourCard
              key={tour.id}
              tour={tour}
              existingCode={codesByTourId.get(tour.id)}
              onCreate={() => openCreateForTour(tour.id)}
              onCopy={copyText}
              onViewDetail={() => setDetailTour(tour)}
            />
          ))}
        </div>
      )}

      <InfluencerTourDetailModal
        tour={detailTour}
        existingCode={detailTour ? codesByTourId.get(detailTour.id) : undefined}
        open={!!detailTour}
        onClose={() => setDetailTour(null)}
        onCreate={() => detailTour && openCreateForTour(detailTour.id)}
        onCopy={copyText}
      />
    </div>
  );
}
