import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { config } from './config.js';
import { getDb, closeDb } from './db/connection.js';
import { startEngine, stopEngine, runAggregation, handlePushHit } from './engine/Engine.js';
import { setupWebSocket, closeWebSocket } from './ws/handler.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authLimiter, apiLimiter, pushLimiter } from './middleware/rateLimiter.js';
import { logger } from './utils/logger.js';
import { backupDatabase } from './utils/backup.js';

// Routes
import authRoutes from './routes/auth.js';
import monitorRoutes from './routes/monitors.js';
import notificationRoutes from './routes/notifications.js';
import statusPageRoutes from './routes/statusPages.js';
import maintenanceRoutes from './routes/maintenance.js';
import apiKeyRoutes from './routes/apiKeys.js';
import settingsRoutes from './routes/settings.js';
import containerRoutes from './routes/containers.js';
import userRoutes from './routes/users.js';
import { startContainerPolling, stopContainerPolling } from './engine/ContainerCollector.js';
import { getScheduledMonitorIds } from './engine/Scheduler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Works for both `tsx src/index.ts` and compiled `node dist/index.js`
const clientDist = process.env['CLIENT_DIST'] || join(__dirname, '..', '..', 'client', 'dist');

const app = express();
const server = createServer(app);

app.set('trust proxy', config.trustProxy);
app.disable('x-powered-by');

if (!process.env['JWT_SECRET']) {
  logger.warn('JWT_SECRET not set — using a generated secret stored next to the database');
} else if (process.env['JWT_SECRET'].startsWith('change-me')) {
  logger.warn('JWT_SECRET uses the example value — set a random secret (openssl rand -hex 64)!');
}

/* ---------- Security Middleware ---------- */
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'", 'ws:', 'wss:'],
      // Allow plain-HTTP LAN deployments (no forced upgrade)
      'upgrade-insecure-requests': null,
    },
  },
  // HSTS only makes sense behind TLS — let the reverse proxy decide
  strictTransportSecurity: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
}));
app.use(cors({ origin: config.cors.origin === '*' ? '*' : config.cors.origin.split(',').map((o) => o.trim()) }));
app.use(express.json({ limit: '1mb' }));

/* ---------- Request Logging (API only) ---------- */
app.use('/api', (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.debug({ method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, durationMs: Date.now() - start }, 'request');
  });
  next();
});

/* ---------- Health / Readiness / Liveness (before rate limiting) ---------- */
function dbOk(): boolean {
  try {
    getDb().prepare('SELECT 1').get();
    return true;
  } catch {
    return false;
  }
}

app.get('/api/v1/live', (_req, res) => {
  res.status(200).json({ status: 'alive' });
});

app.get('/api/v1/ready', (_req, res) => {
  const ok = dbOk();
  res.status(ok ? 200 : 503).json({ status: ok ? 'ready' : 'not ready' });
});

app.get('/api/v1/health', (_req, res) => {
  const ok = dbOk();
  res.status(ok ? 200 : 503).json({
    success: ok,
    data: {
      status: ok ? 'ok' : 'degraded',
      version: config.version,
      uptime: process.uptime(),
      db: ok ? 'connected' : 'error',
      engine: { monitors: getScheduledMonitorIds().length },
      timestamp: new Date().toISOString(),
    },
  });
});

/* ---------- Push endpoint (public, Uptime-Kuma compatible) ---------- */
// GET/POST /api/push/:token?status=up|down&msg=OK&ping=123
app.all('/api/push/:token', pushLimiter, (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, success: false, error: 'Method not allowed' });
    return;
  }
  const q = { ...(req.query as Record<string, string>), ...((req.body as Record<string, string>) ?? {}) };
  const status = String(q['status'] ?? 'up').toLowerCase() === 'down' ? 'down' : 'up';
  const ping = q['ping'] !== undefined && q['ping'] !== '' ? Number(q['ping']) : undefined;
  const found = handlePushHit(req.params['token']!, { status, msg: q['msg'] ? String(q['msg']) : undefined, ping });
  if (!found) {
    res.status(404).json({ ok: false, success: false, error: 'Monitor not found or not a push monitor' });
    return;
  }
  res.json({ ok: true, success: true, data: { message: 'Push received' } });
});

/* ---------- API Routes ---------- */
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/setup', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1/', apiLimiter);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/monitors', monitorRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/status-pages', statusPageRoutes);
app.use('/api/v1/maintenance', maintenanceRoutes);
app.use('/api/v1/api-keys', apiKeyRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/containers', containerRoutes);
app.use('/api/v1/users', userRoutes);

// Unknown API routes → JSON 404 (not the SPA)
app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

/* ---------- Static frontend + SPA fallback ---------- */
const hasFrontend = existsSync(join(clientDist, 'index.html'));
if (hasFrontend) {
  app.use(express.static(clientDist, {
    index: false,
    setHeaders: (res, path) => {
      if (path.includes(`${join('assets', '')}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }));
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(join(clientDist, 'index.html'));
  });
  logger.info({ dist: clientDist }, 'Serving frontend from disk');
} else {
  logger.warn({ dist: clientDist }, 'No built frontend found — API-only mode (run `npm run build:client`)');
}

/* ---------- Error handler ---------- */
app.use(errorHandler);

/* ---------- Start ---------- */
const timers: ReturnType<typeof setInterval>[] = [];

function start(): void {
  getDb();
  logger.info({ db: config.dbPath }, 'Database ready');

  setupWebSocket(server);
  startEngine();
  startContainerPolling();

  // Hourly aggregation + pruning (also once shortly after start)
  const aggregate = () => runAggregation().catch((err) => logger.error({ err }, 'Aggregation error'));
  setTimeout(aggregate, 60_000).unref();
  timers.push(setInterval(aggregate, config.aggregationIntervalMs));

  if (config.backup.enabled) {
    setTimeout(() => void backupDatabase(), 5 * 60_000).unref();
    timers.push(setInterval(() => void backupDatabase(), 24 * 60 * 60 * 1000));
    logger.info({ dir: config.backup.dir }, 'Daily database backup scheduled');
  }

  server.listen(config.port, config.host, () => {
    logger.info({ port: config.port, host: config.host, version: config.version }, 'Helio server started');
  });
}

/* ---------- Graceful Shutdown ---------- */
let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down gracefully...');

  timers.forEach(clearInterval);
  stopEngine();
  stopContainerPolling();
  closeWebSocket();

  server.close(() => {
    closeDb();
    logger.info('Server closed. Goodbye.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    closeDb();
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'Unhandled promise rejection'));

start();
