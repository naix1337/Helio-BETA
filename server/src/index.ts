import express from 'express';
import cors from 'cors';
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

const app = express();
const server = createServer(app);

/* ---------- Middleware ---------- */
app.use(cors({ origin: config.cors.origin }));
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req, _res, next) => {
  const start = Date.now();
  _res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[http] ${req.method} ${req.path} ${_res.statusCode} ${ms}ms`);
  });
  next();
});

/* ---------- Static frontend ---------- */
const hasFrontend = existsSync(clientDist) && existsSync(join(clientDist, 'index.html'));
if (hasFrontend) {
  app.use(express.static(clientDist));
  console.log(`[server] Serving frontend from ${clientDist}`);
} else {
  console.log('[server] No built frontend found at', clientDist);
}

/* ---------- API Routes ---------- */
app.get('/api/v1/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/monitors', monitorRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/status-pages', statusPageRoutes);
app.use('/api/v1/maintenance', maintenanceRoutes);
app.use('/api/v1/api-keys', apiKeyRoutes);
app.use('/api/v1/settings', settingsRoutes);

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

/* ---------- Start ---------- */
function start(): void {
  // Initialize database
  getDb();
  console.log('[db] SQLite ready');

  // Setup WebSocket
  setupWebSocket(server);

  // Start monitoring engine
  startEngine();

  // Schedule hourly aggregation
  setInterval(() => {
    runAggregation().catch((err) => console.error('[agg] Error:', err));
  }, config.aggregationIntervalMs);

  // Start HTTP server
  server.listen(config.port, config.host, () => {
    console.log(`[server] Helio running on http://${config.host}:${config.port}`);
    console.log(`[server] API: http://localhost:${config.port}/api/v1`);
    console.log(`[server] WS:  ws://localhost:${config.port}/ws`);
  });
}

/* ---------- Graceful Shutdown ---------- */
function shutdown(signal: string): void {
  console.log(`\n[server] Received ${signal}, shutting down gracefully...`);

  stopEngine();
  closeWebSocket();
  closeDb();

  server.close(() => {
    console.log('[server] Goodbye.');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('[server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
