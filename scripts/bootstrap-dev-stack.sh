#!/usr/bin/env bash
# One-time bootstrap for the isolated DEV stack on the same VPS as production.
# Does NOT touch /var/www/tourpilot.
#
#   bash scripts/bootstrap-dev-stack.sh
#
# Optional env overrides:
#   DEV_DIR=/var/www/tourpilot-dev
#   REPO_URL=https://github.com/IT24101306/Tourpilot-2.git
#   BRANCH=development
#   SEED=1          # run prisma/seed-demo.ts after up (default 1)
set -euo pipefail

DEV_DIR="${DEV_DIR:-/var/www/tourpilot-dev}"
REPO_URL="${REPO_URL:-https://github.com/IT24101306/Tourpilot-2.git}"
BRANCH="${BRANCH:-development}"
SEED="${SEED:-1}"
PROJECT_NAME="${PROJECT_NAME:-tourpilot-dev}"

echo "==> Bootstrap DEV stack"
echo "    dir=${DEV_DIR}  branch=${BRANCH}  project=${PROJECT_NAME}"

if [ -d /var/www/tourpilot ] && [ "${DEV_DIR}" = "/var/www/tourpilot" ]; then
  echo "Refusing to use production path as DEV_DIR." >&2
  exit 1
fi

if [ ! -d "${DEV_DIR}/.git" ]; then
  sudo mkdir -p "${DEV_DIR}"
  sudo chown "$(id -u):$(id -g)" "${DEV_DIR}"
  git clone -b "${BRANCH}" "${REPO_URL}" "${DEV_DIR}"
else
  echo "==> Repo exists — fetching ${BRANCH}"
  cd "${DEV_DIR}"
  git fetch origin "${BRANCH}" || git fetch tourpilot "${BRANCH}" || true
  git checkout "${BRANCH}"
  git pull --ff-only || true
fi

cd "${DEV_DIR}"

if [ ! -f .env ]; then
  if [ ! -f .env.development.example ]; then
    echo "Missing .env.development.example — is ${BRANCH} up to date with main?" >&2
    exit 1
  fi
  cp .env.development.example .env
  echo "==> Wrote .env from .env.development.example"
  echo "    IMPORTANT: edit passwords/JWT now if still 'change-me-*':"
  echo "      nano ${DEV_DIR}/.env"
  if grep -q 'change-me-dev' .env; then
    echo "==> Generating random secrets into .env"
    gen() { openssl rand -hex 24; }
    sed -i "s|^MYSQL_ROOT_PASSWORD=.*|MYSQL_ROOT_PASSWORD=$(gen)|" .env
    sed -i "s|^MYSQL_PASSWORD=.*|MYSQL_PASSWORD=$(gen)|" .env
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(gen)|" .env
    sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$(gen)|" .env
  fi
else
  echo "==> Keeping existing .env"
fi

export COMPOSE_PROJECT_NAME="${PROJECT_NAME}"

echo "==> Starting isolated compose project '${PROJECT_NAME}'"
docker compose -f docker-compose.prod.yml --env-file .env up -d

echo "==> Wait for API health via web :$(grep -E '^HTTP_PORT=' .env | cut -d= -f2 || echo 8081)"
HTTP_PORT="$(grep -E '^HTTP_PORT=' .env | cut -d= -f2 | tr -d '[:space:]')"
if [ -z "${HTTP_PORT}" ]; then HTTP_PORT=8081; fi
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:${HTTP_PORT}/api/health" >/dev/null 2>&1; then
    echo "    healthy"
    break
  fi
  sleep 3
  if [ "$i" -eq 10 ]; then
    echo "DEV stack not healthy on :${HTTP_PORT}" >&2
    docker compose -f docker-compose.prod.yml --env-file .env ps
    docker compose -f docker-compose.prod.yml --env-file .env logs --tail 40 api || true
    exit 1
  fi
done

if [ "${SEED}" = "1" ]; then
  echo "==> Seeding DEMO data into DEV database only"
  docker compose -f docker-compose.prod.yml --env-file .env \
    exec -T api npx tsx prisma/seed-demo.ts
  echo "    Demo agency login phone: +94771234567 (OTP in UI/logs on DEV)"
fi

echo ""
echo "Next steps:"
echo "  1. bash scripts/diagnose-edge.sh"
echo "  2. Path A (nginx):  bash scripts/wire-dev-domain.sh"
echo "     Path B (caddy):  bash scripts/wire-dev-via-caddy.sh"
echo "  3. curl -fsS https://dev.srilankatourpilot.com/api/health"
echo ""
echo "Always use:  COMPOSE_PROJECT_NAME=${PROJECT_NAME} docker compose ..."
