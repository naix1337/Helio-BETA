# ============================================================
# Pulse — Multi-stage Docker Build
# ============================================================

# Stage 1: Install dependencies
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/

RUN npm ci

# Stage 2: Production image
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache dumb-init

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/shared ./shared
COPY --from=deps /app/server ./server
COPY server/src/ ./server/src/
COPY shared/src/ ./shared/src/

ENV NODE_ENV=production
EXPOSE 3001

VOLUME ["/app/data"]

ENTRYPOINT ["dumb-init", "--"]
CMD ["npx", "--prefix", "/app/server", "tsx", "src/index.ts"]
