import { pipelineNextActions } from "@tourpilot/shared";

type Props = {
  status: string;
  role: "AGENCY" | "TOURIST";
  onCta?: () => void;
};

/** Status pipeline next-action strip for trip room / hub. */
export function PipelineNextBanner({ status, role, onCta }: Props) {
  const next = pipelineNextActions(status, role);
  if (!next) return null;

  return (
    <div className="pipeline-next" role="status">
      <div className="pipeline-next__copy">
        <strong>{next.title}</strong>
        <p>{next.hint}</p>
      </div>
      {next.ctaLabel && onCta ? (
        <button type="button" className="btn btn-primary" onClick={onCta}>
          {next.ctaLabel}
        </button>
      ) : null}
    </div>
  );
}
