import type { TourOfferLinkState } from "./tourOfferLink";
import type { TourFormState, TourKind } from "../components/tour/tourFormTypes";

const STORAGE_KEY = "tourpilot.tour-builder-draft";

export const TOUR_BUILDER_RETURN_PARAM = "returnTo";
export const TOUR_BUILDER_RETURN_VALUE = "tour-builder";
export const TOUR_BUILDER_RESUME_PARAM = "resumeTour";

export type TourBuilderDraft = {
  form: TourFormState;
  modalMode: "create" | "edit";
  modalKind: TourKind;
  editingTourId: string | null;
  offerLink: TourOfferLinkState;
  initialLinkedOfferIds: string[];
};

export function saveTourBuilderDraft(draft: TourBuilderDraft) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota errors */
  }
}

export function loadTourBuilderDraft(): TourBuilderDraft | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TourBuilderDraft;
  } catch {
    return null;
  }
}

export function clearTourBuilderDraft() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function tourBuilderAllPath() {
  return `/dashboard/agency/all?${TOUR_BUILDER_RETURN_PARAM}=${TOUR_BUILDER_RETURN_VALUE}`;
}

export function tourBuilderResumePath() {
  return `/dashboard/agency/tours?${TOUR_BUILDER_RESUME_PARAM}=1`;
}
