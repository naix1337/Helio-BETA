import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { requireAuth, requireWrite, type AuthRequest } from '../middleware/auth.js';
import * as queries from '../db/queries.js';
import { startMonitorEngine, stopMonitorEngine } from '../engine/Engine.js';
import { broadcast } from '../ws/handler.js';
import { getChecker } from '../checkers/registry.js';
import type { Monitor, MonitorConfig, MonitorStatus, MonitorType } from '@pulse/shared';

const router = Router();

const monitorTypes = ['http', 'tcp', 'ping', 'dns', 'ssl', 'push'] as const;

/* ---------- Per-type config validation ---------- */

const httpSchema = z.object({
  url: z.string().url('URL must be a valid http(s) URL').refine((u) => /^https?:\/\//i.test(u), 'URL must start with http:// or https://'),
  method: z.enum(['GET', 'POST', 'HEAD', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  statusCodeMin: z.coerce.number().int().min(100).max(599).default(200),
  statusCodeMax: z.coerce.number().int().min(100).max(599).default(299),
  keyword: z.string().max(500).optional(),
  invertKeyword: z.boolean().optional(),
  jsonPath: z.string().max(500).optional(),
  jsonPathExpected: z.string().max(500).optional(),
  followRedirects: z.boolean().optional(),
  timeoutMs: z.coerce.number().int().min(1000).max(120000).default(30000),
  headers: z.record(z.string()).optional(),
  basicAuthUser: z.string().optional(),
  basicAuthPass: z.string().optional(),
  ignoreTls: z.boolean().optional(),
  body: z.string().max(100000).optional(),
});

const hostSchema = z.string().trim().min(1, 'Host is required').max(253);

const configSchemas: Record<MonitorType, z.ZodTypeAny> = {
  http: httpSchema,
  tcp: z.object({
    host: hostSchema,
    port: z.coerce.number().int().min(1).max(65535),
    timeoutMs: z.coerce.number().int().min(500).max(120000).default(10000),
  }),
  ping: z.object({
    host: hostSchema,
    count: z.coerce.number().int().min(1).max(10).default(3),
  }),
  dns: z.object({
    host: hostSchema,
    recordType: z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT']).default('A'),
    expectedValue: z.string().max(500).optional(),
    resolver: z.string().ip().optional().or(z.literal('').transform(() => undefined)),
  }),
  ssl: z.object({
    host: hostSchema,
    port: z.coerce.number().int().min(1).max(65535).default(443),
    warningDays: z.coerce.number().int().min(0).max(365).default(30),
  }),
  push: z.object({
    token: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/, 'Invalid push token').optional(),
    graceSeconds: z.coerce.number().int().min(0).max(86400 * 7).default(60),
  }),
};

function stripEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined));
}

function generatePushToken(): string {
  return randomBytes(16).toString('base64url');
}

/** Validate + normalize config; returns wrapped `{type, data}` config. */
function buildConfig(type: MonitorType, raw: Record<string, unknown>, existing?: Monitor): MonitorConfig {
  // Accept already-wrapped configs ({type, data}) as well
  const unwrapped = (raw['data'] && typeof raw['data'] === 'object' ? raw['data'] : raw) as Record<string, unknown>;
  const data = configSchemas[type].parse(stripEmpty(unwrapped)) as Record<string, unknown>;

  if (type === 'push' && !data['token']) {
    const prevToken = existing?.type === 'push' ? (existing.config as { data?: { token?: string } }).data?.token : undefined;
    data['token'] = prevToken ?? generatePushToken();
  }
  if (type === 'http') {
    const d = data as z.infer<typeof httpSchema>;
    if (d.statusCodeMin > d.statusCodeMax) throw new z.ZodError([{ code: 'custom', path: ['statusCodeMin'], message: 'statusCodeMin must be <= statusCodeMax' }]);
  }
  return { type, data } as MonitorConfig;
}

const monitorCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(monitorTypes),
  config: z.record(z.unknown()),
  intervalSeconds: z.coerce.number().int().min(20).max(86400 * 7).default(60),
  retries: z.coerce.number().int().min(0).max(10).default(0),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  notificationIds: z.array(z.string()).optional(),
});

const monitorUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  config: z.record(z.unknown()).optional(),
  intervalSeconds: z.coerce.number().int().min(20).max(86400 * 7).optional(),
  retries: z.coerce.number().int().min(0).max(10).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  notificationIds: z.array(z.string()).optional(),
});

const heartbeatRangeSchema = z.enum(['1h', '6h', '24h', '7d', '30d']);

/** Remove credentials from a monitor config (for viewers and WS broadcasts) */
function redact(mon: Monitor): Monitor {
  const data = (mon.config as unknown as { data?: Record<string, unknown> }).data;
  if (!data) return mon;
  const clean: Record<string, unknown> = { ...data };
  if (clean['basicAuthPass']) clean['basicAuthPass'] = '********';
  if (clean['headers'] && typeof clean['headers'] === 'object') {
    clean['headers'] = Object.fromEntries(Object.keys(clean['headers'] as object).map((k) => [k, '********']));
  }
  return { ...mon, config: { ...mon.config, data: clean } as unknown as MonitorConfig };
}

function withNotifications(mon: Monitor, role?: string) {
  const out = role === 'admin' ? mon : redact(mon);
  return { ...out, notificationIds: queries.getNotificationIdsForMonitor(mon.id) };
}

function zodMessage(err: z.ZodError): string {
  return err.errors.map((e) => (e.path.length ? `${e.path.join('.')}: ${e.message}` : e.message)).join(', ');
}

function emit(type: 'monitor:created' | 'monitor:updated' | 'monitor:deleted', payload: unknown) {
  broadcast({ type, payload, timestamp: new Date().toISOString() });
}

// GET /monitors
router.get('/', requireAuth, (req: AuthRequest, res) => {
  const { status, type, tag } = req.query as { status?: MonitorStatus; type?: string; tag?: string };
  const monitors = queries.listMonitors({ status, type, tag });
  res.json({ success: true, data: monitors.map((m) => withNotifications(m, req.userRole)) });
});

// GET /monitors/beats — last heartbeats for all monitors (beat bars)
router.get('/beats', requireAuth, (req, res) => {
  const count = Math.min(Math.max(parseInt(req.query['count'] as string) || 40, 1), 100);
  res.json({ success: true, data: queries.getRecentBeatsForAll(count) });
});

// GET /monitors/events — recent status changes (all monitors)
router.get('/events', requireAuth, (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query['limit'] as string) || 100, 1), 500);
  res.json({ success: true, data: queries.getStatusEvents(limit) });
});

// POST /monitors
router.post('/', requireWrite, (req, res) => {
  try {
    const input = monitorCreateSchema.parse(req.body);
    const monitor = queries.createMonitor({
      name: input.name,
      type: input.type,
      config: buildConfig(input.type, input.config),
      intervalSeconds: input.intervalSeconds,
      retries: input.retries,
      tags: input.tags,
    });
    if (input.notificationIds) queries.setMonitorNotifications(monitor.id, input.notificationIds);

    startMonitorEngine(monitor);
    const out = withNotifications(monitor, 'admin');
    emit('monitor:created', withNotifications(monitor));
    res.status(201).json({ success: true, data: out });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: zodMessage(err) });
      return;
    }
    throw err;
  }
});

// GET /monitors/:id
router.get('/:id', requireAuth, (req: AuthRequest, res) => {
  const monitor = queries.getMonitor(req.params['id']!);
  if (!monitor) {
    res.status(404).json({ success: false, error: 'Monitor not found' });
    return;
  }
  res.json({ success: true, data: withNotifications(monitor, req.userRole) });
});

// PATCH /monitors/:id
router.patch('/:id', requireWrite, (req, res) => {
  try {
    const input = monitorUpdateSchema.parse(req.body);
    const existing = queries.getMonitor(req.params['id']!);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Monitor not found' });
      return;
    }

    const monitor = queries.updateMonitor(existing.id, {
      name: input.name,
      intervalSeconds: input.intervalSeconds,
      retries: input.retries,
      tags: input.tags,
      config: input.config ? buildConfig(existing.type, input.config, existing) : undefined,
      // Config changes invalidate the current state → re-evaluate from PENDING
      ...(input.config && existing.status !== 'PAUSED' ? { status: 'PENDING' as const } : {}),
    })!;
    if (input.notificationIds) queries.setMonitorNotifications(monitor.id, input.notificationIds);

    // Restart scheduler so interval/config changes apply immediately
    if (monitor.status !== 'PAUSED') startMonitorEngine(monitor);

    const out = withNotifications(monitor, 'admin');
    emit('monitor:updated', withNotifications(monitor));
    res.json({ success: true, data: out });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: zodMessage(err) });
      return;
    }
    throw err;
  }
});

// DELETE /monitors/:id
router.delete('/:id', requireWrite, (req, res) => {
  const id = req.params['id']!;
  stopMonitorEngine(id);
  const deleted = queries.deleteMonitor(id);
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Monitor not found' });
    return;
  }
  // Remove from status pages
  for (const page of queries.listStatusPages()) {
    if (page.monitorIds.includes(id)) {
      queries.updateStatusPage(page.id, { monitorIds: page.monitorIds.filter((m) => m !== id) });
    }
  }
  emit('monitor:deleted', { id });
  res.json({ success: true, data: null });
});

// GET /monitors/:id/heartbeats
router.get('/:id/heartbeats', requireAuth, (req, res) => {
  const monitor = queries.getMonitor(req.params['id']!);
  if (!monitor) {
    res.status(404).json({ success: false, error: 'Monitor not found' });
    return;
  }

  const range = heartbeatRangeSchema.safeParse(req.query['range']);
  const limit = Math.min(Math.max(parseInt(req.query['limit'] as string) || 100, 1), 5000);
  const heartbeats = range.success
    ? queries.getHeartbeatsByRange(monitor.id, range.data)
    : queries.getHeartbeats(monitor.id, limit);

  res.json({ success: true, data: heartbeats });
});

// GET /monitors/:id/uptime
router.get('/:id/uptime', requireAuth, (req, res) => {
  const monitor = queries.getMonitor(req.params['id']!);
  if (!monitor) {
    res.status(404).json({ success: false, error: 'Monitor not found' });
    return;
  }

  const summary = queries.computeUptimeSummary(monitor.id);
  const aggregations = queries.getUptimeAggregations(monitor.id, 'hourly', 168);

  res.json({ success: true, data: { summary, aggregations } });
});

// POST /monitors/:id/check — run a check immediately (does not persist)
router.post('/:id/check', requireWrite, async (req, res) => {
  const monitor = queries.getMonitor(req.params['id']!);
  if (!monitor) {
    res.status(404).json({ success: false, error: 'Monitor not found' });
    return;
  }
  const checker = getChecker(monitor.type);
  if (!checker || monitor.type === 'push') {
    res.status(400).json({ success: false, error: 'Manual checks are not available for this monitor type' });
    return;
  }
  const result = await checker.check((monitor.config as { data?: unknown }).data ?? monitor.config);
  res.json({ success: true, data: result });
});

// POST /monitors/:id/pause
router.post('/:id/pause', requireWrite, (req, res) => {
  const monitor = queries.updateMonitor(req.params['id']!, { status: 'PAUSED' });
  if (!monitor) {
    res.status(404).json({ success: false, error: 'Monitor not found' });
    return;
  }
  stopMonitorEngine(monitor.id);
  const out = withNotifications(monitor, 'admin');
  emit('monitor:updated', withNotifications(monitor));
  res.json({ success: true, data: out });
});

// POST /monitors/:id/resume
router.post('/:id/resume', requireWrite, (req, res) => {
  const monitor = queries.updateMonitor(req.params['id']!, { status: 'PENDING' });
  if (!monitor) {
    res.status(404).json({ success: false, error: 'Monitor not found' });
    return;
  }
  startMonitorEngine(monitor);
  const out = withNotifications(monitor, 'admin');
  emit('monitor:updated', withNotifications(monitor));
  res.json({ success: true, data: out });
});

export default router;
