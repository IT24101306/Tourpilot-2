#!/usr/bin/env bash
# One-time TourPilot VPS bootstrap (run on the server as the deploy user).
# Usage:
#   curl -fsSL … | bash   # or copy this file to the VPS and: bash vps-bootstrap.sh
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/var/www/tourpilot}"
REPO_URL="${REPO_URL:-https://github.com/IT24101306/Tourpilot-2.git}"
WEB_APP_URL="${WEB_APP_URL:-http://200.97.168.95}"
HTTP_PORT="${HTTP_PORT:-80}"

echo "==> Installing Docker (if needed)"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "Docker installed. Log out and back in, then re-run this script."
  exit 0
fi

echo "==> Clone / update repo at $DEPLOY_DIR"
sudo mkdir -p "$(dirname "$DEPLOY_DIR")"
sudo chown "$USER:$USER" "$(dirname "$DEPLOY_DIR")"
if [ ! -d "$DEPLOY_DIR/.git" ]; then
  git clone "$REPO_URL" "$DEPLOY_DIR"
else
  git -C "$DEPLOY_DIR" pull --ff-only || true
fi
cd "$DEPLOY_DIR"

if [ ! -f .env ]; then
  echo "==> Creating .env from example"
  cp .env.production.example .env
  # Generate secrets
  ROOT_PW="$(openssl rand -hex 24)"
  DB_PW="$(openssl rand -hex 24)"
  JWT="$(openssl rand -hex 32)"
  JWT_R="$(openssl rand -hex 32)"
  sed -i "s|^WEB_APP_URL=.*|WEB_APP_URL=${WEB_APP_URL}|" .env
  sed -i "s|^HTTP_PORT=.*|HTTP_PORT=${HTTP_PORT}|" .env
  sed -i "s|^MYSQL_ROOT_PASSWORD=.*|MYSQL_ROOT_PASSWORD=${ROOT_PW}|" .env
  sed -i "s|^MYSQL_PASSWORD=.*|MYSQL_PASSWORD=${DB_PW}|" .env
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT}|" .env
  sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${JWT_R}|" .env
  echo "Wrote $DEPLOY_DIR/.env (keep this private)"
else
  echo "==> .env already exists — leaving it alone"
fi

echo "==> First build & start"
docker compose -f docker-compose.prod.yml --env-file .env up -d --build

echo "==> Waiting for health…"
sleep 12
curl -fsS "http://127.0.0.1:${HTTP_PORT}/api/health" || curl -fsS http://127.0.0.1/api/health || true

echo
echo "Done. Open ${WEB_APP_URL}"
echo "Optional seed: docker compose -f docker-compose.prod.yml --env-file .env exec api npx tsx prisma/seed-demo.ts"
echo "(seed may need src/tsx — see docs/DEPLOY.md)"
