import { ImageUrlField } from "../ImageUrlField";
import { RichTextEditor } from "../richtext/RichTextEditor";
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
  /** Offer links require a published tour — parent should flip Publish on. */
  onEnsurePublished?: () => void;
};

export function TourOfferLinkSection({
  offers,
  link,
  onChange,
  uploadToken,
  tourDefaults,
  onEnsurePublished,
}: Props) {
  function patch(partial: Partial<TourOfferLinkState>) {
    onChange({ ...link, ...partial });
  }

  function patchNewOffer(partial: Partial<TourOfferLinkState["newOffer"]>) {
    onChange({ ...link, newOffer: { ...link.newOffer, ...partial } });
  }

  function enableLinking(enabled: boolean) {
    if (!enabled) {
      patch({ enabled: false });
      return;
    }

    onEnsurePublished?.();

    const defaults = tourDefaults;
    const shouldCreateNew =
      link.createNew || link.existingOfferIds.length === 0 || offers.length === 0;

    onChange({
      ...link,
      enabled: true,
      createNew: shouldCreateNew,
      newOffer: {
        ...link.newOffer,
        title:
          link.newOffer.title.trim() ||
          (defaults?.title ? `${defaults.title} offer` : "Loyalty offer"),
        description: link.newOffer.description || defaults?.summary || "",
        imageUrl: link.newOffer.imageUrl || defaults?.coverUrl || "",
        tourPriceLkr:
          link.newOffer.tourPriceLkr > 0
            ? link.newOffer.tourPriceLkr
            : defaults?.basePriceLkr ?? 0,
        rewardText:
          link.newOffer.rewardText.trim() || "Loyalty reward for registered travelers",
      },
    });
  }

  const linkIncomplete =
    link.enabled && !link.createNew && link.existingOfferIds.length === 0;

  return (
    <section className="tour-offer-link" id="tour-offer-link-section">
      <label className="tour-offer-link-toggle">
        <input
          type="checkbox"
          checked={link.enabled}
          onChange={(e) => enableLinking(e.target.checked)}
        />
        <span>Link to loyalty offer(s)</span>
      </label>
      <p className="muted tour-offer-link-hint">
        Same as picking tours when creating an offer — attach this itinerary to existing offers or
        create a new one.
      </p>

      {link.enabled && tourDefaults && !tourDefaults.isPublished && (
        <p className="tour-offer-link-warn">
          This tour will be published so it can be linked to a loyalty offer.
        </p>
      )}

      {linkIncomplete && (
        <p className="tour-offer-link-warn" role="alert">
          Select an existing offer below, or keep “Create new offer with this tour” checked.
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
                        onChange={(e) => {
                          const checked = e.target.checked;
                          const existingOfferIds = checked
                            ? [...link.existingOfferIds, offer.id]
                            : link.existingOfferIds.filter((id) => id !== offer.id);
                          onChange({
                            ...link,
                            existingOfferIds,
                            // Keep a valid link state: either an existing offer or create-new.
                            createNew:
                              existingOfferIds.length > 0 ? false : true,
                          });
                        }}
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
                      rewardText:
                        link.newOffer.rewardText.trim() ||
                        "Loyalty reward for registered travelers",
                    },
                  });
                } else {
                  if (!createNew && link.existingOfferIds.length === 0 && offers.length > 0) {
                    // Turning off create-new with no existing selection leaves an invalid state.
                    patch({ createNew: false });
                    return;
                  }
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
                <RichTextEditor
                  rows={2}
                  value={link.newOffer.description}
                  onChange={(description) => patchNewOffer({ description })}
                  aria-label="Offer description"
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
