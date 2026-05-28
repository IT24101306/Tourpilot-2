import type { InfluencerCommission } from "../../pages/influencer/types";
import {
  commissionPillClass,
  formatCommissionStatus,
  inquiryPillClass,
} from "../../pages/influencer/types";

type Props = {
  commission: InfluencerCommission;
};

export function CommissionCard({ commission }: Props) {
  return (
    <article className="partner-commission-card">
      <div className="partner-commission-top">
        <div>
          <strong className="partner-commission-amount">
            LKR {commission.amountLkr.toLocaleString()}
          </strong>
          <p className="muted partner-commission-meta">
            Code <strong>{commission.code}</strong> · {commission.inquiry.tourist.name}
          </p>
        </div>
        <span className={`agency-status ${commissionPillClass(commission.status)}`}>
          {formatCommissionStatus(commission.status)}
        </span>
      </div>
      <div className="partner-commission-foot">
        <span className="muted">{new Date(commission.createdAt).toLocaleString()}</span>
        <span className={`agency-status ${inquiryPillClass(commission.inquiry.status)}`}>
          Inquiry: {commission.inquiry.status.replace(/_/g, " ")}
        </span>
      </div>
    </article>
  );
}
