#!/usr/bin/env bash
# Full TourPilot deploy — run from repo root on the server.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> TourPilot deploy @ $ROOT"
echo "==> Git commit: $(git rev-parse --short HEAD) — $(git log -1 --format=%s)"

echo "==> Installing dependencies (monorepo root)..."
npm install

echo "==> Syncing database schema..."
npm run db:push -w @tourpilot/api

export BUILD_SHA="$(git rev-parse --short HEAD)"
export BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "==> Building shared + API + web (BUILD_SHA=$BUILD_SHA)..."
npm run build -w @tourpilot/shared
npm run build -w @tourpilot/api
npm run build -w @tourpilot/web

echo ""
echo "==> Build outputs:"
echo "  API:  $ROOT/apps/api/dist/index.js"
ls -la "$ROOT/apps/api/dist/index.js"
echo "  Web:  $ROOT/apps/web/dist/index.html"
ls -la "$ROOT/apps/web/dist/index.html"

echo ""
echo "==> Restart API (adjust PM2 name if different)..."
if command -v pm2 >/dev/null 2>&1; then
  BUILD_SHA="$BUILD_SHA" BUILD_TIME="$BUILD_TIME" \
    pm2 restart tourpilot-api --update-env 2>/dev/null \
    || BUILD_SHA="$BUILD_SHA" BUILD_TIME="$BUILD_TIME" pm2 restart api --update-env 2>/dev/null \
    || pm2 restart all --update-env
  pm2 list
else
  echo "  pm2 not found — restart your API process manually."
fi

echo ""
echo "==> Reload nginx (if installed)..."
if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t && sudo systemctl reload nginx
fi

echo ""
echo "Deploy complete. Hard-refresh the browser (Ctrl+Shift+R)."
echo "Verify API: curl -s http://127.0.0.1:4000/api/health"
