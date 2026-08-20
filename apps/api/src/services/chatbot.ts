import type { ChatbotMessage, ChatbotResult } from "@tourpilot/shared";
import { catalogForPrompt, loadPublishedTourCatalog } from "./aiCatalog.js";
import { AiProviderError, chatCompletion, extractJsonText } from "./openaiClient.js";

/** Schema for Gemini Interactions / OpenAI structured JSON (reply is required). */
const CHATBOT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    reply: { type: "string" },
    links: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          href: { type: "string" },
        },
        required: ["label", "href"],
      },
    },
    lead: {
      type: "object",
      properties: {
        days: { type: "number" },
        pax: { type: "number" },
        interests: { type: "array", items: { type: "string" } },
        budgetBand: { type: "string" },
        preferredAgencySlug: { type: "string" },
        readyForInquiry: { type: "boolean" },
      },
    },
  },
  required: ["reply"],
};

const ALLOWED_HREF =
  /^\/(plan|offers|discover|agencies\/[a-z0-9-]+|tours\/[a-z0-9-]+\/[a-z0-9-]+)(\?[^#]*)?$/i;

function buildSystemPrompt(catalogJson: string, pagePath: string | null): string {
  return `You are TourPilot's on-site travel assistant for Sri Lanka tourism.
TourPilot is a marketplace connecting travelers with local tour agencies.

Goals:
- Answer travel questions about Sri Lanka (destinations, seasons, pacing, packing).
- Recommend packages ONLY from the catalog below — never invent tourIds, slugs, or agencies.
- Collect trip requirements (days, travellers, interests, budget, dates) naturally.
- When helpful, point users to /plan (AI Trip Planner), /offers, agency pages, or specific tours.
- Encourage creating an inquiry with an agency when they are ready (do not invent booking confirmations).
- The UI has "Talk to a human" (live admin chat), "Send inquiry", and "Open trip planner" buttons — you can mention them when relevant.
- When the traveler seems ready, set lead.readyForInquiry=true and preferredAgencySlug from the catalog when a specific agency fits.

Rules:
- Respond with a single JSON object only (no markdown fences).
- Keep reply concise (2–5 short paragraphs or bullets max). Be warm and practical.
- links.href must be app-relative paths from this allow-list pattern:
  /plan, /offers, /discover, /agencies/{agencySlug}, /tours/{agencySlug}/{tourSlug}
- Only include links that exist in the catalog (or the static paths above).
- If the catalog is empty, say so and still help with general Sri Lanka advice + /plan.
- Never claim you booked, paid, or messaged an agency for them.
- Never invent prices not in the catalog; you may discuss ballpark ranges from catalog prices.

Current page (hint only): ${pagePath || "(unknown)"}

JSON shape:
{
  "reply": string,
  "links": [{ "label": string, "href": string }],
  "lead": {
    "days"?: number | null,
    "pax"?: number | null,
    "interests"?: string[],
    "budgetBand"?: string | null,
    "preferredAgencySlug"?: string | null,
    "readyForInquiry"?: boolean
  }
}

Published tour catalog:
${catalogJson}`;
}

function sanitizeLinks(links: unknown): ChatbotResult["links"] {
  if (!Array.isArray(links)) return [];
  const out: ChatbotResult["links"] = [];
  for (const item of links) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim() : "";
    const href = typeof o.href === "string" ? o.href.trim() : "";
    if (!label || !href || !ALLOWED_HREF.test(href)) continue;
    out.push({ label: label.slice(0, 80), href });
    if (out.length >= 6) break;
  }
  return out;
}

function sanitizeLead(lead: unknown): ChatbotResult["lead"] {
  if (!lead || typeof lead !== "object" || Array.isArray(lead)) return {};
  const o = lead as Record<string, unknown>;
  const interests = Array.isArray(o.interests)
    ? o.interests.filter((x): x is string => typeof x === "string").slice(0, 12)
    : undefined;
  return {
    days: typeof o.days === "number" ? o.days : o.days === null ? null : undefined,
    pax: typeof o.pax === "number" ? o.pax : o.pax === null ? null : undefined,
    interests,
    budgetBand:
      typeof o.budgetBand === "string"
        ? o.budgetBand
        : o.budgetBand === null
          ? null
          : undefined,
    preferredAgencySlug:
      typeof o.preferredAgencySlug === "string"
        ? o.preferredAgencySlug
        : o.preferredAgencySlug === null
          ? null
          : undefined,
    readyForInquiry: typeof o.readyForInquiry === "boolean" ? o.readyForInquiry : undefined,
  };
}

function parseResult(raw: string): ChatbotResult {
  const jsonText = extractJsonText(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new AiProviderError(
      `AI returned invalid JSON for the chatbot reply. Preview: ${raw.slice(0, 240)}`,
      502
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AiProviderError("AI returned an unexpected chatbot shape", 502);
  }
  const o = parsed as Record<string, unknown>;
  if (typeof o.reply !== "string" || !o.reply.trim()) {
    throw new AiProviderError(
      `AI chatbot reply was empty. Preview: ${jsonText.slice(0, 240)}`,
      502
    );
  }
  return {
    reply: o.reply.trim(),
    links: sanitizeLinks(o.links),
    lead: sanitizeLead(o.lead),
  };
}

export async function generateChatbotReply(input: {
  messages: ChatbotMessage[];
  pagePath?: string | null;
}): Promise<ChatbotResult> {
  const catalog = await loadPublishedTourCatalog(40);
  const catalogJson = JSON.stringify(catalogForPrompt(catalog));

  const history = input.messages.slice(-16).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content.slice(0, 4000),
  }));

  const content = await chatCompletion({
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(catalogJson, input.pagePath ?? null),
      },
      ...history,
    ],
    temperature: 0.55,
    responseFormatJson: true,
    jsonSchema: CHATBOT_JSON_SCHEMA,
  });

  return parseResult(content);
}
