import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireWrite, type AuthRequest } from '../middleware/auth.js';
import type { Notification } from '@pulse/shared';
import { notificationTestLimiter } from '../middleware/rateLimiter.js';
import * as queries from '../db/queries.js';
import { testNotificationProvider } from '../notifications/index.js';
import { notificationProviderSchemas } from '../notifications/schemas.js';

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

/**
 * Validate notification config against provider-specific schema.
 * Returns an error string or null if valid.
 */
function validateProviderConfig(provider: string, config: Record<string, unknown>): { error: string } | { data: Record<string, unknown> } {
  const schema = notificationProviderSchemas[provider];
  if (!schema) return { error: 'Unknown provider' };

  const result = schema.safeParse(config);
  if (!result.success) {
    return { error: result.error.errors.map((e) => `${e.path.join('.') || 'config'}: ${e.message}`).join(', ') };
  }
  return { data: result.data as Record<string, unknown> };
}


const SECRET_KEYS = ['botToken', 'smtpPass', 'accessToken', 'headers', 'webhookUrl', 'url'];

/** Hide provider secrets from non-admin users */
function redactFor(role: string | undefined, n: Notification): Notification {
  if (role === 'admin') return n;
  const data = { ...((n.config as unknown as { data?: Record<string, unknown> }).data ?? {}) };
  for (const k of SECRET_KEYS) if (data[k]) data[k] = '********';
  return { ...n, config: { provider: n.provider, data } as unknown as Notification['config'] };
}

// GET /notifications
router.get('/', requireAuth, (req: AuthRequest, res) => {
  const notifications = queries.listNotifications().map((n) => redactFor(req.userRole, n));
  res.json({ success: true, data: notifications });
});

// POST /notifications
router.post('/', requireWrite, (req, res) => {
  try {
    const input = createSchema.parse(req.body);

    // Validate config structure for the given provider
    const validated = validateProviderConfig(input.provider, input.config as Record<string, unknown>);
    if ('error' in validated) {
      res.status(400).json({ success: false, error: validated.error });
      return;
    }

    const wrappedConfig = { provider: input.provider, data: validated.data } as unknown as import('@pulse/shared').NotificationConfig;
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
router.get('/:id', requireAuth, (req: AuthRequest, res) => {
  const notification = queries.getNotification(req.params['id']!);
  if (!notification) {
    res.status(404).json({ success: false, error: 'Notification not found' });
    return;
  }
  res.json({ success: true, data: redactFor(req.userRole, notification) });
});

// PATCH /notifications/:id
router.patch('/:id', requireWrite, (req, res) => {
  try {
    const input = updateSchema.parse(req.body);
    const updateInput: Record<string, unknown> = {};
    if (input.name !== undefined) updateInput['name'] = input.name;
    if (input.provider !== undefined) updateInput['provider'] = input.provider;
    if (input.config !== undefined) {
      const provider = (input.provider || queries.getNotification(req.params['id']!)?.provider) as string;

      // Validate config if provided
      const validated = validateProviderConfig(provider, input.config as Record<string, unknown>);
      if ('error' in validated) {
        res.status(400).json({ success: false, error: validated.error });
        return;
      }

      updateInput['config'] = { provider, data: validated.data };
    }
    if (input.monitorIds !== undefined) updateInput['monitorIds'] = input.monitorIds;

    const notification = queries.updateNotification(req.params['id']!, updateInput as Partial<import('@pulse/shared').CreateNotificationInput>);
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
router.delete('/:id', requireWrite, (req, res) => {
  const deleted = queries.deleteNotification(req.params['id']!);
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Notification not found' });
    return;
  }
  res.json({ success: true, data: null });
});

// POST /notifications/:id/test — rate limited
router.post('/:id/test', requireWrite, notificationTestLimiter, async (req, res) => {
  const notification = queries.getNotification(req.params['id']!);
  if (!notification) {
    res.status(404).json({ success: false, error: 'Notification not found' });
    return;
  }

  const configData = (notification.config as unknown as { data?: Record<string, unknown> }).data ?? {};
  const result = await testNotificationProvider(notification.provider, configData as Record<string, unknown>);
  res.json({ success: true, data: result });
});

// POST /notifications/test — test an unsaved config
router.post('/test', requireWrite, notificationTestLimiter, async (req, res) => {
  const body = req.body as { provider?: string; config?: Record<string, unknown> };
  if (!body.provider || !body.config) {
    res.status(400).json({ success: false, error: 'provider and config are required' });
    return;
  }
  const validated = validateProviderConfig(body.provider, body.config);
  if ('error' in validated) {
    res.status(400).json({ success: false, error: validated.error });
    return;
  }
  const result = await testNotificationProvider(body.provider, validated.data);
  res.json({ success: true, data: result });
});

export default router;
