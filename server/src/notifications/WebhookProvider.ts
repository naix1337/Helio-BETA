import type { INotificationProvider } from './INotificationProvider.js';
import type { NotificationPayload } from '@pulse/shared';
import { isSafeUrl } from '../utils/urlSafety.js';

/**
 * Webhook notification provider.
 *
 * Sends JSON payloads to arbitrary HTTP endpoints.
 * Includes SSRF protection — URLs pointing to private / internal
 * IP ranges are blocked.
 */
export class WebhookProvider implements INotificationProvider {
  readonly name = 'webhook';

  async send(config: Record<string, unknown>, payload: NotificationPayload): Promise<boolean> {
    const url = config['url'] as string;
    if (!url) return false;

    // SSRF protection: block internal IPs
    const check = await isSafeUrl(url);
    if (!check.safe) {
      console.warn(`[webhook] Blocked unsafe URL: ${check.reason}`);
      return false;
    }

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

    // Also validate test URLs for safety
    const check = await isSafeUrl(url);
    if (!check.safe) {
      return { success: false, message: `Blocked unsafe URL: ${check.reason}` };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true, message: 'Helio test notification' }),
      });
      return { success: response.ok, message: `HTTP ${response.status}` };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Request failed' };
    }
  }
}
