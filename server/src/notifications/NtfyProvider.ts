import type { INotificationProvider } from './INotificationProvider.js';
import type { NotificationPayload } from '@pulse/shared';
import { config as appConfig } from '../config.js';
import { formatDuration, postNotification } from './http.js';

const TAGS: Record<string, string> = {
  UP: 'white_check_mark', DOWN: 'rotating_light', DEGRADED: 'warning', PENDING: 'hourglass', PAUSED: 'pause_button',
};

/**
 * ntfy provider — uses the JSON publish API: POST <server>/ with {topic, ...}.
 * (Posting JSON to <server>/<topic> would send the raw JSON as message text.)
 */
export class NtfyProvider implements INotificationProvider {
  readonly name = 'ntfy';

  private serverUrl(config: Record<string, unknown>): string {
    const base = (config['serverUrl'] as string | undefined) || appConfig.ntfyDefaultServer;
    return base.replace(/\/+$/, '') + '/';
  }

  private headers(config: Record<string, unknown>): Record<string, string> {
    const token = config['accessToken'] as string | undefined;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async send(config: Record<string, unknown>, payload: NotificationPayload): Promise<boolean> {
    const topic = config['topic'] as string;
    if (!topic) return false;

    const dur = formatDuration(payload.previousStatusDurationMs);
    const lines = [
      payload.errorMessage || `Status: ${payload.status}`,
      payload.previousStatus ? `${payload.previousStatus} → ${payload.status}${dur ? ` (vorher ${dur})` : ''}` : '',
      payload.latencyMs !== undefined ? `Latenz: ${payload.latencyMs} ms` : '',
    ].filter(Boolean);

    const res = await postNotification(this.serverUrl(config), JSON.stringify({
      topic,
      title: `${payload.monitorName} — ${payload.status}`,
      message: lines.join('\n'),
      tags: [TAGS[payload.status] || 'question'],
      priority: payload.status === 'DOWN' ? 5 : payload.status === 'DEGRADED' ? 4 : 3,
    }), this.headers(config));
    return res.ok;
  }

  async test(config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    const topic = config['topic'] as string;
    if (!topic) return { success: false, message: 'Topic is required' };

    const res = await postNotification(this.serverUrl(config), JSON.stringify({
      topic,
      title: 'Helio — Test',
      message: 'Dein ntfy-Provider funktioniert!',
      tags: ['rocket'],
      priority: 3,
    }), this.headers(config));
    return { success: res.ok, message: res.message };
  }
}
