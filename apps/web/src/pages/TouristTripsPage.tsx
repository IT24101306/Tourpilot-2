import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
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

  if (loading) {
    return <p className="muted">Loading your inquiries…</p>;
  }

  if (inquiries.length === 0) {
    return (
      <div className="guided-empty-panel">
        <h3>No inquiries yet</h3>
        <p>Browse trusted agencies, send an inquiry, and track proposals here.</p>
        <Link to="/agencies" className="btn btn-primary">
          Find an agency
        </Link>
      </div>
    );
  }

  return (
    <>
      {needsAction > 0 && (
        <p className="guided-list-summary">
          {needsAction} trip{needsAction === 1 ? "" : "s"} waiting for your review
        </p>
      )}
      <ul className="guided-trip-list">
        {inquiries.map((inq) => (
          <li key={inq.id}>
            <GuidedTripCard inquiry={inq} />
          </li>
        ))}
      </ul>
    </>
  );
}
