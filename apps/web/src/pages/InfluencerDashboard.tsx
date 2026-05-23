import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export function InfluencerDashboard() {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [tours, setTours] = useState<TourPick[]>([]);
  const [tourId, setTourId] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!token) return;
    api<DashboardData>("/influencer/dashboard", { token }).then(setData).catch(console.error);
    api<TourPick[]>("/influencer/tours", { token }).then(setTours).catch(console.error);
  }, [token]);

  async function createCode(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    await api("/influencer/codes", {
      method: "POST",
      token,
      body: JSON.stringify({ tourId: tourId || undefined, code: code || undefined }),
    });
    const refreshed = await api<DashboardData>("/influencer/dashboard", { token });
    setData(refreshed);
    setCode("");
  }

  return (
    <>
      <h1 className="section-title">Influencer dashboard</h1>
      <div className="panel">
        <p className="price">Total earned: LKR {data?.totalEarned?.toLocaleString() ?? 0}</p>
      </div>

      <div className="panel">
        <h3>Create referral code</h3>
        <form className="form-grid" onSubmit={createCode}>
          <select value={tourId} onChange={(e) => setTourId(e.target.value)}>
            <option value="">Any tour</option>
            {tours.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} (LKR {t.basePriceLkr.toLocaleString()})
              </option>
            ))}
          </select>
          <input
            placeholder="Custom code (optional)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button type="submit" className="btn btn-primary">
            Generate code
          </button>
        </form>
      </div>

      <div className="panel">
        <h3>Your codes</h3>
        <ul>
          {data?.profile.codes.map((c) => (
            <li key={c.id} style={{ marginBottom: 12 }}>
              <strong>{c.code}</strong> · {c.clickCount} clicks · {c._count.inquiries} inquiries
              <br />
              <span className="muted">
                Share: /agencies/…?ref={c.code}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

type DashboardData = {
  totalEarned: number;
  profile: {
    codes: Array<{
      id: string;
      code: string;
      clickCount: number;
      _count: { inquiries: number };
    }>;
  };
};

type TourPick = { id: string; title: string; basePriceLkr: number };
