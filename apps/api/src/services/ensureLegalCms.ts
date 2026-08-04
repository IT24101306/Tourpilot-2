import type { PrismaClient } from "@prisma/client";
import { asJson } from "../utils/json.js";
import {
  LEGAL_CMS_SLUGS,
  LEGAL_DOCUMENTS,
  buildLegalHubBlocks,
  loadAllLegalDocuments,
  repoTermsDir,
} from "../lib/legalDocuments.js";
import { prisma as defaultPrisma } from "../lib/prisma.js";

export async function seedLegalDocuments(prisma: PrismaClient) {
  const docs = loadAllLegalDocuments();

  for (const doc of docs) {
    await prisma.cmsPage.upsert({
      where: { slug: doc.slug },
      create: {
        slug: doc.slug,
        title: doc.title,
        isPublished: true,
        blocks: asJson(doc.blocks),
      },
      update: {
        title: doc.title,
        isPublished: true,
        blocks: asJson(doc.blocks),
      },
    });
  }

  const hubBlocks = buildLegalHubBlocks(
    docs.map((d) => ({
      slug: d.slug,
      title: d.title,
      summary: LEGAL_DOCUMENTS.find((x) => x.slug === d.slug)?.summary ?? d.summary,
    }))
  );

  await prisma.cmsPage.upsert({
    where: { slug: "terms" },
    create: {
      slug: "terms",
      title: "Terms & Conditions",
      isPublished: true,
      blocks: asJson(hubBlocks),
    },
    update: {
      title: "Terms & Conditions",
      isPublished: true,
      blocks: asJson(hubBlocks),
    },
  });

  return { hub: "terms", documents: docs.map((d) => d.slug) };
}

function pageHasContent(blocks: unknown): boolean {
  if (!Array.isArray(blocks) || blocks.length === 0) return false;
  return blocks.some((b) => {
    if (!b || typeof b !== "object") return false;
    const row = b as { type?: string; heading?: string; body?: string; items?: unknown[] };
    if (row.type === "toc") return Array.isArray(row.items) && row.items.length > 0;
    return Boolean((row.heading && row.heading.trim()) || (row.body && row.body.trim()));
  });
}

/** Seed legal CMS pages when missing/empty. Does not overwrite rich admin content unless forced. */
export async function ensureLegalCmsPages(client: PrismaClient = defaultPrisma) {
  const force = process.env.SEED_LEGAL_FORCE === "true" || process.env.SEED_LEGAL_FORCE === "1";

  if (!force) {
    const pages = await client.cmsPage.findMany({
      where: { slug: { in: [...LEGAL_CMS_SLUGS] } },
      select: { slug: true, isPublished: true, blocks: true },
    });
    const bySlug = new Map(pages.map((p) => [p.slug, p]));
    const missing = LEGAL_CMS_SLUGS.some((slug) => {
      const page = bySlug.get(slug);
      return !page || !page.isPublished || !pageHasContent(page.blocks);
    });
    if (!missing) {
      console.log("[legal-cms] Terms & legal documents already present");
      return { seeded: false as const };
    }
  }

  try {
    console.log(`[legal-cms] Seeding from ${repoTermsDir()}…`);
    const result = await seedLegalDocuments(client);
    console.log("[legal-cms] Upserted:", result);
    return { seeded: true as const, result };
  } catch (err) {
    console.error("[legal-cms] Failed to seed legal documents:", err);
    return { seeded: false as const, error: err };
  }
}
