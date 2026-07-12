#!/usr/bin/env bash
# Apply upload-proxy nginx config on a running TourPilot web container.
# Does not require git pull — embeds the fixed conf.
set -euo pipefail

cd /var/www/tourpilot 2>/dev/null || cd "$(dirname "$0")/.." || true

if [ -f docker-compose.prod.yml ]; then
  if [ -f .env ]; then
    WEB=$(docker compose -f docker-compose.prod.yml --env-file .env ps -q web)
  else
    WEB=$(docker compose -f docker-compose.prod.yml ps -q web)
  fi
else
  WEB=$(docker ps -qf "name=web")
fi

if [ -z "${WEB:-}" ]; then
  echo "ERROR: web container not found. Run: docker ps" >&2
  exit 1
fi

docker exec -i "$WEB" sh -c 'cat > /etc/nginx/conf.d/default.conf' <<'NGINX'
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  client_max_body_size 25m;

  location ^~ /api/ {
    proxy_pass http://api:4000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location ^~ /uploads/ {
    proxy_pass http://api:4000/uploads/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location ^~ /assets/ {
    expires 7d;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
NGINX

docker exec "$WEB" nginx -t
docker exec "$WEB" nginx -s reload

echo "Reloaded. Checking /uploads proxy..."
CODE=$(curl -s -o /tmp/upl-body -w "%{http_code}" http://127.0.0.1:8080/uploads/__probe__.jpg || true)
BODY=$(head -c 80 /tmp/upl-body 2>/dev/null || true)
echo "HTTP $CODE"
echo "$BODY"
if echo "$BODY" | grep -q 'nginx/1.27'; then
  echo "FAIL: still nginx static 404 — regex still winning or wrong container."
  exit 1
fi
if echo "$BODY" | grep -qi 'Cannot GET\|Express\|Not Found'; then
  echo "OK: request reached the API (file missing is fine for probe)."
  exit 0
fi
echo "Check manually: curl -s http://127.0.0.1:8080/uploads/__probe__.jpg"
