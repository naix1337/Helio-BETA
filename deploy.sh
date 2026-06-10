#!/bin/bash
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
REPO_URL="https://github.com/naix1337/helio.git"
APP_DIR="${HELIO_DIR:-/opt/helio}"
APP_NAME="helio"
PORT="${PORT:-3001}"
DB_PATH="${HELIO_DB_PATH:-$APP_DIR/helio.db}"

# ── Colors ────────────────────────────────────────────────────────────────────
G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'
log()  { echo -e "${G}[helio]${N} $*"; }
warn() { echo -e "${Y}[helio]${N} $*"; }
die()  { echo -e "${R}[helio] ERROR:${N} $*" >&2; exit 1; }

# ── Checks ────────────────────────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || die "Node.js not found. Install Node 20 LTS."
command -v npm  >/dev/null 2>&1 || die "npm not found."
command -v git  >/dev/null 2>&1 || die "git not found."

NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -gt 22 ]; then
  warn "Node v$NODE_MAJOR detected — better-sqlite3 may break. Node 20 LTS is recommended."
fi

# Install PM2 globally if missing
if ! command -v pm2 >/dev/null 2>&1; then
  log "PM2 not found — installing..."
  npm install -g pm2
fi

# ── Step 1: Stop existing instance ───────────────────────────────────────────
if pm2 list 2>/dev/null | grep -q "\b$APP_NAME\b"; then
  log "Stopping existing instance..."
  pm2 delete "$APP_NAME"
fi

# ── Step 2: Pull or clone (main branch = app code) ───────────────────────────
if [ -d "$APP_DIR/.git" ]; then
  log "Pulling latest code from GitHub..."
  git -C "$APP_DIR" fetch origin main
  git -C "$APP_DIR" reset --hard origin/main
else
  log "Cloning repository to $APP_DIR..."
  git clone --branch main --single-branch "$REPO_URL" "$APP_DIR"
fi

# ── Step 3: Install & build (npm workspace at repo root) ─────────────────────
log "Installing dependencies..."
npm ci --prefix "$APP_DIR"

log "Building frontend..."
npm run build -w frontend --prefix "$APP_DIR"

log "Building backend..."
npm run build -w backend --prefix "$APP_DIR"

# ── Step 4: Write PM2 ecosystem and start ────────────────────────────────────
ECOSYSTEM=$(mktemp /tmp/helio-ecosystem.XXXXXX.cjs)
cat > "$ECOSYSTEM" <<EOF
module.exports = {
  apps: [{
    name: '$APP_NAME',
    script: '$APP_DIR/backend/dist/index.js',
    cwd: '$APP_DIR/backend',
    env: {
      NODE_ENV: 'production',
      PORT: '$PORT',
      HELIO_DB_PATH: '$DB_PATH',
    },
    out_file: '/var/log/helio/out.log',
    error_file: '/var/log/helio/err.log',
    merge_logs: true,
    restart_delay: 3000,
    max_memory_restart: '300M',
  }]
};
EOF

mkdir -p /var/log/helio
log "Starting $APP_NAME on port $PORT..."
pm2 start "$ECOSYSTEM"
pm2 save

rm -f "$ECOSYSTEM"

log "Done. Helio läuft → http://$(hostname -I | awk '{print $1}'):$PORT"
log "Logs: pm2 logs $APP_NAME"
