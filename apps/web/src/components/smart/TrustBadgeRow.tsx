import type { EarnedTrustBadge } from "@tourpilot/shared";

type BadgeLite = Pick<EarnedTrustBadge, "key" | "label" | "shortLabel" | "description"> & {
  earned?: boolean;
  progressHint?: string;
};

type Props = {
  badges: BadgeLite[];
  /** When true, show locked badges with how-to-earn hints (agency dashboard). */
  showProgress?: boolean;
  compact?: boolean;
};

export function TrustBadgeRow({ badges, showProgress = false, compact = false }: Props) {
  const list = showProgress ? badges : badges.filter((b) => b.earned !== false);
  if (!list.length) return null;

  return (
    <ul className={`trust-badge-row${compact ? " trust-badge-row--compact" : ""}`} aria-label="Trust signals">
      {list.map((b) => {
        const earned = b.earned !== false;
        return (
          <li
            key={b.key}
            className={`trust-badge${earned ? " trust-badge--earned" : " trust-badge--locked"}`}
            title={earned ? b.description : b.progressHint || b.description}
          >
            <span className="trust-badge__label">{compact ? b.shortLabel : b.label}</span>
            {showProgress && !earned && b.progressHint ? (
              <span className="trust-badge__hint">{b.progressHint}</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
