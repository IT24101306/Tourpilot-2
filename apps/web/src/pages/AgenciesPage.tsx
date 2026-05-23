import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

type AgencyCard = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  district: string | null;
  avgRating: number;
  reviewCount: number;
  tourCount: number;
};

export function AgenciesPage() {
  const [agencies, setAgencies] = useState<AgencyCard[]>([]);

  useEffect(() => {
    api<AgencyCard[]>("/agencies").then(setAgencies).catch(console.error);
  }, []);

  return (
    <section className="section">
      <h1 className="section-title">Travel agencies</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Browse verified agencies and their ready-made tours. Every tour shows pricing upfront.
      </p>
      <div className="grid-3">
        {agencies.map((a) => (
          <Link key={a.id} to={`/agencies/${a.slug}`} className="card" style={{ textDecoration: "none" }}>
            <div className="card-body">
              <h3>{a.name}</h3>
              <p className="muted">{a.district || "Sri Lanka"}</p>
              <p className="muted">
                ★ {a.avgRating} · {a.tourCount} tours
              </p>
              <span className="btn btn-primary" style={{ marginTop: 12 }}>
                View agency
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
