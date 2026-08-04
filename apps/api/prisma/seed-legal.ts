/**
 * Upsert legal CMS pages from the project-root `terms/` folder.
 * Run: npm run db:seed:legal -w @tourpilot/api
 * Also called on API boot when pages are missing (see ensureLegalCms).
 */
import { PrismaClient } from "@prisma/client";
import { seedLegalDocuments } from "../src/services/ensureLegalCms.js";

export { seedLegalDocuments } from "../src/services/ensureLegalCms.js";
export * from "../src/lib/legalDocuments.js";

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
