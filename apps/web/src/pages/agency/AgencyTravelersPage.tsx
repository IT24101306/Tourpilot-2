import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { AgencyInquiry, formatInquiryStatus, inquiryStatusClass } from "./types";

type TravelerRow = {
  id: string;
  name: string;
  phone: string;
  latestStatus: string;
  inquiryCount: number;
};

export function AgencyTravelersPage() {
  const { token } = useAuth();
  const [travelers, setTravelers] = useState<TravelerRow[]>([]);

  useEffect(() => {
    if (!token) return;
    api<AgencyInquiry[]>("/inquiries/mine", { token }).then((inquiries) => {
      const map = new Map<string, TravelerRow>();
      for (const inq of inquiries) {
        if (!inq.tourist) continue;
        const existing = map.get(inq.tourist.id);
        if (existing) {
          existing.inquiryCount += 1;
          existing.latestStatus = inq.status;
        } else {
          map.set(inq.tourist.id, {
            id: inq.tourist.id,
            name: inq.tourist.name,
            phone: inq.tourist.phone,
            latestStatus: inq.status,
            inquiryCount: 1,
          });
        }
      }
      setTravelers([...map.values()]);
    });
  }, [token]);

  return (
    <>
      <div className="agency-panel-head">
        <h2>Travelers</h2>
        <p>Recent guests and support priorities.</p>
      </div>
      {travelers.length === 0 && <p className="muted">No travelers yet.</p>}
      <div className="agency-list">
        {travelers.map((t) => (
          <div key={t.id} className="agency-list-item">
            <span>
              {t.name} | {t.phone} | {t.inquiryCount} booking{t.inquiryCount === 1 ? "" : "s"}
            </span>
            <span className={`agency-status ${inquiryStatusClass(t.latestStatus)}`}>
              {formatInquiryStatus(t.latestStatus)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
