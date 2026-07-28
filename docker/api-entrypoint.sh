#!/bin/sh
set -eu

UPLOADS="${UPLOAD_DIR:-/app/apps/api/uploads}"
mkdir -p "$UPLOADS"

# Named volumes often mount as root; the API process runs as `tourpilot`.
if [ "$(id -u)" = "0" ]; then
  chown -R tourpilot:tourpilot "$UPLOADS"
fi

# Auto schema sync on every container start (CI/CD + local Docker).
# Set PRISMA_ACCEPT_DATA_LOSS=false to refuse destructive schema changes.
ACCEPT_LOSS="${PRISMA_ACCEPT_DATA_LOSS:-true}"

prisma_push() {
  if [ "$ACCEPT_LOSS" = "true" ] || [ "$ACCEPT_LOSS" = "1" ]; then
    npx prisma db push --skip-generate --accept-data-loss
  else
    npx prisma db push --skip-generate
  fi
}

echo "[api] Syncing Prisma schema (accept-data-loss=${ACCEPT_LOSS})..."
i=0
PUSH_LOG="$(mktemp)"
until prisma_push >"$PUSH_LOG" 2>&1; do
  cat "$PUSH_LOG"
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "[api] Database schema sync failed after 30 attempts"
    rm -f "$PUSH_LOG"
    exit 1
  fi
  echo "[api] DB not ready or push failed ($i/30), retrying in 2s..."
  sleep 2
done
cat "$PUSH_LOG"
rm -f "$PUSH_LOG"
echo "[api] Prisma schema is in sync."

echo "[api] Starting TourPilot API..."
if [ "$(id -u)" = "0" ]; then
  exec gosu tourpilot "$@"
fi
exec "$@"
