import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { GuidedTripCard } from "../components/guided/GuidedTripCard";
import { useAuth } from "../context/AuthContext";
import type { NegotiationListItem } from "../types/negotiation";

const BOOKING_STATUSES = new Set(["ACCEPTED"]);

export function TouristBookingsPage() {
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

  const bookings = useMemo(
    () => inquiries.filter((i) => BOOKING_STATUSES.has(i.status)),
    [inquiries]
  );

  if (loading) {
    return <p className="muted">Loading your bookings…</p>;
  }

  if (bookings.length === 0) {
    return (
      <div className="guided-empty-panel">
        <h3>No confirmed bookings yet</h3>
        <p>When you accept a proposal from an agency, your trip appears here.</p>
        <Link to="/trips" className="btn btn-primary">
          View inquiries
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="guided-list-summary muted">
        {bookings.length} confirmed trip{bookings.length === 1 ? "" : "s"}
      </p>
      <ul className="guided-trip-list">
        {bookings.map((inq) => (
          <li key={inq.id}>
            <GuidedTripCard inquiry={inq} />
          </li>
        ))}
      </ul>
    </>
  );
}
