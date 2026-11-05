FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* && corepack enable
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY backend/ ./
RUN pnpm exec prisma generate && pnpm build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PATH="/app/node_modules/.bin:${PATH}"
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* && npm install --global pnpm@12.16.1 && groupadd --system app && useradd --system --create-home --gid app app
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/node_modules/.bin/ts-node ./node_modules/.bin/ts-node
COPY --from=build --chown=app:app /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/package.json ./package.json
USER app
EXPOSE 3000
CMD ["sh", "-c", "export DATABASE_URL=postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@${POSTGRES_HOST:-postgres}:${POSTGRES_PORT:-5432}/$POSTGRES_DB?schema=public && ./node_modules/.bin/prisma migrate deploy && ./node_modules/.bin/prisma db seed && exec node dist/main"]
