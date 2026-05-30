import type { Prisma } from "@prisma/client";
import { slugify } from "../utils/slug.js";

type Db = Prisma.TransactionClient | { influencerProfile: Prisma.InfluencerProfileDelegate };

export function baseSlugFromName(name: string): string {
  const base = slugify(name) || "creator";
  return base.slice(0, 80);
}

export async function ensureUniqueInfluencerSlug(
  db: Db,
  name: string,
  excludeProfileId?: string
): Promise<string> {
  let candidate = baseSlugFromName(name);
  let n = 0;

  while (true) {
    const existing = await db.influencerProfile.findFirst({
      where: {
        slug: candidate,
        ...(excludeProfileId ? { NOT: { id: excludeProfileId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    n += 1;
    candidate = `${baseSlugFromName(name)}-${n}`.slice(0, 80);
  }
}
