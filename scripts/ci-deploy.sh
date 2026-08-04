#!/usr/bin/env bash
# Deploy TourPilot images on the VPS (run locally or from a self-hosted Actions runner).
# Usage: scripts/ci-deploy.sh prod|dev <image-sha>
set -euo pipefail

ENV_NAME="${1:-}"
SHA="${2:-}"

if [[ "$ENV_NAME" != "prod" && "$ENV_NAME" != "dev" ]]; then
  echo "Usage: $0 prod|dev <git-sha>" >&2
  exit 1
fi
if [[ -z "$SHA" ]]; then
  echo "Missing image sha tag" >&2
  exit 1
fi

OWNER="$(echo "${GITHUB_REPOSITORY_OWNER:-${GITHUB_OWNER:-}}" | tr '[:upper:]' '[:lower:]')"
if [[ -z "$OWNER" ]]; then
  OWNER="$(echo "${GHCR_PULL_USER:-}" | tr '[:upper:]' '[:lower:]')"
fi
if [[ -z "$OWNER" ]]; then
  echo "Set GITHUB_REPOSITORY_OWNER or GHCR_PULL_USER" >&2
  exit 1
fi

if [[ "$ENV_NAME" == "prod" ]]; then
  DEPLOY_DIR="${DEPLOY_PATH:-/var/www/tourpilot}"
  GIT_REF="${DEPLOY_GIT_REF:-main}"
  API_TAG="$SHA"
  WEB_TAG="$SHA"
  BUILD_SHA="$SHA"
  COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-tourpilot}"
else
  DEPLOY_DIR="${DEV_DEPLOY_PATH:-/var/www/tourpilot-dev}"
  GIT_REF="${DEPLOY_GIT_REF:-development}"
  API_TAG="dev-$SHA"
  WEB_TAG="dev-$SHA"
  BUILD_SHA="dev-$SHA"
  COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-tourpilot-dev}"
fi

cd "$DEPLOY_DIR"

# Deploy dirs must track origin cleanly. Local edits (lockfiles, tsbuildinfo, etc.)
# must not block pulls — .env stays safe if it is gitignored/untracked.
sync_deploy_tree() {
  if [[ ! -d .git ]]; then
    echo "No git repo in $DEPLOY_DIR — skipping tree sync" >&2
    return 0
  fi
  echo "==> Syncing $DEPLOY_DIR to origin/${GIT_REF}"
  git remote update origin --prune >/dev/null 2>&1 || git fetch origin --prune
  # Drop local modifications that block merge (compose/.env are not overwritten if ignored).
  git reset --hard "origin/${GIT_REF}"
  git clean -fd -e .env -e .env.local -e '*.pem' -e '*.key'
}

sync_deploy_tree

export COMPOSE_PROJECT_NAME
export API_IMAGE="ghcr.io/${OWNER}/tourpilot-api:${API_TAG}"
export WEB_IMAGE="ghcr.io/${OWNER}/tourpilot-web:${WEB_TAG}"
export BUILD_SHA
export BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ -n "${GHCR_PULL_TOKEN:-}" && -n "${GHCR_PULL_USER:-}" ]]; then
  echo "$GHCR_PULL_TOKEN" | docker login ghcr.io -u "$GHCR_PULL_USER" --password-stdin
fi

docker compose -f docker-compose.prod.yml --env-file .env pull api web

if [[ "$ENV_NAME" == "prod" ]] && grep -qE '^USE_CADDY_EDGE=true' .env 2>/dev/null; then
  docker compose -f docker-compose.prod.yml --env-file .env --profile edge up -d --force-recreate api web
else
  docker compose -f docker-compose.prod.yml --env-file .env up -d --force-recreate api web
fi

echo "Waiting for API health (includes Prisma sync)..."
ok=0
for _ in $(seq 1 60); do
  if docker compose -f docker-compose.prod.yml --env-file .env exec -T api \
    node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
    >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 3
done
if [[ "$ok" != "1" ]]; then
  echo "API did not become healthy — recent logs:" >&2
  docker compose -f docker-compose.prod.yml --env-file .env logs --tail=80 api >&2 || true
  exit 1
fi

docker image prune -f

if [[ "$ENV_NAME" == "prod" ]]; then
  curl -fsS http://127.0.0.1/api/health || curl -fsS http://127.0.0.1:8080/api/health
else
  HTTP_PORT="$(grep -E '^HTTP_PORT=' .env | cut -d= -f2 | tr -d '[:space:]' || true)"
  if [[ -z "$HTTP_PORT" ]]; then HTTP_PORT=8081; fi
  curl -fsS "http://127.0.0.1:${HTTP_PORT}/api/health"
fi

echo "Deployed $BUILD_SHA (Prisma schema synced on API start)"
