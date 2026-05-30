import { Link } from "react-router-dom";
import type { InfluencerTour, ReferralCode } from "../../pages/influencer/types";
import { shareLinkForCode } from "../../pages/influencer/types";

import { CoverImage } from "../CoverImage";
import { MEDIA } from "@tourpilot/shared";

type Props = {
  tour: InfluencerTour;
  existingCode?: ReferralCode;
  onCreate: () => void;
  onCopy: (text: string, label: string) => void;
};

export function InfluencerTourCard({ tour, existingCode, onCreate, onCopy }: Props) {
  return (
    <article className="partner-tour-card">
      <CoverImage src={tour.coverUrl} fallback={MEDIA.agencyCover} className="partner-tour-cover" />
      <div className="partner-tour-body">
        <span className="partner-tour-agency">{tour.agency.name}</span>
        <h3>{tour.title}</h3>
        <p className="partner-tour-meta muted">
          {tour.days} days · LKR {tour.publicPriceLkr.toLocaleString()} listed
          {tour.seasonTag ? ` · ${tour.seasonTag}` : ""}
        </p>
        {tour.influencerCommissionLkr > 0 && (
          <p className="partner-tour-commission">
            You earn <strong>LKR {tour.influencerCommissionLkr.toLocaleString()}</strong> per booking
          </p>
        )}
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
