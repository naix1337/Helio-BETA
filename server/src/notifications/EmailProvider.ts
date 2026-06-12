import { createTransport } from 'nodemailer';
import type { INotificationProvider } from './INotificationProvider.js';
import type { NotificationPayload } from '@pulse/shared';

export class EmailProvider implements INotificationProvider {
  readonly name = 'email';

  private getTransport(config: Record<string, unknown>) {
    return createTransport({
      host: config['smtpHost'] as string,
      port: (config['smtpPort'] as number) || 587,
      secure: (config['smtpPort'] as number) === 465,
      auth: {
        user: config['smtpUser'] as string,
        pass: config['smtpPass'] as string,
      },
    });
  }

  async send(config: Record<string, unknown>, payload: NotificationPayload): Promise<boolean> {
    const from = config['fromEmail'] as string;
    const to = config['toEmail'] as string;
    if (!from || !to) return false;

    try {
      const transport = this.getTransport(config);
      await transport.sendMail({
        from,
        to,
        subject: `[Helio] ${payload.monitorName} — ${payload.status}`,
        text: [
          `Monitor: ${payload.monitorName}`,
          `Status: ${payload.status}`,
          payload.latencyMs !== undefined ? `Latenz: ${payload.latencyMs}ms` : '',
          payload.errorMessage ? `Fehler: ${payload.errorMessage}` : '',
          payload.previousStatus ? `Vorheriger Status: ${payload.previousStatus}` : '',
          `Zeit: ${payload.timestamp}`,
        ].filter(Boolean).join('\n'),
        html: `
          <h2>${payload.monitorName} — <strong>${payload.status}</strong></h2>
          <table>
            ${payload.latencyMs !== undefined ? `<tr><td>Latenz:</td><td>${payload.latencyMs}ms</td></tr>` : ''}
            ${payload.errorMessage ? `<tr><td>Fehler:</td><td>${payload.errorMessage}</td></tr>` : ''}
            ${payload.previousStatus ? `<tr><td>Vorheriger Status:</td><td>${payload.previousStatus}</td></tr>` : ''}
            <tr><td>Zeit:</td><td>${payload.timestamp}</td></tr>
          </table>
        `,
      });
      transport.close();
      return true;
    } catch {
      return false;
    }
  }

  async test(config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    const required = ['smtpHost', 'smtpUser', 'smtpPass', 'fromEmail', 'toEmail'];
    for (const field of required) {
      if (!config[field]) return { success: false, message: `${field} is required` };
    }

    try {
      const transport = this.getTransport(config);
      await transport.sendMail({
        from: config['fromEmail'] as string,
        to: config['toEmail'] as string,
        subject: '[Helio] Test-Benachrichtigung',
        text: 'Dein E-Mail-Provider funktioniert!',
      });
      transport.close();
      return { success: true, message: 'Test email sent' };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Failed to send email' };
    }
  }
}
