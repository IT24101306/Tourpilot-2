import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import type { NegotiationListItem } from "../../types/negotiation";
import { formatInquiryStatus, inquiryStatusClass } from "./types";

const ACTIVE = new Set([
  "NEW",
  "AGENCY_REVIEWING",
  "ITINERARY_DRAFT",
  "SENT_TO_TOURIST",
  "TOURIST_VIEWED",
  "REVISION_REQUESTED",
]);

export function AgencyNegotiationsPage() {
  const { token } = useAuth();
  const [inquiries, setInquiries] = useState<NegotiationListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api<NegotiationListItem[]>("/inquiries/mine", { token })
      .then(setInquiries)
      .finally(() => setLoading(false));
  }, [token]);

  const active = inquiries.filter((i) => ACTIVE.has(i.status));
  const closed = inquiries.filter((i) => !ACTIVE.has(i.status));

  return (
    <div className="module-shell module-negotiation">
      <ModuleHeader
        module="negotiation"
        title="Trip negotiations"
        subtitle="Every active conversation with travelers — open a trip room to plan together."
      >
        <Link to="/dashboard/agency/bookings" className="btn btn-ghost">
          Operations queue
        </Link>
      </ModuleHeader>

      {loading ? (
        <p className="muted">Loading negotiations…</p>
      ) : (
        <>
          <section className="neg-list-section">
            <h3>Active planning ({active.length})</h3>
            {active.length === 0 ? (
              <p className="muted">No active negotiations. New inquiries appear here automatically.</p>
            ) : (
              <ul className="neg-inquiry-list">
                {active.map((inq) => (
                  <li key={inq.id}>
                    <Link to={`/dashboard/agency/trip-room/${inq.id}`} className="neg-inquiry-card">
                      <div className="neg-inquiry-card-top">
                        <strong>{inq.tourist?.name ?? "Traveler"}</strong>
                        <span className={`agency-status ${inquiryStatusClass(inq.status)}`}>
                          {formatInquiryStatus(inq.status)}
                        </span>
                      </div>
                      <p className="muted">
                        {inq.tour?.title ?? "Custom trip"} · {inq.pax} guests ·{" "}
                        {inq.proposal ? `${inq.proposal.items.length} option(s)` : "Awaiting proposal"}
                      </p>
                      <p className="neg-inquiry-cta">Open trip room →</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {closed.length > 0 && (
            <section className="neg-list-section">
              <h3>Closed ({closed.length})</h3>
              <ul className="neg-inquiry-list">
                {closed.map((inq) => (
                  <li key={inq.id}>
                    <Link to={`/dashboard/agency/trip-room/${inq.id}`} className="neg-inquiry-card muted-card">
                      <strong>{inq.tourist?.name ?? "Traveler"}</strong>
                      <span className={`agency-status ${inquiryStatusClass(inq.status)}`}>
                        {formatInquiryStatus(inq.status)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
