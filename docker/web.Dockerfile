# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN npm ci --workspace=@tourpilot/shared --workspace=@tourpilot/web --include-workspace-root
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN npm run build -w @tourpilot/shared && npm run build -w @tourpilot/web

FROM nginx:1.27-alpine AS runner
COPY docker/web.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
