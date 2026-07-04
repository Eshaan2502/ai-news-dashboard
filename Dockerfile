# syntax=docker/dockerfile:1

# ── deps: install all dependencies (incl. dev — needed to build & to run
#         tsx migration/seed/worker scripts at runtime) ──────────────────
FROM node:22-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json* ./
RUN npm ci

# ── build: compile the Next.js app ───────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── runtime: app + toolchain so one image can serve, migrate, seed, work ─
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY . .
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
# next start honors the PORT env var (Railway/compose set it); binds 0.0.0.0.
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
