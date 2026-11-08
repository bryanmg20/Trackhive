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
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* && groupadd --system app && useradd --system --create-home --gid app app
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/package.json ./package.json
USER app
EXPOSE 3000
CMD ["sh", "-c", "prisma migrate deploy && if [ \"$RUN_SEED\" = \"true\" ]; then prisma db seed; fi && exec node dist/main"]
