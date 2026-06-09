// helio-app/backend/src/index.ts
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { attachWebSocket, wsBroadcast } from './ws/metricsWs.js';
import { attachAgentWebSocket } from './ws/agentWs.js';
import { authRouter } from './routes/auth.js';
import { metricsRouter } from './routes/metrics.js';
import { alertsRouter } from './routes/alerts.js';
import { nodesRouter } from './routes/nodes.js';
import { statusRouter } from './routes/status.js';
import { settingsRouter } from './routes/settings.js';
import { pingRouter, setPingCollector } from './routes/ping.js';
import { agentsRouter } from './routes/agents.js';
import { teamRouter } from './routes/team.js';
import { collectSnapshot } from './collectors/systemCollector.js';
import { PingCollector } from './collectors/pingCollector.js';
import { queries } from './db/index.js';
import { evaluateAlerts, setAlertBroadcast } from './alertEngine.js';
import { requireAuth, requireRole } from './middleware/auth.js';

const PORT = Number(process.env.PORT ?? 3001);
const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
app.use(cors({ origin: IS_PROD ? false : '*' }));
app.use(express.json());

// Public routes (no auth required)
app.use('/api/auth', authRouter);
app.use('/api/status', statusRouter);
app.use('/api/settings', settingsRouter);

// Global auth guard — all routes below require a valid JWT
app.use(requireAuth);

// Protected routes
app.use('/api/metrics', metricsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/nodes', nodesRouter);
app.use('/api/ping', pingRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/team', requireRole('admin'), teamRouter);

if (IS_PROD) {
  const DIST = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(DIST));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

const server = http.createServer(app);
// Agent WS must be registered before browser WS (order matters for upgrade handler)
attachAgentWebSocket(server);
attachWebSocket(server);
setAlertBroadcast(wsBroadcast);

const pingCollector = new PingCollector(queries, wsBroadcast);
setPingCollector(pingCollector);

async function collect(): Promise<void> {
  try {
    const snap = await collectSnapshot();
    queries.insertMetric(snap);
    wsBroadcast({ type: 'metrics', data: snap });
    await evaluateAlerts(snap);
  } catch (err) {
    console.error('[Collector] Error:', err);
  }
}

server.listen(PORT, async () => {
  console.log(`[Helio] Backend running on http://localhost:${PORT}`);
  pingCollector.start();
  await collect();
  setInterval(collect, 5_000);
});
