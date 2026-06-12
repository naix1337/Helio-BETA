import type { INotificationProvider } from './INotificationProvider.js';
import type { NotificationPayload } from '@pulse/shared';
import { config as appConfig } from '../config.js';
import { isSafeUrl } from '../utils/urlSafety.js';

export class NtfyProvider implements INotificationProvider {
  readonly name = 'ntfy';

  private getUrl(topic: string, serverUrl?: string): string {
    const base = serverUrl || appConfig.ntfyDefaultServer;
    return `${base.replace(/\/$/, '')}/${topic}`;
  }

  private makePayload(payload: NotificationPayload) {
    const tags: Record<string, string> = {
      UP: 'green_circle',
      DOWN: 'red_circle',
      DEGRADED: 'yellow_circle',
      PENDING: 'large_blue_circle',
      PAUSED: 'pause_button',
    };

    return {
      topic: '', // filled in send()
      title: `${payload.monitorName} — ${payload.status}`,
      message: payload.errorMessage || `Status changed to ${payload.status}`,
      tags: [tags[payload.status] || 'question'],
      priority: payload.status === 'DOWN' ? 4 : payload.status === 'DEGRADED' ? 3 : 2,
      ...(payload.latencyMs !== undefined ? { latency: `${payload.latencyMs}ms` } : {}),
    };
  }

  async send(config: Record<string, unknown>, payload: NotificationPayload): Promise<boolean> {
    const topic = config['topic'] as string;
    const serverUrl = config['serverUrl'] as string | undefined;
    if (!topic) return false;

    const url = this.getUrl(topic, serverUrl);
    const check = await isSafeUrl(url);
    if (!check.safe) {
      console.warn(`[ntfy] Blocked unsafe URL: ${check.reason}`);
      return false;
    }

    try {
      const notification = this.makePayload(payload);
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(notification),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async test(config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    const topic = config['topic'] as string;
    if (!topic) return { success: false, message: 'Topic is required' };

    const serverUrl = config['serverUrl'] as string | undefined;
    const url = this.getUrl(topic, serverUrl);
    const check = await isSafeUrl(url);
    if (!check.safe) return { success: false, message: `Blocked unsafe URL: ${check.reason}` };

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
          title: '✅ Helio — Test',
          message: 'Dein ntfy-Provider funktioniert!',
          tags: ['rocket'],
          priority: 2,
        }),
      });
      return { success: response.ok, message: `HTTP ${response.status}` };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Request failed' };
    }
  }
}
