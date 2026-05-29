import { Link } from "react-router-dom";
import { MEDIA } from "@tourpilot/shared";
import { CoverImage } from "../CoverImage";

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

function formatAgencyStats(agency: DiscoveryAgency) {
  const tours =
    agency.tourCount === 0
      ? "No tours yet"
      : `${agency.tourCount} tour${agency.tourCount === 1 ? "" : "s"}`;

  if (agency.reviewCount === 0) {
    return `New agency · ${tours}`;
  }

  return `★ ${agency.avgRating.toFixed(1)} · ${agency.reviewCount} review${
    agency.reviewCount === 1 ? "" : "s"
  } · ${tours}`;
}

export function DiscoveryAgencyCard({ agency, featured }: Props) {
  const region = agency.district?.trim() || "Sri Lanka";
  const tagline = agency.tagline?.trim() || "Curated Sri Lanka experiences";

  return (
    <Link
      to={`/agencies/${agency.slug}`}
      className={`disc-agency-card${featured ? " disc-agency-card--featured" : ""}`}
    >
      <div className="disc-agency-media">
        <CoverImage
          src={agency.coverUrl}
          fallback={MEDIA.agencyCover}
          className="disc-agency-cover"
          alt=""
        />
        {featured && <span className="disc-agency-featured-badge">Featured</span>}
      </div>

      <div className="disc-agency-body">
        <span className="disc-agency-region">{region}</span>
        <h3 className="disc-agency-name">{agency.name}</h3>
        <p className="disc-agency-tagline">{tagline}</p>
        <p className="disc-agency-meta">{formatAgencyStats(agency)}</p>
        <span className="disc-agency-cta">View agency →</span>
      </div>
    </Link>
  );
}
