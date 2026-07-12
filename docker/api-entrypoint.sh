#!/bin/sh
set -eu

UPLOADS="${UPLOAD_DIR:-/app/apps/api/uploads}"
mkdir -p "$UPLOADS"

# Named volumes often mount as root; the API process runs as `tourpilot`.
if [ "$(id -u)" = "0" ]; then
  chown -R tourpilot:tourpilot "$UPLOADS"
fi

echo "[api] Syncing Prisma schema..."
i=0
until npx prisma db push --skip-generate; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "[api] Database not ready after 30 attempts"
    exit 1
  fi
  echo "[api] DB not ready ($i/30), retrying in 2s..."
  sleep 2
done

echo "[api] Starting TourPilot API..."
if [ "$(id -u)" = "0" ]; then
  exec gosu tourpilot "$@"
fi
exec "$@"
