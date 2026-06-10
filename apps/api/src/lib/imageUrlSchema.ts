import { isUsableImageUrl, MEDIA } from "@tourpilot/shared";
import { z } from "zod";

/** Normalize invalid / legacy image values to a known-good default. */
export function sanitizeStoredImageUrl(
  url: unknown,
  fallback: string = MEDIA.hero
): string {
  const trimmed = typeof url === "string" ? url.trim() : "";
  return isUsableImageUrl(trimmed) ? trimmed : fallback;
}

/** External https URL, `/uploads/…`, or `/images/…` static asset path. */
export const storedImageUrlSchema = z
  .string()
  .trim()
  .min(1, "Image URL is required")
  .refine((v) => isUsableImageUrl(v), {
    message: "Use an https:// image link or upload a photo",
  });

/** Like storedImageUrlSchema but coerces broken legacy values to a fallback. */
export function storedImageUrlWithFallback(fallback: string = MEDIA.hero) {
  return z.string().transform((v) => sanitizeStoredImageUrl(v, fallback));
}

/** External https URL, upload path, or empty → null. */
export const optionalImageUrlSchema = z
  .union([storedImageUrlSchema, z.literal("")])
  .optional()
  .transform((v) => {
    const t = v?.trim();
    return t ? t : null;
  });
