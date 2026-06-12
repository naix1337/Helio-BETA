import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import * as containerQueries from '../db/containerQueries.js';
import { startContainerPolling, restartContainerPolling, stopContainerPolling } from '../engine/ContainerCollector.js';
import { ProxmoxClient } from '../collectors/proxmox.js';

const router = Router();

const configSchema = z.object({
  host: z.string().url('Must be a valid URL (https://your-proxmox:8006)'),
  user: z.string().min(1, 'User is required (e.g. root@pam)'),
  password: z.string().min(1, 'Password is required'),
  intervalSeconds: z.number().int().min(10).max(3600).default(60),
});

// GET /api/v1/containers — list latest container metrics
router.get('/', requireAuth, (_req: AuthRequest, res) => {
  const metrics = containerQueries.getLatestContainerMetrics();
  res.json({ success: true, data: metrics });
});

// GET /api/v1/containers/:vmid/history — get metric history for one container
router.get('/:vmid/history', requireAuth, (req, res) => {
  const vmid = parseInt(req.params['vmid']!, 10);
  if (isNaN(vmid)) {
    res.status(400).json({ success: false, error: 'Invalid VMID' });
    return;
  }
  const history = containerQueries.getContainerHistory(vmid);
  res.json({ success: true, data: history });
});

// GET /api/v1/containers/config — get Proxmox connection config (without password)
router.get('/config', requireAuth, (_req: AuthRequest, res) => {
  const config = containerQueries.getProxmoxConfig();
  if (!config) {
    res.json({ success: true, data: null });
    return;
  }
  // Don't return the password
  res.json({
    success: true,
    data: {
      host: config.host,
      user: config.user,
      intervalSeconds: config.intervalSeconds,
      connected: true,
    },
  });
});

// POST /api/v1/containers/config — save Proxmox config and start polling
router.post('/config', requireAuth, (req: AuthRequest, res) => {
  try {
    const input = configSchema.parse(req.body);
    containerQueries.setProxmoxConfig(input);
    restartContainerPolling();
    res.json({ success: true, data: { host: input.host, user: input.user, intervalSeconds: input.intervalSeconds, connected: true } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors.map((e) => e.message).join(', ') });
      return;
    }
    throw err;
  }
});

// POST /api/v1/containers/test — test Proxmox connection
router.post('/test', requireAuth, async (req: AuthRequest, res) => {
  try {
    const input = configSchema.parse(req.body);
    const client = new ProxmoxClient(input.host, input.user, input.password);
    const result = await client.testConnection();
    res.json({ success: result.success, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors.map((e) => e.message).join(', ') });
      return;
    }
    res.json({ success: false, data: { success: false, message: err instanceof Error ? err.message : 'Connection failed' } });
  }
});

// DELETE /api/v1/containers/config — remove Proxmox config and stop polling
router.delete('/config', requireAuth, (_req: AuthRequest, res) => {
  stopContainerPolling();
  containerQueries.deleteProxmoxConfig();
  res.json({ success: true, data: null });
});

export default router;
