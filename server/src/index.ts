import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { config } from './config.js';
import { getDb, closeDb } from './db/connection.js';
import { startEngine, stopEngine, runAggregation } from './engine/Engine.js';
import { setupWebSocket, closeWebSocket, broadcast } from './ws/handler.js';
import { errorHandler } from './middleware/errorHandler.js';
import { handlePushHit } from './engine/Engine.js';
import { v4 as uuid } from 'uuid';
import { authLimiter, apiLimiter } from './middleware/rateLimiter.js';
import { logger } from './utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDist = join(__dirname, '..', '..', 'client', 'dist');

// Routes
import authRoutes from './routes/auth.js';
import monitorRoutes from './routes/monitors.js';
import notificationRoutes from './routes/notifications.js';
import statusPageRoutes from './routes/statusPages.js';
import maintenanceRoutes from './routes/maintenance.js';
import apiKeyRoutes from './routes/apiKeys.js';
import settingsRoutes from './routes/settings.js';
import containerRoutes from './routes/containers.js';
import { startContainerPolling } from './engine/ContainerCollector.js';
import { getScheduledMonitorIds } from './engine/Scheduler.js';

const app = express();
const server = createServer(app);

/* ---------- Security Middleware ---------- */
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for SPA; configure if needed
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({ origin: config.cors.origin }));
app.use(express.json({ limit: '1mb' }));

// Remove fingerprinting header
app.disable('x-powered-by');

// Rate limiting
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1/', apiLimiter);

/* ---------- Structured Request Logging ---------- */
app.use((req, _res, next) => {
  const start = Date.now();
  _res.on('finish', () => {
    const ms = Date.now() - start;
    logger.info({ req, res: { ..._res, statusCode: _res.statusCode }, durationMs: ms }, 'request');
  });
  next();
});

/* ---------- Static frontend ---------- */
const hasFrontend = existsSync(clientDist) && existsSync(join(clientDist, 'index.html'));
if (hasFrontend) {
  app.use(express.static(clientDist));
  logger.info({ dist: clientDist }, 'Serving frontend from disk');
} else {
  logger.warn({ dist: clientDist }, 'No built frontend found — API-only mode');
}

/* ---------- Health / Readiness / Liveness ---------- */
app.get('/api/v1/live', (_req, res) => {
  res.status(200).json({ status: 'alive' });
});

app.get('/api/v1/ready', (_req, res) => {
  let dbOk = false;
  try {
    getDb().prepare('SELECT 1').get();
    dbOk = true;
  } catch { /* empty */ }
  res.status(dbOk ? 200 : 503).json({ status: dbOk ? 'ready' : 'not ready' });
});

app.get('/api/v1/health', (_req, res) => {
  let dbOk = false;
  try {
    getDb().prepare('SELECT 1').get();
    dbOk = true;
  } catch { /* empty */ }

  res.json({
    success: true,
    data: {
      status: dbOk ? 'ok' : 'degraded',
      version: '2.1.0',
      uptime: process.uptime(),
      db: dbOk ? 'connected' : 'error',
      engine: {
        monitors: getScheduledMonitorIds().length,
      },
      timestamp: new Date().toISOString(),
    },
  });
});

/* ---------- API Routes ---------- */
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/monitors', monitorRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/status-pages', statusPageRoutes);
app.use('/api/v1/maintenance', maintenanceRoutes);
app.use('/api/v1/api-keys', apiKeyRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/containers', containerRoutes);

/* ---------- Push endpoint (public) ---------- */
app.get('/api/push/:token', (req, res) => {
  handlePushHit(req.params['token']!);
  res.json({ success: true, data: { message: 'Push received' } });
});

/* ---------- SPA catch-all ---------- */
if (hasFrontend) {
  app.get('*', (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}

/* ---------- Error handler ---------- */
app.use(errorHandler);

/* ---------- Backup helper (loaded lazily) ---------- */
let backupDb: (() => void) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  backupDb = require('./utils/backup.js').backupDatabase;
} catch {
  logger.warn('Backup module not available — install pino-pretty for dev');
}

/* ---------- Start ---------- */
function start(): void {
  // Initialize database
  getDb();
  logger.info('Database ready');

  // Setup WebSocket
  setupWebSocket(server);

  // Start monitoring engine
  startEngine();
  startContainerPolling();

  // Schedule hourly aggregation
  setInterval(() => {
    runAggregation().catch((err) => logger.error({ err }, 'Aggregation error'));
  }, config.aggregationIntervalMs);

  // Schedule daily database backup
  if (backupDb) {
    setInterval(backupDb, 24 * 60 * 60 * 1000);
    logger.info('Daily database backup scheduled');
  }

  // Start HTTP server
  server.listen(config.port, config.host, () => {
    logger.info({ port: config.port, host: config.host }, 'Server started');
    logger.info(`API: http://localhost:${config.port}/api/v1`);
    logger.info(`WS:  ws://localhost:${config.port}/ws`);
  });
}

/* ---------- Graceful Shutdown ---------- */
function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down gracefully...');

  stopEngine();
  closeWebSocket();
  closeDb();

  server.close(() => {
    logger.info('Server closed. Goodbye.');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
