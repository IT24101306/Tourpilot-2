import { Link } from "react-router-dom";
import { GuidedStepper } from "./GuidedStepper";
import { guidedListCta } from "../../lib/guidedUtils";
import { formatInquiryStatus, inquiryStatusClass } from "../../pages/agency/types";
import type { NegotiationListItem } from "../../types/negotiation";

type Props = {
  inquiry: NegotiationListItem;
};

export function GuidedTripCard({ inquiry }: Props) {
  const tourLabel = inquiry.tour?.title ?? "Custom trip";
  const cta = guidedListCta(inquiry.status);
  const needsAttention =
    inquiry.status === "SENT_TO_TOURIST" || inquiry.status === "TOURIST_VIEWED";

  return (
    <article
      className={`guided-trip-card${needsAttention ? " guided-trip-card--attention" : ""}`}
    >
      <div className="guided-trip-card-head">
        <div>
          <p className="guided-trip-eyebrow">Trip with</p>
          <h3>
            <Link to={`/trips/${inquiry.id}`}>{inquiry.agency?.name ?? "Your agency"}</Link>
          </h3>
        </div>
        <span className={`agency-status ${inquiryStatusClass(inquiry.status)}`}>
          {formatInquiryStatus(inquiry.status)}
        </span>
      </div>

      <GuidedStepper status={inquiry.status} />

      <p className="guided-trip-meta muted">
        {inquiry.type === "READY_MADE" && inquiry.tour?.title && (
          <span className="inquiry-type-pill">Ready-made tour</span>
        )}{" "}
        {tourLabel} · {inquiry.pax} traveler{inquiry.pax === 1 ? "" : "s"}
      </p>

      <Link to={`/trips/${inquiry.id}`} className="btn btn-primary">
        {cta}
      </Link>
    </article>
  );
}
