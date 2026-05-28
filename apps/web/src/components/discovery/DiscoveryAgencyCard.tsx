import { Link } from "react-router-dom";

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80";

export type DiscoveryAgency = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  coverUrl: string | null;
  district: string | null;
  avgRating: number;
  reviewCount: number;
  tourCount: number;
};

type Props = {
  agency: DiscoveryAgency;
  featured?: boolean;
};

export function DiscoveryAgencyCard({ agency, featured }: Props) {
  return (
    <Link
      to={`/agencies/${agency.slug}`}
      className={`disc-agency-card${featured ? " disc-agency-card--featured" : ""}`}
    >
      <div
        className="disc-agency-cover"
        style={{ backgroundImage: `url(${agency.coverUrl || FALLBACK_COVER})` }}
      />
      <div className="disc-agency-body">
        {agency.district && <span className="disc-agency-region">{agency.district}</span>}
        <h3>{agency.name}</h3>
        <p className="disc-agency-tagline">{agency.tagline || "Curated Sri Lanka experiences"}</p>
        <p className="disc-agency-meta">
          ★ {agency.avgRating.toFixed(1)} · {agency.reviewCount} reviews · {agency.tourCount} tours
        </p>
        <span className="disc-agency-cta">View agency →</span>
      </div>
    </Link>
  );
}
