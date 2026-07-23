# ── Derleme aşaması ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Workspace yapısı korunarak bağımlılıklar kuruluyor; sadece manifest'leri
# kopyalamak katman önbelleğinin kaynak değişikliklerinde bozulmasını önler.
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

RUN npm ci --workspace @ticket/api --workspace @ticket/shared --include-workspace-root

COPY packages/shared packages/shared
COPY apps/api apps/api

RUN npm run --workspace @ticket/shared build \
    && npx --workspace @ticket/api prisma generate \
    && npm run --workspace @ticket/api build

# ── Çalışma aşaması ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

# Prisma engine'leri Alpine'da OpenSSL'e ihtiyaç duyar.
RUN apk add --no-cache openssl

COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/package.json package.json
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/shared/package.json packages/shared/package.json
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/package.json apps/api/package.json
COPY --from=builder /app/apps/api/prisma apps/api/prisma

# Root olarak çalıştırmıyoruz.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Migration'lar her açılışta uygulanır — ayrı bir dağıtım adımı gerekmesin.
CMD ["sh", "-c", "npx --workspace @ticket/api prisma migrate deploy && node apps/api/dist/server.js"]
