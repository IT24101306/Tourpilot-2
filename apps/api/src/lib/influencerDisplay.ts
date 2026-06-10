import type { Prisma } from "@prisma/client";
import { asJson } from "../utils/json.js";

export type InfluencerDisplayContent = {
  headline: string;
  tagline: string;
  tourIds: string[];
  offerIds: string[];
};

export function defaultInfluencerDisplay(name: string): InfluencerDisplayContent {
  const first = name.trim().split(/\s+/)[0] || "My";
  return {
    headline: `${first}'s Sri Lanka picks`,
    tagline: "Ready-made tours I recommend — book through the links below.",
    tourIds: [],
    offerIds: [],
  };
}

export function parseInfluencerDisplay(raw: unknown, name: string): InfluencerDisplayContent {
  const base = defaultInfluencerDisplay(name);
  if (!raw || typeof raw !== "object") return base;

  const obj = raw as Record<string, unknown>;
  if (typeof obj.headline === "string" && obj.headline.trim()) {
    base.headline = obj.headline.trim();
  }
  if (typeof obj.tagline === "string" && obj.tagline.trim()) {
    base.tagline = obj.tagline.trim();
  }
  if (Array.isArray(obj.tourIds)) {
    base.tourIds = obj.tourIds
      .map((id) => (typeof id === "string" ? id.trim() : ""))
      .filter(Boolean)
      .slice(0, 48);
  }
  if (Array.isArray(obj.offerIds)) {
    base.offerIds = obj.offerIds
      .map((id) => (typeof id === "string" ? id.trim() : ""))
      .filter(Boolean)
      .slice(0, 24);
  }
  return base;
}

export function buildDisplayPayload(content: InfluencerDisplayContent): Prisma.InputJsonValue {
  return asJson({
    headline: content.headline,
    tagline: content.tagline,
    tourIds: content.tourIds,
    offerIds: content.offerIds,
  });
}
