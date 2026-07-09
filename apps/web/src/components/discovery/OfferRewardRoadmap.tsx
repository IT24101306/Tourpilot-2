import { useState, type MouseEvent } from "react";
import {
  offerRewardTierDisplayLine,
  offerRewardTierHeadline,
  offerRewardTierIcon,
  offerRewardTierMilestoneHeading,
  parseOfferRewardTiers,
  summarizeOfferRewardTiers,
  type OfferRewardTier,
} from "@tourpilot/shared";

type Props = {
  tiers: OfferRewardTier[];
  registeredCount: number;
  registrationCap?: number;
  className?: string;
  /** Show full roadmap (dashboard preview). */
  expanded?: boolean;
  /** Tap to expand/collapse on public offer cards. */
  interactive?: boolean;
};

function roadmapScaleMax(tiers: OfferRewardTier[], registeredCount: number, registrationCap?: number) {
  const tierMax = tiers.reduce((max, t) => Math.max(max, t.registrationsRequired), 0);
  return Math.max(registrationCap ?? 0, tierMax, registeredCount, 1);
}

function RoadmapTrack({
  sorted,
  scaleMax,
  progressPct,
  registeredCount,
  nextTier,
  compact,
}: {
  sorted: OfferRewardTier[];
  scaleMax: number;
  progressPct: number;
  registeredCount: number;
  nextTier: OfferRewardTier | undefined;
  compact: boolean;
}) {
  return (
    <div className="offer-reward-roadmap__track-wrap">
      <div
        className="offer-reward-roadmap__track"
        role="img"
        aria-label={`Registration progress: ${registeredCount} of ${scaleMax}`}
      >
        <div className="offer-reward-roadmap__track-base" />
        <div className="offer-reward-roadmap__track-fill" style={{ width: `${progressPct}%` }} />
        {sorted.map((tier, index) => {
          const leftPct = (tier.registrationsRequired / scaleMax) * 100;
          const unlocked = registeredCount >= tier.registrationsRequired;
          return (
            <div
              key={`${tier.registrationsRequired}-${index}`}
              className={`offer-reward-roadmap__milestone${unlocked ? " is-unlocked" : ""}${
                nextTier?.registrationsRequired === tier.registrationsRequired ? " is-next" : ""
              }`}
              style={{ left: `${leftPct}%` }}
            >
              <span className="offer-reward-roadmap__milestone-dot" aria-hidden="true" />
              {!compact && (
                <span className="offer-reward-roadmap__milestone-count">{tier.registrationsRequired}</span>
              )}
            </div>
          );
        })}
        <div
          className="offer-reward-roadmap__needle"
          style={{ left: `${progressPct}%` }}
          aria-hidden="true"
        />
      </div>
      {!compact && (
        <div className="offer-reward-roadmap__scale" aria-hidden="true">
          <span>0</span>
          <span>{scaleMax}</span>
        </div>
      )}
    </div>
  );
}

export function OfferRewardRoadmap({
  tiers,
  registeredCount,
  registrationCap,
  className = "",
  expanded: expandedProp,
  interactive = false,
}: Props) {
  const [expandedInternal, setExpandedInternal] = useState(false);
  const expanded = expandedProp ?? expandedInternal;

  const sorted = parseOfferRewardTiers(tiers);
  if (sorted.length === 0) return null;

  const scaleMax = roadmapScaleMax(sorted, registeredCount, registrationCap);
  const progressPct = Math.min(100, Math.round((registeredCount / scaleMax) * 100));
  const nextTier = sorted.find((t) => registeredCount < t.registrationsRequired);
  const summary = summarizeOfferRewardTiers(sorted);

  const rootClass = [
    "offer-reward-roadmap",
    expanded ? "is-expanded" : "is-compact",
    interactive ? "is-interactive" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  function onToggle(e: MouseEvent<HTMLElement>) {
    if (!interactive || expandedProp !== undefined) return;
    e.stopPropagation();
    setExpandedInternal((open) => !open);
  }

  const content = expanded ? (
    <>
      <RoadmapTrack
        sorted={sorted}
        scaleMax={scaleMax}
        progressPct={progressPct}
        registeredCount={registeredCount}
        nextTier={nextTier}
        compact={false}
      />
      <ul className="offer-reward-roadmap__details">
        {sorted.map((tier, index) => {
          const unlocked = registeredCount >= tier.registrationsRequired;
          const isNext = nextTier?.registrationsRequired === tier.registrationsRequired;
          return (
            <li
              key={`${tier.registrationsRequired}-${index}`}
              className={`offer-reward-roadmap__detail${unlocked ? " is-unlocked" : ""}${
                isNext ? " is-next" : ""
              }`}
            >
              <p className="offer-reward-roadmap__detail-heading">
                {offerRewardTierMilestoneHeading(tier)}
              </p>
              <p className="offer-reward-roadmap__detail-reward">
                <span className="offer-reward-roadmap__detail-icon" aria-hidden="true">
                  {offerRewardTierIcon(tier)}
                </span>
                <span>{offerRewardTierDisplayLine(tier)}</span>
              </p>
            </li>
          );
        })}
      </ul>
      <p className="offer-reward-roadmap__footnote">
        {registeredCount} registered
        {nextTier
          ? ` · ${nextTier.registrationsRequired - registeredCount} more for ${offerRewardTierHeadline(nextTier)}`
          : " · All milestones unlocked"}
      </p>
    </>
  ) : (
    <>
      <RoadmapTrack
        sorted={sorted}
        scaleMax={scaleMax}
        progressPct={progressPct}
        registeredCount={registeredCount}
        nextTier={nextTier}
        compact
      />
      <p className="offer-reward-roadmap__summary">{summary}</p>
    </>
  );

  if (interactive && expandedProp === undefined) {
    return (
      <button
        type="button"
        className={rootClass}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse reward roadmap" : "Expand reward roadmap"}
      >
        {content}
        <span className="offer-reward-roadmap__toggle-hint">{expanded ? "Show less" : "Tap for details"}</span>
      </button>
    );
  }

  return <div className={rootClass}>{content}</div>;
}
