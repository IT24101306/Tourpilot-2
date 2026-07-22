#!/usr/bin/env bash
# Switch the edge from host nginx+certbot to the Caddy container with
# automatic HTTPS + On-Demand TLS (enables agency custom domains).
# Run as a user with sudo:  bash scripts/wire-caddy.sh
set -euo pipefail

DOMAIN="${DOMAIN:-srilankatourpilot.com}"
DEPLOY_DIR="${DEPLOY_DIR:-/var/www/tourpilot}"
DOCKER_PORT="${DOCKER_PORT:-8080}"
VPS_IP="${VPS_IP:-200.97.168.95}"
CADDY_EMAIL="${CADDY_EMAIL:-admin@${DOMAIN}}"

echo "==> Edge: Caddy (automatic HTTPS + On-Demand TLS)"
echo "==> Platform domain: ${DOMAIN}"
echo "==> Server IP (A target for agency domains): ${VPS_IP}"

if [ ! -f "${DEPLOY_DIR}/.env" ]; then
  echo "Missing ${DEPLOY_DIR}/.env — copy .env.production.example first." >&2
  exit 1
fi

cd "${DEPLOY_DIR}"

set_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}

echo "==> Update .env"
set_env WEB_APP_URL "https://${DOMAIN}"
set_env HTTP_PORT "${DOCKER_PORT}"
set_env PLATFORM_DOMAIN "${DOMAIN}"
set_env PLATFORM_DOMAINS "${DOMAIN},dev.${DOMAIN}"
set_env DEV_DOMAIN "dev.${DOMAIN}"
set_env CADDY_EMAIL "${CADDY_EMAIL}"
set_env CUSTOM_DOMAIN_A_TARGET "${VPS_IP}"
# So CI/CD recreate keeps the Caddy edge profile:
set_env USE_CADDY_EDGE "true"
# Path B: Caddy → DEV stack on the host
set_env DEV_UPSTREAM "host.docker.internal:8081"

echo "==> Free ports 80/443 (stop host nginx if present)"
if systemctl is-active --quiet nginx; then
  sudo systemctl stop nginx
  sudo systemctl disable nginx || true
  echo "    host nginx stopped and disabled"
else
  echo "    host nginx not active"
fi

echo "==> Bring up stack with Caddy edge"
docker compose -f docker-compose.prod.yml --env-file .env --profile edge up -d

echo "==> Wait for web health (internal :${DOCKER_PORT})"
sleep 5
curl -fsS "http://127.0.0.1:${DOCKER_PORT}/api/health" || {
  echo "Docker web not healthy on :${DOCKER_PORT}" >&2
  docker compose -f docker-compose.prod.yml --env-file .env ps
  exit 1
}

echo "==> Wait for Caddy to obtain the platform certificate"
sleep 8
curl -fsS "https://${DOMAIN}/api/health" || {
  echo "WARNING: https://${DOMAIN} not ready yet — Caddy may still be issuing the cert." >&2
  docker compose -f docker-compose.prod.yml --env-file .env logs --tail 40 caddy || true
}

echo ""
echo "Done. Caddy is now the edge on :80/:443."
echo "Agencies with the Custom Domain feature can point an A record → ${VPS_IP}."
echo "Caddy issues their certificate automatically on first visit once DNS resolves here."
