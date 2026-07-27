import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DEFAULT_TOUR_COVER_URL, MEDIA } from "@tourpilot/shared";
import { api, ApiError } from "../../api/client";
import type { InfluencerTour, ReferralCode } from "../../pages/influencer/types";
import { shareLinkForCode } from "../../pages/influencer/types";
import { CoverImage } from "../CoverImage";
import { DashboardModal } from "../DashboardModal";
import { RichTextHtml } from "../richtext/RichTextHtml";

type AgencyPreview = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  district: string | null;
  avgRating: number;
  reviewCount: number;
  tours: Array<{ id: string; title: string; slug: string; days: number }>;
};

type Props = {
  tour: InfluencerTour | null;
  existingCode?: ReferralCode;
  open: boolean;
  onClose: () => void;
  onCreate: () => void;
  onCopy: (text: string, label: string) => void;
};

export function InfluencerTourDetailModal({
  tour,
  existingCode,
  open,
  onClose,
  onCreate,
  onCopy,
}: Props) {
  const [agency, setAgency] = useState<AgencyPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !tour) {
      setAgency(null);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    api<AgencyPreview>(`/agencies/${tour.agency.slug}`)
      .then((data) => {
        if (!cancelled) setAgency(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setAgency(null);
          setError(err instanceof ApiError ? err.message : "Could not load agency details");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, tour?.agency.slug, tour]);

  if (!tour) return null;

  const tourPath = `/tours/${tour.agency.slug}/${tour.slug}`;
  const agencyPath = `/agencies/${tour.agency.slug}`;

  return (
    <DashboardModal
      open={open}
      title={tour.title}
      subtitle={`${tour.agency.name} · ${tour.days} days`}
      onClose={onClose}
      dialogClassName="influencer-tour-detail-dialog"
    >
      <div className="influencer-tour-detail-layout">
        <section className="influencer-tour-detail-tour">
          <CoverImage
            src={tour.coverUrl}
            fallback={DEFAULT_TOUR_COVER_URL}
            className="influencer-tour-detail-cover"
          />
          <dl className="influencer-tour-detail-facts">
            <div>
              <dt>Listed price</dt>
              <dd>LKR {tour.publicPriceLkr.toLocaleString()}</dd>
            </div>
            {tour.influencerCommissionLkr > 0 && (
              <div>
                <dt>Your commission</dt>
                <dd className="influencer-tour-detail-earn">
                  LKR {tour.influencerCommissionLkr.toLocaleString()} per booking
                </dd>
              </div>
            )}
            {tour.seasonTag && (
              <div>
                <dt>Season</dt>
                <dd>{tour.seasonTag}</dd>
              </div>
            )}
          </dl>
          {tour.summary && (
            <RichTextHtml html={tour.summary} className="influencer-tour-detail-summary" />
          )}
        </section>

        <section className="influencer-tour-detail-agency">
          <h4 className="influencer-tour-detail-agency-title">Agency</h4>
          {loading ? (
            <p className="muted">Loading agency profile…</p>
          ) : error ? (
            <p className="form-error">{error}</p>
          ) : agency ? (
            <>
              <div className="influencer-tour-detail-agency-head">
                <CoverImage
                  src={agency.logoUrl || agency.coverUrl}
                  fallback={MEDIA.agencyCover}
                  className="influencer-tour-detail-agency-logo"
                />
                <div>
                  <strong>{agency.name}</strong>
                  {agency.tagline && <p className="muted influencer-tour-detail-tagline">{agency.tagline}</p>}
                  <p className="muted influencer-tour-detail-agency-meta">
                    {agency.district && <span>{agency.district}</span>}
                    {agency.reviewCount > 0 && (
                      <span>
                        {agency.district ? " · " : ""}
                        {agency.avgRating.toFixed(1)} ★ ({agency.reviewCount} review
                        {agency.reviewCount === 1 ? "" : "s"})
                      </span>
                    )}
                    <span>
                      {(agency.district || agency.reviewCount > 0) && " · "}
                      {agency.tours.length} published tour{agency.tours.length === 1 ? "" : "s"}
                    </span>
                  </p>
                </div>
              </div>
              {agency.description && (
                <RichTextHtml
                  html={agency.description}
                  className="influencer-tour-detail-agency-desc"
                />
              )}
            </>
          ) : (
            <p className="muted">Agency details unavailable.</p>
          )}
        </section>
      </div>

      <div className="influencer-tour-detail-actions">
        <Link to={agencyPath} className="btn btn-ghost" target="_blank" rel="noreferrer">
          View agency
        </Link>
        <Link to={tourPath} className="btn btn-ghost" target="_blank" rel="noreferrer">
          Preview tour
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
          <button
            type="button"
            className="btn btn-teal"
            onClick={() => {
              onClose();
              onCreate();
            }}
          >
            Create referral code
          </button>
        )}
      </div>
    </DashboardModal>
  );
}
