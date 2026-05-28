import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { OpsMetricStrip } from "../../components/module/OpsMetricStrip";
import { AgencyInquiry, formatInquiryStatus, inquiryStatusClass } from "./types";

type TravelerRow = {
  id: string;
  name: string;
  phone: string;
  latestStatus: string;
  inquiryCount: number;
};

export function AgencyTravelersPage() {
  const { token } = useAuth();
  const [travelers, setTravelers] = useState<TravelerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api<AgencyInquiry[]>("/inquiries/mine", { token })
      .then((inquiries) => {
        const map = new Map<string, TravelerRow>();
        for (const inq of inquiries) {
          if (!inq.tourist) continue;
          const existing = map.get(inq.tourist.id);
          if (existing) {
            existing.inquiryCount += 1;
            existing.latestStatus = inq.status;
          } else {
            map.set(inq.tourist.id, {
              id: inq.tourist.id,
              name: inq.tourist.name,
              phone: inq.tourist.phone,
              latestStatus: inq.status,
              inquiryCount: 1,
            });
          }
        }
        setTravelers([...map.values()]);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const needsAction = useMemo(
    () =>
      travelers.filter((t) =>
        ["NEW", "REVISION_REQUESTED", "SENT_TO_TOURIST"].includes(t.latestStatus)
      ).length,
    [travelers]
  );

  return (
    <div className="module-shell module-operations">
      <ModuleHeader
        module="operations"
        title="Travelers"
        subtitle="Guests who inquired with your agency — follow up from negotiations or bookings."
      >
        <Link to="/dashboard/agency/negotiations" className="btn btn-ghost">
          Negotiations
        </Link>
      </ModuleHeader>

      <OpsMetricStrip
        metrics={[
          {
            id: "total",
            label: "Travelers",
            value: travelers.length,
            hint: "Unique guests",
          },
          {
            id: "action",
            label: "Needs follow-up",
            value: needsAction,
            hint: "Open or waiting statuses",
          },
        ]}
      />

      {loading ? (
        <p className="muted">Loading travelers…</p>
      ) : travelers.length === 0 ? (
        <div className="ops-empty-panel">
          <p>No travelers yet — they appear when inquiries come in.</p>
        </div>
      ) : (
        <ul className="ops-queue-list" style={{ marginTop: 4 }}>
          {travelers.map((t) => (
            <li key={t.id}>
              <div className="ops-queue-card" style={{ cursor: "default" }}>
                <div className="ops-queue-card-top">
                  <strong>{t.name}</strong>
                  <span className={`agency-status ${inquiryStatusClass(t.latestStatus)}`}>
                    {formatInquiryStatus(t.latestStatus)}
                  </span>
                </div>
                <p className="ops-queue-card-meta">
                  {t.phone} · {t.inquiryCount} booking{t.inquiryCount === 1 ? "" : "s"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
