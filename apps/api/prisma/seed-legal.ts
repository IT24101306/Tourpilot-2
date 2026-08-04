/**
 * Upsert legal CMS pages from the project-root `terms/` folder.
 * Run: npx tsx prisma/seed-legal.ts  (from apps/api)
 * Also called from seed.ts / seed-demo.ts.
 */
import { PrismaClient } from "@prisma/client";
import { asJson } from "../src/utils/json.js";
import {
  LEGAL_DOCUMENTS,
  buildLegalHubBlocks,
  loadAllLegalDocuments,
} from "./legalDocuments.js";

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

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await seedLegalDocuments(prisma);
    console.log("Legal CMS pages upserted:", result);
  } finally {
    await prisma.$disconnect();
  }
}

const isDirect =
  process.argv[1]?.includes("seed-legal") ||
  process.argv[1]?.replace(/\\/g, "/").endsWith("seed-legal.ts");

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
