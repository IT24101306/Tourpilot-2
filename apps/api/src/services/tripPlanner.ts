import type { TripPlannerRequest, TripPlannerResult } from "@tourpilot/shared";
import { catalogForPrompt, loadPublishedTourCatalog } from "./aiCatalog.js";
import { AiProviderError, chatCompletion, extractJsonText } from "./openaiClient.js";

const TRIP_PLANNER_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    summary: { type: "string" },
    destinations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          region: { type: "string" },
          why: { type: "string" },
        },
        required: ["name", "why"],
      },
    },
    itinerary: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dayNumber: { type: "number" },
          title: { type: "string" },
          highlights: { type: "array", items: { type: "string" } },
        },
        required: ["dayNumber", "title", "highlights"],
      },
    },
    packages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tourId: { type: "string" },
          tourSlug: { type: "string" },
          agencyId: { type: "string" },
          agencySlug: { type: "string" },
          title: { type: "string" },
          days: { type: "number" },
          estimatedTotalLkr: { type: "number" },
          matchReason: { type: "string" },
        },
        required: ["title", "matchReason"],
      },
    },
    draftTripPlan: {
      type: "object",
      properties: {
        title: { type: "string" },
        agencySlug: { type: "string" },
        days: {
          type: "array",
          items: {
            type: "object",
            properties: {
              dayNumber: { type: "number" },
              title: { type: "string" },
              notes: { type: "string" },
            },
            required: ["dayNumber", "title"],
          },
        },
        estimatedTotalLkr: { type: "number" },
      },
      required: ["title", "days"],
    },
  },
  required: ["summary", "itinerary"],
};

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
  const jsonText = extractJsonText(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new AiProviderError(
      `AI returned invalid JSON for the trip plan. Preview: ${raw.slice(0, 240)}`,
      502
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AiProviderError("AI returned an unexpected trip plan shape", 502);
  }
  const o = parsed as Record<string, unknown>;
  if (typeof o.summary !== "string" || !Array.isArray(o.itinerary)) {
    throw new AiProviderError(
      `AI trip plan missing required fields. Preview: ${jsonText.slice(0, 240)}`,
      502
    );
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
    jsonSchema: TRIP_PLANNER_JSON_SCHEMA,
  });

  return parseResult(content);
}
