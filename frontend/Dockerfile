FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

FROM nginx:1.27-alpine AS runtime
# HTTPS by default (production, HU-42). When the container starts, the script
# copies https.conf or http.conf (FRONTEND_TLS=off, docker-compose.dev.yml)
# from /etc/nginx/trackhive to default.conf
COPY frontend/nginx/locations.conf /etc/nginx/snippets/trackhive-locations.conf
COPY frontend/nginx/https.conf frontend/nginx/http.conf /etc/nginx/trackhive/
COPY frontend/nginx/https.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 frontend/nginx/40-trackhive-tls.sh /docker-entrypoint.d/40-trackhive-tls.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 443
