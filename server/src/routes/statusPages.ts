import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireWrite } from '../middleware/auth.js';
import * as queries from '../db/queries.js';

const router = Router();

const createSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  logoUrl: z.string().url().nullable().optional().or(z.literal('').transform(() => null)),
  monitorIds: z.array(z.string()).default([]),
  incidentBanner: z.string().nullable().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  logoUrl: z.string().url().nullable().optional().or(z.literal('').transform(() => null)),
  monitorIds: z.array(z.string()).optional(),
  incidentBanner: z.string().nullable().optional(),
});

// CRUD (authenticated)
router.get('/', requireAuth, (_req, res) => {
  const pages = queries.listStatusPages();
  res.json({ success: true, data: pages });
});

router.post('/', requireWrite, (req, res) => {
  try {
    const input = createSchema.parse(req.body);
    if (queries.getStatusPageBySlug(input.slug)) {
      res.status(409).json({ success: false, error: 'Slug already in use' });
      return;
    }
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

router.patch('/:id', requireWrite, (req, res) => {
  try {
    const input = updateSchema.parse(req.body);
    if (!queries.getStatusPage(req.params['id']!)) {
      res.status(404).json({ success: false, error: 'Status page not found' });
      return;
    }
    if (input.slug) {
      const other = queries.getStatusPageBySlug(input.slug);
      if (other && other.id !== req.params['id']) {
        res.status(409).json({ success: false, error: 'Slug already in use' });
        return;
      }
    }
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

router.delete('/:id', requireWrite, (req, res) => {
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

  const beats = queries.getRecentBeatsForAll(60);
  const activeMaintenance = queries.getActiveMaintenanceWindows();

  // Only expose non-sensitive fields publicly (no config / URLs / hostnames)
  const monitorsWithStatus = monitors.map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    status: m.status,
    inMaintenance: activeMaintenance.some((mw) => mw.monitorIds.includes(m.id)),
    uptime: queries.computeUptimeSummary(m.id),
    beats: (beats[m.id] ?? []).map((b) => ({ status: b.status, latencyMs: b.latencyMs, timestamp: b.timestamp })),
  }));

  res.json({
    success: true,
    data: {
      page: {
        title: page.title,
        slug: page.slug,
        logoUrl: page.logoUrl,
        incidentBanner: page.incidentBanner,
        updatedAt: page.updatedAt,
      },
      monitors: monitorsWithStatus,
      maintenance: activeMaintenance
        .filter((mw) => mw.monitorIds.some((id) => page.monitorIds.includes(id)))
        .map((mw) => ({ description: mw.description, startsAt: mw.startsAt, endsAt: mw.endsAt })),
    },
  });
});

export default router;
