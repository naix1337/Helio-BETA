// helio-app/backend/src/index.ts
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { attachWebSocket, wsBroadcast } from './ws/metricsWs.js';
import { metricsRouter } from './routes/metrics.js';
import { alertsRouter } from './routes/alerts.js';
import { nodesRouter } from './routes/nodes.js';
import { statusRouter } from './routes/status.js';
import { collectSnapshot } from './collectors/systemCollector.js';
import { collectContainers } from './collectors/dockerCollector.js';
import { queries } from './db/index.js';
import { evaluateAlerts, setAlertBroadcast } from './alertEngine.js';

const PORT = Number(process.env.PORT ?? 3001);
const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
app.use(cors({ origin: IS_PROD ? false : '*' }));
app.use(express.json());

app.use('/api/metrics', metricsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/nodes', nodesRouter);
app.use('/api/status', statusRouter);

if (IS_PROD) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const DIST = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(DIST));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

const server = http.createServer(app);
attachWebSocket(server);
setAlertBroadcast(wsBroadcast);

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
  await collect();
  setInterval(collect, 5_000);
});
