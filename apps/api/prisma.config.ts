import "dotenv/config";
import { defineConfig } from "prisma/config";

/** Placeholder only for `prisma generate` when DATABASE_URL is unset (CI / postinstall). */
const datasourceUrl =
  process.env.DATABASE_URL?.trim() ||
  "mysql://build:build@127.0.0.1:3306/build";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: datasourceUrl,
  },
});
