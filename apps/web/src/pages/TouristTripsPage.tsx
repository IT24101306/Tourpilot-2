import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ModuleHeader } from "../components/module/ModuleHeader";
import { GuidedTripCard } from "../components/guided/GuidedTripCard";
import type { NegotiationListItem } from "../types/negotiation";

export function TouristTripsPage() {
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

  const needsAction = inquiries.filter(
    (i) => i.status === "SENT_TO_TOURIST" || i.status === "TOURIST_VIEWED"
  ).length;

  return (
    <section className="section module-shell module-guided">
      <ModuleHeader
        module="guided"
        title="My trips"
        subtitle="A clear path from first request to confirmed adventure — one place for every step."
      >
        <Link to="/agencies" className="btn btn-teal">
          Plan a new trip
        </Link>
      </ModuleHeader>

      {!loading && inquiries.length > 0 && needsAction > 0 && (
        <p className="guided-list-summary">
          {needsAction} trip{needsAction === 1 ? "" : "s"} waiting for your review
        </p>
      )}

      {loading ? (
        <p className="muted">Loading your trips…</p>
      ) : inquiries.length === 0 ? (
        <div className="guided-empty-panel">
          <h3>Start your Sri Lanka journey</h3>
          <p>Browse trusted agencies, send an inquiry, and track everything here.</p>
          <Link to="/agencies" className="btn btn-primary">
            Find an agency
          </Link>
        </div>
      ) : (
        <ul className="guided-trip-list">
          {inquiries.map((inq) => (
            <li key={inq.id}>
              <GuidedTripCard inquiry={inq} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
