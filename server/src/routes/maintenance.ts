import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireWrite } from '../middleware/auth.js';
import * as queries from '../db/queries.js';

const router = Router();

const createSchema = z.object({
  monitorIds: z.array(z.string()).min(1, 'At least one monitor required'),
  startsAt: z.string().datetime({ offset: true }).transform((v) => new Date(v).toISOString()),
  endsAt: z.string().datetime({ offset: true }).transform((v) => new Date(v).toISOString()),
  description: z.string().min(1).max(500),
}).refine((v) => v.endsAt > v.startsAt, { message: 'endsAt must be after startsAt', path: ['endsAt'] });

// GET /maintenance
router.get('/', requireAuth, (_req, res) => {
  const windows = queries.listMaintenanceWindows();
  res.json({ success: true, data: windows });
});

// POST /maintenance
router.post('/', requireWrite, (req, res) => {
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
router.delete('/:id', requireWrite, (req, res) => {
  const deleted = queries.deleteMaintenanceWindow(req.params['id']!);
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Maintenance window not found' });
    return;
  }
  res.json({ success: true, data: null });
});

export default router;
