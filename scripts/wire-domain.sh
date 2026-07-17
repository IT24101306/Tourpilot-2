#!/usr/bin/env bash
# One-shot domain wiring for srilankatourpilot.com on the VPS.
# Run as a user with sudo:  bash scripts/wire-domain.sh
set -euo pipefail

DOMAIN="${DOMAIN:-srilankatourpilot.com}"
WWW="www.${DOMAIN}"
DEPLOY_DIR="${DEPLOY_DIR:-/var/www/tourpilot}"
DOCKER_PORT="${DOCKER_PORT:-8080}"
VPS_IP="${VPS_IP:-200.97.168.95}"

echo "==> Domain: https://${DOMAIN}  (www → same)"
echo "==> Deploy dir: ${DEPLOY_DIR}"
echo "==> Docker web port: ${DOCKER_PORT}"

if [ ! -f "${DEPLOY_DIR}/.env" ]; then
  echo "Missing ${DEPLOY_DIR}/.env — copy .env.production.example first." >&2
  exit 1
fi

echo "==> DNS check (must resolve to ${VPS_IP})"
RESOLVED="$(dig +short "${DOMAIN}" A | head -n1 || true)"
if [ -z "${RESOLVED}" ]; then
  echo "WARNING: ${DOMAIN} does not resolve yet. Create A records @ and www → ${VPS_IP}, then re-run."
else
  echo "    ${DOMAIN} → ${RESOLVED}"
  if [ "${RESOLVED}" != "${VPS_IP}" ]; then
    echo "WARNING: Expected ${VPS_IP}, got ${RESOLVED}. Fix DNS before certbot."
  fi
fi

echo "==> Update .env WEB_APP_URL + HTTP_PORT"
cd "${DEPLOY_DIR}"
if grep -q '^WEB_APP_URL=' .env; then
  sed -i "s|^WEB_APP_URL=.*|WEB_APP_URL=https://${DOMAIN}|" .env
else
  echo "WEB_APP_URL=https://${DOMAIN}" >> .env
fi
if grep -q '^HTTP_PORT=' .env; then
  sed -i "s|^HTTP_PORT=.*|HTTP_PORT=${DOCKER_PORT}|" .env
else
  echo "HTTP_PORT=${DOCKER_PORT}" >> .env
fi
if grep -q '^EMAIL_FROM=' .env; then
  sed -i "s|^EMAIL_FROM=.*|EMAIL_FROM=TourPilot <noreply@${DOMAIN}>|" .env
fi

echo "==> Ensure host nginx + certbot"
sudo apt-get update -qq
sudo apt-get install -y nginx certbot python3-certbot-nginx

echo "==> Write nginx site"
sudo tee /etc/nginx/sites-available/tourpilot >/dev/null <<EOF
server {
  listen 80;
  server_name ${DOMAIN} ${WWW};

  client_max_body_size 25m;

  location / {
    proxy_pass http://127.0.0.1:${DOCKER_PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF

sudo ln -sf /etc/nginx/sites-available/tourpilot /etc/nginx/sites-enabled/tourpilot
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo "==> Recreate Docker stack (web on ${DOCKER_PORT})"
docker compose -f docker-compose.prod.yml --env-file .env up -d

echo "==> Wait for local health"
sleep 5
curl -fsS "http://127.0.0.1:${DOCKER_PORT}/api/health" || {
  echo "Docker web not healthy on :${DOCKER_PORT}" >&2
  docker compose -f docker-compose.prod.yml --env-file .env ps
  exit 1
}

echo "==> Issue / renew Let's Encrypt cert"
sudo certbot --nginx -d "${DOMAIN}" -d "${WWW}" --non-interactive --agree-tos \
  --register-unsafely-without-email || \
sudo certbot --nginx -d "${DOMAIN}" -d "${WWW}"

echo "==> Public health checks"
curl -fsS "https://${DOMAIN}/api/health"
curl -fsS "https://${WWW}/api/health" || true

echo ""
echo "Done. Open https://${DOMAIN}"
echo "Also set Admin → Platform settings → Public site URL = https://${DOMAIN}"
