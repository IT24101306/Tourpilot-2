import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { AgencyInquiry, AgencyTour, formatInquiryStatus, inquiryStatusClass, isToday } from "./types";

export function AgencyOverviewPage() {
  const { token } = useAuth();
  const [tours, setTours] = useState<AgencyTour[]>([]);
  const [inquiries, setInquiries] = useState<AgencyInquiry[]>([]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api<AgencyTour[]>("/tours/agency/mine", { token }),
      api<AgencyInquiry[]>("/inquiries/mine", { token }),
    ]).then(([t, i]) => {
      setTours(t);
      setInquiries(i);
    });
  }, [token]);

  const activeTours = tours.filter((t) => t.isPublished).length;
  const todayBookings = inquiries.filter((i) => isToday(i.createdAt)).length;
  const confirmed = inquiries.filter((i) =>
    ["ACCEPTED", "SENT_TO_TOURIST", "TOURIST_VIEWED"].includes(i.status)
  ).length;
  const confirmRate = inquiries.length ? Math.round((confirmed / inquiries.length) * 100) : 0;
  const publishedValue = tours
    .filter((t) => t.isPublished)
    .reduce((sum, t) => sum + t.basePriceLkr, 0);

  return (
    <>
      <div className="agency-panel-head">
        <h2>Dashboard Overview</h2>
        <p>Track today&apos;s performance and active operations in one place.</p>
      </div>
      <div className="agency-stat-grid">
        <Link to="/dashboard/agency/tours" className="agency-stat-card clickable">
          <h3>Active Tours</h3>
          <p className="agency-stat-value">{activeTours}</p>
          <p className="agency-stat-sub">{tours.length} total in catalog</p>
        </Link>
        <Link to="/dashboard/agency/bookings" className="agency-stat-card">
          <h3>Today Bookings</h3>
          <p className="agency-stat-value">{todayBookings}</p>
          <p className="agency-stat-sub">{confirmRate}% confirmation rate</p>
        </Link>
        <div className="agency-stat-card">
          <h3>Revenue</h3>
          <p className="agency-stat-value">LKR {publishedValue.toLocaleString()}</p>
          <p className="agency-stat-sub">Published tour catalog value</p>
        </div>
      </div>
      {inquiries.length > 0 && (
        <div className="agency-panel" style={{ marginTop: 20 }}>
          <h3>Recent inquiries</h3>
          <div className="agency-list">
            {inquiries.slice(0, 5).map((inq) => (
              <div key={inq.id} className="agency-list-item">
                <span>
                  {inq.tourist?.name || "Traveler"} · {inq.type.replace("_", " ")} · {inq.pax}{" "}
                  guests
                </span>
                <span className={`agency-status ${inquiryStatusClass(inq.status)}`}>
                  {formatInquiryStatus(inq.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
