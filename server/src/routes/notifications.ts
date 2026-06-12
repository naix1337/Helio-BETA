import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import * as queries from '../db/queries.js';
import { testNotificationProvider } from '../notifications/index.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(200),
  provider: z.enum(['webhook', 'telegram', 'discord', 'email', 'ntfy']),
  config: z.record(z.unknown()),
  monitorIds: z.array(z.string()).default([]),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  provider: z.enum(['webhook', 'telegram', 'discord', 'email', 'ntfy']).optional(),
  config: z.record(z.unknown()).optional(),
  monitorIds: z.array(z.string()).optional(),
});

// GET /notifications
router.get('/', requireAuth, (_req, res) => {
  const notifications = queries.listNotifications();
  res.json({ success: true, data: notifications });
});

// POST /notifications
router.post('/', requireAuth, (req, res) => {
  try {
    const input = createSchema.parse(req.body);
    const wrappedConfig = { provider: input.provider, data: input.config } as import('@pulse/shared').NotificationConfig;
    const notification = queries.createNotification({
      name: input.name,
      provider: input.provider,
      config: wrappedConfig,
      monitorIds: input.monitorIds,
    });
    res.status(201).json({ success: true, data: notification });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors.map((e) => e.message).join(', ') });
      return;
    }
    throw err;
  }
});

// GET /notifications/:id
router.get('/:id', requireAuth, (req, res) => {
  const notification = queries.getNotification(req.params['id']!);
  if (!notification) {
    res.status(404).json({ success: false, error: 'Notification not found' });
    return;
  }
  res.json({ success: true, data: notification });
});

// PATCH /notifications/:id
router.patch('/:id', requireAuth, (req, res) => {
  try {
    const input = updateSchema.parse(req.body);
    const updateInput: Record<string, unknown> = {};
    if (input.name !== undefined) updateInput['name'] = input.name;
    if (input.provider !== undefined) updateInput['provider'] = input.provider;
    if (input.config !== undefined) {
      const provider = (input.provider || queries.getNotification(req.params['id']!)?.provider) as string;
      updateInput['config'] = { provider, data: input.config } as import('@pulse/shared').NotificationConfig;
    }
    if (input.monitorIds !== undefined) updateInput['monitorIds'] = input.monitorIds;

    const notification = queries.updateNotification(req.params['id']!, updateInput as any);
    if (!notification) {
      res.status(404).json({ success: false, error: 'Notification not found' });
      return;
    }
    res.json({ success: true, data: notification });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors.map((e) => e.message).join(', ') });
      return;
    }
    throw err;
  }
});

// DELETE /notifications/:id
router.delete('/:id', requireAuth, (req, res) => {
  const deleted = queries.deleteNotification(req.params['id']!);
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Notification not found' });
    return;
  }
  res.json({ success: true, data: null });
});

// POST /notifications/:id/test
router.post('/:id/test', requireAuth, async (req, res) => {
  const notification = queries.getNotification(req.params['id']!);
  if (!notification) {
    res.status(404).json({ success: false, error: 'Notification not found' });
    return;
  }

  const configData = (notification.config as { data: Record<string, unknown> }).data ?? {};
  const result = await testNotificationProvider(notification.provider, configData as Record<string, unknown>);
  res.json({ success: result.success, data: result });
});

export default router;
