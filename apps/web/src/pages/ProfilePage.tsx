import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

type InquirySummary = {
  id: string;
};

export function ProfilePage() {
  const { user, token } = useAuth();
  const [inquiries, setInquiries] = useState<InquirySummary[]>([]);

  const loadInquiries = useCallback(async () => {
    if (!token || user?.role !== "TOURIST") return;
    const list = await api<InquirySummary[]>("/inquiries/mine", { token });
    setInquiries(list);
  }, [token, user?.role]);

  useEffect(() => {
    loadInquiries().catch(console.error);
  }, [loadInquiries]);

  if (!user) {
    return (
      <section className="section">
        <p>
          Please <Link to="/login">log in</Link>.
        </p>
      </section>
    );
  }

  return (
    <section className="section profile-page">
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
        <div className="neg-profile-cta panel">
          <h2 className="section-title">My trips</h2>
          <p className="muted">
            Plan with your agency in a dedicated trip room — compare options, chat, and confirm in
            one guided space.
          </p>
          {inquiries.length > 0 ? (
            <p>
              You have <strong>{inquiries.length}</strong> trip
              {inquiries.length === 1 ? "" : "s"} in progress.
            </p>
          ) : (
            <p className="muted">
              No trips yet. Browse <Link to="/agencies">agencies</Link> and send an inquiry.
            </p>
          )}
          <Link to="/trips" className="btn btn-primary" style={{ marginTop: 12 }}>
            Open My trips
          </Link>
        </div>
      )}
    </section>
  );
}
