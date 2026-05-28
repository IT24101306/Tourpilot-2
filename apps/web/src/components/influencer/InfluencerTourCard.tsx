import { Link } from "react-router-dom";
import type { InfluencerTour, ReferralCode } from "../../pages/influencer/types";
import { shareLinkForCode } from "../../pages/influencer/types";

const FALLBACK =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80";

type Props = {
  tour: InfluencerTour;
  existingCode?: ReferralCode;
  onCreate: () => void;
  onCopy: (text: string, label: string) => void;
};

export function InfluencerTourCard({ tour, existingCode, onCreate, onCopy }: Props) {
  return (
    <article className="partner-tour-card">
      <div
        className="partner-tour-cover"
        style={{ backgroundImage: `url(${tour.coverUrl || FALLBACK})` }}
      />
      <div className="partner-tour-body">
        <span className="partner-tour-agency">{tour.agency.name}</span>
        <h3>{tour.title}</h3>
        <p className="partner-tour-meta muted">
          {tour.days} days · LKR {tour.basePriceLkr.toLocaleString()}
          {tour.seasonTag ? ` · ${tour.seasonTag}` : ""}
        </p>
        {tour.summary && <p className="partner-tour-summary">{tour.summary}</p>}
        <div className="partner-tour-actions">
          <Link
            to={`/tours/${tour.agency.slug}/${tour.slug}`}
            className="btn btn-ghost"
            target="_blank"
            rel="noreferrer"
          >
            Preview
          </Link>
          {existingCode ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onCopy(shareLinkForCode(existingCode), `Link (${existingCode.code})`)}
            >
              Copy {existingCode.code}
            </button>
          ) : (
            <button type="button" className="btn btn-teal" onClick={onCreate}>
              Create code
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
