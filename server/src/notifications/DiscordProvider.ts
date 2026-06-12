import type { INotificationProvider } from './INotificationProvider.js';
import type { NotificationPayload } from '@pulse/shared';
import { isSafeUrl } from '../utils/urlSafety.js';

export class DiscordProvider implements INotificationProvider {
  readonly name = 'discord';

  private makeEmbed(payload: NotificationPayload) {
    const colorMap: Record<string, number> = {
      UP: 0x36d399,
      DOWN: 0xf76c6c,
      DEGRADED: 0xf7c948,
      PENDING: 0x9aa6b6,
      PAUSED: 0x677082,
    };

    const fields = [];
    if (payload.latencyMs !== undefined) {
      fields.push({ name: 'Latenz', value: `${payload.latencyMs} ms`, inline: true });
    }
    if (payload.monitorId) {
      fields.push({ name: 'Monitor ID', value: `\`${payload.monitorId}\``, inline: true });
    }
    if (payload.previousStatus) {
      fields.push({ name: 'Vorheriger Status', value: payload.previousStatus, inline: true });
    }
    if (payload.errorMessage) {
      fields.push({ name: 'Fehler', value: payload.errorMessage });
    }

    return {
      embeds: [{
        title: `${payload.monitorName} — ${payload.status}`,
        color: colorMap[payload.status] || 0x9aa6b6,
        fields,
        timestamp: payload.timestamp,
        footer: { text: 'Helio Monitoring' },
      }],
    };
  }

  async send(config: Record<string, unknown>, payload: NotificationPayload): Promise<boolean> {
    const webhookUrl = config['webhookUrl'] as string;
    if (!webhookUrl) return false;

    const check = await isSafeUrl(webhookUrl);
    if (!check.safe) {
      console.warn(`[discord] Blocked unsafe URL: ${check.reason}`);
      return false;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.makeEmbed(payload)),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async test(config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    const webhookUrl = config['webhookUrl'] as string;
    if (!webhookUrl) return { success: false, message: 'Webhook URL is required' };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: '✅ Helio — Test-Benachrichtigung',
            description: 'Dein Discord-Provider funktioniert!',
            color: 0x36d399,
            footer: { text: 'Helio Monitoring' },
          }],
        }),
      });
      return { success: response.ok, message: `HTTP ${response.status}` };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Request failed' };
    }
  }
}
