# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/scripts/prepare.mjs ./packages/shared/scripts/
COPY apps/api/package.json ./apps/api/
# Lockfile lists all workspaces — stubs keep `npm ci` in sync.
COPY apps/web/package.json ./apps/web/
COPY apps/mobile/package.json ./apps/mobile/
# Skip dependency postinstalls (prisma generate) — schema arrives in the build stage.
# Workspace `prepare` may still run; shared prepare.mjs no-ops without tsconfig.
RUN npm ci --workspace=@tourpilot/shared --workspace=@tourpilot/api --include-workspace-root --ignore-scripts

FROM deps AS build
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
ENV DATABASE_URL="mysql://build:build@127.0.0.1:3306/build"
RUN npm run build -w @tourpilot/shared \
  && npm run db:generate -w @tourpilot/api \
  && npm run build -w @tourpilot/api

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV UPLOAD_DIR=/app/apps/api/uploads
ENV TERMS_DIR=/app/terms
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates gosu \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r tourpilot && useradd -r -g tourpilot tourpilot

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist
# Seed scripts import from ../src (tsx); keep source available for one-off seeding.
COPY --from=build /app/apps/api/src ./apps/api/src
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=build /app/apps/api/tsconfig.json ./apps/api/tsconfig.json
# Plain-text legal docs — seeded into CmsPage on API boot when missing.
COPY terms ./terms
COPY docker/api-entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh \
  && chmod +x /entrypoint.sh \
  && mkdir -p /app/apps/api/uploads \
  && chown -R tourpilot:tourpilot /app

# Entrypoint starts as root to fix volume ownership, then drops to tourpilot via gosu.
WORKDIR /app/apps/api
EXPOSE 4000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/index.js"]
