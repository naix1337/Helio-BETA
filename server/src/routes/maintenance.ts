import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import * as queries from '../db/queries.js';

const router = Router();

const createSchema = z.object({
  monitorIds: z.array(z.string()).min(1, 'At least one monitor required'),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  description: z.string().min(1).max(500),
});

// GET /maintenance
router.get('/', requireAuth, (_req, res) => {
  const windows = queries.listMaintenanceWindows();
  res.json({ success: true, data: windows });
});

// POST /maintenance
router.post('/', requireAuth, (req, res) => {
  try {
    const input = createSchema.parse(req.body);
    const mw = queries.createMaintenanceWindow(input.monitorIds, input.startsAt, input.endsAt, input.description);
    res.status(201).json({ success: true, data: mw });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors.map((e) => e.message).join(', ') });
      return;
    }
    throw err;
  }
});

// GET /maintenance/active
router.get('/active', requireAuth, (_req, res) => {
  const windows = queries.getActiveMaintenanceWindows();
  res.json({ success: true, data: windows });
});

// DELETE /maintenance/:id
router.delete('/:id', requireAuth, (req, res) => {
  const deleted = queries.deleteMaintenanceWindow(req.params['id']!);
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Maintenance window not found' });
    return;
  }
  res.json({ success: true, data: null });
});

export default router;
