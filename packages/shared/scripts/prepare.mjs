import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const tsconfig = join(root, "tsconfig.json");

// Docker deps stages copy package.json only — skip compile until sources exist.
if (!existsSync(tsconfig)) {
  process.exit(0);
}

const result = spawnSync("tsc", ["-p", "tsconfig.json"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
