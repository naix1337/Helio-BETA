# ============================================================
# Helio — Multi-stage Docker Build
# ============================================================

# ---------- Stage 1: build client + server ----------
FROM node:22-alpine AS build
WORKDIR /app

# Toolchain in case better-sqlite3 has no prebuilt binary for this platform
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm ci --no-audit --no-fund

COPY shared/ ./shared/
COPY server/ ./server/
COPY client/ ./client/

# Build, then reinstall only the server's production dependencies
# (`npm prune` does not remove workspace devDependencies)
RUN npm run build -w client \
 && npm run build -w server \
 && rm -rf node_modules server/node_modules client/node_modules shared/node_modules \
 && npm ci --omit=dev -w server --no-audit --no-fund \
 && rm -rf server/src client/src

# ---------- Stage 2: runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app

# iputils: real ICMP ping (unprivileged via net.ipv4.ping_group_range)
RUN apk add --no-cache dumb-init iputils tzdata wget

ARG UID=1001
ARG GID=1001
RUN addgroup -g ${GID} -S helio && adduser -S -u ${UID} -G helio helio

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared ./shared
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist

RUN mkdir -p /app/data && chown -R helio:helio /app/data

ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0 \
    DB_PATH=/app/data/helio.db \
    BACKUP_DIR=/app/data/backups

EXPOSE 3001
VOLUME ["/app/data"]
USER helio

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3001/api/v1/live || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/dist/index.js"]
