#!/usr/bin/env bash
set -euo pipefail
cd /var/www/tourpilot
cp .env.production.example .env
ROOT_PW=$(openssl rand -hex 24)
DB_PW=$(openssl rand -hex 24)
JWT=$(openssl rand -hex 32)
JWT_R=$(openssl rand -hex 32)
sed -i "s|^WEB_APP_URL=.*|WEB_APP_URL=http://200.97.168.95|" .env
sed -i "s|^HTTP_PORT=.*|HTTP_PORT=80|" .env
sed -i "s|^MYSQL_ROOT_PASSWORD=.*|MYSQL_ROOT_PASSWORD=${ROOT_PW}|" .env
sed -i "s|^MYSQL_PASSWORD=.*|MYSQL_PASSWORD=${DB_PW}|" .env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT}|" .env
sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${JWT_R}|" .env
echo "=== .env keys ==="
grep -E '^(WEB_APP_URL|HTTP_PORT|MYSQL_USER|MYSQL_DATABASE)=' .env
echo "=== starting compose build ==="
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
echo "=== ps ==="
docker compose -f docker-compose.prod.yml --env-file .env ps
sleep 20
echo "=== health ==="
curl -fsS http://127.0.0.1/api/health || echo HEALTH_FAIL
