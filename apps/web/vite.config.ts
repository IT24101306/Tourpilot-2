import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const sharedSrc = path.resolve(rootDir, "../../packages/shared/src/index.ts");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Resolve workspace package from source so Vite never depends on a stale/missing dist.
      "@tourpilot/shared": sharedSrc,
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: [path.resolve(rootDir, "../..")],
    },
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:4000",
        changeOrigin: true,
        ws: true,
      },
      "/uploads": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    // Don't prebundle the workspace package; serve its TS source directly.
    exclude: ["@tourpilot/shared"],
  },
});
