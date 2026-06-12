import type { INotificationProvider } from './INotificationProvider.js';
import type { NotificationPayload } from '@pulse/shared';

export class WebhookProvider implements INotificationProvider {
  readonly name = 'webhook';

  async send(config: Record<string, unknown>, payload: NotificationPayload): Promise<boolean> {
    const url = config['url'] as string;
    const headers = config['headers'] as Record<string, string> | undefined;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(headers ?? {}),
        },
        body: JSON.stringify(payload),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async test(config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    const url = config['url'] as string;
    if (!url) return { success: false, message: 'URL is required' };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true, message: 'Pulse test notification' }),
      });
      return { success: response.ok, message: `HTTP ${response.status}` };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Request failed' };
    }
  }
}
