import type { INotificationProvider } from './INotificationProvider.js';
import type { NotificationPayload } from '@pulse/shared';
import { escapeHtml, formatDuration, postNotification } from './http.js';

const STATUS_EMOJI: Record<string, string> = {
  UP: '✅', DOWN: '🔴', DEGRADED: '⚠️', PENDING: '⏳', PAUSED: '⏸️',
};

export class TelegramProvider implements INotificationProvider {
  readonly name = 'telegram';

  private apiUrl(botToken: string): string {
    return `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`;
  }

  private formatMessage(payload: NotificationPayload): string {
    const emoji = STATUS_EMOJI[payload.status] || '❓';
    const lines = [`${emoji} <b>${escapeHtml(payload.monitorName)}</b> — ${payload.status}`];
    if (payload.previousStatus) {
      const dur = formatDuration(payload.previousStatusDurationMs);
      lines.push(`${payload.previousStatus} → ${payload.status}${dur ? ` (vorher ${dur})` : ''}`);
    }
    if (payload.latencyMs !== undefined) lines.push(`Latenz: ${payload.latencyMs} ms`);
    if (payload.errorMessage) lines.push(`Meldung: ${escapeHtml(payload.errorMessage)}`);
    lines.push(`Zeit: ${payload.timestamp}`);
    return lines.join('\n');
  }

  private async sendText(config: Record<string, unknown>, text: string) {
    const botToken = config['botToken'] as string;
    const chatId = config['chatId'] as string;
    return postNotification(
      this.apiUrl(botToken),
      JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      { 'Content-Type': 'application/json' },
      { checkSsrf: false },
    );
  }

  async send(config: Record<string, unknown>, payload: NotificationPayload): Promise<boolean> {
    if (!config['botToken'] || !config['chatId']) return false;
    return (await this.sendText(config, this.formatMessage(payload))).ok;
  }

  async test(config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    if (!config['botToken']) return { success: false, message: 'Bot token is required' };
    if (!config['chatId']) return { success: false, message: 'Chat ID is required' };
    const res = await this.sendText(config, '🟢 <b>Helio</b> — Test-Benachrichtigung\nDein Telegram-Provider funktioniert!');
    return { success: res.ok, message: res.message };
  }
}
