#!/usr/bin/env bash
# Hot-fix web nginx so /uploads/* is proxied to the API (not served as SPA static → 404).
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE=(docker compose -f docker-compose.prod.yml)
if [ -f .env ]; then
  COMPOSE+=(--env-file .env)
fi

WEB="$("${COMPOSE[@]}" ps -q web)"
if [ -z "$WEB" ]; then
  echo "web container not running" >&2
  exit 1
fi

CONF=docker/web.nginx.conf
if [ ! -f "$CONF" ]; then
  echo "Missing $CONF — git pull first, or paste the fixed conf into that path." >&2
  exit 1
fi

docker cp "$CONF" "$WEB":/etc/nginx/conf.d/default.conf
docker exec "$WEB" nginx -t
docker exec "$WEB" nginx -s reload
echo "OK: web nginx reloaded. Test: curl -sI http://127.0.0.1:8080/uploads/test.jpg"
echo "(Expect proxy to API — not nginx default HTML 404. Real files return 200.)"
