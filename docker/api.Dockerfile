# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
# Skip postinstall (prisma generate) — schema is not copied until the build stage.
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
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r tourpilot && useradd -r -g tourpilot tourpilot

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY docker/api-entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh \
  && chmod +x /entrypoint.sh \
  && mkdir -p /app/apps/api/uploads \
  && chown -R tourpilot:tourpilot /app

USER tourpilot
WORKDIR /app/apps/api
EXPOSE 4000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/index.js"]
