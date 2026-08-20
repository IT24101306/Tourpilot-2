import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { EmptyState } from "../components/feedback/EmptyState";
import { GuidedTripCard } from "../components/guided/GuidedTripCard";
import { usePublicSmartFeatures } from "../lib/publicSmartFeatures";
import type { NegotiationListItem } from "../types/negotiation";

export function TouristTripsPage() {
  const { token } = useAuth();
  const { publicOffersEnabled } = usePublicSmartFeatures();
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

  const needsAction = inquiries.filter(
    (i) => i.status === "SENT_TO_TOURIST" || i.status === "TOURIST_VIEWED"
  ).length;

  if (loading) {
    return <p className="muted">Loading your inquiries…</p>;
  }

  if (error) {
    return <p className="form-error">{error}</p>;
  }

  if (inquiries.length === 0) {
    return (
      <EmptyState
        title="No inquiries yet"
        description="Visit an agency or tour page and send an inquiry — proposals and trip rooms will show up here."
        action={
          publicOffersEnabled
            ? { label: "Browse offers", to: "/offers" }
            : { label: "Find agencies", to: "/" }
        }
        secondaryAction={
          publicOffersEnabled ? { label: "Find agencies", to: "/" } : undefined
        }
      />
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
