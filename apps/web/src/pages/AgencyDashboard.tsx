import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export function AgencyDashboard() {
  const { token } = useAuth();
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [tours, setTours] = useState<TourRow[]>([]);
  const [entityForm, setEntityForm] = useState({
    name: "",
    type: "HOTEL",
    city: "",
    priceHint: "",
  });
  const [selectedInquiry, setSelectedInquiry] = useState<string | null>(null);
  const [itineraryLabel, setItineraryLabel] = useState("Day 1 experience");

  useEffect(() => {
    if (!token) return;
    refresh(token);
  }, [token]);

  async function refresh(authToken: string) {
    const [inq, ent, tr] = await Promise.all([
      api<InquiryRow[]>("/inquiries/mine", { token: authToken }),
      api<EntityRow[]>("/entities", { token: authToken }),
      api<TourRow[]>("/tours/agency/mine", { token: authToken }),
    ]);
    setInquiries(inq);
    setEntities(ent);
    setTours(tr);
  }

  async function addEntity(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    await api("/entities", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: entityForm.name,
        type: entityForm.type,
        city: entityForm.city,
        priceHint: entityForm.priceHint ? Number(entityForm.priceHint) : undefined,
      }),
    });
    setEntityForm({ name: "", type: "HOTEL", city: "", priceHint: "" });
    refresh(token);
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
              {
                label: itineraryLabel,
                kind: "REQUIRED",
                priceLkr: 25000,
              },
              {
                label: "Premium jeep safari (optional)",
                kind: "OPTIONAL",
                priceLkr: 12000,
              },
            ],
          },
        ],
        send: true,
      }),
    });
    refresh(token);
    setSelectedInquiry(null);
  }

  return (
    <>
      <h1 className="section-title">Agency dashboard</h1>

      <div className="panel">
        <h3>Inquiry inbox</h3>
        {inquiries.length === 0 && <p className="muted">No inquiries yet.</p>}
        {inquiries.map((inq) => (
          <div key={inq.id} style={{ borderBottom: "1px solid var(--line)", padding: "12px 0" }}>
            <strong>{inq.tourist?.name}</strong> · {inq.status} · {inq.type}
            <p className="muted">{inq.message || "No message"}</p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 8 }}
              onClick={() => setSelectedInquiry(inq.id)}
            >
              Build & send itinerary
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

      <div className="panel">
        <h3>Entities library</h3>
        <form className="form-grid" onSubmit={addEntity}>
          <input
            placeholder="Name"
            value={entityForm.name}
            onChange={(e) => setEntityForm({ ...entityForm, name: e.target.value })}
            required
          />
          <select
            value={entityForm.type}
            onChange={(e) => setEntityForm({ ...entityForm, type: e.target.value })}
          >
            <option value="HOTEL">Hotel</option>
            <option value="VIEWPOINT">Viewpoint</option>
            <option value="ACTIVITY">Activity</option>
            <option value="RESTAURANT">Restaurant</option>
            <option value="TRANSPORT">Transport</option>
          </select>
          <input
            placeholder="City"
            value={entityForm.city}
            onChange={(e) => setEntityForm({ ...entityForm, city: e.target.value })}
          />
          <input
            placeholder="Price hint LKR"
            value={entityForm.priceHint}
            onChange={(e) => setEntityForm({ ...entityForm, priceHint: e.target.value })}
          />
          <button type="submit" className="btn btn-primary">
            Add entity
          </button>
        </form>
        <ul style={{ marginTop: 16 }}>
          {entities.map((ent) => (
            <li key={ent.id}>
              {ent.name} · {ent.type} · {ent.city}
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h3>Ready-made tours ({tours.length})</h3>
        <ul>
          {tours.map((t) => (
            <li key={t.id}>
              {t.title} — LKR {t.basePriceLkr.toLocaleString()} ·{" "}
              {t.isPublished ? "Published" : "Draft"}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

type InquiryRow = {
  id: string;
  status: string;
  type: string;
  message: string | null;
  tourist?: { name: string };
};

type EntityRow = { id: string; name: string; type: string; city: string | null };
type TourRow = { id: string; title: string; basePriceLkr: number; isPublished: boolean };
