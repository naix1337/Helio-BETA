import type { INotificationProvider } from './INotificationProvider.js';
import type { NotificationPayload } from '@pulse/shared';
import { postNotification } from './http.js';

/**
 * Webhook notification provider.
 *
 * Sends JSON payloads to arbitrary HTTP endpoints (SSRF-protected).
 */
export class WebhookProvider implements INotificationProvider {
  readonly name = 'webhook';

  async send(config: Record<string, unknown>, payload: NotificationPayload): Promise<boolean> {
    const url = config['url'] as string;
    if (!url) return false;
    const headers = (config['headers'] as Record<string, string> | undefined) ?? {};
    const res = await postNotification(url, JSON.stringify(payload), { 'Content-Type': 'application/json', ...headers });
    return res.ok;
  }

  async test(config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    const url = config['url'] as string;
    if (!url) return { success: false, message: 'URL is required' };
    const headers = (config['headers'] as Record<string, string> | undefined) ?? {};
    const res = await postNotification(
      url,
      JSON.stringify({ test: true, message: 'Helio test notification', timestamp: new Date().toISOString() }),
      { 'Content-Type': 'application/json', ...headers },
    );
    return { success: res.ok, message: res.message };
  }
}
