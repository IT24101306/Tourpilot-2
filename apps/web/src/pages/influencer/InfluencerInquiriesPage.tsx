import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import type { NegotiationListItem } from "../../types/negotiation";
import { formatInquiryStatus, inquiryStatusClass } from "../agency/types";

const ACTIVE = new Set([
  "NEW",
  "AGENCY_REVIEWING",
  "ITINERARY_DRAFT",
  "SENT_TO_TOURIST",
  "TOURIST_VIEWED",
  "REVISION_REQUESTED",
]);

export function InfluencerInquiriesPage() {
  const { token } = useAuth();
  const [inquiries, setInquiries] = useState<NegotiationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError("");
    api<NegotiationListItem[]>("/inquiries/mine", { token })
      .then(setInquiries)
      .catch((err) => {
        setInquiries([]);
        setError(err instanceof Error ? err.message : "Failed to load inquiries");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const active = inquiries.filter((i) => ACTIVE.has(i.status));
  const closed = inquiries.filter((i) => !ACTIVE.has(i.status));

  return (
    <div className="module-shell module-partner">
      <ModuleHeader
        module="partner"
        title="Traveler chats"
        subtitle="Inquiries from tours you share as yours — reply in the trip room."
      />

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="muted">Loading chats…</p>
      ) : (
        <>
          <section className="neg-list-section">
            <h3>Open ({active.length})</h3>
            {active.length === 0 ? (
              <p className="muted">
                No open chats yet. When a traveler inquires on a “share as mine” tour, it appears
                here.
              </p>
            ) : (
              <ul className="neg-inquiry-list">
                {active.map((inq) => (
                  <li key={inq.id}>
                    <Link to={`/dashboard/i/trip-room/${inq.id}`} className="neg-inquiry-card">
                      <div className="neg-inquiry-card-top">
                        <strong>{inq.tourist?.name ?? "Traveler"}</strong>
                        <span className={`agency-status ${inquiryStatusClass(inq.status)}`}>
                          {formatInquiryStatus(inq.status)}
                        </span>
                      </div>
                      <p className="muted">
                        {inq.tour?.title ?? "Tour inquiry"} ·{" "}
                        {new Date(inq.createdAt).toLocaleDateString()}
                      </p>
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
                    <Link to={`/dashboard/i/trip-room/${inq.id}`} className="neg-inquiry-card">
                      <div className="neg-inquiry-card-top">
                        <strong>{inq.tourist?.name ?? "Traveler"}</strong>
                        <span className={`agency-status ${inquiryStatusClass(inq.status)}`}>
                          {formatInquiryStatus(inq.status)}
                        </span>
                      </div>
                      <p className="muted">{inq.tour?.title ?? "Tour inquiry"}</p>
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
