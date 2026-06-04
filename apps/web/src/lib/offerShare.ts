/** Public URL for a single offer (opens /offers with highlight). */
export function offerShareUrl(offerId: string, origin = typeof window !== "undefined" ? window.location.origin : "") {
  return `${origin}/offers?offer=${encodeURIComponent(offerId)}`;
}

export type OfferShareResult = "shared" | "copied" | "cancelled" | "failed";

export type OfferSharePayload = {
  id: string;
  title: string;
  description?: string | null;
  rewardText: string;
};

export async function shareOffer(offer: OfferSharePayload): Promise<OfferShareResult> {
  const url = offerShareUrl(offer.id);
  const text = [offer.rewardText, offer.description?.trim()].filter(Boolean).join(" — ");

  try {
    if (typeof navigator.share === "function") {
      await navigator.share({
        title: offer.title,
        text: text || undefined,
        url,
      });
      return "shared";
    }
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return "cancelled";
    try {
      await navigator.clipboard.writeText(url);
      return "copied";
    } catch {
      return "failed";
    }
  }
}

export function offerShareFeedback(result: OfferShareResult): string {
  switch (result) {
    case "shared":
      return "Thanks for sharing!";
    case "copied":
      return "Link copied.";
    case "cancelled":
      return "";
    case "failed":
      return "Could not share or copy.";
  }
}
