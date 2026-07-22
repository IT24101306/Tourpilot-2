import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { agencyFeaturesOf, useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { OpsMetricStrip } from "../../components/module/OpsMetricStrip";
import { AgencyInquiry, formatInquiryStatus, inquiryStatusClass } from "./types";

type TravelerRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  avatarUrl: string | null;
  latestStatus: string;
  inquiryCount: number;
};

function travelerInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function TravelerAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [failed, setFailed] = useState(!avatarUrl);

  if (!avatarUrl || failed) {
    return (
      <span className="traveler-avatar traveler-avatar--fallback" aria-hidden="true">
        {travelerInitials(name)}
      </span>
    );
  }

  return (
    <img
      className="traveler-avatar"
      src={avatarUrl}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export function AgencyTravelersPage() {
  const { token, user } = useAuth();
  const features = agencyFeaturesOf(user);
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
            if (inq.tourist.email && !existing.email) {
              existing.email = inq.tourist.email;
            }
            if (inq.tourist.avatarUrl && !existing.avatarUrl) {
              existing.avatarUrl = inq.tourist.avatarUrl;
            }
          } else {
            map.set(inq.tourist.id, {
              id: inq.tourist.id,
              name: inq.tourist.name,
              phone: inq.tourist.phone,
              email: inq.tourist.email ?? null,
              avatarUrl: inq.tourist.avatarUrl ?? null,
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
        {features.negotiationsBookings && (
          <Link to="/dashboard/agency/negotiations" className="btn btn-ghost">
            Negotiations
          </Link>
        )}
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
                  <span className="traveler-name-row">
                    <TravelerAvatar name={t.name} avatarUrl={t.avatarUrl} />
                    <strong>{t.name}</strong>
                  </span>
                  <span className={`agency-status ${inquiryStatusClass(t.latestStatus)}`}>
                    {formatInquiryStatus(t.latestStatus)}
                  </span>
                </div>
                <p className="ops-queue-card-meta">
                  <span className="traveler-contact-line">
                    <span className="traveler-contact-label">Phone</span> {t.phone}
                  </span>
                  {t.email && (
                    <span className="traveler-contact-line">
                      <span className="traveler-contact-label">Email</span>{" "}
                      <a href={`mailto:${t.email}`}>{t.email}</a>
                    </span>
                  )}
                  <span className="traveler-contact-line muted">
                    {t.inquiryCount} inquiry{t.inquiryCount === 1 ? "" : "ies"}
                  </span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
