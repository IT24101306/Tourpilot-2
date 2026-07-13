import { GuidedStepper } from "./GuidedStepper";
import { guidedListCta } from "../../lib/guidedUtils";
import { formatInquiryStatus, inquiryStatusClass } from "../../pages/agency/types";
import type { NegotiationListItem } from "../../types/negotiation";

type Props = {
  inquiry: NegotiationListItem;
  onOpen?: () => void;
};

export function GuidedTripCard({ inquiry, onOpen }: Props) {
  const tourLabel = inquiry.tour?.title ?? "Custom trip";
  const cta = guidedListCta(inquiry.status);
  const needsAttention =
    inquiry.status === "SENT_TO_TOURIST" || inquiry.status === "TOURIST_VIEWED";
  const partnerName =
    inquiry.whiteLabel && inquiry.handlerInfluencer?.name
      ? inquiry.handlerInfluencer.name
      : inquiry.agency?.name ?? "Your travel partner";

  return (
    <article
      className={`guided-trip-card${needsAttention ? " guided-trip-card--attention" : ""}`}
    >
      <div className="guided-trip-card-head">
        <div>
          <p className="guided-trip-eyebrow">Trip with</p>
          <h3>
            {onOpen ? (
              <button type="button" className="guided-trip-card__title-btn" onClick={onOpen}>
                {partnerName}
              </button>
            ) : (
              partnerName
            )}
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

      {onOpen ? (
        <button type="button" className="btn btn-primary" onClick={onOpen}>
          {cta}
        </button>
      ) : null}
    </article>
  );
}
