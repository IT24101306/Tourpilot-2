import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

type Inquiry = {
  id: string;
  status: string;
  type: string;
  agency: { name: string; slug: string };
  tour: { title: string } | null;
  itineraries: Array<{ grandMax: number; shareToken: string | null; isSent: boolean }>;
};

export function ProfilePage() {
  const { user, token } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);

  useEffect(() => {
    if (!token) return;
    api<Inquiry[]>("/inquiries/mine", { token }).then(setInquiries).catch(console.error);
  }, [token]);

  if (!user) {
    return (
      <section className="section">
        <p>Please <Link to="/login">log in</Link>.</p>
      </section>
    );
  }

  return (
    <section className="section">
      <h1 className="section-title">My profile</h1>
      <div className="panel">
        <p>
          <strong>{user.name}</strong>
        </p>
        <p className="muted">{user.phone}</p>
        <p className="muted">Role: {user.role}</p>
        <p className="price">Wallet: LKR {user.walletBalance.toLocaleString()}</p>
      </div>

      {user.role === "TOURIST" && (
        <>
          <h2 className="section-title">My inquiries</h2>
          {inquiries.map((inq) => {
            const itin = inq.itineraries[0];
            return (
              <div key={inq.id} className="panel">
                <p>
                  <strong>{inq.agency.name}</strong> · {inq.status}
                </p>
                <p className="muted">
                  {inq.type} {inq.tour ? `· ${inq.tour.title}` : ""}
                </p>
                {itin?.isSent && itin.shareToken && (
                  <>
                    <p className="price">Total up to LKR {itin.grandMax.toLocaleString()}</p>
                    <Link to={`/itinerary/${itin.shareToken}`}>View itinerary</Link>
                  </>
                )}
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}
