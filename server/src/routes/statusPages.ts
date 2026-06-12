import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import * as queries from '../db/queries.js';

const router = Router();

const createSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  logoUrl: z.string().nullable().optional(),
  monitorIds: z.array(z.string()).default([]),
  incidentBanner: z.string().nullable().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  logoUrl: z.string().nullable().optional(),
  monitorIds: z.array(z.string()).optional(),
  incidentBanner: z.string().nullable().optional(),
});

// CRUD (authenticated)
router.get('/', requireAuth, (_req, res) => {
  const pages = queries.listStatusPages();
  res.json({ success: true, data: pages });
});

router.post('/', requireAuth, (req, res) => {
  try {
    const input = createSchema.parse(req.body);
    const page = queries.createStatusPage(input.title, input.slug, input.monitorIds);
    if (input.logoUrl) queries.updateStatusPage(page.id, { logoUrl: input.logoUrl });
    if (input.incidentBanner) queries.updateStatusPage(page.id, { incidentBanner: input.incidentBanner });
    res.status(201).json({ success: true, data: queries.getStatusPage(page.id) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors.map((e) => e.message).join(', ') });
      return;
    }
    throw err;
  }
});

router.get('/:id', requireAuth, (req, res) => {
  const page = queries.getStatusPage(req.params['id']!);
  if (!page) {
    res.status(404).json({ success: false, error: 'Status page not found' });
    return;
  }
  res.json({ success: true, data: page });
});

router.patch('/:id', requireAuth, (req, res) => {
  try {
    const input = updateSchema.parse(req.body);
    const page = queries.updateStatusPage(req.params['id']!, input);
    if (!page) {
      res.status(404).json({ success: false, error: 'Status page not found' });
      return;
    }
    res.json({ success: true, data: page });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors.map((e) => e.message).join(', ') });
      return;
    }
    throw err;
  }
});

router.delete('/:id', requireAuth, (req, res) => {
  const deleted = queries.deleteStatusPage(req.params['id']!);
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Status page not found' });
    return;
  }
  res.json({ success: true, data: null });
});

// Public status page (no auth)
router.get('/public/:slug', (req, res) => {
  const page = queries.getStatusPageBySlug(req.params['slug']!);
  if (!page) {
    res.status(404).json({ success: false, error: 'Status page not found' });
    return;
  }

  const monitors = page.monitorIds
    .map((id) => queries.getMonitor(id))
    .filter(Boolean) as import('@pulse/shared').Monitor[];

  const monitorsWithStatus = monitors.map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    status: m.status,
    uptime: queries.computeUptimeSummary(m.id),
  }));

  res.json({
    success: true,
    data: {
      page,
      monitors: monitorsWithStatus,
    },
  });
});

export default router;
