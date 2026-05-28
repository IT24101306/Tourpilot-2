import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ItineraryDreamView } from "../components/itinerary/ItineraryDreamView";
import type { ItineraryView } from "../types/itinerary";

export function ItinerarySharePage() {
  const { token } = useAuth();
  const { shareToken } = useParams<{ shareToken: string }>();
  const [itin, setItin] = useState<ItineraryView | null>(null);
  const [error, setError] = useState("");
  const [responding, setResponding] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!shareToken) return;
    setError("");
    api<ItineraryView>(`/inquiries/share/${shareToken}`)
      .then(setItin)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Itinerary not found");
      });
  }, [shareToken]);

  async function respond(action: "accept" | "revision" | "decline") {
    if (!token || !itin?.inquiry?.id) return;
    setResponding(true);
    setStatus("");
    try {
      await api(`/inquiries/${itin.inquiry.id}/respond`, {
        method: "POST",
        token,
        body: JSON.stringify({ action }),
      });
      setStatus(
        action === "accept"
          ? "You accepted this itinerary."
          : action === "decline"
            ? "You declined this itinerary."
            : "Revision requested — your agency will update the plan."
      );
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Could not save your response");
    } finally {
      setResponding(false);
    }
  }

  if (error) {
    return (
      <section className="section module-shell module-itinerary">
        <p className="form-error">{error}</p>
        <Link to="/" className="btn btn-ghost">
          Back to home
        </Link>
      </section>
    );
  }

  if (!itin) {
    return (
      <section className="section module-shell module-itinerary">
        <p className="muted">Opening your itinerary…</p>
      </section>
    );
  }

  return (
    <>
      {status && (
        <div className="itin-status-banner" role="status">
          {status}
        </div>
      )}
      <ItineraryDreamView
        itinerary={itin}
        shareToken={shareToken}
        showRespondActions={Boolean(token && itin.inquiry?.id)}
        responding={responding}
        onRespond={respond}
      />
    </>
  );
}
