/** AI Trip Planner request/response shapes (LLM-backed). */

export type TripPlannerPace = "relaxed" | "balanced" | "packed";

export type TripPlannerRequest = {
  days: number;
  pax: number;
  interests: string[];
  budgetMinLkr?: number | null;
  budgetMaxLkr?: number | null;
  startDate?: string | null;
  pace?: TripPlannerPace;
  notes?: string | null;
};

export type TripPlannerDestination = {
  name: string;
  region?: string;
  why: string;
};

export type TripPlannerItineraryDay = {
  dayNumber: number;
  title: string;
  highlights: string[];
};

export type TripPlannerPackageSuggestion = {
  tourId?: string;
  tourSlug?: string;
  agencyId?: string;
  agencySlug?: string;
  title: string;
  days?: number;
  estimatedTotalLkr?: number | null;
  matchReason: string;
};

export type TripPlannerResult = {
  summary: string;
  destinations: TripPlannerDestination[];
  itinerary: TripPlannerItineraryDay[];
  packages: TripPlannerPackageSuggestion[];
  draftTripPlan?: {
    title: string;
    agencySlug?: string;
    days: Array<{
      dayNumber: number;
      title: string;
      notes?: string;
    }>;
    estimatedTotalLkr?: number | null;
  };
};
