import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export function ItinerarySharePage() {
  const { token } = useAuth();
  const { shareToken } = useParams<{ shareToken: string }>();
  const [itin, setItin] = useState<ItineraryView | null>(null);

  useEffect(() => {
    if (!shareToken) return;
    api<ItineraryView>(`/inquiries/share/${shareToken}`).then(setItin).catch(console.error);
  }, [shareToken]);

  async function respond(action: "accept" | "revision" | "decline") {
    if (!token || !itin?.inquiry) return;
    await api(`/inquiries/${itin.inquiry.id}/respond`, {
      method: "POST",
      token,
      body: JSON.stringify({ action }),
    });
    alert(`Marked as ${action}`);
  }

  if (!itin) return <section className="section">Loading itinerary…</section>;

  return (
    <section className="section" style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1>{itin.title || "Your itinerary"}</h1>
      <p className="price">
        Base: LKR {itin.baseTotal.toLocaleString()} · Optional up to LKR{" "}
        {itin.optionalTotal.toLocaleString()} · Max LKR {itin.grandMax.toLocaleString()}
      </p>
      {itin.days?.map((day) => (
        <div key={day.dayNumber} className="panel">
          <h3>Day {day.dayNumber}</h3>
          <ul>
            {day.lineItems.map((li, i) => (
              <li key={i}>
                {li.label}{" "}
                <span className="muted">({li.kind})</span>
                {li.priceLkr != null ? (
                  <span className="price"> — LKR {li.priceLkr.toLocaleString()}</span>
                ) : li.priceOnRequest ? (
                  <span className="muted"> — price on request</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {token && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" onClick={() => respond("accept")}>
            Accept
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => respond("revision")}>
            Request revision
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => respond("decline")}>
            Decline
          </button>
        </div>
      )}
    </section>
  );
}

type ItineraryView = {
  title: string | null;
  baseTotal: number;
  optionalTotal: number;
  grandMax: number;
  inquiry?: { id: string };
  days?: Array<{
    dayNumber: number;
    lineItems: Array<{
      label: string;
      kind: string;
      priceLkr: number | null;
      priceOnRequest: boolean;
    }>;
  }>;
};
