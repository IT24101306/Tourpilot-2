type BadgeLite = {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
  earned?: boolean;
  progressHint?: string;
};

type Props = {
  badges: BadgeLite[];
  /** When true, show locked badges with how-to-earn hints (agency dashboard). */
  showProgress?: boolean;
  compact?: boolean;
};

function sortedBadges(badges: BadgeLite[], showProgress: boolean): BadgeLite[] {
  const list = showProgress ? [...badges] : badges.filter((b) => b.earned !== false);
  if (!showProgress) return list;
  return list.sort((a, b) => {
    const ae = a.earned !== false ? 0 : 1;
    const be = b.earned !== false ? 0 : 1;
    return ae - be;
  });
}

export function TrustBadgeRow({ badges, showProgress = false, compact = false }: Props) {
  const list = sortedBadges(badges, showProgress);
  if (!list.length) return null;

  const rootClass = [
    "trust-badge-row",
    compact && "trust-badge-row--compact",
    showProgress && "trust-badge-row--progress",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <ul className={rootClass} aria-label="Trust signals">
      {list.map((b) => {
        const earned = b.earned !== false;
        const hint = !earned ? b.progressHint || b.description : b.description;
        return (
          <li
            key={b.key}
            className={`trust-badge${earned ? " trust-badge--earned" : " trust-badge--locked"}`}
            title={hint}
          >
            <span className="trust-badge__status" aria-hidden="true">
              {earned ? "✓" : "○"}
            </span>
            <span className="trust-badge__copy">
              <span className="trust-badge__label">{compact ? b.shortLabel : b.label}</span>
              {showProgress ? (
                <span className="trust-badge__hint">
                  {earned ? "Unlocked" : b.progressHint || "Keep going"}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
