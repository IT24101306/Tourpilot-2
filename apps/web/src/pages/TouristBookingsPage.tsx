import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState } from "../components/feedback/EmptyState";
import { GuidedTripCard } from "../components/guided/GuidedTripCard";
import { useAuth } from "../context/AuthContext";
import type { NegotiationListItem } from "../types/negotiation";

const BOOKING_STATUSES = new Set(["ACCEPTED", "IN_PROGRESS", "COMPLETED"]);

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

  const upcoming = bookings.filter((b) => b.status === "ACCEPTED");
  const active = bookings.filter((b) => b.status === "IN_PROGRESS");
  const past = bookings.filter((b) => b.status === "COMPLETED");

  if (loading) {
    return <p className="muted">Loading your bookings…</p>;
  }

  if (bookings.length === 0) {
    return (
      <EmptyState
        title="No confirmed bookings yet"
        description="When you accept a proposal from an agency, your trip appears here."
        action={{ label: "View inquiries", to: "/trips" }}
      />
    );
  }

  return (
    <>
      {active.length > 0 && (
        <section>
          <p className="guided-list-summary">
            {active.length} trip{active.length === 1 ? "" : "s"} in progress
          </p>
          <ul className="guided-trip-list">
            {active.map((inq) => (
              <li key={inq.id}>
                <GuidedTripCard inquiry={inq} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {upcoming.length > 0 && (
        <section>
          <p className="guided-list-summary muted">
            {upcoming.length} upcoming trip{upcoming.length === 1 ? "" : "s"}
          </p>
          <ul className="guided-trip-list">
            {upcoming.map((inq) => (
              <li key={inq.id}>
                <GuidedTripCard inquiry={inq} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <p className="guided-list-summary muted">
            {past.length} completed trip{past.length === 1 ? "" : "s"}
          </p>
          <ul className="guided-trip-list">
            {past.map((inq) => (
              <li key={inq.id}>
                <GuidedTripCard inquiry={inq} />
                {!(inq.hasReview || inq.touristReview) && (
                  <Link
                    to={`/trips/${inq.id}`}
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 8 }}
                  >
                    Leave a review
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
