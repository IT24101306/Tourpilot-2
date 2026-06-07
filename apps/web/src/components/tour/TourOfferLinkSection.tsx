import { ImageUrlField } from "../ImageUrlField";
import type { ManagedOffer } from "../offers/OffersDashboard";
import type { TourOfferLinkState } from "../../lib/tourOfferLink";

type Props = {
  offers: ManagedOffer[];
  link: TourOfferLinkState;
  onChange: (next: TourOfferLinkState) => void;
  uploadToken?: string | null;
  tourDefaults?: {
    title: string;
    summary: string;
    coverUrl: string;
    basePriceLkr: number;
    isPublished: boolean;
  };
};

export function TourOfferLinkSection({
  offers,
  link,
  onChange,
  uploadToken,
  tourDefaults,
}: Props) {
  function patch(partial: Partial<TourOfferLinkState>) {
    onChange({ ...link, ...partial });
  }

  function patchNewOffer(partial: Partial<TourOfferLinkState["newOffer"]>) {
    onChange({ ...link, newOffer: { ...link.newOffer, ...partial } });
  }

  function toggleExistingOffer(offerId: string, checked: boolean) {
    const next = checked
      ? [...link.existingOfferIds, offerId]
      : link.existingOfferIds.filter((id) => id !== offerId);
    patch({ existingOfferIds: next });
  }

  return (
    <section className="tour-offer-link">
      <label className="tour-offer-link-toggle">
        <input
          type="checkbox"
          checked={link.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        <span>Link to loyalty offer(s)</span>
      </label>
      <p className="muted tour-offer-link-hint">
        Same as picking tours when creating an offer — attach this itinerary to existing offers or
        create a new one.
      </p>

      {link.enabled && tourDefaults && !tourDefaults.isPublished && (
        <p className="tour-offer-link-warn">
          Publish this tour before saving — offer links only apply to published tours.
        </p>
      )}

      {link.enabled && (
        <div className="tour-offer-link-body">
          {offers.length > 0 ? (
            <fieldset className="tour-offer-link-existing">
              <legend>Existing offers</legend>
              <ul className="tour-offer-link-list">
                {offers.map((offer) => (
                  <li key={offer.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={link.existingOfferIds.includes(offer.id)}
                        onChange={(e) => toggleExistingOffer(offer.id, e.target.checked)}
                      />
                      <span>
                        {offer.title}
                        {!offer.isActive && <span className="muted"> · inactive</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          ) : (
            <p className="muted">No offers yet — create one below.</p>
          )}

          <label className="tour-offer-link-toggle tour-offer-link-create">
            <input
              type="checkbox"
              checked={link.createNew}
              onChange={(e) => {
                const createNew = e.target.checked;
                if (createNew && tourDefaults) {
                  onChange({
                    ...link,
                    createNew,
                    newOffer: {
                      ...link.newOffer,
                      title: link.newOffer.title || `${tourDefaults.title} offer`,
                      description: link.newOffer.description || tourDefaults.summary,
                      imageUrl: link.newOffer.imageUrl || tourDefaults.coverUrl,
                      tourPriceLkr: link.newOffer.tourPriceLkr || tourDefaults.basePriceLkr,
                    },
                  });
                } else {
                  patch({ createNew });
                }
              }}
            />
            <span>Create new offer with this tour</span>
          </label>

          {link.createNew && (
            <div className="tour-offer-link-new">
              <label className="field full">
                <span>Offer title</span>
                <input
                  type="text"
                  value={link.newOffer.title}
                  onChange={(e) => patchNewOffer({ title: e.target.value })}
                  placeholder="Summer special"
                  required={link.createNew}
                />
              </label>

              <label className="field full">
                <span>Reward text</span>
                <input
                  type="text"
                  value={link.newOffer.rewardText}
                  onChange={(e) => patchNewOffer({ rewardText: e.target.value })}
                  placeholder="Free airport pickup"
                  required={link.createNew}
                />
              </label>

              <label className="field full">
                <span>Description (optional)</span>
                <textarea
                  rows={2}
                  value={link.newOffer.description}
                  onChange={(e) => patchNewOffer({ description: e.target.value })}
                />
              </label>

              <ImageUrlField
                className="field image-url-field--full"
                label="Cover image (optional)"
                value={link.newOffer.imageUrl}
                onChange={(imageUrl) => patchNewOffer({ imageUrl })}
                token={uploadToken}
                placeholder="Uses tour cover if empty"
              />

              <div className="tour-offer-link-dates">
                <label className="field">
                  <span>Valid from</span>
                  <input
                    type="datetime-local"
                    value={link.newOffer.validFrom}
                    onChange={(e) => patchNewOffer({ validFrom: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Valid until</span>
                  <input
                    type="datetime-local"
                    value={link.newOffer.validUntil}
                    onChange={(e) => patchNewOffer({ validUntil: e.target.value })}
                  />
                </label>
              </div>

              <label className="field">
                <span>Registration cap</span>
                <input
                  type="number"
                  min={1}
                  value={link.newOffer.registrationCap}
                  onChange={(e) =>
                    patchNewOffer({ registrationCap: Number(e.target.value) || 1 })
                  }
                />
              </label>

              <label className="tour-offer-link-toggle" style={{ gridColumn: "1 / -1" }}>
                <input
                  type="checkbox"
                  checked={link.newOffer.isFreeTour}
                  onChange={(e) => {
                    const isFreeTour = e.target.checked;
                    const basePrice = tourDefaults?.basePriceLkr ?? link.newOffer.tourPriceLkr;
                    patchNewOffer({
                      isFreeTour,
                      discountedLkr: isFreeTour ? 0 : "",
                      tourPriceLkr: isFreeTour && link.newOffer.tourPriceLkr === 0 ? basePrice : link.newOffer.tourPriceLkr,
                      rewardText:
                        isFreeTour && !link.newOffer.rewardText.trim()
                          ? "Free tour for registered travelers"
                          : link.newOffer.rewardText,
                    });
                  }}
                />
                <span>Free tour offer</span>
              </label>

              <label className="field">
                <span>Regular tour price (LKR)</span>
                <input
                  type="number"
                  min={0}
                  value={link.newOffer.tourPriceLkr}
                  onChange={(e) =>
                    patchNewOffer({ tourPriceLkr: Number(e.target.value) || 0 })
                  }
                />
              </label>

              {!link.newOffer.isFreeTour && (
                <label className="field">
                  <span>Discounted (LKR)</span>
                  <input
                    type="number"
                    min={0}
                    value={link.newOffer.discountedLkr}
                    onChange={(e) =>
                      patchNewOffer({
                        discountedLkr: e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                    placeholder="(optional)"
                  />
                </label>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
