# ============================================================
# Helio — Production Multi-stage Docker Build
# ============================================================

# Stage 1: Install production dependencies
FROM node:22-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/

RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Build client frontend
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/
RUN npm ci

COPY client/ ./client/
COPY shared/ ./shared/
RUN npm run build -w client

# Stage 3: Production runner
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache dumb-init iputils

# Create non-root user
RUN addgroup -g 1001 -S helio && \
    adduser -S -u 1001 -G helio helio

# Copy deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/shared ./shared
COPY --from=deps /app/server ./server

# Copy source (compiled at runtime via tsx)
COPY server/src/ ./server/src/
COPY shared/src/ ./shared/src/

# Copy built frontend
COPY --from=builder /app/client/dist ./client/dist

# Create data directory with correct ownership
RUN mkdir -p /app/data && chown -R helio:helio /app/data

ENV NODE_ENV=production
EXPOSE 3001

VOLUME ["/app/data"]

USER helio

ENTRYPOINT ["dumb-init", "--"]
CMD ["npx", "--prefix", "/app/server", "tsx", "src/index.ts"]
