import type { Notification, NotificationPayload } from '@pulse/shared';
import { WebhookProvider } from './WebhookProvider.js';
import { TelegramProvider } from './TelegramProvider.js';
import { DiscordProvider } from './DiscordProvider.js';
import { EmailProvider } from './EmailProvider.js';
import { NtfyProvider } from './NtfyProvider.js';
import type { INotificationProvider } from './INotificationProvider.js';

const providers: Map<string, INotificationProvider> = new Map();

// Register all providers
const webhook = new WebhookProvider();
const telegram = new TelegramProvider();
const discord = new DiscordProvider();
const email = new EmailProvider();
const ntfy = new NtfyProvider();

[webhook, telegram, discord, email, ntfy].forEach((p) => providers.set(p.name, p));

export function getProvider(name: string): INotificationProvider | undefined {
  return providers.get(name);
}

export async function dispatchNotification(
  notification: Notification,
  payload: NotificationPayload,
): Promise<boolean> {
  const provider = getProvider(notification.provider);
  if (!provider) {
    console.error(`[notifications] Unknown provider: ${notification.provider}`);
    return false;
  }

  const configData = (notification.config as { data: unknown }).data ?? notification.config;
  return provider.send(configData as Record<string, unknown>, payload);
}

export async function testNotificationProvider(
  provider: string,
  config: Record<string, unknown>,
): Promise<{ success: boolean; message: string }> {
  const prov = getProvider(provider);
  if (!prov) return { success: false, message: `Unknown provider: ${provider}` };
  try {
    return await prov.test(config);
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Test failed' };
  }
}
