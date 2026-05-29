import { z } from "zod";

const uploadPathSchema = z
  .string()
  .regex(/^\/uploads\/[a-zA-Z0-9._-]+$/, "Invalid upload path");

/** External https URL or a file uploaded to this server. */
export const storedImageUrlSchema = z.union([z.string().url(), uploadPathSchema]);

/** External https URL, same-origin upload path, or empty → null. */
export const optionalImageUrlSchema = z
  .union([storedImageUrlSchema, z.literal("")])
  .optional()
  .transform((v) => {
    const t = v?.trim();
    return t ? t : null;
  });
