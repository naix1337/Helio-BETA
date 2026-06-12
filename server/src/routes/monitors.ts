import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAuthOrApiKey, type AuthRequest } from '../middleware/auth.js';
import * as queries from '../db/queries.js';
import { startMonitorEngine, stopMonitorEngine } from '../engine/Engine.js';
import { getChecker } from '../checkers/registry.js';
import type { MonitorType, MonitorStatus } from '@pulse/shared';

const router = Router();

const monitorCreateSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['http', 'tcp', 'ping', 'dns', 'ssl', 'push']),
  config: z.record(z.unknown()),
  intervalSeconds: z.number().int().min(20).default(60),
  retries: z.number().int().min(0).default(0),
  tags: z.array(z.string()).default([]),
});

const monitorUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  config: z.record(z.unknown()).optional(),
  intervalSeconds: z.number().int().min(20).optional(),
  retries: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['UP', 'DOWN', 'PENDING', 'PAUSED', 'DEGRADED']).optional(),
});

const heartbeatRangeSchema = z.enum(['24h', '7d', '30d']);

function formatMonitorResponse(mon: import('@pulse/shared').Monitor) {
  return mon;
}

// GET /monitors (accepts JWT or API key with read scope)
router.get('/', requireAuthOrApiKey('read'), (req: AuthRequest, res) => {
  const { status, type, tag } = req.query as { status?: MonitorStatus; type?: string; tag?: string };
  const monitors = queries.listMonitors({ status, type, tag });
  res.json({ success: true, data: monitors.map(formatMonitorResponse) });
});

// POST /monitors
router.post('/', requireAuth, (req: AuthRequest, res) => {
  try {
    const input = monitorCreateSchema.parse(req.body);
    const wrappedConfig = { type: input.type, data: input.config } as import('@pulse/shared').MonitorConfig;
    const monitor = queries.createMonitor({
      name: input.name,
      type: input.type,
      config: wrappedConfig,
      intervalSeconds: input.intervalSeconds,
      retries: input.retries,
      tags: input.tags,
    });

    // Start engine
    startMonitorEngine(monitor);

    res.status(201).json({ success: true, data: formatMonitorResponse(monitor) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors.map((e) => e.message).join(', ') });
      return;
    }
    throw err;
  }
});

// GET /monitors/:id (accepts JWT or API key)
router.get('/:id', requireAuthOrApiKey('read'), (req, res) => {
  const monitor = queries.getMonitor(req.params['id']!);
  if (!monitor) {
    res.status(404).json({ success: false, error: 'Monitor not found' });
    return;
  }
  res.json({ success: true, data: formatMonitorResponse(monitor) });
});

// PATCH /monitors/:id
router.patch('/:id', requireAuth, (req, res) => {
  try {
    const input = monitorUpdateSchema.parse(req.body);
    const monitor = queries.updateMonitor(req.params['id']!, input);
    if (!monitor) {
      res.status(404).json({ success: false, error: 'Monitor not found' });
      return;
    }

    // Restart engine with new interval/config if needed
    if (input.intervalSeconds || input.status) {
      stopMonitorEngine(monitor.id);
      if (monitor.status !== 'PAUSED') {
        startMonitorEngine(monitor);
      }
    }

    res.json({ success: true, data: formatMonitorResponse(monitor) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors.map((e) => e.message).join(', ') });
      return;
    }
    throw err;
  }
});

// DELETE /monitors/:id
router.delete('/:id', requireAuth, (req, res) => {
  stopMonitorEngine(req.params['id']!);
  const deleted = queries.deleteMonitor(req.params['id']!);
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Monitor not found' });
    return;
  }
  res.json({ success: true, data: null });
});

// GET /monitors/:id/heartbeats (accepts JWT or API key)
router.get('/:id/heartbeats', requireAuthOrApiKey('read'), (req, res) => {
  const monitor = queries.getMonitor(req.params['id']!);
  if (!monitor) {
    res.status(404).json({ success: false, error: 'Monitor not found' });
    return;
  }

  const range = heartbeatRangeSchema.safeParse(req.query['range']);
  const heartbeats = range.success
    ? queries.getHeartbeatsByRange(req.params['id']!, range.data)
    : queries.getHeartbeats(req.params['id']!, parseInt(req.query['limit'] as string) || 100);

  res.json({ success: true, data: heartbeats });
});

// GET /monitors/:id/uptime (accepts JWT or API key)
router.get('/:id/uptime', requireAuthOrApiKey('read'), (req, res) => {
  const monitor = queries.getMonitor(req.params['id']!);
  if (!monitor) {
    res.status(404).json({ success: false, error: 'Monitor not found' });
    return;
  }

  const summary = queries.computeUptimeSummary(req.params['id']!);
  const aggregations = queries.getUptimeAggregations(req.params['id']!, 'hourly', 168);

  res.json({ success: true, data: { summary, aggregations } });
});

// POST /monitors/:id/pause
router.post('/:id/pause', requireAuth, (req, res) => {
  const monitor = queries.updateMonitor(req.params['id']!, { status: 'PAUSED' });
  if (!monitor) {
    res.status(404).json({ success: false, error: 'Monitor not found' });
    return;
  }
  stopMonitorEngine(monitor.id);
  res.json({ success: true, data: formatMonitorResponse(monitor) });
});

// POST /monitors/:id/resume
router.post('/:id/resume', requireAuth, (req, res) => {
  const monitor = queries.updateMonitor(req.params['id']!, { status: 'PENDING' });
  if (!monitor) {
    res.status(404).json({ success: false, error: 'Monitor not found' });
    return;
  }
  startMonitorEngine(monitor);
  res.json({ success: true, data: formatMonitorResponse(monitor) });
});

export default router;
