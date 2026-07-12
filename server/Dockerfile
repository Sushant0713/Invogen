# syntax=docker/dockerfile:1
# Production backend image — multi-stage: compile TypeScript, run Node on :5000
# Uses system Chromium for Puppeteer (PDF) instead of bundling Chrome into the image.

# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Skip Puppeteer's Chrome download during install (runtime uses system Chromium)
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    npm_config_ignore_scripts=true

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci --workspace=@invogen/server --workspace=@invogen/shared --include-workspace-root

COPY shared ./shared
COPY server ./server

RUN npm run build -w @invogen/shared \
 && npm run build -w @invogen/server

# Production node_modules only (shared + server workspaces)
RUN npm prune --omit=dev --workspace=@invogen/server --workspace=@invogen/shared --include-workspace-root

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=5000 \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Chromium + minimal deps for headless PDF generation
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      chromium \
      ca-certificates \
      fonts-liberation \
      fonts-noto-core \
      fonts-noto-color-emoji \
      curl \
 && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN groupadd --system --gid 1001 invogen \
 && useradd --system --uid 1001 --gid invogen --create-home invogen

# Copy pruned monorepo runtime pieces (workspace layout must stay intact for @invogen/shared)
COPY --from=builder --chown=invogen:invogen /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=invogen:invogen /app/node_modules ./node_modules
COPY --from=builder --chown=invogen:invogen /app/shared ./shared
COPY --from=builder --chown=invogen:invogen /app/server/package.json ./server/package.json
COPY --from=builder --chown=invogen:invogen /app/server/dist ./server/dist

WORKDIR /app/server

USER invogen

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:5000/api/v1/health || exit 1

CMD ["node", "dist/server.js"]
