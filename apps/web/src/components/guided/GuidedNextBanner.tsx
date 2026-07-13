import { guidedStatusCopy } from "../../lib/guidedUtils";

type Props = {
  status: string;
  hasProposal?: boolean;
  partnerName?: string | null;
};

export function GuidedNextBanner({ status, hasProposal, partnerName }: Props) {
  const copy = guidedStatusCopy(status, { partnerName });
  const showCtaHint =
    (status === "SENT_TO_TOURIST" || status === "TOURIST_VIEWED") && hasProposal;

  return (
    <aside className="guided-next-banner" aria-live="polite">
      <div className="guided-next-icon" aria-hidden="true">
        ✦
      </div>
      <div className="guided-next-body">
        <strong>{copy.title}</strong>
        <p>{copy.hint}</p>
        {showCtaHint && copy.cta && (
          <p className="guided-next-cta-hint">{copy.cta} in the panel on the right →</p>
        )}
      </div>
    </aside>
  );
}
