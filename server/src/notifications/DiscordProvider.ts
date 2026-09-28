import type { INotificationProvider } from './INotificationProvider.js';
import type { NotificationPayload } from '@pulse/shared';
import { formatDuration, postNotification } from './http.js';

const COLORS: Record<string, number> = {
  UP: 0x36d399, DOWN: 0xf76c6c, DEGRADED: 0xf7c948, PENDING: 0x9aa6b6, PAUSED: 0x677082,
};

export class DiscordProvider implements INotificationProvider {
  readonly name = 'discord';

  private makeEmbed(payload: NotificationPayload) {
    const fields: { name: string; value: string; inline?: boolean }[] = [];
    if (payload.latencyMs !== undefined) fields.push({ name: 'Latenz', value: `${payload.latencyMs} ms`, inline: true });
    if (payload.previousStatus) {
      const dur = formatDuration(payload.previousStatusDurationMs);
      fields.push({ name: 'Vorheriger Status', value: `${payload.previousStatus}${dur ? ` (${dur})` : ''}`, inline: true });
    }
    if (payload.errorMessage) fields.push({ name: 'Meldung', value: payload.errorMessage.slice(0, 1000) });

    return {
      username: 'Helio',
      embeds: [{
        title: `${payload.monitorName} — ${payload.status}`.slice(0, 250),
        color: COLORS[payload.status] ?? 0x9aa6b6,
        fields,
        timestamp: payload.timestamp,
        footer: { text: 'Helio Monitoring' },
      }],
    };
  }

  async send(config: Record<string, unknown>, payload: NotificationPayload): Promise<boolean> {
    const webhookUrl = config['webhookUrl'] as string;
    if (!webhookUrl) return false;
    const res = await postNotification(webhookUrl, JSON.stringify(this.makeEmbed(payload)), { 'Content-Type': 'application/json' });
    return res.ok;
  }

  async test(config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    const webhookUrl = config['webhookUrl'] as string;
    if (!webhookUrl) return { success: false, message: 'Webhook URL is required' };
    const res = await postNotification(webhookUrl, JSON.stringify({
      username: 'Helio',
      embeds: [{
        title: '✅ Helio — Test-Benachrichtigung',
        description: 'Dein Discord-Provider funktioniert!',
        color: 0x36d399,
        footer: { text: 'Helio Monitoring' },
      }],
    }), { 'Content-Type': 'application/json' });
    return { success: res.ok, message: res.message };
  }
}
