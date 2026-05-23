import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { AgencyInquiry, formatInquiryStatus, inquiryStatusClass } from "./types";

export function AgencyBookingsPage() {
  const { token } = useAuth();
  const [inquiries, setInquiries] = useState<AgencyInquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<string | null>(null);
  const [itineraryLabel, setItineraryLabel] = useState("Day 1 experience");

  useEffect(() => {
    if (!token) return;
    api<AgencyInquiry[]>("/inquiries/mine", { token }).then(setInquiries);
  }, [token]);

  async function refresh() {
    if (!token) return;
    const list = await api<AgencyInquiry[]>("/inquiries/mine", { token });
    setInquiries(list);
  }

  async function sendItinerary(inquiryId: string) {
    if (!token) return;
    await api(`/inquiries/${inquiryId}/itinerary`, {
      method: "POST",
      token,
      body: JSON.stringify({
        title: "Your custom Sri Lanka itinerary",
        days: [
          {
            dayNumber: 1,
            title: "Day 1",
            items: [
              { label: itineraryLabel, kind: "REQUIRED", priceLkr: 25000 },
              { label: "Premium jeep safari (optional)", kind: "OPTIONAL", priceLkr: 12000 },
            ],
          },
        ],
        send: true,
      }),
    });
    await refresh();
    setSelectedInquiry(null);
  }

  return (
    <>
      <div className="agency-panel-head">
        <h2>Bookings</h2>
        <p>Latest reservations and their current status.</p>
      </div>
      {inquiries.length === 0 && <p className="muted">No bookings yet.</p>}
      <div className="agency-list">
        {inquiries.map((inq) => (
          <div key={inq.id} className="agency-list-item stacked">
            <div className="agency-list-item-main">
              <span>
                <strong>{inq.id.slice(-6).toUpperCase()}</strong>
                {inq.tour ? ` | ${inq.tour.title}` : " | Custom trip"} | {inq.pax} guests
              </span>
              <span className={`agency-status ${inquiryStatusClass(inq.status)}`}>
                {formatInquiryStatus(inq.status)}
              </span>
            </div>
            <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.88rem" }}>
              {inq.tourist?.name} · {inq.tourist?.phone}
              {inq.message ? ` — ${inq.message}` : ""}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 10 }}
              onClick={() => setSelectedInquiry(inq.id)}
            >
              Build &amp; send itinerary
            </button>
            {selectedInquiry === inq.id && (
              <div style={{ marginTop: 12 }}>
                <input
                  value={itineraryLabel}
                  onChange={(e) => setItineraryLabel(e.target.value)}
                  placeholder="Main activity label"
                />
                <button
                  type="button"
                  className="btn btn-teal"
                  style={{ marginTop: 8 }}
                  onClick={() => sendItinerary(inq.id)}
                >
                  Send itinerary to tourist
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
