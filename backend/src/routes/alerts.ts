// helio-app/backend/src/routes/alerts.ts
import { Router } from 'express';
import { queries } from '../db/index.js';
import type { AlertMetric, AlertOperator, AlertChannel } from '../types.js';

export const alertsRouter = Router();

alertsRouter.get('/', (_req, res) => {
  res.json(queries.getAllAlerts());
});

alertsRouter.get('/events', (_req, res) => {
  res.json(queries.getRecentAlertEvents(50));
});

alertsRouter.post('/', (req, res) => {
  const { name, metric, operator, threshold, channel, target, cooldown } = req.body as {
    name: string; metric: AlertMetric; operator: AlertOperator;
    threshold: number; channel: AlertChannel; target: string; cooldown?: number;
  };

  if (!name || !metric || !operator || threshold == null || !channel || !target) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const id = queries.insertAlert({ name, metric, operator, threshold, channel, target, cooldown: cooldown ?? 15 });
  res.status(201).json({ id, name, metric, operator, threshold, channel, target });
});

alertsRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { enabled } = req.body as { enabled: boolean };
  queries.updateAlert(id, enabled);
  res.json({ ok: true });
});

alertsRouter.delete('/:id', (req, res) => {
  queries.deleteAlert(Number(req.params.id));
  res.json({ ok: true });
});
