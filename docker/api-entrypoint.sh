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
PUSH_LOG="$(mktemp)"
until npx prisma db push --skip-generate >"$PUSH_LOG" 2>&1; do
  cat "$PUSH_LOG"
  if grep -q "accept-data-loss" "$PUSH_LOG"; then
    echo "[api] Schema sync skipped: would drop columns (image/schema mismatch)."
    echo "[api] Starting API anyway — redeploy a matching API image when you can."
    break
  fi
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "[api] Database not ready after 30 attempts"
    rm -f "$PUSH_LOG"
    exit 1
  fi
  echo "[api] DB not ready ($i/30), retrying in 2s..."
  sleep 2
done
rm -f "$PUSH_LOG"

echo "[api] Starting TourPilot API..."
if [ "$(id -u)" = "0" ]; then
  exec gosu tourpilot "$@"
fi
exec "$@"
