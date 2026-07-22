#!/usr/bin/env bash
# Show who owns ports 80/443 on this VPS (host nginx vs Caddy container).
# Run on the VPS:  bash scripts/diagnose-edge.sh
set -euo pipefail

PROD_DIR="${PROD_DIR:-/var/www/tourpilot}"
DEV_DIR="${DEV_DIR:-/var/www/tourpilot-dev}"

echo "========== Edge diagnose =========="
echo ""

echo "==> Listeners on :80 and :443"
if command -v ss >/dev/null 2>&1; then
  sudo ss -tlnp | grep -E ':80 |:443 ' || echo "    (nothing listening)"
else
  sudo netstat -tlnp 2>/dev/null | grep -E ':80 |:443 ' || echo "    (nothing listening)"
fi
echo ""

echo "==> Host nginx"
if systemctl is-active --quiet nginx 2>/dev/null; then
  echo "    systemctl: active"
  sudo nginx -t 2>&1 | sed 's/^/    /' || true
  if [ -f /etc/nginx/sites-enabled/default ] || ls /etc/nginx/sites-enabled/* >/dev/null 2>&1; then
    echo "    enabled sites:"
    ls -1 /etc/nginx/sites-enabled/ 2>/dev/null | sed 's/^/      - /' || true
  fi
else
  echo "    systemctl: not active (or nginx not installed)"
fi
echo ""

echo "==> Docker containers (caddy / web / api / mysql)"
docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}' 2>/dev/null \
  | grep -Ei 'NAME|caddy|nginx|web|api|mysql|tourpilot' || echo "    (docker ps failed or empty)"
echo ""

if [ -d "${PROD_DIR}" ]; then
  echo "==> Prod compose (${PROD_DIR})"
  (
    cd "${PROD_DIR}"
    if [ -f .env ]; then
      docker compose -f docker-compose.prod.yml --env-file .env ps 2>/dev/null || true
      echo "    HTTP_PORT=$(grep -E '^HTTP_PORT=' .env | cut -d= -f2- || echo '(unset)')"
      echo "    PLATFORM_DOMAIN=$(grep -E '^PLATFORM_DOMAIN=' .env | cut -d= -f2- || echo '(unset)')"
      echo "    USE_CADDY_EDGE=$(grep -E '^USE_CADDY_EDGE=' .env | cut -d= -f2- || echo '(unset)')"
    else
      echo "    missing .env"
    fi
  )
  echo ""
fi

if [ -d "${DEV_DIR}" ]; then
  echo "==> Dev compose (${DEV_DIR})"
  (
    cd "${DEV_DIR}"
    export COMPOSE_PROJECT_NAME=tourpilot-dev
    if [ -f .env ]; then
      docker compose -f docker-compose.prod.yml --env-file .env ps 2>/dev/null || true
      echo "    HTTP_PORT=$(grep -E '^HTTP_PORT=' .env | cut -d= -f2- || echo '(unset)')"
    else
      echo "    missing .env"
    fi
  )
  echo ""
fi

echo "==> Verdict"
NGINX_UP=0
CADDY_UP=0
systemctl is-active --quiet nginx 2>/dev/null && NGINX_UP=1 || true
docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -qi caddy && CADDY_UP=1 || true

if [ "${NGINX_UP}" -eq 1 ] && [ "${CADDY_UP}" -eq 1 ]; then
  echo "    CONFLICT: both host nginx and a Caddy container look active."
  echo "    Stop one before wiring domains. Prefer a single edge."
elif [ "${CADDY_UP}" -eq 1 ]; then
  echo "    Path B — Caddy owns the edge (ports 80/443)."
  echo "    For DEV: run  bash scripts/wire-dev-via-caddy.sh"
elif [ "${NGINX_UP}" -eq 1 ]; then
  echo "    Path A — host Nginx owns the edge."
  echo "    For DEV: run  bash scripts/wire-dev-domain.sh"
else
  echo "    Neither nginx nor Caddy looks active on this host."
  echo "    Bring up production first (wire-domain.sh or wire-caddy.sh), then re-run."
fi
echo "==================================="
