import type { ConfirmSummaryItem } from "../components/confirm/ConfirmActionContext";
import type { ManagedOffer } from "../components/offers/OffersDashboard";
import type { TourFormState, TourKind, EntityOption } from "../components/tour/tourFormTypes";
import { buildTourPlanPayload } from "../components/tour/tourFormTypes";

export type TourOfferNewDraft = {
  title: string;
  description: string;
  imageUrl: string;
  rewardText: string;
  registrationCap: number;
  validFrom: string;
  validUntil: string;
  tourPriceLkr: number;
  discountedLkr: number | "";
  isFreeTour: boolean;
};

export type TourOfferLinkState = {
  enabled: boolean;
  existingOfferIds: string[];
  createNew: boolean;
  newOffer: TourOfferNewDraft;
};

export type LinkedOfferLite = {
  id: string;
  title: string;
  isActive: boolean;
};

function toLocalDateTimeValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export function emptyTourOfferLink(): TourOfferLinkState {
  const now = new Date();
  const in7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return {
    enabled: false,
    existingOfferIds: [],
    createNew: false,
    newOffer: {
      title: "",
      description: "",
      imageUrl: "",
      rewardText: "",
      registrationCap: 50,
      validFrom: toLocalDateTimeValue(now),
      validUntil: toLocalDateTimeValue(in7),
      tourPriceLkr: 0,
      discountedLkr: "",
      isFreeTour: false,
    },
  };
}

export function tourOfferLinkFromTour(
  tour: { title: string; summary?: string; coverUrl?: string; basePriceLkr: number },
  linked: LinkedOfferLite[] | string[]
): TourOfferLinkState {
  const linkedIds = linked.map((l) => (typeof l === "string" ? l : l.id));
  const base = emptyTourOfferLink();
  return {
    ...base,
    enabled: linkedIds.length > 0,
    existingOfferIds: linkedIds,
    newOffer: {
      ...base.newOffer,
      title: tour.title ? `${tour.title} offer` : "",
      description: tour.summary ?? "",
      imageUrl: tour.coverUrl ?? "",
      tourPriceLkr: tour.basePriceLkr,
    },
  };
}

function validateOfferDates(validFrom: string, validUntil: string): string | null {
  if (new Date(validFrom).getTime() > new Date(validUntil).getTime()) {
    return "Offer valid-from must be before valid-until.";
  }
  return null;
}

function validateDiscount(tourPriceLkr: number, discountedLkr: number | ""): string | null {
  if (discountedLkr !== "" && Number(discountedLkr) > tourPriceLkr) {
    return "Discounted price must be less than or equal to tour price.";
  }
  return null;
}

export function validateTourOfferLink(
  link: TourOfferLinkState,
  opts?: { isPublished?: boolean }
): string | null {
  if (!link.enabled) return null;

  if (!link.createNew && link.existingOfferIds.length === 0) {
    return "Select at least one existing offer or enable “Create new offer”.";
  }

  if (opts?.isPublished === false) {
    return "Publish the tour or turn off offer linking before saving.";
  }

  if (link.createNew) {
    if (!link.newOffer.title.trim()) return "Offer title is required.";
    if (!link.newOffer.rewardText.trim()) return "Reward text is required.";
    if (!link.newOffer.validFrom || !link.newOffer.validUntil) return "Offer dates are required.";
    if (Number(link.newOffer.registrationCap) < 1) return "Registration cap must be at least 1.";

    const dateErr = validateOfferDates(link.newOffer.validFrom, link.newOffer.validUntil);
    if (dateErr) return dateErr;

    const discounted = link.newOffer.isFreeTour ? 0 : link.newOffer.discountedLkr;
    const discountErr = validateDiscount(link.newOffer.tourPriceLkr, discounted);
    if (discountErr) return discountErr;
  }

  return null;
}

export function buildOfferLinkPayload(
  link: TourOfferLinkState,
  initialLinkedOfferIds: string[]
) {
  const hasChanges =
    link.enabled ||
    initialLinkedOfferIds.length > 0 ||
    link.existingOfferIds.length > 0 ||
    link.createNew;

  if (!hasChanges) return undefined;

  return {
    enabled: link.enabled,
    existingOfferIds: link.existingOfferIds,
    createNew: link.createNew,
    initialLinkedOfferIds,
    ...(link.createNew
      ? {
          newOffer: {
            title: link.newOffer.title.trim(),
            description: link.newOffer.description.trim() || undefined,
            imageUrl: link.newOffer.imageUrl.trim() || undefined,
            rewardText: link.newOffer.rewardText.trim(),
            registrationCap: Number(link.newOffer.registrationCap),
            validFrom: new Date(link.newOffer.validFrom).toISOString(),
            validUntil: new Date(link.newOffer.validUntil).toISOString(),
            tourPriceLkr: Number(link.newOffer.tourPriceLkr),
            discountedLkr: link.newOffer.isFreeTour
              ? 0
              : link.newOffer.discountedLkr === ""
                ? undefined
                : Number(link.newOffer.discountedLkr),
          },
        }
      : {}),
  };
}

export function buildTourSavePayload(
  form: TourFormState,
  tourKind: TourKind,
  offerLink: TourOfferLinkState,
  initialLinkedOfferIds: string[],
  entities: EntityOption[] = []
) {
  const offerLinkPayload = buildOfferLinkPayload(offerLink, initialLinkedOfferIds);
  return {
    ...buildTourPlanPayload(form, tourKind, entities),
    ...(offerLinkPayload ? { offerLink: offerLinkPayload } : {}),
  };
}

export function getOfferLinkConfirmSummary(
  offerLink: TourOfferLinkState,
  initialLinkedOfferIds: string[],
  offers: ManagedOffer[],
  editingTourId: string | null
): ConfirmSummaryItem[] {
  const summary: ConfirmSummaryItem[] = [];

  if (offerLink.enabled) {
    const linkedNames = offers
      .filter((o) => offerLink.existingOfferIds.includes(o.id))
      .map((o) => o.title);
    summary.push({
      label: "Offer links",
      value: linkedNames.length ? linkedNames.join(", ") : "None selected",
    });
    if (offerLink.createNew) {
      summary.push({
        label: "New offer",
        value: offerLink.newOffer.title.trim() || "(untitled)",
      });
    }
  } else if (initialLinkedOfferIds.length > 0) {
    summary.push({
      label: "Offer links",
      value: "This will remove the tour from all linked loyalty offers.",
      tone: "warning",
    });
  }

  if (editingTourId) {
    const emptied = offers.filter((o) => {
      if (!initialLinkedOfferIds.includes(o.id)) return false;
      if (offerLink.enabled && offerLink.existingOfferIds.includes(o.id)) return false;
      const remaining = o.tourIds.filter((id) => id !== editingTourId);
      return remaining.length === 0;
    });

    if (emptied.length > 0) {
      summary.push({
        label: "Offers affected",
        value: `${emptied.map((o) => `"${o.title}"`).join(", ")} will have no tours left.`,
        tone: "warning",
      });
    }
  }

  return summary;
}
