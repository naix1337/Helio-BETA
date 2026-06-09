// helio-app/backend/src/routes/metrics.ts
import { Router } from 'express';
import { queries } from '../db/index.js';
import { collectSnapshot } from '../collectors/systemCollector.js';

export const metricsRouter = Router();

metricsRouter.get('/current', async (_req, res) => {
  try {
    const snap = await collectSnapshot();
    res.json(snap);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

metricsRouter.get('/history', (req, res) => {
  const range = (req.query.range as string) ?? '1h';
  const now = Math.floor(Date.now() / 1000);

  const rangeMap: Record<string, number> = {
    '1h': 3600, '6h': 21600, '24h': 86400, '7d': 604800,
  };
  const seconds = rangeMap[range] ?? 3600;
  const from = now - seconds;

  const rows = queries.getMetricsRange(from, now);

  const step = Math.max(1, Math.floor(rows.length / 500));
  const sampled = step === 1 ? rows : rows.filter((_, i) => i % step === 0);

  res.json(sampled);
});

