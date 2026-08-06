import type { TripPlannerRequest, TripPlannerResult } from "@tourpilot/shared";
import { catalogForPrompt, loadPublishedTourCatalog } from "./aiCatalog.js";
import { AiProviderError, chatCompletion } from "./openaiClient.js";

function buildSystemPrompt(catalogJson: string): string {
  return `You are TourPilot's Sri Lanka trip planner. Build practical itineraries for visitors.

Rules:
- Respond with a single JSON object only (no markdown).
- Prefer real places and realistic travel times within Sri Lanka.
- When suggesting packages, ONLY use tours from the catalog below (match by tourId / tourSlug). If none fit, return an empty packages array — do not invent tourIds.
- draftTripPlan should mirror the itinerary for inquiry handoff.

JSON shape:
{
  "summary": string,
  "destinations": [{ "name": string, "region"?: string, "why": string }],
  "itinerary": [{ "dayNumber": number, "title": string, "highlights": string[] }],
  "packages": [{
    "tourId"?: string,
    "tourSlug"?: string,
    "agencyId"?: string,
    "agencySlug"?: string,
    "title": string,
    "days"?: number,
    "estimatedTotalLkr"?: number | null,
    "matchReason": string
  }],
  "draftTripPlan": {
    "title": string,
    "agencySlug"?: string,
    "days": [{ "dayNumber": number, "title": string, "notes"?: string }],
    "estimatedTotalLkr"?: number | null
  }
}

Published tour catalog:
${catalogJson}`;
}

function parseResult(raw: string): TripPlannerResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AiProviderError("AI returned invalid JSON for the trip plan", 502);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AiProviderError("AI returned an unexpected trip plan shape", 502);
  }
  const o = parsed as Record<string, unknown>;
  if (typeof o.summary !== "string" || !Array.isArray(o.itinerary)) {
    throw new AiProviderError("AI trip plan missing required fields", 502);
  }
  return parsed as TripPlannerResult;
}

export async function generateTripPlan(input: TripPlannerRequest): Promise<TripPlannerResult> {
  const catalog = await loadPublishedTourCatalog();
  const catalogJson = JSON.stringify(catalogForPrompt(catalog));
  const userPayload = {
    days: input.days,
    pax: input.pax,
    interests: input.interests,
    budgetMinLkr: input.budgetMinLkr ?? null,
    budgetMaxLkr: input.budgetMaxLkr ?? null,
    startDate: input.startDate ?? null,
    pace: input.pace ?? "balanced",
    notes: input.notes ?? null,
  };

  const content = await chatCompletion({
    messages: [
      { role: "system", content: buildSystemPrompt(catalogJson) },
      {
        role: "user",
        content: `Plan a Sri Lanka trip with these preferences:\n${JSON.stringify(userPayload, null, 2)}`,
      },
    ],
    temperature: 0.5,
    responseFormatJson: true,
  });

  return parseResult(content);
}
