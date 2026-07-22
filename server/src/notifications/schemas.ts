/**
 * Zod validation schemas for notification provider configs.
 * Ensures each provider receives the correct configuration structure.
 */

import { z } from 'zod';

export const webhookConfigSchema = z.object({
  url: z.string().url('Webhook URL must be a valid URL'),
  headers: z.record(z.string()).optional(),
});

export const telegramConfigSchema = z.object({
  botToken: z.string().min(1, 'Bot token is required'),
  chatId: z.string().min(1, 'Chat ID is required'),
});

export const discordConfigSchema = z.object({
  webhookUrl: z.string().url('Discord webhook URL must be a valid URL'),
});

export const emailConfigSchema = z.object({
  smtpHost: z.string().min(1, 'SMTP host is required'),
  smtpPort: z.number().int().min(1).max(65535).default(587),
  smtpUser: z.string().min(1, 'SMTP user is required'),
  smtpPass: z.string().min(1, 'SMTP password is required'),
  fromEmail: z.string().email('From email must be valid'),
  toEmail: z.string().email('To email must be valid'),
});

export const ntfyConfigSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  serverUrl: z.string().url('Server URL must be valid').optional(),
});

export const notificationProviderSchemas: Record<string, z.ZodType> = {
  webhook: webhookConfigSchema,
  telegram: telegramConfigSchema,
  discord: discordConfigSchema,
  email: emailConfigSchema,
  ntfy: ntfyConfigSchema,
};
