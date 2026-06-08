import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const required = ["nodemailer", "typescript"];

for (const pkg of required) {
  try {
    require.resolve(pkg);
  } catch {
    console.error(
      `[prebuild] Missing "${pkg}". Install from the monorepo root:\n` +
        "  cd /var/www/tourpilot && npm install\n" +
        "Then build with:\n" +
        "  npm run build -w @tourpilot/api"
    );
    process.exit(1);
  }
}
