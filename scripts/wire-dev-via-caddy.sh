#!/usr/bin/env bash
# Path B: route dev.srilankatourpilot.com through the PRODUCTION Caddy edge
# to the isolated DEV stack on host port 8081.
#
# Use this when Caddy (not host nginx) owns :80/:443.
# Prerequisites:
#   - /var/www/tourpilot-dev exists with .env (HTTP_PORT=8081)
#   - DEV stack is up: COMPOSE_PROJECT_NAME=tourpilot-dev docker compose ... up -d
#   - DNS A record: dev → VPS IP
#   - Prod Caddyfile includes the "dev.{$PLATFORM_DOMAIN}" site block
#
# Run from either folder (or set PROD_DIR / DEV_DIR):
#   bash scripts/wire-dev-via-caddy.sh
set -euo pipefail

DOMAIN="${DOMAIN:-dev.srilankatourpilot.com}"
PROD_DIR="${PROD_DIR:-/var/www/tourpilot}"
DEV_DIR="${DEV_DIR:-/var/www/tourpilot-dev}"
DOCKER_PORT="${DOCKER_PORT:-8081}"
# Docker bridge gateway — Caddy in the prod network reaches host-published ports here.
HOST_GW="${HOST_GW:-172.17.0.1}"
VPS_IP="${VPS_IP:-200.97.168.95}"

echo "==> Path B: Caddy → host :${DOCKER_PORT} for ${DOMAIN}"
echo "==> Prod dir: ${PROD_DIR}"
echo "==> Dev dir:  ${DEV_DIR}"

if [ ! -f "${DEV_DIR}/.env" ]; then
  echo "Missing ${DEV_DIR}/.env — run scripts/bootstrap-dev-stack.sh first." >&2
  exit 1
fi
if [ ! -f "${PROD_DIR}/.env" ]; then
  echo "Missing ${PROD_DIR}/.env" >&2
  exit 1
fi

echo "==> DNS check"
RESOLVED="$(dig +short "${DOMAIN}" A | head -n1 || true)"
if [ -z "${RESOLVED}" ]; then
  echo "WARNING: ${DOMAIN} does not resolve yet. Create A record 'dev' → ${VPS_IP}."
else
  echo "    ${DOMAIN} → ${RESOLVED}"
fi

echo "==> Ensure DEV stack is up on :${DOCKER_PORT}"
cd "${DEV_DIR}"
export COMPOSE_PROJECT_NAME=tourpilot-dev
if grep -q '^HTTP_PORT=' .env; then
  sed -i "s|^HTTP_PORT=.*|HTTP_PORT=${DOCKER_PORT}|" .env
else
  echo "HTTP_PORT=${DOCKER_PORT}" >> .env
fi
if grep -q '^WEB_APP_URL=' .env; then
  sed -i "s|^WEB_APP_URL=.*|WEB_APP_URL=https://${DOMAIN}|" .env
else
  echo "WEB_APP_URL=https://${DOMAIN}" >> .env
fi
docker compose -f docker-compose.prod.yml --env-file .env up -d

sleep 5
curl -fsS "http://127.0.0.1:${DOCKER_PORT}/api/health" || {
  echo "DEV web not healthy on :${DOCKER_PORT}" >&2
  docker compose -f docker-compose.prod.yml --env-file .env ps
  exit 1
}

echo "==> Reload production Caddy (reads updated Caddyfile from ${PROD_DIR}/docker/Caddyfile)"
cd "${PROD_DIR}"
# Prefer recreate with edge profile so Caddy picks up file + env.
if grep -qE '^USE_CADDY_EDGE=true' .env 2>/dev/null || docker compose -f docker-compose.prod.yml --env-file .env ps 2>/dev/null | grep -qi caddy; then
  docker compose -f docker-compose.prod.yml --env-file .env --profile edge up -d caddy
  # Soft reload if running
  docker compose -f docker-compose.prod.yml --env-file .env exec -T caddy \
    caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || true
else
  echo "ERROR: Caddy does not appear to be the edge." >&2
  echo "Either run bash scripts/wire-caddy.sh first, or use Path A: bash scripts/wire-dev-domain.sh" >&2
  exit 1
fi

echo "==> Public health check (may take a minute while Caddy issues the cert)"
sleep 8
curl -fsS "https://${DOMAIN}/api/health" || {
  echo "WARNING: https://${DOMAIN} not ready yet." >&2
  echo "Confirm DNS, then: docker compose -f docker-compose.prod.yml --env-file .env logs --tail 50 caddy" >&2
  echo "Caddy proxies ${DOMAIN} → ${HOST_GW}:${DOCKER_PORT} (see docker/Caddyfile)."
  exit 1
}

echo ""
echo "Done. Dev is live at https://${DOMAIN}"
echo "DB/uploads are isolated (COMPOSE_PROJECT_NAME=tourpilot-dev)."
