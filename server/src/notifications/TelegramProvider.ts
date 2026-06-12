import type { INotificationProvider } from './INotificationProvider.js';
import type { NotificationPayload } from '@pulse/shared';

export class TelegramProvider implements INotificationProvider {
  readonly name = 'telegram';

  private apiUrl(botToken: string): string {
    return `https://api.telegram.org/bot${botToken}/sendMessage`;
  }

  private formatMessage(payload: NotificationPayload): string {
    const statusEmoji: Record<string, string> = {
      UP: '✅',
      DOWN: '🔴',
      DEGRADED: '⚠️',
      PENDING: '⏳',
      PAUSED: '⏸️',
    };

    const emoji = statusEmoji[payload.status] || '❓';
    const lines = [
      `${emoji} *${payload.monitorName}* — ${payload.status}`,
    ];
    if (payload.latencyMs !== undefined) lines.push(`Latency: ${payload.latencyMs}ms`);
    if (payload.errorMessage) lines.push(`Message: ${payload.errorMessage}`);
    if (payload.previousStatus) lines.push(`Previous: ${payload.previousStatus} → ${payload.status}`);
    lines.push(`Time: ${payload.timestamp}`);

    return lines.join('\n');
  }

  async send(config: Record<string, unknown>, payload: NotificationPayload): Promise<boolean> {
    const botToken = config['botToken'] as string;
    const chatId = config['chatId'] as string;

    if (!botToken || !chatId) return false;

    try {
      const response = await fetch(this.apiUrl(botToken), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: this.formatMessage(payload),
          parse_mode: 'Markdown',
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async test(config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    const botToken = config['botToken'] as string;
    const chatId = config['chatId'] as string;

    if (!botToken) return { success: false, message: 'Bot token is required' };
    if (!chatId) return { success: false, message: 'Chat ID is required' };

    try {
      const response = await fetch(this.apiUrl(botToken), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '🟢 *Helio* — Test-Benachrichtigung\nDein Telegram-Provider funktioniert!',
          parse_mode: 'Markdown',
        }),
      });
      const data = await response.json() as { ok: boolean; description?: string };
      return { success: data.ok, message: data.description || 'OK' };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Request failed' };
    }
  }
}
