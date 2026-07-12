# syntax=docker/dockerfile:1
# Production frontend image — multi-stage: build Vite SPA, serve with nginx on :3000

# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Build-time public env (baked into the JS bundle)
ARG VITE_API_URL=/api/v1
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_API_URL=$VITE_API_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# Install workspace dependencies (lockfile + package manifests only first → better cache)
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN npm ci --workspace=@invogen/client --workspace=@invogen/shared --include-workspace-root

# App sources required for the client build (Vite aliases @invogen/shared → shared/src)
COPY shared ./shared
COPY client ./client

RUN npm run build -w @invogen/client

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# SPA + /api reverse-proxy config
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/client/dist /usr/share/nginx/html

# nginx runs as non-root-friendly ports via master; listen on 3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
