FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/

RUN npm ci --workspace @ticket/web --workspace @ticket/shared --include-workspace-root

COPY packages/shared packages/shared
COPY apps/web apps/web

# API adresi derleme zamanında gömülür — panel statik dosya olarak servis edilir.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run --workspace @ticket/shared build \
    && npm run --workspace @ticket/web build

# ── Statik servis ────────────────────────────────────────────────────────────
FROM caddy:2-alpine AS runtime

COPY --from=builder /app/apps/web/dist /srv
COPY apps/web/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
