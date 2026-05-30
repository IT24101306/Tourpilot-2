import type { ReferralCode } from "../../pages/influencer/types";
import { shareLinkForCode } from "../../pages/influencer/types";

type Props = {
  code: ReferralCode;
  onCopy: (text: string, label: string) => void;
};

export function ReferralCodeCard({ code, onCopy }: Props) {
  const link = shareLinkForCode(code);

  return (
    <article className={`partner-code-card${code.isActive ? "" : " partner-code-card--inactive"}`}>
      <div className="partner-code-head">
        <div>
          <span className="partner-code-label">Referral code</span>
          <strong className="partner-code-value">{code.code}</strong>
        </div>
        <span className={`agency-status ${code.isActive ? "ok" : "late"}`}>
          {code.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      {code.tour ? (
        <p className="partner-code-tour muted">
          {code.tour.agency.name} — {code.tour.title}
        </p>
      ) : (
        <p className="partner-code-tour muted">No tour linked</p>
      )}

      <div className="partner-code-metrics">
        <div>
          <span className="partner-metric-value">
            {code.tour && code.tour.influencerCommissionLkr > 0
              ? `LKR ${code.tour.influencerCommissionLkr.toLocaleString()}`
              : "—"}
          </span>
          <span className="partner-metric-label">You earn</span>
        </div>
        <div>
          <span className="partner-metric-value">{code.clickCount}</span>
          <span className="partner-metric-label">Clicks</span>
        </div>
        <div>
          <span className="partner-metric-value">{code.inquiryCount}</span>
          <span className="partner-metric-label">Inquiries</span>
        </div>
        <div>
          <span className="partner-metric-value">{code.commissionCount}</span>
          <span className="partner-metric-label">Commissions</span>
        </div>
      </div>

      <div className="partner-share-row">
        <code className="partner-share-url">{link}</code>
        <button type="button" className="btn btn-primary" onClick={() => onCopy(link, "Referral link")}>
          Copy link
        </button>
      </div>
    </article>
  );
}
