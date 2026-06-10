import {
  offerRewardTierForEveryone,
  type OfferRewardTier,
} from "@tourpilot/shared";
import { OfferRewardRoadmap } from "../discovery/OfferRewardRoadmap";

type Props = {
  tiers: OfferRewardTier[];
  onChange: (tiers: OfferRewardTier[]) => void;
  registrationCap?: number;
  previewRegisteredCount?: number;
};

function emptyTier(): OfferRewardTier {
  return { registrationsRequired: 50, winnersCount: 50, rewardLabel: "free dinners" };
}

export function OfferRewardTiersEditor({
  tiers,
  onChange,
  registrationCap,
  previewRegisteredCount = 0,
}: Props) {
  function updateTier(index: number, patch: Partial<OfferRewardTier>) {
    onChange(tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function removeTier(index: number) {
    onChange(tiers.filter((_, i) => i !== index));
  }

  function toggleEveryone(index: number, checked: boolean) {
    const tier = tiers[index];
    if (!tier) return;
    updateTier(index, {
      winnersCount: checked ? tier.registrationsRequired : Math.min(tier.winnersCount, tier.registrationsRequired - 1) || 1,
    });
  }

  return (
    <div className="offer-tiers-editor">
      <div className="offer-tiers-editor__head">
        <span className="offer-tiers-editor__title">Reward roadmap</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...tiers, emptyTier()])}>
          + Add milestone
        </button>
      </div>
      <p className="muted offer-tiers-editor__hint">
        Set registration milestones and what travelers win. Example: at 50 registrations everyone gets free dinners;
        at 100 registrations one person wins a free tour.
      </p>
      {tiers.length === 0 ? (
        <p className="muted">No milestones yet. Add at least one reward step for the roadmap.</p>
      ) : (
        <ul className="offer-tiers-editor__list">
          {tiers.map((tier, index) => {
            const everyone = offerRewardTierForEveryone(tier);
            return (
              <li key={index} className="offer-tiers-editor__row">
                <label className="field">
                  <span>Registrations needed</span>
                  <input
                    type="number"
                    min={1}
                    value={tier.registrationsRequired}
                    onChange={(e) => {
                      const registrationsRequired = Number(e.target.value) || 1;
                      const patch: Partial<OfferRewardTier> = { registrationsRequired };
                      if (everyone) patch.winnersCount = registrationsRequired;
                      updateTier(index, patch);
                    }}
                  />
                </label>
                <label className="field">
                  <span>Winners</span>
                  <input
                    type="number"
                    min={1}
                    value={tier.winnersCount}
                    disabled={everyone}
                    onChange={(e) => updateTier(index, { winnersCount: Number(e.target.value) || 1 })}
                  />
                </label>
                <label className="field offer-tiers-editor__reward">
                  <span>Reward</span>
                  <input
                    type="text"
                    value={tier.rewardLabel}
                    onChange={(e) => updateTier(index, { rewardLabel: e.target.value })}
                    placeholder="e.g. a free tour / free dinners"
                  />
                </label>
                <label className="offer-tiers-editor__everyone">
                  <input
                    type="checkbox"
                    checked={everyone}
                    onChange={(e) => toggleEveryone(index, e.target.checked)}
                  />
                  <span>Everyone who registered gets this reward</span>
                </label>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeTier(index)}>
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {tiers.length > 0 && (
        <div className="offer-tiers-editor__preview">
          <p className="offer-tiers-editor__preview-title">Preview</p>
          <OfferRewardRoadmap
            tiers={tiers}
            registeredCount={previewRegisteredCount}
            registrationCap={registrationCap}
            expanded
          />
        </div>
      )}
    </div>
  );
}
