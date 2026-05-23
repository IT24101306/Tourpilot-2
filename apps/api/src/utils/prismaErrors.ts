import type { Prisma } from "@prisma/client";

export function formatDbError(err: unknown): { status: number; message: string; hint?: string } {
  const code = (err as Prisma.PrismaClientKnownRequestError)?.code;

  if (code === "P1001") {
    return {
      status: 503,
      message: "Database is not running.",
      hint:
        "Start MySQL (Docker: docker compose up -d) then run: npm run db:push && npm run db:seed. Or set DEV_AUTH_WITHOUT_DB=true in apps/api/.env to test login without MySQL.",
    };
  }

  if (code === "P1003") {
    return {
      status: 503,
      message: 'Database "tourpilot" does not exist.',
      hint: "Create it in MySQL or run npm run db:push",
    };
  }

  if (code === "P2021" || code === "P2010") {
    return {
      status: 503,
      message: "Database tables are missing.",
      hint: "Run: npm run db:push && npm run db:seed",
    };
  }

  return {
    status: 500,
    message: err instanceof Error ? err.message : "Internal Server Error",
  };
}
